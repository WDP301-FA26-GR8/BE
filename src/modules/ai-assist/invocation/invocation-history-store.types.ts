import type { DbTx } from '../../../infrastructure/database/transaction-runner';
import type { QueueContext } from '../ai-service/ai-service.types';
import type { InvocationContentRecord, InvocationOutcome } from './invocation.types';

/**
 * Where what was said to the model and what came back is kept (QĐ-102g). In this repository (WDP) it is MongoDB, through the outbox
 * of PostgreSQL (`MongoInvocationHistoryRepo`, ADR-0020); the PostgreSQL store of the SEP repository (`ai_invocation_contents`) does
 * not exist here.
 *
 * Every method runs in the PostgreSQL transaction of its caller, and that transaction may roll back after the method returned: a
 * store outside PostgreSQL must not be written to directly in a method, but through a record kept in `tx` (an outbox) and sent
 * after the commit.
 *
 * The result of the checks is not in this port: `AiInvocationRepo.finish` writes it (here, into `ai_invocation_results`) and
 * `AiInvocationRepo.findOwned` reads it for the owner of the call, with the history state (`history_state`) as the mark of "not
 * purged". `recordAnswered` therefore writes the raw history only.
 */
export abstract class AiInvocationHistoryStore {
  /** The call as admitted: its context, nothing answered yet. In the transaction that inserts the call. */
  abstract recordAdmitted(
    tx: DbTx,
    call: { invocationId: string; organizationId: string; context: QueueContext; at: Date },
  ): Promise<void>;

  /**
   * The call as it ended with an answer: the whole raw history, replacing the one of the admission. In the transaction that finished
   * it; only called when the run was the one to finish it.
   */
  abstract recordAnswered(
    tx: DbTx,
    call: {
      invocationId: string;
      organizationId: string;
      context: QueueContext;
      answer: NonNullable<InvocationOutcome['content']>;
      at: Date;
    },
  ): Promise<void>;

  /**
   * The content for the Super Admin, or null when there is none (never made, or purged). Reads inside `tx`: the query service of
   * this repository does not call it, because a network call (MongoDB) does not belong inside a transaction; it calls the two phases
   * of the adapter (`prepareRead` before its transaction, `confirmRead` inside it).
   */
  abstract find(tx: DbTx, invocationId: string): Promise<InvocationContentRecord | null>;

  /** How many calls a purge through `before` (exclusive) would take; live calls (PENDING, RUNNING) never count. */
  abstract countPurgeable(before: Date): Promise<number>;

  /**
   * Takes them in the caller's transaction and returns how many: the history of each reads as gone from that commit (a COMPLETED
   * call becomes STALE); the store outside PostgreSQL is written after the commit.
   */
  abstract purge(tx: DbTx, before: Date): Promise<number>;
}
