import { BSON, type Db, MongoServerError } from 'mongodb';
import type { MongoConnection } from '../../../infrastructure/mongodb/mongodb-connection.service';
import { MongoUnavailableError } from '../../../infrastructure/mongodb/mongodb.errors';
import { HistoryWriteRefusedError } from './invocation-history.errors';
import { InvocationHistoryStoreRepo } from './invocation-history-store.repo';
import type { HistorySnapshot } from './invocation-history.types';

function world() {
  const collection = {
    findOne: jest.fn<Promise<Record<string, unknown> | null>, []>(() => Promise.resolve(null)),
    updateOne: jest.fn(() => Promise.resolve({ matchedCount: 1, upsertedCount: 0 })),
    insertOne: jest.fn(() => Promise.resolve({ acknowledged: true })),
  };
  const database = {
    createCollection: jest.fn(() => Promise.resolve()),
    collection: jest.fn(() => collection),
  };
  const mongo = { database: () => database as unknown as Db } as unknown as MongoConnection;

  return { store: new InvocationHistoryStoreRepo(mongo), database, collection };
}

describe('InvocationHistoryStoreRepo', () => {
  it('reads without creating the collection: the API reads MongoDB and never writes it, not even its schema', async () => {
    const { store, database, collection } = world();

    await expect(store.find('7b0e4b5e-0000-4000-8000-000000000001', 'org-1')).resolves.toBeNull();

    expect(collection.findOne).toHaveBeenCalledTimes(1);
    expect(database.createCollection).not.toHaveBeenCalled();
  });

  it('creates the collection with its validator once, before the first write of the process', async () => {
    const { store, database } = world();
    const tombstone = {
      invocationId: '7b0e4b5e-0000-4000-8000-000000000001',
      organizationId: 'org-1',
      generation: 1,
      at: new Date(),
    };

    await store.writeTombstone(tombstone);
    await store.writeTombstone(tombstone);

    expect(database.createCollection).toHaveBeenCalledTimes(1);
    expect(database.createCollection).toHaveBeenCalledWith(
      'ai_invocation_histories',
      expect.objectContaining({ validator: expect.any(Object) as unknown }),
    );
  });

  describe('a write MongoDB fails (O-5)', () => {
    const ID = '7b0e4b5e-0000-4000-8000-000000000001';
    const snapshot = {
      invocationId: ID,
      organizationId: 'org-1',
      generation: 0,
      version: 1,
      payloadHash: 'h1',
      snapshot: {
        context: null,
        promptText: 'p',
        rawResponse: 'r',
        parsed: null,
        validation: null,
      } as unknown as HistorySnapshot,
      at: new Date(),
    };

    it.each([
      [
        'the validator refuses the document (121)',
        () => new MongoServerError({ code: 121, errmsg: 'Document failed validation' }),
      ],
      [
        'the document is over the size limit (10334)',
        () => new MongoServerError({ code: 10334, errmsg: 'BSONObj size is invalid' }),
      ],
      ['the driver cannot encode it', () => new BSON.BSONError('Unsupported type')],
    ])('refuses for good when %s: the delivery parks it, MongoDB is not down', async (_what, failure) => {
      const { store, collection } = world();
      collection.updateOne.mockRejectedValue(failure());

      await expect(store.writeSnapshot(snapshot)).rejects.toMatchObject({ refusal: 'PAYLOAD_INVALID' });
      await expect(store.writeSnapshot(snapshot)).rejects.toBeInstanceOf(HistoryWriteRefusedError);
    });

    it('stays a MongoDB that is down for a failure that may pass: a timeout, a refused connection, a server that does not answer', async () => {
      const { store, collection } = world();
      collection.updateOne.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.1:27017'));

      const error = await store.writeSnapshot(snapshot).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(MongoUnavailableError);
      expect(error).not.toBeInstanceOf(HistoryWriteRefusedError);
    });
  });

  describe('two deliveries of one call crossing (v1 and v2 in the same wave, no document yet)', () => {
    const ID = '7b0e4b5e-0000-4000-8000-000000000001';
    const SNAPSHOT = { context: null, promptText: 'p', rawResponse: 'r', parsed: null, validation: null };
    const duplicateKey = () => new MongoServerError({ code: 11000, errmsg: 'E11000 duplicate key' });
    const existing = (fields: Record<string, unknown>) => ({
      _id: ID,
      organizationId: 'org-1',
      generation: 1,
      version: 1,
      payloadHash: 'h1',
      purged: false,
      ...fields,
    });
    const snapshotV2 = {
      invocationId: ID,
      organizationId: 'org-1',
      generation: 1,
      version: 2,
      payloadHash: 'h2',
      snapshot: SNAPSHOT as unknown as HistorySnapshot,
      at: new Date(),
    };

    it('writes the later snapshot over the earlier one that won the insert, at once: never put back to wait', async () => {
      const { store, collection } = world();
      collection.updateOne.mockResolvedValueOnce({ matchedCount: 0, upsertedCount: 0 });
      collection.insertOne.mockRejectedValueOnce(duplicateKey());
      collection.findOne.mockResolvedValueOnce(existing({ version: 1 }));

      await expect(store.writeSnapshot(snapshotV2)).resolves.toBe('WRITTEN');
      expect(collection.updateOne).toHaveBeenCalledTimes(2);
    });

    it('writes the tombstone over a snapshot that won the insert, at once', async () => {
      const { store, collection } = world();
      collection.updateOne.mockResolvedValueOnce({ matchedCount: 0, upsertedCount: 0 });
      collection.insertOne.mockRejectedValueOnce(duplicateKey());
      collection.findOne.mockResolvedValueOnce(existing({ generation: 1 }));

      await expect(
        store.writeTombstone({ invocationId: ID, organizationId: 'org-1', generation: 2, at: new Date() }),
      ).resolves.toBe('WRITTEN');
      expect(collection.updateOne).toHaveBeenCalledTimes(2);
    });

    it('still answers RETRY when the document keeps changing under the write, so the outbox waits instead of spinning', async () => {
      const { store, collection } = world();
      collection.updateOne.mockResolvedValue({ matchedCount: 0, upsertedCount: 0 });
      collection.insertOne.mockRejectedValue(duplicateKey());
      collection.findOne.mockResolvedValue(existing({ version: 1 }));

      await expect(store.writeSnapshot(snapshotV2)).resolves.toBe('RETRY');
      expect(collection.updateOne.mock.calls.length).toBeLessThanOrEqual(3);
    });
  });
});
