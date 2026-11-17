import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { JsonColumnShapeError } from '../../../infrastructure/database/json-column.errors';
import { TransactionRunner } from '../../../infrastructure/database/transaction-runner';
import { MongoUnavailableError } from '../../../infrastructure/mongodb/mongodb.errors';
import { describeForOperator } from '../../../infrastructure/observability/operator-error';
import { snapshotHashOf } from '../invocation-history/invocation-history-hash.policy';
import { InvocationHistoryOutboxRepo } from '../invocation-history/invocation-history-outbox.repo';
import { historyPayloadJson } from '../invocation-history/invocation-history-payload.json';
import { InvocationHistoryStoreRepo } from '../invocation-history/invocation-history-store.repo';
import { HistoryWriteRefusedError } from '../invocation-history/invocation-history.errors';
import type { ClaimedDelivery, HistoryOperation } from '../invocation-history/invocation-history.types';
import { retryAt } from './history-delivery-retry.policy';

/** Rows taken per round, and the lease they are taken under: longer than the timeouts of the MongoDB writes of one row. */
const BATCH = 20;
const LEASE_MS = 60_000;
/** MongoDB writes in flight at once, each in its own short transaction to acknowledge it. */
const CONCURRENCY = 2;
/**
 * The longest one row may take (a few MongoDB operations, each bounded by the operation timeout, and its acknowledgement): a wave
 * starts only while this much of the lease is left, so a slow MongoDB never makes a row outlive the claim it was taken under.
 */
const ROW_BUDGET_MS = 15_000;

/** What one round did; a round that claimed a full batch is followed by another at once. */
export interface HistoryDeliveryRound {
  claimed: number;
  delivered: number;
  obsolete: number;
  retried: number;
  parked: number;
  /** Rows this round no longer owned: not started before the lease ran short, or taken by another claim before they were closed. */
  leaseLost: number;
}

type RowOutcome = 'delivered' | 'obsolete' | 'retried' | 'parked' | 'leaseLost';

/**
 * Delivers the outbox of the raw history to MongoDB (ADR-0020), at least once: claim a batch in a short PostgreSQL transaction,
 * write MongoDB outside any transaction, then acknowledge each row under its lease. Every MongoDB write is conditional, so a row
 * delivered twice (the worker died after the write, before the acknowledgement) changes nothing the second time. A failure that may
 * pass waits and is retried without end; a refusal for good parks the row. The log names rows and codes, never a content or the URI.
 */
@Injectable()
export class HistoryDeliveryService {
  /** Rows taken per round: a round that took this many is followed by another at once. */
  static readonly BATCH_SIZE = BATCH;
  private readonly logger = new Logger('AiHistoryDelivery');

  constructor(
    private readonly runner: TransactionRunner,
    private readonly outbox: InvocationHistoryOutboxRepo,
    private readonly store: InvocationHistoryStoreRepo,
  ) {}

  /**
   * Rounds of tombstones until none is due, for the purge command. Only tombstones due when the drain starts are taken: one that
   * failed is due again after its backoff, which a long pass (MongoDB down, many tombstones) can outlast, so a cut-off that moved
   * with the clock could take the same rows for ever. A round where MongoDB took nothing (every row put back for later) ends it too:
   * MongoDB is down, and the rest would only wait out the same timeout row after row; the worker and the next run deliver them.
   * Returns how many MongoDB confirmed.
   */
  async drainPurges(): Promise<number> {
    const dueBy = new Date();
    let confirmed = 0;
    for (;;) {
      const round = await this.deliverDue('PURGE', dueBy);
      confirmed += round.delivered;
      if (round.claimed === 0 || round.retried === round.claimed) return confirmed;
    }
  }

  /** One round: the rows due by `dueBy` (now by default), of one operation when named, delivered. */
  async deliverDue(operation: HistoryOperation | null = null, dueBy?: Date): Promise<HistoryDeliveryRound> {
    const leaseToken = randomUUID();
    const now = new Date();
    const leaseUntil = now.getTime() + LEASE_MS;
    const claimed = await this.runner.run((tx) =>
      this.outbox.claimDue(tx, {
        now,
        dueBy: dueBy ?? now,
        leaseToken,
        leaseUntil: new Date(leaseUntil),
        limit: BATCH,
        operation,
      }),
    );
    const round: HistoryDeliveryRound = {
      claimed: claimed.length,
      delivered: 0,
      obsolete: 0,
      retried: 0,
      parked: 0,
      leaseLost: 0,
    };
    for (let start = 0; start < claimed.length; start += CONCURRENCY) {
      // The rows not started stay leased until it runs out, then the next claim takes them; they were never written.
      if (Date.now() + ROW_BUDGET_MS > leaseUntil) {
        round.leaseLost += claimed.length - start;
        break;
      }
      const outcomes = await Promise.all(
        claimed.slice(start, start + CONCURRENCY).map((row) => this.deliverOne(row, leaseToken)),
      );
      for (const outcome of outcomes) round[outcome] += 1;
    }

    return round;
  }

  private async deliverOne(row: ClaimedDelivery, leaseToken: string): Promise<RowOutcome> {
    let written: Awaited<ReturnType<HistoryDeliveryService['writeSnapshot']>>;
    try {
      written = row.operation === 'PURGE' ? await this.writeTombstone(row) : await this.writeSnapshot(row);
    } catch (error) {
      return this.failed(row, leaseToken, error);
    }
    // Outside the try: a PostgreSQL error from here on is not a failure of the MongoDB write, and is not retried as one.
    if (written === 'RETRY') return this.retry(row, leaseToken, 'WRITE_RACE');
    const at = new Date();
    if (written === 'OBSOLETE') {
      const closed = await this.runner.run((tx) => this.outbox.closeObsolete(tx, row, leaseToken, at));

      return closed ? 'obsolete' : 'leaseLost';
    }
    const acknowledged = await this.runner.run((tx) => this.outbox.acknowledge(tx, row, leaseToken, at));

    return acknowledged ? 'delivered' : 'leaseLost';
  }

  /** The MongoDB write failed: parked when it never will pass, kept for later otherwise. */
  private async failed(row: ClaimedDelivery, leaseToken: string, error: unknown): Promise<RowOutcome> {
    const refusal = refusalOf(error);
    if (refusal !== null) {
      this.logger.error(`delivery=${row.id} invocation=${row.invocationId} ${row.operation} refused: ${refusal}`);
      const parked = await this.runner.run((tx) => this.outbox.park(tx, row, leaseToken, refusal, new Date()));

      return parked ? 'parked' : 'leaseLost';
    }
    const code = error instanceof MongoUnavailableError ? error.code : 'DELIVERY_FAILED';
    this.logger.warn(
      `delivery=${row.id} invocation=${row.invocationId} ${row.operation} attempt=${row.attempts} failed: ` +
        describeForOperator(error),
    );

    return this.retry(row, leaseToken, code);
  }

  private writeSnapshot(row: ClaimedDelivery) {
    const snapshot = historyPayloadJson.decode(row.payload);
    // A SNAPSHOT row without a payload breaks the CHECK of the table; read as a payload that cannot be delivered.
    if (snapshot === null) throw new HistoryWriteRefusedError('PAYLOAD_INVALID');

    return this.store.writeSnapshot({
      invocationId: row.invocationId,
      organizationId: row.organizationId,
      generation: row.generation,
      version: row.version,
      payloadHash: snapshotHashOf(snapshot),
      snapshot,
      at: new Date(),
    });
  }

  private writeTombstone(row: ClaimedDelivery) {
    return this.store.writeTombstone({
      invocationId: row.invocationId,
      organizationId: row.organizationId,
      generation: row.generation,
      at: new Date(),
    });
  }

  private async retry(row: ClaimedDelivery, leaseToken: string, code: string): Promise<'retried'> {
    await this.outbox.retryLater(row, leaseToken, retryAt(row.attempts, new Date()), code);

    return 'retried';
  }
}

/** The stable code of a failure that will not pass by retrying; null for one that may. */
function refusalOf(error: unknown): string | null {
  if (error instanceof HistoryWriteRefusedError) return error.refusal;
  if (error instanceof JsonColumnShapeError) return 'PAYLOAD_INVALID';

  return null;
}
