import { Injectable } from '@nestjs/common';
import type { DbTx } from '../../../infrastructure/database/transaction-runner';
import { MongoUnavailableError } from '../../../infrastructure/mongodb/mongodb.errors';
import { AiInvocationHistoryStore } from '../invocation/invocation-history-store.types';
import type { InvocationContentRecord, InvocationOutcome } from '../invocation/invocation.types';
import { AiInvocationRepo } from '../invocation/invocation.repo';
import { InvocationHistoryOutboxRepo } from './invocation-history-outbox.repo';
import { InvocationHistoryStoreRepo } from './invocation-history-store.repo';
import {
  HistoryDocumentShapeError,
  InvocationContentPendingError,
  InvocationContentUnavailableError,
} from './invocation-history.errors';
import type { HistoryDocument, HistorySnapshot, HistoryStanding } from './invocation-history.types';

type Answer = NonNullable<InvocationOutcome['content']>;
type LiveDocument = HistoryDocument & { context: NonNullable<HistoryDocument['context']> };

/** The raw history of an answered call: what was sent, what came back, and why the checks rejected the lines they rejected. */
function snapshotOf(context: HistorySnapshot['context'], answer: Answer): HistorySnapshot {
  return {
    context,
    promptText: answer.promptText,
    rawResponse: answer.rawResponse,
    parsed: answer.parsed,
    validation: answer.result === null ? null : { rejections: answer.result.rejections },
  };
}

/** Whether the history reads as gone: never made, or purged (logically as soon as the purge committed). */
const isGone = (standing: HistoryStanding | null): boolean =>
  standing === null || standing.state === 'PURGING' || standing.state === 'PURGED';

/** Throws the refusal the state stands for when PostgreSQL does not let the history be read now. */
function assertReadable(standing: HistoryStanding): void {
  if (standing.state === 'ERROR') throw new InvocationContentUnavailableError();
  if (standing.state !== 'AVAILABLE' || standing.storedVersion < standing.version)
    throw new InvocationContentPendingError();
}

/** The document, when it is the one PostgreSQL confirmed: the same purge generation and the last version, with content. */
function currentDocument(document: HistoryDocument | null, standing: HistoryStanding): LiveDocument | null {
  if (document === null || document.version < standing.version) throw new InvocationContentPendingError();
  if (document.purged || document.generation !== standing.generation) return null;
  const { context } = document;
  if (context === null) throw new InvocationContentUnavailableError();

  return { ...document, context };
}

/** What the first phase of the read of a content settled before any transaction: the version it read and the document itself. */
export interface PreparedContentRead {
  invocationId: string;
  /** The purge generation and the version of the document: the second phase checks that they are still the call's. */
  generation: number;
  version: number;
  document: LiveDocument;
}

/**
 * The MongoDB history store of `AiInvocationHistoryStore` (ADR-0020, WDP): the raw history is MongoDB's and the call and the result of
 * its checks are PostgreSQL's. PostgreSQL and MongoDB share no transaction, so every method that changes something writes a record in
 * the caller's transaction (the outbox `ai_history_deliveries`, and the purge generation of the call) and the worker delivers it to
 * MongoDB after the commit; MongoDB is only read here. The result stays in PostgreSQL (`ai_invocation_results`, written by
 * `AiInvocationRepo.finish`), so `AiInvocationRepo.findOwned` reads it there.
 */
@Injectable()
export class MongoInvocationHistoryRepo implements AiInvocationHistoryStore {
  constructor(
    private readonly outbox: InvocationHistoryOutboxRepo,
    private readonly store: InvocationHistoryStoreRepo,
    private readonly invocations: AiInvocationRepo,
  ) {}

  /** Queues the first snapshot: the context sent, nothing answered yet. A call whose history is purging or purged queues nothing. */
  async recordAdmitted(
    tx: DbTx,
    call: { invocationId: string; organizationId: string; context: HistorySnapshot['context']; at: Date },
  ): Promise<void> {
    await this.outbox.enqueueSnapshot(tx, {
      invocationId: call.invocationId,
      organizationId: call.organizationId,
      snapshot: { context: call.context, promptText: null, rawResponse: null, parsed: null, validation: null },
      at: call.at,
    });
  }

  /** Queues the whole snapshot of the call as it ended with an answer, replacing the one of its admission. */
  async recordAnswered(
    tx: DbTx,
    call: {
      invocationId: string;
      organizationId: string;
      context: HistorySnapshot['context'];
      answer: Answer;
      at: Date;
    },
  ): Promise<void> {
    await this.outbox.enqueueSnapshot(tx, {
      invocationId: call.invocationId,
      organizationId: call.organizationId,
      snapshot: snapshotOf(call.context, call.answer),
      at: call.at,
    });
  }

  /**
   * The first phase of the read of the content, with no transaction: PostgreSQL decides whether the history may be read, then
   * MongoDB is read. A network call does not belong inside a transaction (`TransactionRunner`), and a slow MongoDB must not hold a
   * PostgreSQL connection. Null when there is none (never made, or purged). Throws InvocationContentPendingError (not in MongoDB
   * yet) or InvocationContentUnavailableError (MongoDB down or refusing, or the history in error); nothing is recorded then.
   */
  async prepareRead(invocationId: string): Promise<PreparedContentRead | null> {
    const standing = await this.outbox.standingOf(invocationId);
    if (standing === null || isGone(standing)) return null;
    assertReadable(standing);
    const document = currentDocument(await this.documentOf(invocationId, standing.organizationId), standing);
    if (document === null) return null;

    return { invocationId, generation: document.generation, version: document.version, document };
  }

  /**
   * The second phase, in the short transaction that also writes the audit event: the call is locked (`FOR SHARE`) and checked
   * again, so a purge or a newer snapshot that committed after the read of MongoDB is never missed. Null when the history was
   * purged meanwhile; throws InvocationContentPendingError when a newer snapshot came.
   */
  async confirmRead(tx: DbTx, prepared: PreparedContentRead): Promise<InvocationContentRecord | null> {
    const now = await this.outbox.standingOf(prepared.invocationId, tx, true);
    if (now === null || isGone(now)) return null;
    assertReadable(now);
    if (now.generation !== prepared.generation || now.version !== prepared.version) {
      throw new InvocationContentPendingError();
    }
    const providerMode = await this.invocations.providerModeOf(tx, prepared.invocationId);
    if (providerMode === null) return null;
    const { document } = prepared;

    return {
      invocationId: prepared.invocationId,
      organizationId: now.organizationId,
      providerMode,
      context: document.context,
      promptText: document.promptText,
      rawResponse: document.rawResponse,
      parsed: document.parsed,
      result: await this.invocations.resultOf(tx, prepared.invocationId),
    };
  }

  /**
   * The read of the port, both phases in the transaction of the caller. The query service of this repository does not use it: it
   * calls `prepareRead` before its transaction and `confirmRead` inside it, so MongoDB is never read inside a transaction.
   */
  async find(tx: DbTx, invocationId: string): Promise<InvocationContentRecord | null> {
    const prepared = await this.prepareRead(invocationId);

    return prepared === null ? null : this.confirmRead(tx, prepared);
  }

  /** How many calls a purge through `before` (exclusive) would take; live calls (PENDING, RUNNING) never count. */
  countPurgeable(before: Date): Promise<number> {
    return this.outbox.countPurgeable(before);
  }

  /**
   * The logical purge, in the caller's transaction: the calls are locked, their results deleted (a COMPLETED call becomes STALE) and
   * each gets a new purge generation, the state PURGING and one tombstone queued; MongoDB is written after the commit
   * (`HistoryDeliveryService.drainPurges`).
   */
  async purge(tx: DbTx, before: Date): Promise<number> {
    const ids = await this.outbox.lockPurgeable(tx, before);
    if (ids.length === 0) return 0;
    await this.invocations.dropResults(tx, ids);
    await this.outbox.beginPurge(tx, ids, new Date());

    return ids.length;
  }

  private async documentOf(invocationId: string, organizationId: string): Promise<HistoryDocument | null> {
    try {
      return await this.store.find(invocationId, organizationId);
    } catch (error) {
      if (error instanceof MongoUnavailableError || error instanceof HistoryDocumentShapeError) {
        throw new InvocationContentUnavailableError({ cause: error });
      }
      throw error;
    }
  }
}
