import { randomBytes } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { MongoClient } from 'mongodb';
import { MONGO_RUNTIME_ADAPTERS } from '../../src/infrastructure/mongodb/mongodb-infrastructure.module';
import { TransactionRunner } from '../../src/infrastructure/database/transaction-runner';
import { HistoryDeliveryService } from '../../src/modules/ai-assist/history-delivery/history-delivery.service';
import { InvocationHistoryOutboxRepo } from '../../src/modules/ai-assist/invocation-history/invocation-history-outbox.repo';
import { InvocationHistoryStoreRepo } from '../../src/modules/ai-assist/invocation-history/invocation-history-store.repo';
import { HISTORY_COLLECTION } from '../../src/modules/ai-assist/invocation-history/invocation-history.types';

/**
 * A MongoDB database of its own for one suite (ADR-0020), dropped at the end: the store of the raw AI history, as the disposable
 * PostgreSQL database is for the rest. Reads `TEST_MONGODB_URI` only (never `.env`, never `MONGODB_URI`), and refuses a server that
 * is not on this machine, as the PostgreSQL helper does: a suite never writes into a shared cluster.
 */
export interface DisposableHistoryStore {
  uri: string;
  database: string;
  client: MongoClient;
  /** The variables the application reads to reach this database. */
  env: { MONGODB_URI: string; MONGODB_DATABASE: string };
}

const LOOPBACK = /^mongodb:\/\/(?:[^@/]+@)?(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?(?:\/|$)/;

export async function provisionHistoryStore(): Promise<DisposableHistoryStore> {
  const uri = process.env.TEST_MONGODB_URI;
  if (uri === undefined || uri === '') {
    throw new Error('TEST_MONGODB_URI is required (mongodb://127.0.0.1:27017 of a MongoDB for tests).');
  }
  if (!LOOPBACK.test(uri)) throw new Error('TEST_MONGODB_URI must point to a MongoDB on this machine.');
  const database = `slm_it_${randomBytes(6).toString('hex')}`;
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5_000, runtimeAdapters: MONGO_RUNTIME_ADAPTERS });
  await client.connect();

  return { uri, database, client, env: { MONGODB_URI: uri, MONGODB_DATABASE: database } };
}

export async function dropHistoryStore(store: DisposableHistoryStore): Promise<void> {
  try {
    await store.client.db(store.database).dropDatabase();
  } finally {
    await store.client.close();
  }
}

/** The documents of the raw history, by id, as MongoDB holds them. */
export function historyDocument(store: DisposableHistoryStore, invocationId: string) {
  return store.client
    .db(store.database)
    .collection<{ _id: string } & Record<string, unknown>>(HISTORY_COLLECTION)
    .findOne({ _id: invocationId });
}

/**
 * What the worker does, run in the test app until no row is due: the outbox delivered to MongoDB. The API graph holds the outbox
 * and the store; the delivery service itself belongs to the worker graph, so it is built here from them.
 */
export async function deliverHistory(app: INestApplication): Promise<void> {
  const delivery = new HistoryDeliveryService(
    app.get(TransactionRunner, { strict: false }),
    app.get(InvocationHistoryOutboxRepo, { strict: false }),
    app.get(InvocationHistoryStoreRepo, { strict: false }),
  );
  for (;;) {
    const round = await delivery.deliverDue();
    if (round.claimed === 0) return;
  }
}
