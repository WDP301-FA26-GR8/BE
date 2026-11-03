import { Injectable } from '@nestjs/common';
import { fiscalYearOf } from '../../../core/fiscal-year';
import type { Money } from '../../../core/money/money';
import { MoneyMalformedError } from '../../../core/money/money.errors';
import { TransactionRunner, type DbTx } from '../../../infrastructure/database/transaction-runner';
import type { AuthenticatedPrincipal } from '../../../infrastructure/security/tokens/access-token-verifier.port';
import { AuditApi } from '../../audit/public/audit.api';
import { CatalogApi } from '../../catalog/public/catalog.api';
import { FinanceApi } from '../../finance/public/finance.api';
import { OrganizationHistoryApi } from '../../organization/public/organization-history.api';
import { budgetAuditEvent, BudgetSupportService } from '../budget/budget-support.service';
import { invoiceCostOf, splitAcrossLines } from './invoice-cost.policy';
import type { RecordInvoiceInput } from './invoice.dto';
import {
  InvoiceLinesDoNotAddUpError,
  InvoiceLineVendorMismatchError,
  InvoiceRateMissingError,
  InvoiceVendorUnusableError,
} from './invoice.errors';
import { InvoiceMatchService } from './invoice-match.service';
import { InvoiceRepo } from './invoice.repo';
import { InvoiceReferenceInvalidError } from './invoice-record.errors';
import type { InvoiceMoney, NewInvoiceLine, NewInvoiceTaxLine, ParsedInvoiceLine } from './invoice.types';

/**
 * Records the document and audit atomically. Lock order: organizations FOR SHARE, acquired by snapshotMoney and held until commit.
 * The invoice day fixes every rate (D2); no tax profile estimate creates or changes a document's tax lines.
 */
@Injectable()
export class InvoiceService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly repo: InvoiceRepo,
    private readonly finance: FinanceApi,
    private readonly catalog: CatalogApi,
    private readonly history: OrganizationHistoryApi,
    private readonly support: BudgetSupportService,
    private readonly audit: AuditApi,
    private readonly matchService: InvoiceMatchService,
  ) {}

  async record(actor: AuthenticatedPrincipal, input: RecordInvoiceInput): Promise<{ id: string }> {
    this.support.requireFinance(actor);
    const startMonth = await this.support.fiscalYearStartMonth();
    return this.transactions.run(async (tx) => {
      const owners = await this.owners(tx, input);
      const money = await this.finance.parseMoney(input.amount, tx);
      if (money.amountMinor < 0n || input.lines.length === 0) throw new MoneyMalformedError();
      const parsed = await this.parseLines(tx, input);
      if (parsed.reduce((sum, line) => sum + line.amountMinor, 0n) !== money.amountMinor) {
        throw new InvoiceLinesDoNotAddUpError();
      }
      const header = await this.snapshot(tx, money, input.invoiceDate);
      const taxes = await this.taxLines(tx, input);
      const lines = await this.allocate(tx, input, parsed, header, taxes, owners, startMonth);
      const organizationId = await this.support.organizationId(tx);
      const invoice = await this.repo.insert(tx, {
        ...input,
        ...header,
        organizationId,
        recordedByEmployeeId: actor.employeeId,
      });
      await this.repo.insertLines(tx, invoice.id, lines);
      await this.repo.insertTaxLines(tx, invoice.id, taxes);

      const linesToMatch = input.lines
        .map((l, index) => (l.commitmentId ? { position: index + 1, commitmentId: l.commitmentId } : null))
        .filter((item): item is { position: number; commitmentId: string } => item !== null);

      await this.matchService.matchDuringRecord(
        tx,
        actor,
        { ...invoice, organizationId, vendorId: input.vendorId, kind: 'INVOICE' },
        linesToMatch,
      );

      await this.audit.record(
        tx,
        budgetAuditEvent(actor, organizationId, 'INVOICE.RECORDED', 'INVOICE', invoice.id, {
          vendorId: input.vendorId,
          invoiceNumber: input.invoiceNumber,
          invoiceDate: input.invoiceDate,
          amountMinor: money.amountMinor.toString(),
          amountCurrency: money.currency,
          amountReportingMinor: header.snapshot.reportingAmountMinor.toString(),
          lineCount: lines.length,
          taxLineCount: taxes.length,
        }),
      );
      return invoice;
    });
  }

  private async owners(tx: DbTx, input: RecordInvoiceInput): Promise<Map<string, string>> {
    if (!(await this.catalog.isVendorUsable(input.vendorId, tx))) throw new InvoiceVendorUnusableError();
    const ids = input.lines.flatMap((line) => (line.subscriptionId ? [line.subscriptionId] : []));
    const summaries = await this.catalog.getSubscriptionSummaries(ids, tx);
    const found = new Map(summaries.map((item) => [item.id, item]));
    for (const id of ids) {
      const subscription = found.get(id);
      if (!subscription) throw new InvoiceReferenceInvalidError('The invoice line subscription does not exist.');
      if (subscription.vendorId !== input.vendorId) throw new InvoiceLineVendorMismatchError();
    }
    return new Map(summaries.map((item) => [item.id, item.ownerDepartmentId]));
  }

  private async parseLines(tx: DbTx, input: RecordInvoiceInput): Promise<ParsedInvoiceLine[]> {
    const lines: ParsedInvoiceLine[] = [];
    for (const [index, line] of input.lines.entries()) {
      const money = await this.finance.parseMoney({ amount: line.amount, currency: input.amount.currency }, tx);
      const unitPrice =
        line.unitPrice === undefined
          ? null
          : await this.finance.parseMoney(
              {
                amount: line.unitPrice,
                currency: input.amount.currency,
              },
              tx,
            );
      lines.push({
        subscriptionId: line.subscriptionId,
        outOfCatalog: line.outOfCatalog,
        description: line.description,
        billedQuantity: line.billedQuantity,
        servicePeriodStart: line.servicePeriodStart,
        servicePeriodEnd: line.servicePeriodEnd,
        position: index + 1,
        amountMinor: money.amountMinor,
        unitPriceMinor: unitPrice?.amountMinor ?? null,
      });
    }
    return lines;
  }

  private async snapshot(tx: DbTx, money: Money, date: string): Promise<InvoiceMoney> {
    const result = await this.finance.snapshotMoney(tx, money, date);
    if (result.status === 'MISSING_RATE') throw new InvoiceRateMissingError();
    return { money, snapshot: result.snapshot };
  }

  private async taxLines(tx: DbTx, input: RecordInvoiceInput): Promise<NewInvoiceTaxLine[]> {
    const taxes: NewInvoiceTaxLine[] = [];
    for (const [index, { amount, ...line }] of input.taxLines.entries()) {
      const money = await this.finance.parseMoney(amount, tx);
      if (money.amountMinor < 0n) throw new MoneyMalformedError();
      taxes.push({ ...line, ...(await this.snapshot(tx, money, input.invoiceDate)), position: index + 1 });
    }
    return taxes;
  }

  private async allocate(
    tx: DbTx,
    input: RecordInvoiceInput,
    lines: ParsedInvoiceLine[],
    header: InvoiceMoney,
    taxes: NewInvoiceTaxLine[],
    owners: Map<string, string>,
    startMonth: number,
  ): Promise<NewInvoiceLine[]> {
    const [first, ...rest] = lines;
    if (!first) throw new MoneyMalformedError();
    const weights: [ParsedInvoiceLine, ...ParsedInvoiceLine[]] = [first, ...rest];
    const cost = invoiceCostOf({
      kind: 'INVOICE',
      amountReportingMinor: header.snapshot.reportingAmountMinor,
      taxLines: taxes.map((line) => ({
        amountReportingMinor: line.snapshot.reportingAmountMinor,
        deductible: line.deductible,
      })),
      markedFeeReportingMinor: 0n,
    });
    const amounts = splitAcrossLines(header.snapshot.reportingAmountMinor, weights);
    const costs = splitAcrossLines(cost.effectiveCostMinor, weights);
    const vat = splitAcrossLines(cost.deductibleVatMinor, weights);
    const centers = new Map<string, string | null>();
    for (const departmentId of new Set(owners.values())) {
      centers.set(departmentId, await this.history.getCostCenterOfDepartmentOn(departmentId, input.invoiceDate, tx));
    }
    return lines.map((line, index) => ({
      ...line,
      amountReportingMinor: amounts[index].amountMinor,
      costReportingMinor: costs[index].amountMinor,
      deductibleVatReportingMinor: vat[index].amountMinor,
      fiscalYear: fiscalYearOf(input.invoiceDate, startMonth),
      costCenterId: line.subscriptionId ? (centers.get(owners.get(line.subscriptionId) ?? '') ?? null) : null,
    }));
  }
}
