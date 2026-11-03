import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { DbTx } from '../../../infrastructure/database/transaction-runner';
import type { CommitmentHoldInput, CommitmentReleaseReason, HeldCommitment } from '../public/budgets.types';
import { BudgetYearLockRepo } from './budget-year-lock.repo';
import type { CommitmentRow } from './commitment-release.policy';
import { InvoiceSpendRepo } from './invoice-spend.repo';
import { heldKey } from './commitment-key.policy';

export interface AttachedCommitment {
  id: string;
  requestId: string;
  amountMinor: bigint;
  currency: string;
}

/**
 * The commitments of the budget, as far as the decision of a version needs them: attaching the ones that wait for a budget
 * and adding up what is held. It is the only code that writes `budget_commitments`; the slices that create and release them
 * extend it.
 */
@Injectable()
export class CommitmentRepo {
  constructor(
    private readonly prisma: PrismaService,
    private readonly yearLock: BudgetYearLockRepo,
    private readonly invoiceSpend: InvoiceSpendRepo,
  ) {}

  /**
   * Attaches to `versionId` the commitments of the Cost Center and the year that wait for a budget (US-06-07 AC-3). Only
   * that Cost Center and that year: a commitment of another year is never attached by the budget of this one (AC-4).
   */
  async attachWaiting(
    tx: DbTx,
    input: { costCenterId: string; year: number; versionId: string; now: Date },
  ): Promise<AttachedCommitment[]> {
    const waiting = await tx.budgetCommitment.findMany({
      where: { costCenterId: input.costCenterId, year: input.year, state: 'HELD', attachedVersionId: null },
      select: { id: true, requestId: true, amountMinor: true, currency: true },
      orderBy: { createdAt: 'asc' },
    });
    if (waiting.length === 0) return [];

    await tx.budgetCommitment.updateMany({
      where: { id: { in: waiting.map((commitment) => commitment.id) } },
      data: { attachedVersionId: input.versionId, attachedAt: input.now, unattachedReason: null },
    });

    return waiting;
  }

  /**
   * Holds the amount of each year for the request, one commitment for each year (`INV-16`): attached to the current budget of
   * the year when there is one, and waiting for one with the reason *no budget* when there is not (`US-06-07` AC-1). The
   * database refuses a second commitment for the same request and year.
   *
   * The budget of each Cost Center and year is locked first, the earliest year first, after the row of the request the caller
   * holds: what the decision of a version attaches and what is held here never read the current budget at the same moment,
   * so a commitment never waits for a budget that was approved while it was being made.
   */
  async hold(tx: DbTx, input: CommitmentHoldInput): Promise<HeldCommitment[]> {
    await this.yearLock.lock(
      tx,
      input.costCenterId,
      input.items.map((item) => item.year),
    );
    const held: HeldCommitment[] = [];
    for (const item of input.items) {
      const current = await tx.budgetVersion.findFirst({
        where: { costCenterId: input.costCenterId, year: item.year, state: 'APPROVED' },
        select: { id: true },
      });
      const created = await tx.budgetCommitment.create({
        data: {
          organizationId: input.organizationId,
          requestId: input.requestId,
          costCenterId: input.costCenterId,
          year: item.year,
          amountMinor: item.amountMinor,
          currency: input.currency,
          state: 'HELD',
          attachedVersionId: current?.id ?? null,
          attachedAt: current ? input.now : null,
          unattachedReason: current ? null : 'NO_BUDGET',
          snapshotCheckId: input.snapshotCheckId,
        },
        select: { id: true },
      });
      held.push({
        id: created.id,
        year: item.year,
        amountMinor: item.amountMinor,
        attachedVersionId: current?.id ?? null,
      });
    }

    return held;
  }

  /** The commitments of the request, whatever became of them, the oldest year first. */
  async ofRequest(tx: DbTx, requestId: string): Promise<CommitmentOfRequest[]> {
    const rows = await tx.budgetCommitment.findMany({ where: { requestId }, orderBy: { year: 'asc' } });

    return rows.map((row) => ({
      id: row.id,
      year: row.year,
      amountMinor: row.amountMinor,
      releasedMinor: row.releasedMinor,
      realizedMinor: row.realizedMinor,
      state: row.state,
      organizationId: row.organizationId,
      costCenterId: row.costCenterId,
    }));
  }

  /**
   * The commitments of the request, oldest year first, with row-level locks for update (F-11).
   * Prevents race conditions with `realize` and other concurrent operations.
   */
  async lockOfRequest(tx: DbTx, requestId: string): Promise<CommitmentOfRequest[]> {
    const locked = await tx.$queryRaw<
      Array<{ id: string }>
    >`SELECT id FROM budget_commitments WHERE request_id = ${requestId}::uuid ORDER BY year ASC FOR UPDATE`;
    if (locked.length === 0) return [];

    const rows = await tx.budgetCommitment.findMany({
      where: { id: { in: locked.map((r) => r.id) } },
      orderBy: { year: 'asc' },
    });

    return rows.map((row) => ({
      id: row.id,
      year: row.year,
      amountMinor: row.amountMinor,
      releasedMinor: row.releasedMinor,
      realizedMinor: row.realizedMinor,
      state: row.state,
      organizationId: row.organizationId,
      costCenterId: row.costCenterId,
    }));
  }

  /** Reads the Cost Center and year of a commitment without locking (for advisory year lock acquisition). */
  async findScope(tx: DbTx, id: string): Promise<{ costCenterId: string; year: number } | null> {
    const row = await tx.budgetCommitment.findUnique({
      where: { id },
      select: { costCenterId: true, year: true },
    });

    return row ? { costCenterId: row.costCenterId, year: row.year } : null;
  }

  /** One commitment with its row locked, so that two releases of it queue. */
  async lockById(tx: DbTx, id: string): Promise<(CommitmentOfRequest & { requestId: string }) | null> {
    const found = await tx.$queryRaw<
      Array<{ id: string }>
    >`SELECT id FROM budget_commitments WHERE id = ${id}::uuid FOR UPDATE`;
    if (found.length === 0) return null;
    const row = await tx.budgetCommitment.findUnique({ where: { id } });
    if (!row) return null;

    return {
      id: row.id,
      requestId: row.requestId,
      year: row.year,
      amountMinor: row.amountMinor,
      releasedMinor: row.releasedMinor,
      realizedMinor: row.realizedMinor,
      state: row.state,
      organizationId: row.organizationId,
      costCenterId: row.costCenterId,
    };
  }

  /**
   * Takes `takeMinor` back to the budget and writes it in the ledger. The commitment is released when none is left. The row is
   * changed only if it is still as it was read, so a release that lost a race is told and writes nothing.
   */
  async release(
    tx: DbTx,
    row: CommitmentRow,
    input: {
      takeMinor: bigint;
      reason: CommitmentReleaseReason | 'REMAINDER';
      reasonText: string | null;
      releasedByEmployeeId: string | null;
      now: Date;
    },
  ): Promise<{ released: boolean; heldMinor: bigint }> {
    const releasedMinor = row.releasedMinor + input.takeMinor;
    const heldMinor = row.amountMinor - releasedMinor - row.realizedMinor;
    const ended = heldMinor === 0n;
    const state = !ended ? 'HELD' : row.realizedMinor > 0n ? 'EXPENSED' : 'RELEASED';
    const changed = await tx.budgetCommitment.updateMany({
      where: { id: row.id, state: 'HELD', releasedMinor: row.releasedMinor, realizedMinor: row.realizedMinor },
      data: {
        releasedMinor,
        state,
        releasedAt: state === 'RELEASED' ? input.now : null,
      },
    });
    if (changed.count !== 1) throw new Error(`The commitment ${row.id} changed while it was being released.`);
    await tx.budgetCommitmentRelease.create({
      data: {
        commitmentId: row.id,
        amountMinor: input.takeMinor,
        reason: input.reason,
        reasonText: input.reasonText,
        releasedByEmployeeId: input.releasedByEmployeeId,
        releasedAt: input.now,
      },
    });

    return { released: ended, heldMinor };
  }

  /**
   * Increases `realized_minor` by `takeMinor` and writes the realization to `commitment_realizations`.
   * When held reaches 0, the state transitions to `EXPENSED`.
   * Uses optimistic locking identical to `release` to prevent concurrent conflicts.
   */
  async realize(
    tx: DbTx,
    row: CommitmentRow,
    input: {
      takeMinor: bigint;
      invoiceLineId: string;
      employeeId: string;
      now: Date;
    },
  ): Promise<{ expensed: boolean; heldMinor: bigint }> {
    const realizedMinor = row.realizedMinor + input.takeMinor;
    const heldMinor = row.amountMinor - row.releasedMinor - realizedMinor;
    const ended = heldMinor === 0n;
    const state = ended ? 'EXPENSED' : 'HELD';
    const changed = await tx.budgetCommitment.updateMany({
      where: { id: row.id, state: 'HELD', releasedMinor: row.releasedMinor, realizedMinor: row.realizedMinor },
      data: {
        realizedMinor,
        state,
      },
    });
    if (changed.count !== 1) throw new Error(`The commitment ${row.id} changed while it was being realized.`);
    await tx.commitmentRealization.create({
      data: {
        commitmentId: row.id,
        invoiceLineId: input.invoiceLineId,
        amountMinor: input.takeMinor,
        recordedByEmployeeId: input.employeeId,
        recordedAt: input.now,
      },
    });

    return { expensed: ended, heldMinor };
  }

  /** What went back to the budget from one commitment, the oldest first. */
  async pageReleases(commitmentId: string, skip: number, take: number) {
    const where = { commitmentId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.budgetCommitmentRelease.findMany({
        where,
        orderBy: [{ releasedAt: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
      this.prisma.budgetCommitmentRelease.count({ where }),
    ]);

    return { rows, total };
  }

  async exists(id: string): Promise<boolean> {
    return (await this.prisma.budgetCommitment.count({ where: { id } })) > 0;
  }

  /** The years the request already holds a commitment for, among the years asked about. */
  async yearsHeldBy(tx: DbTx, requestId: string, years: readonly number[]): Promise<number[]> {
    const rows = await tx.budgetCommitment.findMany({
      where: { requestId, year: { in: [...years] } },
      select: { year: true },
      orderBy: { year: 'asc' },
    });

    return rows.map((row) => row.year);
  }

  /** Whether the request holds any commitment: Finance reads such a request from the commitment (`US-06-09` AC-2). */
  async existsFor(requestId: string): Promise<boolean> {
    return (await this.prisma.budgetCommitment.count({ where: { requestId } })) > 0;
  }

  /** One page of the commitments, the newest first; `attached` narrows to the ones attached to a budget or waiting for one. */
  async page(filter: {
    id?: string;
    attached?: boolean;
    year?: number;
    costCenterId?: string;
    requestId?: string;
    skip: number;
    take: number;
  }) {
    const where = {
      ...(filter.attached === undefined ? {} : { attachedVersionId: filter.attached ? { not: null } : null }),
      ...(filter.year ? { year: filter.year } : {}),
      ...(filter.costCenterId ? { costCenterId: filter.costCenterId } : {}),
      ...(filter.requestId ? { requestId: filter.requestId } : {}),
      ...(filter.id ? { id: filter.id } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.budgetCommitment.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: filter.skip,
        take: filter.take,
      }),
      this.prisma.budgetCommitment.count({ where }),
    ]);

    return { rows, total };
  }

  /**
   * What is held against the budget of each Cost Center and year from attached commitments, and what has become an
   * expense and deductible VAT from recorded invoice lines (FR-5.4, US-06-09 AC-12).
   */
  async totals(
    pairs: readonly { costCenterId: string; year: number }[],
    tx?: DbTx,
  ): Promise<Map<string, CommitmentTotals>> {
    const totals = new Map<string, CommitmentTotals>();
    if (pairs.length === 0) return totals;

    const heldMap = await this.heldTotals(pairs, tx);
    const spendTotals = await this.invoiceSpend.totals(pairs, tx);
    for (const pair of pairs) {
      const key = heldKey(pair.costCenterId, pair.year);
      const spend = spendTotals.get(key);
      totals.set(key, {
        held: heldMap.get(key) ?? 0n,
        spent: spend?.spent ?? 0n,
        deductibleVat: spend?.deductibleVat ?? 0n,
      });
    }

    return totals;
  }

  private async heldTotals(
    pairs: readonly { costCenterId: string; year: number }[],
    tx?: DbTx,
  ): Promise<Map<string, bigint>> {
    const map = new Map<string, bigint>();
    const db = tx ?? this.prisma;
    const groups = await db.budgetCommitment.groupBy({
      by: ['costCenterId', 'year'],
      where: {
        state: 'HELD',
        attachedVersionId: { not: null },
        OR: pairs.map((pair) => ({ costCenterId: pair.costCenterId, year: pair.year })),
      },
      _sum: { amountMinor: true, releasedMinor: true, realizedMinor: true },
    });
    for (const group of groups) {
      const held = (group._sum.amountMinor ?? 0n) - (group._sum.releasedMinor ?? 0n) - (group._sum.realizedMinor ?? 0n);
      map.set(heldKey(group.costCenterId, group.year), held);
    }
    return map;
  }

  /**
   * The first `limit` commitments of the Cost Center that are still held, by id, and how many there are: a Cost Center with one
   * cannot be retired (`QĐ-87d(2)`). A commitment is held until nothing of it is left; one that became an expense or was released
   * keeps nothing in use.
   */
  async heldOn(
    costCenterId: string,
    limit: number,
    tx?: DbTx,
  ): Promise<{ rows: { id: string; year: number }[]; total: number }> {
    const db = tx ?? this.prisma;
    const where = { costCenterId, state: 'HELD' as const };
    const rows = await db.budgetCommitment.findMany({
      where,
      orderBy: { id: 'asc' },
      take: limit,
      select: { id: true, year: true },
    });

    return { rows, total: await db.budgetCommitment.count({ where }) };
  }
}

export interface CommitmentOfRequest extends CommitmentRow {
  organizationId: string;
  costCenterId: string;
}

/** What a commitment total says about the budget of a Cost Center and year. */
export interface CommitmentTotals {
  held: bigint;
  spent: bigint;
  deductibleVat: bigint;
}
