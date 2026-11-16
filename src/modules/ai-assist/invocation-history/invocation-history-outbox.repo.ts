import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { DbTx } from '../../../infrastructure/database/transaction-runner';
import { historyPayloadJson } from './invocation-history-payload.json';
import type {
  ClaimedDelivery,
  HistoryOperation,
  HistorySnapshot,
  HistoryStanding,
  HistoryState,
} from './invocation-history.types';

/** The states of a history whose content is gone, logically (PURGING) or for good (PURGED). */
const PURGED_STATES = ['PURGING', 'PURGED'] as const;

/**
 * The calls a purge through `before` (exclusive) takes: over (not PENDING, RUNNING) and with a history not purged yet. One predicate
 * for the dry-run count and the purge itself, so the count is what `--apply` purges.
 */
const purgeScope = (before: Date) => Prisma.sql`
  created_at < ${before.toISOString()}::timestamptz
  AND status NOT IN ('PENDING', 'RUNNING') AND history_state NOT IN ('PURGING', 'PURGED')`;

/** Tombstones not yet confirmed by MongoDB: still waiting for a delivery, or parked (refused for good, for an operator). */
export interface PendingPurges {
  waiting: number;
  parked: number;
}

interface ClaimedRow {
  id: string;
  organization_id: string;
  invocation_id: string;
  generation: number;
  version: number;
  operation: HistoryOperation;
  payload: unknown;
  attempts: number;
}

interface StandingRow {
  id: string;
  organization_id: string;
  history_state: HistoryState;
  history_version: number;
  history_stored_version: number;
  history_generation: number;
}

const standingOf = (row: StandingRow): HistoryStanding => ({
  invocationId: row.id,
  organizationId: row.organization_id,
  state: row.history_state,
  version: row.history_version,
  storedVersion: row.history_stored_version,
  generation: row.history_generation,
});

/**
 * The PostgreSQL side of the raw history (ADR-0020): the outbox `ai_history_deliveries` and the `history_*` columns of
 * `ai_invocations`. An intent is written in the transaction that changes the call, so a call never ends without its history queued;
 * MongoDB is written after commit, by the worker. A delivery row is changed only under the lease that claimed it, so a delivery that
 * outlived its lease never acknowledges a row another one took. Instants go to SQL as ISO strings with an offset.
 */
@Injectable()
export class InvocationHistoryOutboxRepo {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The next version of the history of the call, queued for delivery. False (nothing queued) when the history is purging or
   * purged: a purged call never gets content back.
   */
  async enqueueSnapshot(
    tx: DbTx,
    input: { invocationId: string; organizationId: string; snapshot: HistorySnapshot; at: Date },
  ): Promise<boolean> {
    const rows = await tx.$queryRaw<{ history_version: number; history_generation: number }[]>`
      UPDATE ai_invocations SET history_version = history_version + 1, history_state = 'PENDING', history_error_code = NULL
      WHERE id = ${input.invocationId}::uuid AND history_state NOT IN ('PURGING', 'PURGED')
      RETURNING history_version, history_generation`;
    const bumped = rows[0];
    if (bumped === undefined) return false;
    await tx.aiHistoryDelivery.create({
      data: {
        organizationId: input.organizationId,
        invocationId: input.invocationId,
        generation: bumped.history_generation,
        version: bumped.history_version,
        operation: 'SNAPSHOT',
        payload: historyPayloadJson.encode(input.snapshot),
        availableAt: input.at,
        createdAt: input.at,
      },
    });

    return true;
  }

  /**
   * Takes due rows with `FOR UPDATE SKIP LOCKED`, so concurrent workers never share one, under a lease: a row whose lease ran out
   * (the worker died mid-delivery) is taken again. `operation` narrows the claim to one kind (the purge command drains its tombstones).
   */
  async claimDue(
    tx: DbTx,
    input: {
      now: Date;
      /** Rows available by this instant are due; the purge command fixes it when it starts, so its drain ends. */
      dueBy: Date;
      leaseToken: string;
      leaseUntil: Date;
      limit: number;
      operation: HistoryOperation | null;
    },
  ): Promise<ClaimedDelivery[]> {
    const now = input.now.toISOString();
    const dueBy = input.dueBy.toISOString();
    const rows = await tx.$queryRaw<ClaimedRow[]>`
      UPDATE ai_history_deliveries SET lease_token = ${input.leaseToken}::uuid,
        lease_until = ${input.leaseUntil.toISOString()}::timestamptz, attempts = attempts + 1
      WHERE id IN (
        SELECT id FROM ai_history_deliveries
        WHERE closed_at IS NULL AND parked_at IS NULL AND available_at <= ${dueBy}::timestamptz
          AND (lease_until IS NULL OR lease_until <= ${now}::timestamptz)
          AND (${input.operation}::text IS NULL OR operation::text = ${input.operation}::text)
        ORDER BY available_at, id
        LIMIT ${input.limit}::int
        FOR UPDATE SKIP LOCKED)
      RETURNING id, organization_id, invocation_id, generation, version, operation, payload, attempts`;

    return rows.map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      invocationId: row.invocation_id,
      generation: row.generation,
      version: row.version,
      operation: row.operation,
      payload: row.payload,
      attempts: row.attempts,
    }));
  }

  /**
   * MongoDB confirmed the row: it is closed and its payload wiped, and the call moves on when the confirmation is still about its
   * current generation. A snapshot makes the history AVAILABLE once the version written last is the one confirmed; a tombstone
   * makes a PURGING history PURGED. False when the lease is no longer ours (nothing written).
   */
  async acknowledge(tx: DbTx, row: ClaimedDelivery, leaseToken: string, at: Date): Promise<boolean> {
    if (!(await this.close(tx, row.id, leaseToken, at, null))) return false;
    if (row.operation === 'PURGE') {
      await tx.aiInvocation.updateMany({
        where: { id: row.invocationId, historyGeneration: row.generation, historyState: 'PURGING' },
        data: { historyState: 'PURGED' },
      });

      return true;
    }
    await tx.$executeRaw`
      UPDATE ai_invocations
      SET history_stored_version = GREATEST(history_stored_version, ${row.version}::int),
          history_state = CASE WHEN GREATEST(history_stored_version, ${row.version}::int) >= history_version
                               THEN 'AVAILABLE'::"AiHistoryState" ELSE history_state END
      WHERE id = ${row.invocationId}::uuid AND history_generation = ${row.generation}::int
        AND history_state NOT IN ('PURGING', 'PURGED') AND history_version >= ${row.version}::int`;

    return true;
  }

  /** MongoDB holds a later snapshot or a tombstone: the row is closed without moving the call. */
  closeObsolete(tx: DbTx, row: ClaimedDelivery, leaseToken: string, at: Date): Promise<boolean> {
    return this.close(tx, row.id, leaseToken, at, 'OBSOLETE');
  }

  /** A failure that may pass (MongoDB down, a write that crossed another): the row waits until `availableAt` and is taken again. */
  async retryLater(row: ClaimedDelivery, leaseToken: string, availableAt: Date, errorCode: string): Promise<void> {
    await this.prisma.aiHistoryDelivery.updateMany({
      where: { id: row.id, leaseToken, closedAt: null },
      data: { leaseToken: null, leaseUntil: null, availableAt, lastErrorCode: errorCode },
    });
  }

  /**
   * A refusal for good: the row is parked with its payload (an operator can look at it and replay it). The history of the call
   * shows ERROR only when the refused row is its latest version: a refused older snapshot is superseded by the later one, which
   * may be delivered already, and a purge moves the call on. False when the lease is no longer ours (nothing written).
   */
  async park(tx: DbTx, row: ClaimedDelivery, leaseToken: string, errorCode: string, at: Date): Promise<boolean> {
    const { count } = await tx.aiHistoryDelivery.updateMany({
      where: { id: row.id, leaseToken, closedAt: null },
      data: { leaseToken: null, leaseUntil: null, parkedAt: at, lastErrorCode: errorCode },
    });
    if (count !== 1) return false;
    await tx.aiInvocation.updateMany({
      where: {
        id: row.invocationId,
        historyGeneration: row.generation,
        historyVersion: row.version,
        historyState: { notIn: [...PURGED_STATES] },
      },
      data: { historyState: 'ERROR', historyErrorCode: errorCode },
    });

    return true;
  }

  /** Where the history of the call stands; `lock` takes a share lock on the call, so a purge or a finish waits for the read. */
  async standingOf(invocationId: string, tx?: DbTx, lock = false): Promise<HistoryStanding | null> {
    const client = tx ?? this.prisma;
    const rows = lock
      ? await client.$queryRaw<StandingRow[]>`
          SELECT id, organization_id, history_state, history_version, history_stored_version, history_generation
          FROM ai_invocations WHERE id = ${invocationId}::uuid FOR SHARE`
      : await client.$queryRaw<StandingRow[]>`
          SELECT id, organization_id, history_state, history_version, history_stored_version, history_generation
          FROM ai_invocations WHERE id = ${invocationId}::uuid`;
    const row = rows[0];

    return row === undefined ? null : standingOf(row);
  }

  /** How many calls that are over, created before `before` (exclusive), still have a history to purge. */
  async countPurgeable(before: Date, tx?: DbTx): Promise<number> {
    const rows = await (tx ?? this.prisma).$queryRaw<{ count: number }[]>`
      SELECT count(*)::int AS count FROM ai_invocations WHERE ${purgeScope(before)}`;

    return rows[0]?.count ?? 0;
  }

  /** The same calls, locked in the order of their ids (every writer of a call takes it the same way). */
  async lockPurgeable(tx: DbTx, before: Date): Promise<string[]> {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM ai_invocations WHERE ${purgeScope(before)}
      ORDER BY id
      FOR UPDATE`;

    return rows.map((row) => row.id);
  }

  /**
   * The purge of these calls, logically done in this transaction: a new generation, PURGING (the content reads as gone from now),
   * every undelivered snapshot made obsolete and its payload wiped, and one tombstone queued per call. The ids go as one array
   * parameter: the first purge after a long retention can hold more calls than PostgreSQL takes bind parameters.
   */
  async beginPurge(tx: DbTx, invocationIds: string[], at: Date): Promise<void> {
    if (invocationIds.length === 0) return;
    const instant = at.toISOString();
    await tx.$executeRaw`
      UPDATE ai_invocations
      SET history_generation = history_generation + 1, history_state = 'PURGING', history_purged_at = ${instant}::timestamptz,
          history_error_code = NULL
      WHERE id = ANY(${invocationIds}::uuid[])`;
    await tx.$executeRaw`
      UPDATE ai_history_deliveries
      SET closed_at = ${instant}::timestamptz, payload = NULL, lease_token = NULL, lease_until = NULL, last_error_code = 'OBSOLETE'
      WHERE invocation_id = ANY(${invocationIds}::uuid[]) AND operation = 'SNAPSHOT' AND closed_at IS NULL`;
    await tx.$executeRaw`
      INSERT INTO ai_history_deliveries (id, organization_id, invocation_id, generation, version, operation, available_at, created_at)
      SELECT gen_random_uuid(), organization_id, id, history_generation, history_version, 'PURGE', ${instant}::timestamptz,
             ${instant}::timestamptz
      FROM ai_invocations WHERE id = ANY(${invocationIds}::uuid[])`;
  }

  /** Tombstones queued and not yet confirmed by MongoDB, the parked ones apart: running again delivers only the waiting ones. */
  async countPendingPurges(tx?: DbTx): Promise<PendingPurges> {
    const rows = await (tx ?? this.prisma).$queryRaw<PendingPurges[]>`
      SELECT count(*) FILTER (WHERE parked_at IS NULL)::int AS waiting, count(*) FILTER (WHERE parked_at IS NOT NULL)::int AS parked
      FROM ai_history_deliveries WHERE operation = 'PURGE' AND closed_at IS NULL`;

    return rows[0] ?? { waiting: 0, parked: 0 };
  }

  private async close(tx: DbTx, id: string, leaseToken: string, at: Date, code: string | null): Promise<boolean> {
    const { count } = await tx.aiHistoryDelivery.updateMany({
      where: { id, leaseToken, closedAt: null },
      data: {
        closedAt: at,
        payload: historyPayloadJson.encode(null),
        leaseToken: null,
        leaseUntil: null,
        lastErrorCode: code,
      },
    });

    return count === 1;
  }
}
