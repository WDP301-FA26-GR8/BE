import { Injectable } from '@nestjs/common';
import { Page, pageOf } from '../../../core/application/pagination';
import type { AuditValue } from '../../audit/public/audit.types';
import { AuditApi } from '../../audit/public/audit.api';
import { TransactionRunner, type DbTx } from '../../../infrastructure/database/transaction-runner';
import type { AuthenticatedPrincipal } from '../../../infrastructure/security/tokens/access-token-verifier.port';
import { budgetAuditEvent, BudgetSupportService } from '../budget/budget-support.service';
import { BudgetCommitmentNotFoundError } from '../budget/budget.errors';
import { BudgetYearLockRepo } from '../budget/budget-year-lock.repo';
import { CommitmentRepo } from '../budget/commitment.repo';
import { CommitmentVendorHook } from '../public/budgets.extension-points';
import { matchInvoiceLine } from './invoice-match.policy';
import { InvoiceLineNotFoundError, InvoiceMatchRefusedError, InvoiceNotFoundError } from './invoice.errors';
import { InvoiceRepo } from './invoice.repo';

export interface CommitmentMatchResult {
  commitmentId: string;
  invoiceId: string;
  invoiceLineId: string;
  position: number;
  matchedMinor: bigint;
  heldMinor: bigint;
  expensed: boolean;
}

export interface CommitmentMatchRecord {
  id: string;
  commitmentId: string;
  invoiceLineId: string;
  position: number;
  amountMinor: bigint;
  recordedAt: Date;
  recordedByEmployeeId: string;
}

/**
 * Matches an invoice line to a budget commitment (US-06-06, US-12-02, F-07, F-08, F-09, F-10, F-21, F-22).
 *
 * Strict locking order within transaction:
 * 1. Invoice row: locked first via `InvoiceRepo.lockInvoice` (SELECT ... FOR UPDATE).
 * 2. Non-locking read of commitment Cost Center and year (immutable by trigger guard), then budget year lock
 *    via `BudgetYearLockRepo.lock`.
 * 3. Commitment row: locked via `CommitmentRepo.lockById` (SELECT ... FOR UPDATE).
 *
 * Followed by: vendor hook -> pure match policy -> realize commitment -> set line Cost Center if null -> audit event.
 * Reconcilation status is untouched (F-08). Tax edits after match do not alter realized amount (F-07).
 */
@Injectable()
export class InvoiceMatchService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly invoiceRepo: InvoiceRepo,
    private readonly commitments: CommitmentRepo,
    private readonly yearLock: BudgetYearLockRepo,
    private readonly support: BudgetSupportService,
    private readonly audit: AuditApi,
    private readonly vendorHook: CommitmentVendorHook,
  ) {}

  /**
   * Matches an invoice line to a commitment in a dedicated transaction.
   * Only FINANCE role may perform invoice matching.
   */
  async match(
    actor: AuthenticatedPrincipal,
    invoiceId: string,
    position: number,
    commitmentId: string,
  ): Promise<CommitmentMatchResult> {
    this.support.requireFinance(actor);

    return this.transactions.run(async (tx) => {
      // 1. Lock invoice row
      const invoice = await this.invoiceRepo.lockInvoice(tx, invoiceId);
      if (!invoice) throw new InvoiceNotFoundError();

      const line = await this.invoiceRepo.findLine(tx, invoiceId, position);
      if (!line) throw new InvoiceLineNotFoundError();

      return this.executeMatch(tx, actor, invoice, line, commitmentId);
    });
  }

  /**
   * Executes matching logic within an existing transaction where the invoice row has already been locked.
   * Useful when matching immediately during invoice recording (F-24) or in `match`.
   */
  async executeMatch(
    tx: DbTx,
    actor: AuthenticatedPrincipal,
    invoice: { id: string; organizationId: string; vendorId: string; kind: string },
    line: {
      id: string;
      position: number;
      costCenterId: string | null;
      fiscalYear: number;
      costReportingMinor: bigint;
      realizationId: string | null;
    },
    commitmentId: string,
    now = new Date(),
  ): Promise<CommitmentMatchResult> {
    const scope = await this.commitments.findScope(tx, commitmentId);
    if (!scope) throw new BudgetCommitmentNotFoundError();
    await this.yearLock.lock(tx, scope.costCenterId, [scope.year]);

    const commitment = await this.commitments.lockById(tx, commitmentId);
    if (!commitment) throw new BudgetCommitmentNotFoundError();

    const vendorId = await this.vendorHook.get().getVendorId(commitment.requestId, tx);
    const decision = matchInvoiceLine({
      invoice: { kind: invoice.kind, vendorId: invoice.vendorId },
      line: {
        costReportingMinor: line.costReportingMinor,
        fiscalYear: line.fiscalYear,
        alreadyMatched: line.realizationId !== null,
      },
      commitment,
      commitmentVendorId: vendorId,
    });
    if (!decision.ok) throw new InvoiceMatchRefusedError(decision.refusal);

    return this.applyRealization(tx, actor, invoice, line, commitment, decision.matchedMinor, now);
  }

  /** Matches multiple lines during invoice recording in a single transaction (F-24). */
  async matchDuringRecord(
    tx: DbTx,
    actor: AuthenticatedPrincipal,
    invoice: { id: string; organizationId: string; vendorId: string; kind: string },
    linesToMatch: readonly { position: number; commitmentId: string }[],
  ): Promise<void> {
    if (linesToMatch.length === 0) return;

    const grouped = new Map<string, Set<number>>();
    for (const item of linesToMatch) {
      const scope = await this.commitments.findScope(tx, item.commitmentId);
      if (!scope) throw new BudgetCommitmentNotFoundError();
      const years = grouped.get(scope.costCenterId) ?? new Set<number>();
      years.add(scope.year);
      grouped.set(scope.costCenterId, years);
    }
    const sortedCostCenters = [...grouped.keys()].sort((a, b) => a.localeCompare(b));
    for (const ccId of sortedCostCenters) {
      const sortedYears = [...(grouped.get(ccId) as Set<number>)].sort((a, b) => a - b);
      await this.yearLock.lock(tx, ccId, sortedYears);
    }

    const savedLines = await this.invoiceRepo.findLines(tx, invoice.id);
    const lineByPosition = new Map(savedLines.map((l) => [l.position, l]));

    for (const item of linesToMatch) {
      const lineRow = lineByPosition.get(item.position);
      if (!lineRow) throw new InvoiceLineNotFoundError();
      await this.executeMatch(tx, actor, invoice, lineRow, item.commitmentId);
    }
  }

  private async applyRealization(
    tx: DbTx,
    actor: AuthenticatedPrincipal,
    invoice: { id: string; organizationId: string },
    line: { id: string; position: number; costCenterId: string | null },
    commitment: {
      id: string;
      requestId: string;
      year: number;
      costCenterId: string;
      amountMinor: bigint;
      releasedMinor: bigint;
      realizedMinor: bigint;
      state: string;
    },
    matchedMinor: bigint,
    now: Date,
  ): Promise<CommitmentMatchResult> {
    const realization = await this.commitments.realize(tx, commitment, {
      takeMinor: matchedMinor,
      invoiceLineId: line.id,
      employeeId: actor.employeeId,
      now,
    });

    if (line.costCenterId === null) {
      await this.invoiceRepo.setLineCostCenterIfNull(tx, line.id, commitment.costCenterId);
    }

    const afterPayload: Record<string, AuditValue> = {
      requestId: commitment.requestId,
      year: commitment.year,
      invoiceId: invoice.id,
      position: line.position,
      amountMinor: matchedMinor.toString(),
      heldMinor: realization.heldMinor.toString(),
      costCenterId: commitment.costCenterId,
    };
    if (line.costCenterId !== null && line.costCenterId !== commitment.costCenterId) {
      afterPayload.lineCostCenterId = line.costCenterId;
    }

    await this.audit.record(
      tx,
      budgetAuditEvent(
        actor,
        invoice.organizationId,
        'BUDGET_COMMITMENT.REALIZED',
        'BUDGET_COMMITMENT',
        commitment.id,
        afterPayload,
      ),
    );

    return {
      commitmentId: commitment.id,
      invoiceId: invoice.id,
      invoiceLineId: line.id,
      position: line.position,
      matchedMinor,
      heldMinor: realization.heldMinor,
      expensed: realization.expensed,
    };
  }

  /**
   * Lists commitment matches for an invoice with pagination (`FINANCE`).
   */
  async listMatches(
    actor: AuthenticatedPrincipal,
    invoiceId: string,
    query: { page: number; pageSize: number },
  ): Promise<Page<CommitmentMatchRecord>> {
    this.support.requireFinance(actor);
    const invoice = await this.invoiceRepo.findInvoice(invoiceId);
    if (!invoice) throw new InvoiceNotFoundError();

    const skip = (query.page - 1) * query.pageSize;
    const { items, total } = await this.invoiceRepo.findMatches(invoiceId, { skip, take: query.pageSize });

    return pageOf(items, total, query.page, query.pageSize);
  }
}
