import type { DbTx } from '../../../infrastructure/database/transaction-runner';
import { MongoUnavailableError } from '../../../infrastructure/mongodb/mongodb.errors';
import type { InvocationResult } from '../invocation/invocation-result.json';
import type { AiInvocationRepo } from '../invocation/invocation.repo';
import type { InvocationOutcome } from '../invocation/invocation.types';
import { MongoInvocationHistoryRepo } from './invocation-history-mongo.repo';
import type { InvocationHistoryOutboxRepo } from './invocation-history-outbox.repo';
import type { InvocationHistoryStoreRepo } from './invocation-history-store.repo';
import {
  HistoryDocumentShapeError,
  InvocationContentPendingError,
  InvocationContentUnavailableError,
} from './invocation-history.errors';
import type { HistoryDocument, HistoryStanding } from './invocation-history.types';

const TX = { fake: 'transaction' } as unknown as DbTx;
const INVOCATION_ID = '3f0c7d54-9e1b-4f6a-8d2c-5b7a1e9c0d11';
const ORGANIZATION_ID = '0a000000-0000-4000-8000-000000000001';

const STANDING: HistoryStanding = {
  invocationId: INVOCATION_ID,
  organizationId: ORGANIZATION_ID,
  state: 'AVAILABLE',
  version: 2,
  storedVersion: 2,
  generation: 0,
};

const CONTEXT = { generatedAt: '2026-11-04T09:00:00.000Z', requests: [] };
const DOCUMENT: HistoryDocument = {
  invocationId: INVOCATION_ID,
  organizationId: ORGANIZATION_ID,
  generation: 0,
  version: 2,
  payloadHash: 'h',
  purged: false,
  context: CONTEXT,
  promptText: 'the prompt',
  rawResponse: '{"items":[]}',
  parsed: { items: [] },
  validation: { rejections: [] },
};

const RESULT: InvocationResult = { total: 0, steps: [], accepted: [], rejections: [] };
const ANSWER: NonNullable<InvocationOutcome['content']> = {
  promptText: 'the prompt',
  rawResponse: '{"items":[]}',
  parsed: { items: [] },
  result: { ...RESULT, rejections: [{ sourceRef: 'R001', code: 'NUMBER_NOT_IN_SOURCE' }] },
};

function world(
  options: {
    standing?: HistoryStanding | null;
    locked?: HistoryStanding | null;
    document?: HistoryDocument | null;
    mode?: 'MODEL' | 'SIMULATED' | null;
  } = {},
) {
  const order: string[] = [];
  const standing = options.standing === undefined ? STANDING : options.standing;
  const outbox = {
    standingOf: jest.fn((_id: string, tx?: DbTx, lock?: boolean) => {
      order.push(lock === true ? 'lock' : 'standing');

      return Promise.resolve(
        tx === undefined || options.locked === undefined || lock !== true ? standing : options.locked,
      );
    }),
    enqueueSnapshot: jest.fn(() => Promise.resolve(true)),
    countPurgeable: jest.fn(() => Promise.resolve(5)),
    lockPurgeable: jest.fn(() => {
      order.push('lock-purgeable');

      return Promise.resolve(['a', 'b']);
    }),
    beginPurge: jest.fn(() => {
      order.push('begin-purge');

      return Promise.resolve();
    }),
  };
  const store = {
    find: jest.fn(() => {
      order.push('mongo');

      return Promise.resolve(options.document === undefined ? DOCUMENT : options.document);
    }),
  };
  const invocations = {
    resultOf: jest.fn(() => Promise.resolve(RESULT)),
    providerModeOf: jest.fn(() => Promise.resolve(options.mode === undefined ? 'MODEL' : options.mode)),
    dropResults: jest.fn(() => {
      order.push('drop-results');

      return Promise.resolve();
    }),
  };
  const repo = new MongoInvocationHistoryRepo(
    outbox as unknown as InvocationHistoryOutboxRepo,
    store as unknown as InvocationHistoryStoreRepo,
    invocations as unknown as AiInvocationRepo,
  );

  return { repo, outbox, store, invocations, order };
}

describe('MongoInvocationHistoryRepo.recordAdmitted / recordAnswered', () => {
  it('queues the context alone at the admission: nothing answered, nothing made up', async () => {
    const { repo, outbox } = world();
    const at = new Date();

    await repo.recordAdmitted(TX, {
      invocationId: INVOCATION_ID,
      organizationId: ORGANIZATION_ID,
      context: CONTEXT,
      at,
    });

    expect(outbox.enqueueSnapshot).toHaveBeenCalledWith(TX, {
      invocationId: INVOCATION_ID,
      organizationId: ORGANIZATION_ID,
      snapshot: { context: CONTEXT, promptText: null, rawResponse: null, parsed: null, validation: null },
      at,
    });
  });

  it('queues the whole raw history of an answered call, with why the checks rejected the lines they rejected', async () => {
    const { repo, outbox } = world();
    const at = new Date();

    await repo.recordAnswered(TX, {
      invocationId: INVOCATION_ID,
      organizationId: ORGANIZATION_ID,
      context: CONTEXT,
      answer: ANSWER,
      at,
    });

    expect(outbox.enqueueSnapshot).toHaveBeenCalledWith(TX, {
      invocationId: INVOCATION_ID,
      organizationId: ORGANIZATION_ID,
      snapshot: {
        context: CONTEXT,
        promptText: 'the prompt',
        rawResponse: '{"items":[]}',
        parsed: { items: [] },
        validation: { rejections: [{ sourceRef: 'R001', code: 'NUMBER_NOT_IN_SOURCE' }] },
      },
      at,
    });
  });

  it('records no validation for an answer whose checks never ran', async () => {
    const { repo, outbox } = world();

    await repo.recordAnswered(TX, {
      invocationId: INVOCATION_ID,
      organizationId: ORGANIZATION_ID,
      context: CONTEXT,
      answer: { ...ANSWER, result: null },
      at: new Date(),
    });

    expect(outbox.enqueueSnapshot).toHaveBeenCalledWith(
      TX,
      expect.objectContaining({ snapshot: expect.objectContaining({ validation: null }) as unknown }),
    );
  });
});

describe('MongoInvocationHistoryRepo.find', () => {
  it('gives the raw history from MongoDB with the result and the mode from PostgreSQL', async () => {
    const { repo, store } = world();

    await expect(repo.find(TX, INVOCATION_ID)).resolves.toEqual({
      invocationId: INVOCATION_ID,
      organizationId: ORGANIZATION_ID,
      providerMode: 'MODEL',
      context: CONTEXT,
      promptText: 'the prompt',
      rawResponse: '{"items":[]}',
      parsed: { items: [] },
      result: RESULT,
    });
    // The organization of the filter is the one PostgreSQL holds for the call, never one the caller sent.
    expect(store.find).toHaveBeenCalledWith(INVOCATION_ID, ORGANIZATION_ID);
  });

  it('decides on PostgreSQL first, reads MongoDB, then locks the call and checks it again', async () => {
    const { repo, order } = world();

    await repo.find(TX, INVOCATION_ID);

    expect(order).toEqual(['standing', 'mongo', 'lock']);
  });

  it('prepareRead decides on PostgreSQL and reads MongoDB with no transaction at all: the first phase takes none', async () => {
    const { repo, outbox, invocations, order } = world();

    const prepared = await repo.prepareRead(INVOCATION_ID);

    expect(prepared).toEqual({ invocationId: INVOCATION_ID, generation: 0, version: 2, document: DOCUMENT });
    expect(order).toEqual(['standing', 'mongo']);
    // The standing of the first phase is read without a transaction (the pool of PostgreSQL, not a held connection).
    expect(outbox.standingOf).toHaveBeenCalledTimes(1);
    expect(outbox.standingOf).toHaveBeenCalledWith(INVOCATION_ID);
    expect(invocations.resultOf).not.toHaveBeenCalled();
  });

  it('confirmRead takes the lock in the transaction it is given, and reads no MongoDB', async () => {
    const { repo, store, outbox, order } = world();
    const prepared = await repo.prepareRead(INVOCATION_ID);
    store.find.mockClear();
    order.length = 0;

    await expect(repo.confirmRead(TX, prepared as NonNullable<typeof prepared>)).resolves.toMatchObject({
      invocationId: INVOCATION_ID,
      providerMode: 'MODEL',
      result: RESULT,
    });

    expect(order).toEqual(['lock']);
    expect(store.find).not.toHaveBeenCalled();
    expect(outbox.standingOf).toHaveBeenLastCalledWith(INVOCATION_ID, TX, true);
  });

  it('confirmRead gives nothing when a purge committed, and refuses a newer snapshot, between the two phases', async () => {
    const world1 = world({ locked: { ...STANDING, state: 'PURGING' } });
    const prepared = (await world1.repo.prepareRead(INVOCATION_ID)) as NonNullable<unknown> as Parameters<
      typeof world1.repo.confirmRead
    >[1];
    await expect(world1.repo.confirmRead(TX, prepared)).resolves.toBeNull();

    const world2 = world({ locked: { ...STANDING, version: 3, storedVersion: 3 } });
    const prepared2 = (await world2.repo.prepareRead(INVOCATION_ID)) as NonNullable<unknown> as Parameters<
      typeof world2.repo.confirmRead
    >[1];
    await expect(world2.repo.confirmRead(TX, prepared2)).rejects.toThrow(InvocationContentPendingError);
  });

  it.each([
    ['no such call', null],
    ['a history being purging', { ...STANDING, state: 'PURGING' as const }],
    ['a purged history', { ...STANDING, state: 'PURGED' as const }],
  ])('gives nothing for %s, without reading MongoDB', async (_label, standing) => {
    const { repo, store } = world({ standing });

    await expect(repo.find(TX, INVOCATION_ID)).resolves.toBeNull();
    expect(store.find).not.toHaveBeenCalled();
  });

  it('answers pending while MongoDB has not confirmed the last snapshot: an earlier one is never served as the last', async () => {
    const pending = world({ standing: { ...STANDING, state: 'PENDING', storedVersion: 1 } });
    await expect(pending.repo.find(TX, INVOCATION_ID)).rejects.toThrow(InvocationContentPendingError);
    expect(pending.store.find).not.toHaveBeenCalled();

    const older = world({ document: { ...DOCUMENT, version: 1 } });
    await expect(older.repo.find(TX, INVOCATION_ID)).rejects.toThrow(InvocationContentPendingError);
  });

  it('answers unavailable for a refused history, MongoDB down, or a document of another shape', async () => {
    for (const setup of [
      world({ standing: { ...STANDING, state: 'ERROR' } }),
      (() => {
        const down = world();
        down.store.find.mockRejectedValueOnce(new MongoUnavailableError());

        return down;
      })(),
      (() => {
        const odd = world();
        odd.store.find.mockRejectedValueOnce(new HistoryDocumentShapeError());

        return odd;
      })(),
    ]) {
      await expect(setup.repo.find(TX, INVOCATION_ID)).rejects.toThrow(InvocationContentUnavailableError);
    }
  });

  it('gives nothing for a tombstone or a document of an older purge generation', async () => {
    for (const [document, generation] of [
      [{ ...DOCUMENT, purged: true, context: null }, 0],
      [{ ...DOCUMENT, generation: 0 }, 1],
    ] as const) {
      const { repo } = world({ standing: { ...STANDING, generation }, document });

      await expect(repo.find(TX, INVOCATION_ID)).resolves.toBeNull();
    }
  });

  it('gives nothing when a purge or a newer snapshot came between the read of MongoDB and the lock', async () => {
    const purged = world({ locked: { ...STANDING, state: 'PURGING' } });
    await expect(purged.repo.find(TX, INVOCATION_ID)).resolves.toBeNull();

    const newer = world({ locked: { ...STANDING, version: 3, storedVersion: 3 } });
    await expect(newer.repo.find(TX, INVOCATION_ID)).rejects.toThrow(InvocationContentPendingError);
  });

  it('gives nothing for a call whose row is gone', async () => {
    const { repo } = world({ mode: null });

    await expect(repo.find(TX, INVOCATION_ID)).resolves.toBeNull();
  });
});

describe('MongoInvocationHistoryRepo.countPurgeable / purge', () => {
  it('counts what the outbox counts', async () => {
    const { repo, outbox } = world();
    const before = new Date('2026-12-02T00:00:00.000Z');

    await expect(repo.countPurgeable(before)).resolves.toBe(5);
    expect(outbox.countPurgeable).toHaveBeenCalledWith(before);
  });

  it('locks the calls, drops their results, then begins the purge, in the transaction of the caller', async () => {
    const { repo, order, outbox, invocations } = world();
    const before = new Date('2026-12-02T00:00:00.000Z');

    await expect(repo.purge(TX, before)).resolves.toBe(2);

    expect(order).toEqual(['lock-purgeable', 'drop-results', 'begin-purge']);
    expect(outbox.lockPurgeable).toHaveBeenCalledWith(TX, before);
    expect(invocations.dropResults).toHaveBeenCalledWith(TX, ['a', 'b']);
    expect(outbox.beginPurge).toHaveBeenCalledWith(TX, ['a', 'b'], expect.any(Date));
  });

  it('does nothing when there is nothing to purge', async () => {
    const { repo, outbox, invocations } = world();
    outbox.lockPurgeable.mockResolvedValueOnce([]);

    await expect(repo.purge(TX, new Date())).resolves.toBe(0);
    expect(invocations.dropResults).not.toHaveBeenCalled();
    expect(outbox.beginPurge).not.toHaveBeenCalled();
  });
});
