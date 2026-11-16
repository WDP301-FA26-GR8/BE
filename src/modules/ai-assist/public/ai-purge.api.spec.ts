import type { DbTx, TransactionRunner } from '../../../infrastructure/database/transaction-runner';
import type { AuditApi } from '../../audit/public/audit.api';
import type { AuditEventInput } from '../../audit/public/audit.types';
import type { OrganizationReadApi } from '../../organization/public/organization-read.api';
import type { HistoryDeliveryService } from '../history-delivery/history-delivery.service';
import type { InvocationHistoryOutboxRepo } from '../invocation-history/invocation-history-outbox.repo';
import type { AiInvocationRepo } from '../invocation/invocation.repo';
import { AiPurgeApi } from './ai-purge.api';
import { AiPurgeRefusedError } from './ai-purge.errors';

const TX = { fake: 'transaction' } as unknown as DbTx;
const ORGANIZATION_ID = '0a000000-0000-4000-8000-000000000001';
const ids = (count: number) => Array.from({ length: count }, (_, index) => `id-${index}`);

function world(
  options: { count?: number; organization?: boolean; confirmed?: number; pending?: number; parked?: number } = {},
) {
  const count = options.count ?? 3;
  const order: string[] = [];
  const events: AuditEventInput[] = [];
  const outbox = {
    countPurgeable: jest.fn<Promise<number>, [Date, DbTx?]>(() => Promise.resolve(count)),
    lockPurgeable: jest.fn<Promise<string[]>, [DbTx, Date]>(() => {
      order.push('lock');
      return Promise.resolve(ids(count));
    }),
    beginPurge: jest.fn<Promise<void>, [DbTx, string[], Date]>(() => {
      order.push('purging');
      return Promise.resolve();
    }),
    countPendingPurges: jest.fn(() => Promise.resolve({ waiting: options.pending ?? 0, parked: options.parked ?? 0 })),
  };
  const invocations = {
    dropResults: jest.fn<Promise<void>, [DbTx, string[]]>(() => {
      order.push('results');
      return Promise.resolve();
    }),
  };
  const delivery = {
    drainPurges: jest.fn(() => {
      order.push('tombstones');
      return Promise.resolve(options.confirmed ?? count);
    }),
  };
  const audit = {
    record: jest.fn((_tx: DbTx, event: AuditEventInput) => {
      order.push('audit');
      events.push(event);
      return Promise.resolve();
    }),
  };
  const organizations = {
    getOrganization: jest.fn(() => Promise.resolve(options.organization === false ? null : { id: ORGANIZATION_ID })),
  };
  const run = jest.fn(<T>(work: (tx: DbTx) => Promise<T>) => work(TX));
  const api = new AiPurgeApi(
    { run } as unknown as TransactionRunner,
    invocations as unknown as AiInvocationRepo,
    outbox as unknown as InvocationHistoryOutboxRepo,
    delivery as unknown as HistoryDeliveryService,
    organizations as unknown as OrganizationReadApi,
    audit as unknown as AuditApi,
  );

  return { api, outbox, invocations, delivery, audit, run, events, order };
}

describe('AiPurgeApi.purge', () => {
  describe('a dry run', () => {
    it('counts what the cut-off would purge and what is still pending, and writes nothing', async () => {
      const { api, outbox, delivery, audit, run } = world({ count: 7, pending: 2 });

      await expect(api.purge({ through: '2026-12-01', apply: false, operator: null })).resolves.toEqual({
        mode: 'DRY_RUN',
        through: '2026-12-01',
        contentCount: 7,
        confirmedCount: 0,
        pendingCount: 2,
        parkedCount: 0,
      });
      expect(outbox.beginPurge).not.toHaveBeenCalled();
      expect(delivery.drainPurges).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
      expect(run).not.toHaveBeenCalled();
    });

    it('counts the calls created before the start of the day after --through (UTC): the whole of that day is in', async () => {
      const { api, outbox } = world();

      await api.purge({ through: '2026-12-31', apply: false, operator: null });

      expect(outbox.countPurgeable).toHaveBeenCalledWith(new Date('2027-01-01T00:00:00.000Z'));
    });
  });

  describe('with --apply', () => {
    const command = { through: '2026-12-01', apply: true, operator: 'ops-lead' } as const;

    it('purges logically in one transaction with AI_INVOCATION.PURGED, then writes the tombstones after the commit', async () => {
      const { api, outbox, invocations, events, order, run } = world({ count: 4 });

      await expect(api.purge(command)).resolves.toEqual({
        mode: 'APPLIED',
        through: '2026-12-01',
        contentCount: 4,
        confirmedCount: 4,
        pendingCount: 0,
        parkedCount: 0,
      });

      expect(run).toHaveBeenCalledTimes(1);
      expect(outbox.lockPurgeable).toHaveBeenCalledWith(TX, new Date('2026-12-02T00:00:00.000Z'));
      expect(invocations.dropResults).toHaveBeenCalledWith(TX, ids(4));
      expect(outbox.beginPurge).toHaveBeenCalledWith(TX, ids(4), expect.any(Date));
      expect(order).toEqual(['lock', 'results', 'purging', 'audit', 'tombstones']);
      expect(events).toEqual([
        {
          organizationId: ORGANIZATION_ID,
          actorKind: 'OPERATOR',
          actorAppUserId: null,
          actorRoles: [],
          action: 'AI_INVOCATION.PURGED',
          resourceType: 'AiInvocationContent',
          resourceId: '2026-12-01',
          after: { deletedCount: 4, through: '2026-12-01' },
          correlationId: expect.any(String) as unknown,
          operatorReference: 'ops-lead',
        },
      ]);
    });

    it('reports the tombstones MongoDB did not take, so the command does not claim it finished', async () => {
      const { api } = world({ count: 3, confirmed: 1, pending: 2 });

      await expect(api.purge(command)).resolves.toMatchObject({ contentCount: 3, confirmedCount: 1, pendingCount: 2 });
    });

    it('reports the tombstones MongoDB refused for good apart from the ones still waiting: running again does not take them', async () => {
      const { api } = world({ count: 2, confirmed: 1, pending: 0, parked: 1 });

      await expect(api.purge(command)).resolves.toMatchObject({ confirmedCount: 1, pendingCount: 0, parkedCount: 1 });
    });

    it('writes no event when there was nothing new to purge, and still finishes the tombstones of an earlier run', async () => {
      const { api, audit, delivery } = world({ count: 0, confirmed: 2 });

      await expect(api.purge(command)).resolves.toMatchObject({ contentCount: 0, confirmedCount: 2, pendingCount: 0 });
      expect(audit.record).not.toHaveBeenCalled();
      expect(delivery.drainPurges).toHaveBeenCalledTimes(1);
    });

    it('rolls the purge back, by failing before any tombstone, when the event cannot be written', async () => {
      const { api, audit, delivery } = world();
      audit.record.mockRejectedValueOnce(new Error('audit failed'));

      await expect(api.purge(command)).rejects.toThrow('audit failed');
      expect(delivery.drainPurges).not.toHaveBeenCalled();
    });

    it('refuses, by an error of its own, an installation with no organization: nobody to record the purge under', async () => {
      const { api } = world({ organization: false });

      await expect(api.purge(command)).rejects.toThrow(AiPurgeRefusedError);
    });

    it('refuses to apply for no operator', async () => {
      const { api, outbox } = world();

      await expect(api.purge({ through: '2026-12-01', apply: true, operator: null })).rejects.toThrow(
        AiPurgeRefusedError,
      );
      expect(outbox.lockPurgeable).not.toHaveBeenCalled();
    });
  });
});
