import { Logger } from '@nestjs/common';
import type { DbTx, TransactionRunner } from '../../../infrastructure/database/transaction-runner';
import { MongoUnavailableError } from '../../../infrastructure/mongodb/mongodb.errors';
import { snapshotHashOf } from '../invocation-history/invocation-history-hash.policy';
import type { InvocationHistoryOutboxRepo } from '../invocation-history/invocation-history-outbox.repo';
import type { InvocationHistoryStoreRepo } from '../invocation-history/invocation-history-store.repo';
import { HistoryWriteRefusedError } from '../invocation-history/invocation-history.errors';
import type { ClaimedDelivery, HistorySnapshot } from '../invocation-history/invocation-history.types';
import { HistoryDeliveryService } from './history-delivery.service';

const TX = { fake: 'transaction' } as unknown as DbTx;
const SNAPSHOT: HistorySnapshot = {
  context: { generatedAt: '2026-11-15T10:00:00.000Z', requests: [] },
  promptText: 'the prompt',
  rawResponse: 'the raw answer',
  parsed: { items: [] },
  validation: null,
};

const row = (overrides: Partial<ClaimedDelivery> = {}): ClaimedDelivery => ({
  id: `d-${Math.random()}`,
  organizationId: 'org-1',
  invocationId: 'inv-1',
  generation: 0,
  version: 2,
  operation: 'SNAPSHOT',
  payload: SNAPSHOT,
  attempts: 1,
  ...overrides,
});

function world(claimed: ClaimedDelivery[]) {
  const outbox = {
    claimDue: jest.fn<Promise<ClaimedDelivery[]>, [DbTx, { operation: string | null }]>(() => Promise.resolve(claimed)),
    acknowledge: jest.fn(() => Promise.resolve(true)),
    closeObsolete: jest.fn(() => Promise.resolve(true)),
    retryLater: jest.fn<Promise<void>, [ClaimedDelivery, string, Date, string]>(() => Promise.resolve()),
    park: jest.fn(() => Promise.resolve(true)),
  };
  const store = {
    writeSnapshot: jest.fn<Promise<'WRITTEN' | 'OBSOLETE' | 'RETRY'>, [{ payloadHash: string }]>(() =>
      Promise.resolve('WRITTEN'),
    ),
    writeTombstone: jest.fn(() => Promise.resolve<'WRITTEN' | 'RETRY'>('WRITTEN')),
  };
  const run = jest.fn(<T>(work: (tx: DbTx) => Promise<T>) => work(TX));
  const service = new HistoryDeliveryService(
    { run } as unknown as TransactionRunner,
    outbox as unknown as InvocationHistoryOutboxRepo,
    store as unknown as InvocationHistoryStoreRepo,
  );

  return { service, outbox, store };
}

describe('HistoryDeliveryService.deliverDue', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('writes each snapshot with the hash of its payload, then acknowledges it under the lease of the claim', async () => {
    const claimed = [row(), row({ invocationId: 'inv-2' }), row({ invocationId: 'inv-3' })];
    const { service, outbox, store } = world(claimed);

    await expect(service.deliverDue()).resolves.toEqual({
      claimed: 3,
      delivered: 3,
      obsolete: 0,
      retried: 0,
      parked: 0,
      leaseLost: 0,
    });
    expect(store.writeSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        invocationId: 'inv-1',
        version: 2,
        generation: 0,
        payloadHash: snapshotHashOf(SNAPSHOT),
      }),
    );
    const leaseToken = (outbox.claimDue.mock.calls[0][1] as unknown as { leaseToken: string }).leaseToken;
    expect(outbox.acknowledge).toHaveBeenCalledWith(TX, claimed[0], leaseToken, expect.any(Date));
  });

  it('writes a tombstone for a PURGE row, and claims PURGE rows only when asked', async () => {
    const { service, store, outbox } = world([row({ operation: 'PURGE', payload: null, generation: 1 })]);

    await service.deliverDue('PURGE');

    expect(outbox.claimDue.mock.calls[0][1]).toMatchObject({ operation: 'PURGE', limit: 20 });
    expect(store.writeTombstone).toHaveBeenCalledWith(
      expect.objectContaining({ invocationId: 'inv-1', generation: 1 }),
    );
    expect(outbox.acknowledge).toHaveBeenCalledTimes(1);
  });

  it('closes a snapshot MongoDB already holds a later version or a tombstone for, without moving the call', async () => {
    const { service, store, outbox } = world([row()]);
    store.writeSnapshot.mockResolvedValueOnce('OBSOLETE');

    await expect(service.deliverDue()).resolves.toMatchObject({ obsolete: 1, delivered: 0 });
    expect(outbox.closeObsolete).toHaveBeenCalledTimes(1);
    expect(outbox.acknowledge).not.toHaveBeenCalled();
  });

  it('keeps a row for later when MongoDB is down or a write crossed another: never dropped, never acknowledged', async () => {
    const { service, store, outbox } = world([row({ attempts: 3 }), row()]);
    store.writeSnapshot.mockRejectedValueOnce(new MongoUnavailableError()).mockResolvedValueOnce('RETRY');

    await expect(service.deliverDue()).resolves.toMatchObject({ retried: 2, delivered: 0 });
    expect(outbox.retryLater).toHaveBeenCalledWith(
      expect.objectContaining({ attempts: 3 }),
      expect.any(String),
      expect.any(Date),
      'MONGODB_UNAVAILABLE',
    );
    expect(outbox.retryLater).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      expect.any(Date),
      'WRITE_RACE',
    );
    expect(outbox.acknowledge).not.toHaveBeenCalled();
  });

  it('parks a row MongoDB refused for good, and one whose payload does not decode', async () => {
    const { service, store, outbox } = world([row(), row({ payload: { context: 'not a context' } })]);
    store.writeSnapshot.mockRejectedValueOnce(new HistoryWriteRefusedError('CONTENT_CONFLICT'));

    await expect(service.deliverDue()).resolves.toMatchObject({ parked: 2 });
    expect(outbox.park).toHaveBeenCalledWith(
      TX,
      expect.anything(),
      expect.any(String),
      'CONTENT_CONFLICT',
      expect.any(Date),
    );
    expect(outbox.park).toHaveBeenCalledWith(
      TX,
      expect.anything(),
      expect.any(String),
      'PAYLOAD_INVALID',
      expect.any(Date),
    );
  });

  it('never logs what the history holds', async () => {
    const warned = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { service, store } = world([row()]);
    store.writeSnapshot.mockRejectedValueOnce(new Error('the prompt mongodb+srv://u:s3cr3t@x'));

    await service.deliverDue();

    expect(JSON.stringify(warned.mock.calls)).not.toMatch(/the prompt|s3cr3t/);
  });
});

describe('HistoryDeliveryService.drainPurges', () => {
  it('stops after a round where MongoDB took nothing: the rest waits for the worker and the next run', async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const tombstones = Array.from({ length: 45 }, (_, index) =>
      row({ id: `t-${index}`, operation: 'PURGE', payload: null }),
    );
    const { service, outbox, store } = world([]);
    outbox.claimDue
      .mockResolvedValueOnce(tombstones.slice(0, 20))
      .mockResolvedValueOnce(tombstones.slice(20, 40))
      .mockResolvedValueOnce(tombstones.slice(40))
      .mockResolvedValue([]);
    store.writeTombstone.mockRejectedValue(new MongoUnavailableError());

    await expect(service.drainPurges()).resolves.toBe(0);
    expect(outbox.claimDue).toHaveBeenCalledTimes(1);
    expect(store.writeTombstone).toHaveBeenCalledTimes(20);
  });

  it('runs rounds of tombstones until none is due, and counts what MongoDB confirmed', async () => {
    const { service, outbox } = world([]);
    outbox.claimDue
      .mockResolvedValueOnce([row({ operation: 'PURGE', payload: null }), row({ operation: 'PURGE', payload: null })])
      .mockResolvedValueOnce([row({ operation: 'PURGE', payload: null })])
      .mockResolvedValueOnce([]);

    await expect(service.drainPurges()).resolves.toBe(3);
    expect(outbox.claimDue).toHaveBeenCalledTimes(3);
  });

  it('ends while MongoDB is down, even when one pass over the tombstones outlasts their backoff', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-16T00:00:00.000Z') });
    try {
      const { service, outbox, store } = world([]);
      // The outbox in memory: a row is due when it is available by the claim's cut-off; a retry puts it back for later.
      const queue = Array.from({ length: 4 }, (_, index) => ({
        row: row({ id: `t-${index}`, operation: 'PURGE', payload: null }),
        availableAt: new Date(),
      }));
      outbox.claimDue.mockImplementation((_tx, input) => {
        if (outbox.claimDue.mock.calls.length > 50) throw new Error('the drain does not end');
        const { dueBy, now } = input as unknown as { dueBy?: Date; now: Date };
        const cutOff = dueBy ?? now;

        return Promise.resolve(queue.filter((entry) => entry.availableAt <= cutOff).map((entry) => entry.row));
      });
      outbox.retryLater.mockImplementation((delivery: ClaimedDelivery, _lease: string, availableAt: Date) => {
        queue.find((entry) => entry.row.id === delivery.id)!.availableAt = availableAt;

        return Promise.resolve();
      });
      // Each failed write takes ten minutes: longer than the longest backoff (300 s).
      store.writeTombstone.mockImplementation(() => {
        jest.setSystemTime(Date.now() + 600_000);

        return Promise.reject(new MongoUnavailableError());
      });

      await expect(service.drainPurges()).resolves.toBe(0);
      expect(store.writeTombstone).toHaveBeenCalledTimes(4);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('HistoryDeliveryService leases', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  it('starts no row it could not finish under the lease of the claim; those rows are left for the next claim', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-16T00:00:00.000Z') });
    try {
      const claimed = Array.from({ length: 20 }, (_, index) => row({ id: `s-${index}` }));
      const { service, store, outbox } = world(claimed);
      // A slow MongoDB: every write takes 30 s, so the second wave would start with the lease (60 s) nearly gone.
      store.writeSnapshot.mockImplementation(() => {
        jest.setSystemTime(Date.now() + 30_000);

        return Promise.resolve('WRITTEN');
      });

      const round = await service.deliverDue();

      expect(store.writeSnapshot).toHaveBeenCalledTimes(2);
      expect(outbox.acknowledge).toHaveBeenCalledTimes(2);
      expect(round).toMatchObject({ claimed: 20, delivered: 2, leaseLost: 18 });
    } finally {
      jest.useRealTimers();
    }
  });

  it('counts a row whose lease another claim took as lost, not as delivered or closed', async () => {
    const { service, outbox, store } = world([row({ id: 'a' }), row({ id: 'b' })]);
    outbox.acknowledge.mockResolvedValueOnce(false);
    store.writeSnapshot.mockResolvedValueOnce('WRITTEN').mockResolvedValueOnce('OBSOLETE');
    outbox.closeObsolete.mockResolvedValueOnce(false);

    await expect(service.deliverDue()).resolves.toMatchObject({ claimed: 2, delivered: 0, obsolete: 0, leaseLost: 2 });
  });

  it('does not take a PostgreSQL error after a crossed write for a failed MongoDB write, nor retry it under another code', async () => {
    const { service, outbox, store } = world([row()]);
    store.writeSnapshot.mockResolvedValueOnce('RETRY');
    outbox.retryLater.mockRejectedValueOnce(new Error('connection reset'));

    await expect(service.deliverDue()).rejects.toThrow('connection reset');
    expect(outbox.retryLater).toHaveBeenCalledTimes(1);
    expect(outbox.retryLater).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      expect.any(Date),
      'WRITE_RACE',
    );
  });

  it('counts a park under a lost lease as lost', async () => {
    const { service, outbox, store } = world([row()]);
    store.writeSnapshot.mockRejectedValueOnce(new HistoryWriteRefusedError('SCOPE_CONFLICT'));
    outbox.park.mockResolvedValueOnce(false);

    await expect(service.deliverDue()).resolves.toMatchObject({ parked: 0, leaseLost: 1 });
  });
});
