import { Injectable, Logger } from '@nestjs/common';
import { type Collection, MongoServerError } from 'mongodb';
import { z } from 'zod';
import { MongoConnection } from '../../../infrastructure/mongodb/mongodb-connection.service';
import { MongoUnavailableError } from '../../../infrastructure/mongodb/mongodb.errors';
import { HistoryDocumentShapeError, HistoryWriteRefusedError } from './invocation-history.errors';
import {
  type ExistingHistory,
  snapshotOutcomeAgainst,
  tombstoneOutcomeAgainst,
} from './invocation-history-write.policy';
import {
  HISTORY_COLLECTION,
  HISTORY_SCHEMA_VERSION,
  type HistoryDocument,
  type HistorySnapshot,
  type SnapshotWriteOutcome,
  historySnapshotSchema,
} from './invocation-history.types';

/** The document as stored: the snapshot fields, the keys of the write protocol, and when it was written. */
interface StoredHistory {
  _id: string;
  schemaVersion: number;
  organizationId: string;
  generation: number;
  version: number;
  payloadHash: string | null;
  purged: boolean;
  context: HistorySnapshot['context'] | null;
  promptText: string | null;
  rawResponse: string | null;
  parsed: HistorySnapshot['parsed'];
  validation: HistorySnapshot['validation'];
  createdAt: Date;
  updatedAt: Date;
  purgedAt: Date | null;
}

const DUPLICATE_KEY = 11000;
const NAMESPACE_EXISTS = 48;
const UNAUTHORIZED = 13;

/** A document of the current shape: a live snapshot carries a context, a tombstone carries nothing. */
const storedSchema = z.object({
  _id: z.string(),
  schemaVersion: z.literal(HISTORY_SCHEMA_VERSION),
  organizationId: z.string(),
  generation: z.number().int().nonnegative(),
  version: z.number().int().nonnegative(),
  payloadHash: z.string().nullable(),
  purged: z.boolean(),
  context: historySnapshotSchema.shape.context.nullable(),
  promptText: historySnapshotSchema.shape.promptText,
  rawResponse: historySnapshotSchema.shape.rawResponse,
  parsed: historySnapshotSchema.shape.parsed,
  validation: historySnapshotSchema.shape.validation,
});

/** The validator MongoDB holds the collection to: the keys of the protocol must be there and of the right type. */
const COLLECTION_VALIDATOR = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['_id', 'schemaVersion', 'organizationId', 'generation', 'version', 'purged', 'createdAt', 'updatedAt'],
    properties: {
      _id: { bsonType: 'string' },
      schemaVersion: { bsonType: 'int' },
      organizationId: { bsonType: 'string' },
      generation: { bsonType: 'int', minimum: 0 },
      version: { bsonType: 'int', minimum: 0 },
      purged: { bsonType: 'bool' },
      payloadHash: { bsonType: ['string', 'null'] },
      promptText: { bsonType: ['string', 'null'] },
      rawResponse: { bsonType: ['string', 'null'] },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' },
    },
  },
} as const;

const TOMBSTONE_FIELDS = {
  purged: true,
  payloadHash: null,
  context: null,
  promptText: null,
  rawResponse: null,
  parsed: null,
  validation: null,
} as const;

/**
 * Writes tried at once when the document changed between the conditional update and the insert (two deliveries of one call
 * crossing, e.g. v1 and v2 in the same wave): the document now exists, so the next conditional update settles it. Only a document
 * that keeps changing is handed back as RETRY, for the outbox to wait out its backoff.
 */
const CROSSED_WRITE_ATTEMPTS = 3;

const isDuplicateKey = (error: unknown) => error instanceof MongoServerError && error.code === DUPLICATE_KEY;

/**
 * What MongoDB answers to a write that retrying never changes: the validator of the collection refused the document (121), the
 * document is over the size limit (10334), or the driver could not encode it (a BSON error). The same snapshot would be refused
 * again, so the delivery parks the row (`PAYLOAD_INVALID`) instead of retrying it for ever as if MongoDB were down.
 */
const NON_RETRYABLE_WRITE_CODES: ReadonlySet<number> = new Set([121, 10334]);

/** The error of a failed write: a refusal for good, or the one error callers handle for a MongoDB that may answer later. */
function writeFailure(error: unknown): HistoryWriteRefusedError | MongoUnavailableError {
  const refused =
    (error instanceof MongoServerError && NON_RETRYABLE_WRITE_CODES.has(Number(error.code))) ||
    (error instanceof Error && error.name === 'BSONError');

  return refused ? new HistoryWriteRefusedError('PAYLOAD_INVALID') : unavailable(error);
}

/** Anything the driver throws, as the one error callers handle: its message (which can name the host) stays in `cause`. */
function unavailable(error: unknown): MongoUnavailableError {
  return error instanceof MongoUnavailableError ? error : new MongoUnavailableError({ cause: error });
}

/**
 * The raw history in MongoDB (`ai_invocation_histories`, ADR-0020). Every write is one atomic operation on one document, conditional
 * on the purge generation and the version, so deliveries that repeat, cross or come late converge on the last snapshot, and a
 * tombstone is never replaced by content. Filters are built from validated ids only, never from a value the client sent.
 */
@Injectable()
export class InvocationHistoryStoreRepo {
  private readonly logger = new Logger('AiInvocationHistory');
  private prepared: Promise<void> | null = null;

  constructor(private readonly mongo: MongoConnection) {}

  /** Writes a snapshot unless MongoDB holds a later one or a tombstone. Throws HistoryWriteRefusedError or MongoUnavailableError. */
  async writeSnapshot(input: {
    invocationId: string;
    organizationId: string;
    generation: number;
    version: number;
    payloadHash: string;
    snapshot: HistorySnapshot;
    at: Date;
  }): Promise<SnapshotWriteOutcome> {
    const collection = await this.collection();
    let outcome: SnapshotWriteOutcome = 'RETRY';
    for (let attempt = 0; attempt < CROSSED_WRITE_ATTEMPTS && outcome === 'RETRY'; attempt += 1) {
      outcome = await this.trySnapshot(collection, input);
    }

    return outcome;
  }

  private async trySnapshot(
    collection: Collection<StoredHistory>,
    input: Parameters<InvocationHistoryStoreRepo['writeSnapshot']>[0],
  ): Promise<SnapshotWriteOutcome> {
    const fields = { ...input.snapshot, payloadHash: input.payloadHash, version: input.version, updatedAt: input.at };
    try {
      const { matchedCount } = await collection.updateOne(
        {
          _id: input.invocationId,
          organizationId: input.organizationId,
          purged: false,
          generation: input.generation,
          version: { $lt: input.version },
        },
        { $set: fields },
      );
      if (matchedCount === 1) return 'WRITTEN';
      await collection.insertOne({
        _id: input.invocationId,
        schemaVersion: HISTORY_SCHEMA_VERSION,
        organizationId: input.organizationId,
        generation: input.generation,
        purged: false,
        createdAt: input.at,
        purgedAt: null,
        ...fields,
      });

      return 'WRITTEN';
    } catch (error) {
      if (!isDuplicateKey(error)) throw writeFailure(error);
    }
    const outcome = snapshotOutcomeAgainst(await this.existing(collection, input.invocationId), input);
    if (outcome !== 'WRITTEN' && outcome !== 'OBSOLETE' && outcome !== 'RETRY')
      throw new HistoryWriteRefusedError(outcome);

    return outcome;
  }

  /** Replaces the history with a tombstone of this generation, creating it if MongoDB never held the call. */
  async writeTombstone(input: {
    invocationId: string;
    organizationId: string;
    generation: number;
    at: Date;
  }): Promise<'WRITTEN' | 'RETRY'> {
    const collection = await this.collection();
    let outcome: 'WRITTEN' | 'RETRY' = 'RETRY';
    for (let attempt = 0; attempt < CROSSED_WRITE_ATTEMPTS && outcome === 'RETRY'; attempt += 1) {
      outcome = await this.tryTombstone(collection, input);
    }

    return outcome;
  }

  private async tryTombstone(
    collection: Collection<StoredHistory>,
    input: Parameters<InvocationHistoryStoreRepo['writeTombstone']>[0],
  ): Promise<'WRITTEN' | 'RETRY'> {
    const fields = { ...TOMBSTONE_FIELDS, generation: input.generation, updatedAt: input.at, purgedAt: input.at };
    try {
      const { matchedCount } = await collection.updateOne(
        { _id: input.invocationId, organizationId: input.organizationId, generation: { $lt: input.generation } },
        { $set: fields },
      );
      if (matchedCount === 1) return 'WRITTEN';
      await collection.insertOne({
        _id: input.invocationId,
        schemaVersion: HISTORY_SCHEMA_VERSION,
        organizationId: input.organizationId,
        version: 0,
        createdAt: input.at,
        ...fields,
      });

      return 'WRITTEN';
    } catch (error) {
      if (!isDuplicateKey(error)) throw writeFailure(error);
    }
    const outcome = tombstoneOutcomeAgainst(await this.existing(collection, input.invocationId), input);
    if (outcome !== 'WRITTEN' && outcome !== 'RETRY') throw new HistoryWriteRefusedError(outcome);

    return outcome;
  }

  /** The document of the call in this organization, checked against the shape this backend writes; null when there is none. */
  async find(invocationId: string, organizationId: string): Promise<HistoryDocument | null> {
    // A read never creates the collection (the API reads MongoDB and never writes it): a missing one reads as no document.
    const collection = this.mongo.database().collection<StoredHistory>(HISTORY_COLLECTION);
    let stored: StoredHistory | null;
    try {
      stored = await collection.findOne({ _id: invocationId, organizationId });
    } catch (error) {
      throw unavailable(error);
    }
    if (stored === null) return null;
    const parsed = storedSchema.safeParse(stored);
    if (!parsed.success) throw new HistoryDocumentShapeError();
    const { _id, context, ...rest } = parsed.data;
    if (context === null && !rest.purged) throw new HistoryDocumentShapeError();

    return {
      invocationId: _id,
      organizationId: rest.organizationId,
      generation: rest.generation,
      version: rest.version,
      payloadHash: rest.payloadHash,
      purged: rest.purged,
      context,
      promptText: rest.promptText,
      rawResponse: rest.rawResponse,
      parsed: rest.parsed,
      validation: rest.validation,
    };
  }

  private async existing(collection: Collection<StoredHistory>, invocationId: string): Promise<ExistingHistory> {
    let stored: StoredHistory | null;
    try {
      stored = await collection.findOne({ _id: invocationId });
    } catch (error) {
      throw unavailable(error);
    }
    // Gone between the two operations (it is never deleted, so only a concurrent write explains it): try again.
    if (stored === null) throw new MongoUnavailableError();

    return stored;
  }

  /** The collection for a write, created once per process with its validator; a database that is already set up is left as it is. */
  private async collection(): Promise<Collection<StoredHistory>> {
    this.prepared ??= this.prepare().catch((error: unknown) => {
      this.prepared = null;
      throw unavailable(error);
    });
    await this.prepared;

    return this.mongo.database().collection<StoredHistory>(HISTORY_COLLECTION);
  }

  private async prepare(): Promise<void> {
    try {
      await this.mongo.database().createCollection(HISTORY_COLLECTION, { validator: COLLECTION_VALIDATOR });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === NAMESPACE_EXISTS) return;
      // A user with read and write only may not create collections: the backend still works, without the validator.
      if (error instanceof MongoServerError && error.code === UNAUTHORIZED) {
        this.logger.warn(`collection=${HISTORY_COLLECTION} created without its validator: not authorized`);

        return;
      }
      throw error;
    }
  }
}
