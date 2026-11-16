import type { DbTx, TransactionRunner } from '../../../infrastructure/database/transaction-runner';
import { MongoUnavailableError } from '../../../infrastructure/mongodb/mongodb.errors';
import type { AuthenticatedPrincipal } from '../../../infrastructure/security/tokens/access-token-verifier.port';
import type { AuditApi } from '../../audit/public/audit.api';
import type { AuditEventInput } from '../../audit/public/audit.types';
import type { InvocationHistoryOutboxRepo } from '../invocation-history/invocation-history-outbox.repo';
import type { InvocationHistoryStoreRepo } from '../invocation-history/invocation-history-store.repo';
import { HistoryDocumentShapeError } from '../invocation-history/invocation-history.errors';
import type { HistoryDocument, HistoryStanding } from '../invocation-history/invocation-history.types';
import type { InvocationResult } from '../invocation/invocation-result.json';
import type { AiInvocationRepo } from '../invocation/invocation.repo';
import {
  InvocationContentNotFoundError,
  InvocationContentPendingError,
  InvocationContentUnavailableError,
} from './invocation-content.errors';
import { InvocationContentQueryService } from './invocation-content-query.service';

const TX = { fake: 'transaction' } as unknown as DbTx;
const INVOCATION_ID = '3f0c7d54-9e1b-4f6a-8d2c-5b7a1e9c0d11';
const ORGANIZATION_ID = '0a000000-0000-4000-8000-000000000001';
const ADMIN = {
  subject: 'admin',
  appUserId: 'b0000000-0000-4000-8000-000000000001',
  sessionId: 'session-1',
  employeeId: 'e0000000-0000-4000-8000-000000000001',
  directRoles: ['SUPER_ADMIN'],
  roles: ['SUPER_ADMIN'],
} as unknown as AuthenticatedPrincipal;

const STANDING: HistoryStanding = {
  invocationId: INVOCATION_ID,
  organizationId: ORGANIZATION_ID,
  state: 'AVAILABLE',
  version: 2,
  storedVersion: 2,
  generation: 0,
};

const DOCUMENT: HistoryDocument = {
  invocationId: INVOCATION_ID,
  organizationId: ORGANIZATION_ID,
  generation: 0,
  version: 2,
  payloadHash: 'h',
  purged: false,
  context: { generatedAt: '2026-11-04T09:00:00.000Z', requests: [] },
  promptText: 'the prompt',
  rawResponse: '{"items":[]}',
  parsed: { items: [] },
  validation: { rejections: [] },
};

const RESULT: InvocationResult = { total: 0, steps: [], accepted: [], rejections: [] };

function world(
  options: {
    standing?: HistoryStanding | null;
    locked?: HistoryStanding | null;
    document?: HistoryDocument | null;
  } = {},
) {
  const order: string[] = [];
  const events: AuditEventInput[] = [];
  const standing = options.standing === undefined ? STANDING : options.standing;
  const outbox = {
    standingOf: jest.fn((_id: string, tx?: DbTx) => {
      order.push(tx === undefined ? 'standing' : 'lock');

      return Promise.resolve(tx === undefined || options.locked === undefined ? standing : options.locked);
    }),
  };
  const store = {
    find: jest.fn(() => {
      order.push('mongo');

      return Promise.resolve(options.document === undefined ? DOCUMENT : options.document);
    }),
  };
  const invocations = { resultOf: jest.fn(() => Promise.resolve(RESULT)) };
  const audit = {
    record: jest.fn((_tx: DbTx, event: AuditEventInput) => {
      order.push('audit');
      events.push(event);
      return Promise.resolve();
    }),
  };
  const run = jest.fn(<T>(work: (tx: DbTx) => Promise<T>) => work(TX));
  const service = new InvocationContentQueryService(
    { run } as unknown as TransactionRunner,
    invocations as unknown as AiInvocationRepo,
    outbox as unknown as InvocationHistoryOutboxRepo,
    store as unknown as InvocationHistoryStoreRepo,
    audit as unknown as AuditApi,
  );

  return { service, outbox, store, audit, run, events, order };
}

describe('InvocationContentQueryService.read', () => {
  it('gives the raw history from MongoDB with the result from PostgreSQL', async () => {
    const { service, store } = world();

    await expect(service.read(ADMIN, INVOCATION_ID)).resolves.toEqual({
      invocationId: INVOCATION_ID,
      context: DOCUMENT.context,
      promptText: 'the prompt',
      rawResponse: '{"items":[]}',
      parsed: { items: [] },
      result: RESULT,
    });
    // The organization of the filter is the one PostgreSQL holds for the call, never one the caller sent.
    expect(store.find).toHaveBeenCalledWith(INVOCATION_ID, ORGANIZATION_ID);
  });

  it('reads MongoDB outside the transaction, then locks the call, checks it again and writes one event with no content', async () => {
    const { service, events, order, run } = world();

    await service.read(ADMIN, INVOCATION_ID);

    expect(order).toEqual(['standing', 'mongo', 'lock', 'audit']);
    expect(run).toHaveBeenCalledTimes(1);
    expect(events).toEqual([
      {
        organizationId: ORGANIZATION_ID,
        actorKind: 'USER',
        actorAppUserId: ADMIN.appUserId,
        actorRoles: ['SUPER_ADMIN'],
        action: 'AI_INVOCATION.CONTENT_READ',
        resourceType: 'AiInvocation',
        resourceId: INVOCATION_ID,
        after: { invocationId: INVOCATION_ID },
        correlationId: 'session-1',
      },
    ]);
    const payload = JSON.stringify(events[0]);
    for (const content of ['the prompt', '{\\"items\\"', 'generatedAt']) expect(payload).not.toContain(content);
  });

  it('writes an event on every read, the same call read twice included', async () => {
    const { service, events } = world();

    await service.read(ADMIN, INVOCATION_ID);
    await service.read(ADMIN, INVOCATION_ID);

    expect(events).toHaveLength(2);
  });

  it.each([
    ['no such call', null],
    ['a history being purged', { ...STANDING, state: 'PURGING' as const }],
    ['a purged history', { ...STANDING, state: 'PURGED' as const }],
  ])('answers not found for %s, without reading MongoDB', async (_label, standing) => {
    const { service, store, audit } = world({ standing });

    await expect(service.read(ADMIN, INVOCATION_ID)).rejects.toThrow(InvocationContentNotFoundError);
    expect(store.find).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('answers pending while MongoDB has not confirmed the last snapshot: an earlier one is never served as the last', async () => {
    const pending = world({ standing: { ...STANDING, state: 'PENDING', storedVersion: 1 } });
    await expect(pending.service.read(ADMIN, INVOCATION_ID)).rejects.toThrow(InvocationContentPendingError);
    expect(pending.store.find).not.toHaveBeenCalled();

    const older = world({ document: { ...DOCUMENT, version: 1 } });
    await expect(older.service.read(ADMIN, INVOCATION_ID)).rejects.toThrow(InvocationContentPendingError);
    expect(older.audit.record).not.toHaveBeenCalled();
  });

  it('answers unavailable for a refused history, MongoDB down, or a document of another shape; nothing is recorded', async () => {
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
      await expect(setup.service.read(ADMIN, INVOCATION_ID)).rejects.toThrow(InvocationContentUnavailableError);
      expect(setup.audit.record).not.toHaveBeenCalled();
    }
  });

  it('answers not found for a tombstone or a document of an older purge generation', async () => {
    for (const document of [
      { ...DOCUMENT, purged: true, context: null },
      { ...DOCUMENT, generation: 0 },
    ]) {
      const { service } = world({ standing: { ...STANDING, generation: document.purged ? 0 : 1 }, document });
      await expect(service.read(ADMIN, INVOCATION_ID)).rejects.toThrow(InvocationContentNotFoundError);
    }
  });

  it('gives nothing when a purge or a newer snapshot came between the read of MongoDB and the lock', async () => {
    const purged = world({ locked: { ...STANDING, state: 'PURGING' } });
    await expect(purged.service.read(ADMIN, INVOCATION_ID)).rejects.toThrow(InvocationContentNotFoundError);
    expect(purged.audit.record).not.toHaveBeenCalled();

    const newer = world({ locked: { ...STANDING, version: 3, storedVersion: 3 } });
    await expect(newer.service.read(ADMIN, INVOCATION_ID)).rejects.toThrow(InvocationContentPendingError);
    expect(newer.audit.record).not.toHaveBeenCalled();
  });

  it('refuses an id that is not a UUID as not found, without reading', async () => {
    const { service, outbox, run } = world();

    await expect(service.read(ADMIN, 'not-an-id')).rejects.toThrow(InvocationContentNotFoundError);
    expect(outbox.standingOf).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it('gives nothing back when the event cannot be written: the read is not answered unrecorded', async () => {
    const { service, audit } = world();
    audit.record.mockRejectedValueOnce(new Error('audit failed'));

    await expect(service.read(ADMIN, INVOCATION_ID)).rejects.toThrow('audit failed');
  });
});
