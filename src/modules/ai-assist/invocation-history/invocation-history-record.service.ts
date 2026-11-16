import { Injectable } from '@nestjs/common';
import type { DbTx } from '../../../infrastructure/database/transaction-runner';
import { InvocationHistoryOutboxRepo } from './invocation-history-outbox.repo';
import type { HistorySnapshot } from './invocation-history.types';

/**
 * Records a snapshot of the raw history of a call, in the caller's transaction (ADR-0020): the call and its history intent commit
 * together or not at all, and MongoDB is written after commit by the worker. Never waits for MongoDB: the summary of the queue
 * answers whatever state MongoDB is in.
 */
@Injectable()
export class InvocationHistoryRecordService {
  constructor(private readonly outbox: InvocationHistoryOutboxRepo) {}

  /** The call as admitted: the context sent, nothing answered yet. */
  recordAdmitted(
    tx: DbTx,
    call: { invocationId: string; organizationId: string; context: HistorySnapshot['context']; at: Date },
  ): Promise<boolean> {
    return this.outbox.enqueueSnapshot(tx, {
      invocationId: call.invocationId,
      organizationId: call.organizationId,
      snapshot: { context: call.context, promptText: null, rawResponse: null, parsed: null, validation: null },
      at: call.at,
    });
  }

  /** The call as it ended with an answer: the whole snapshot, replacing the one of the admission. */
  recordAnswered(
    tx: DbTx,
    call: { invocationId: string; organizationId: string; snapshot: HistorySnapshot; at: Date },
  ): Promise<boolean> {
    return this.outbox.enqueueSnapshot(tx, call);
  }
}
