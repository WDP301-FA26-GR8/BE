import { z } from 'zod';
import { SOURCE_REF_PATTERN, queueContextSchema, queueSummaryParsedSchema } from '../ai-service/ai-service.types';

/*
 * The raw history of one call of the AI (ADR-0020): what was sent to the model and what came back, kept in MongoDB
 * (`ai_invocation_histories`, one document per call) for the Super Admin to explain a result. PostgreSQL stays the authority: the
 * call, its state and the result the summary of the owner is built from never depend on MongoDB.
 */

/** The collection of the raw history, one document per call, `_id` the id of the call. */
export const HISTORY_COLLECTION = 'ai_invocation_histories';
/** The shape of the documents written today; a document of another shape is refused on read. */
export const HISTORY_SCHEMA_VERSION = 1;

/** Why the checks of the backend refused each line the model wrote. */
export const historyValidationSchema = z.strictObject({
  rejections: z.array(
    z.strictObject({ sourceRef: z.string().regex(SOURCE_REF_PATTERN), code: z.string().regex(/^[A-Z][A-Z_]*$/) }),
  ),
});

/**
 * One snapshot of the history: the whole of it, never a patch, so the order snapshots arrive in never matters. A field the call never
 * got (the model never answered, or the checks never ran) is null: nothing is made up.
 */
export const historySnapshotSchema = z.strictObject({
  context: queueContextSchema,
  promptText: z.string().nullable(),
  rawResponse: z.string().nullable(),
  parsed: queueSummaryParsedSchema.nullable(),
  validation: historyValidationSchema.nullable(),
});
export type HistorySnapshot = z.output<typeof historySnapshotSchema>;

/** Where the history of a call stands (`ai_invocations.history_state`). */
export type HistoryState = 'PENDING' | 'AVAILABLE' | 'ERROR' | 'PURGING' | 'PURGED';
export type HistoryOperation = 'SNAPSHOT' | 'PURGE';

/** What PostgreSQL says of the history of one call. */
export interface HistoryStanding {
  invocationId: string;
  organizationId: string;
  state: HistoryState;
  /** The snapshot written last. */
  version: number;
  /** The snapshot MongoDB confirmed last. */
  storedVersion: number;
  /** The purge generation: it only grows, and a document of an older one is never served. */
  generation: number;
}

/** One row of the outbox taken by a delivery, under its lease. */
export interface ClaimedDelivery {
  id: string;
  organizationId: string;
  invocationId: string;
  generation: number;
  version: number;
  operation: HistoryOperation;
  /** The snapshot as stored (decoded by the delivery); null for a PURGE. */
  payload: unknown;
  attempts: number;
}

/** The document of a call in MongoDB, as read back and checked; a tombstone (`purged`) has no context and no content. */
export interface HistoryDocument extends Omit<HistorySnapshot, 'context'> {
  context: HistorySnapshot['context'] | null;
  invocationId: string;
  organizationId: string;
  generation: number;
  version: number;
  payloadHash: string | null;
  purged: boolean;
}

/** What a snapshot write found: written (or already there, the same), or obsolete (MongoDB holds a later one or a tombstone). */
export type SnapshotWriteOutcome = 'WRITTEN' | 'OBSOLETE' | 'RETRY';
