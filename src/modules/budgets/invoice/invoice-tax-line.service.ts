import { Injectable } from '@nestjs/common';
import { fromDateColumn } from '../../../core/business-date';
import { MoneyMalformedError } from '../../../core/money/money.errors';
import type { Money } from '../../../core/money/money';
import { TransactionRunner, type DbTx } from '../../../infrastructure/database/transaction-runner';
import type { AuthenticatedPrincipal } from '../../../infrastructure/security/tokens/access-token-verifier.port';
import { AuditApi } from '../../audit/public/audit.api';
import { FinanceApi } from '../../finance/public/finance.api';
import type { ConversionSnapshot } from '../../finance/public/finance.types';
import { budgetAuditEvent, BudgetSupportService } from '../budget/budget-support.service';
import { invoiceCostOf, splitAcrossLines } from './invoice-cost.policy';
import type { UpdateInvoiceTaxLineInput } from './invoice.dto';
import { InvoiceNotFoundError, InvoiceRateMissingError } from './invoice.errors';
import { InvoiceRepo } from './invoice.repo';

export interface UpdatedInvoiceTaxLineWire {
  position: number;
  taxType: string;
  rateBp: number;
  amountMinor: string;
  amountCurrency: string;
  amountReportingMinor: string;
  payer: 'VENDOR_COLLECTS' | 'BUYER_REMITS';
  deductible: boolean;
  note: string | null;
}

interface ExistingTaxLine {
  position: number;
  taxType: string;
  rateBp: number;
  amountMinor: bigint;
  amountCurrency: string;
  amountReportingMinor: bigint;
  payer: 'VENDOR_COLLECTS' | 'BUYER_REMITS';
  deductible: boolean;
  note: string | null;
}

/**
 * Updates or creates an invoice tax line and recalculates cost/deductible VAT allocations across all lines (US-12-10 AC-3).
 * Lock order: invoice row FOR UPDATE first. Rate date uses invoice date (D2).
 */
@Injectable()
export class InvoiceTaxLineService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly repo: InvoiceRepo,
    private readonly finance: FinanceApi,
    private readonly support: BudgetSupportService,
    private readonly audit: AuditApi,
  ) {}

  async update(
    actor: AuthenticatedPrincipal,
    invoiceId: string,
    position: number,
    input: UpdateInvoiceTaxLineInput,
  ): Promise<UpdatedInvoiceTaxLineWire> {
    this.support.requireFinance(actor);

    return this.transactions.run(async (tx) => {
      const invoice = await this.repo.lockInvoice(tx, invoiceId);
      if (!invoice) throw new InvoiceNotFoundError();

      const oldTaxLine = await this.repo.findTaxLineFull(tx, invoiceId, position);
      const money = await this.finance.parseMoney(input.amount, tx);
      if (money.amountMinor < 0n) throw new MoneyMalformedError();

      const rateResult = await this.finance.snapshotMoney(tx, money, fromDateColumn(invoice.invoiceDate));
      if (rateResult.status === 'MISSING_RATE') throw new InvoiceRateMissingError();
      const snapshot = rateResult.snapshot;

      await this.repo.upsertTaxLine(tx, invoiceId, position, {
        taxType: input.taxType,
        rateBp: input.rateBp,
        payer: input.payer,
        deductible: input.deductible,
        note: input.note,
        money,
        snapshot,
        position,
      });

      await this.recalculateLines(tx, invoice);
      await this.recordAudit(tx, actor, invoice, {
        position,
        input,
        money,
        snapshot,
        oldTaxLine,
      });

      return {
        position,
        taxType: input.taxType,
        rateBp: input.rateBp,
        amountMinor: money.amountMinor.toString(),
        amountCurrency: money.currency,
        amountReportingMinor: snapshot.reportingAmountMinor.toString(),
        payer: input.payer,
        deductible: input.deductible,
        note: input.note ?? null,
      };
    });
  }

  private async recalculateLines(
    tx: DbTx,
    invoice: { id: string; kind: 'INVOICE' | 'CREDIT_NOTE'; amountReportingMinor: bigint },
  ): Promise<void> {
    const allTaxLines = await this.repo.findTaxLines(tx, invoice.id);
    const cost = invoiceCostOf({
      kind: invoice.kind,
      amountReportingMinor: invoice.amountReportingMinor,
      taxLines: allTaxLines.map((t) => ({ amountReportingMinor: t.amountReportingMinor, deductible: t.deductible })),
      markedFeeReportingMinor: 0n,
    });

    const lines = await this.repo.findLinesForCostRecalc(tx, invoice.id);
    if (lines.length === 0) return;

    const [first, ...rest] = lines;
    const weights: [typeof first, ...(typeof first)[]] = [first, ...rest];
    const costs = splitAcrossLines(cost.effectiveCostMinor, weights);
    const vats = splitAcrossLines(cost.deductibleVatMinor, weights);

    await this.repo.updateLineCosts(
      tx,
      lines.map((l, index) => ({
        id: l.id,
        costReportingMinor: costs[index].amountMinor,
        deductibleVatReportingMinor: vats[index].amountMinor,
      })),
    );
  }

  private async recordAudit(
    tx: DbTx,
    actor: AuthenticatedPrincipal,
    invoice: { id: string; organizationId: string },
    line: {
      position: number;
      input: UpdateInvoiceTaxLineInput;
      money: Money;
      snapshot: ConversionSnapshot;
      oldTaxLine: ExistingTaxLine | null;
    },
  ): Promise<void> {
    const before = line.oldTaxLine
      ? {
          position: line.oldTaxLine.position,
          taxType: line.oldTaxLine.taxType,
          rateBp: line.oldTaxLine.rateBp,
          amountMinor: line.oldTaxLine.amountMinor.toString(),
          amountCurrency: line.oldTaxLine.amountCurrency,
          amountReportingMinor: line.oldTaxLine.amountReportingMinor.toString(),
          payer: line.oldTaxLine.payer,
          deductible: line.oldTaxLine.deductible,
          note: line.oldTaxLine.note,
        }
      : null;

    const after = {
      position: line.position,
      taxType: line.input.taxType,
      rateBp: line.input.rateBp,
      amountMinor: line.money.amountMinor.toString(),
      amountCurrency: line.money.currency,
      amountReportingMinor: line.snapshot.reportingAmountMinor.toString(),
      payer: line.input.payer,
      deductible: line.input.deductible,
      note: line.input.note ?? null,
    };

    await this.audit.record(
      tx,
      budgetAuditEvent(actor, invoice.organizationId, 'INVOICE.TAX_LINE_CHANGED', 'INVOICE', invoice.id, after, before),
    );
  }
}
