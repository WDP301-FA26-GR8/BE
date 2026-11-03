import { Injectable } from '@nestjs/common';
import { Page, pageOf } from '../../../core/application/pagination';
import type { AuthenticatedPrincipal } from '../../../infrastructure/security/tokens/access-token-verifier.port';
import { BudgetNotFinanceError } from '../budget/budget.errors';
import { BudgetSupportService, type MoneyView } from '../budget/budget-support.service';
import { invoiceCostOf } from './invoice-cost.policy';
import type { ListInvoicesQueryDto, ListInvoiceLinesQueryDto, ListInvoiceTaxLinesQueryDto } from './invoice.dto';
import { InvoiceNotFoundError } from './invoice.errors';
import {
  toInvoiceDetailWire,
  toInvoiceLineWire,
  toInvoiceSummaryWire,
  toInvoiceTaxLineWire,
  type InvoiceDetailWire,
  type InvoiceLineWire,
  type InvoiceSummaryWire,
  type InvoiceTaxLineWire,
} from './invoice.mapper';
import { InvoiceRepo } from './invoice.repo';

/**
 * Read-only queries for invoices, lines, and tax lines (US-12-10 AC-11, API-LIST-DETAIL.1).
 * All collections are paginated and read in RepeatableRead isolation.
 */
@Injectable()
export class InvoiceQueryService {
  constructor(
    private readonly repo: InvoiceRepo,
    private readonly support: BudgetSupportService,
  ) {}

  /** Lists invoices with summary fields and pagination (FINANCE only). */
  async pageInvoices(actor: AuthenticatedPrincipal, query: ListInvoicesQueryDto): Promise<Page<InvoiceSummaryWire>> {
    this.support.requireFinance(actor);

    const reporting = await this.support.reportingCurrency();
    const formatReporting = await this.support.formatter(reporting);
    const skip = (query.page - 1) * query.pageSize;

    const { items, total } = await this.repo.pageInvoices({
      ...query,
      skip,
      take: query.pageSize,
    });

    const money = new Map<string, (minor: bigint) => MoneyView>();
    for (const code of new Set(items.map((r) => r.amountCurrency))) {
      money.set(code, await this.support.formatter(code));
    }

    const rows = items.map((r) => {
      const formatAmount = money.get(r.amountCurrency);
      if (!formatAmount) throw new Error(`Currency ${r.amountCurrency} not found`);
      return toInvoiceSummaryWire(r, formatAmount, formatReporting);
    });

    return pageOf(rows, total, query.page, query.pageSize);
  }

  /** Retrieves full invoice detail with effective cost and deductible VAT (FINANCE and IT_ADMIN). */
  async getInvoice(actor: AuthenticatedPrincipal, id: string): Promise<InvoiceDetailWire> {
    this.requireFinanceOrItAdmin(actor);

    const invoice = await this.repo.findInvoiceDetail(id);
    if (!invoice) throw new InvoiceNotFoundError();

    const reporting = await this.support.reportingCurrency();
    const formatReporting = await this.support.formatter(reporting);
    const formatAmount = await this.support.formatter(invoice.amountCurrency);

    const cost = invoiceCostOf({
      kind: invoice.kind,
      amountReportingMinor: invoice.amountReportingMinor,
      taxLines: invoice.taxLines.map((t) => ({
        amountReportingMinor: t.amountReportingMinor,
        deductible: t.deductible,
      })),
      markedFeeReportingMinor: 0n,
    });

    return toInvoiceDetailWire(invoice, cost, formatAmount, formatReporting);
  }

  /** Lists invoice lines with pagination (FINANCE and IT_ADMIN). */
  async pageLines(
    actor: AuthenticatedPrincipal,
    invoiceId: string,
    query: ListInvoiceLinesQueryDto,
  ): Promise<Page<InvoiceLineWire>> {
    this.requireFinanceOrItAdmin(actor);

    const invoice = await this.repo.findInvoice(invoiceId);
    if (!invoice) throw new InvoiceNotFoundError();

    const reporting = await this.support.reportingCurrency();
    const formatReporting = await this.support.formatter(reporting);
    const formatAmount = await this.support.formatter(invoice.amountCurrency);
    const skip = (query.page - 1) * query.pageSize;

    const { items, total } = await this.repo.pageInvoiceLines(invoiceId, skip, query.pageSize);
    const rows = items.map((line) => toInvoiceLineWire(line, formatAmount, formatReporting));

    return pageOf(rows, total, query.page, query.pageSize);
  }

  /** Lists invoice tax lines with pagination (FINANCE and IT_ADMIN, US-12-10 AC-11). */
  async pageTaxLines(
    actor: AuthenticatedPrincipal,
    invoiceId: string,
    query: ListInvoiceTaxLinesQueryDto,
  ): Promise<Page<InvoiceTaxLineWire>> {
    this.requireFinanceOrItAdmin(actor);

    const invoice = await this.repo.findInvoice(invoiceId);
    if (!invoice) throw new InvoiceNotFoundError();

    const reporting = await this.support.reportingCurrency();
    const formatReporting = await this.support.formatter(reporting);
    const skip = (query.page - 1) * query.pageSize;

    const { items, total } = await this.repo.pageInvoiceTaxLines(invoiceId, skip, query.pageSize);

    const money = new Map<string, (minor: bigint) => MoneyView>();
    for (const code of new Set(items.map((r) => r.amountCurrency))) {
      money.set(code, await this.support.formatter(code));
    }

    const rows = items.map((taxLine) => {
      const formatAmount = money.get(taxLine.amountCurrency);
      if (!formatAmount) throw new Error(`Currency ${taxLine.amountCurrency} not found`);
      return toInvoiceTaxLineWire(taxLine, formatAmount, formatReporting);
    });

    return pageOf(rows, total, query.page, query.pageSize);
  }

  private requireFinanceOrItAdmin(actor: AuthenticatedPrincipal): void {
    if (!actor.roles.some((role) => role === 'FINANCE' || role === 'IT_ADMIN')) {
      throw new BudgetNotFinanceError();
    }
  }
}
