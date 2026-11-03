import { randomUUID } from 'node:crypto';
import { TransactionRunner } from '../../../src/infrastructure/database/transaction-runner';
import { CatalogApi } from '../../../src/modules/catalog/public/catalog.api';
import { PgRelay } from '../../support/pg-relay';
import { QueryCounter, dataStatements } from '../../support/query-count';
import { SeatHarness } from '../../support/seat-baseline-harness';

const h = new SeatHarness();

describe('catalog invoice reference reads (B07-2 step 3)', () => {
  let catalog: CatalogApi;
  let relay: PgRelay;
  let counter: QueryCounter;
  let firstId: string;
  let secondId: string;

  beforeAll(async () => {
    await h.start({
      appDatabaseUrl: async (directUrl) => {
        const url = new URL(directUrl);
        relay = await PgRelay.start(url.hostname, Number(url.port || 5432));
        url.port = String(relay.port);
        return url.toString();
      },
    });
    catalog = h.ctx.app.get(CatalogApi);
    counter = QueryCounter.on(relay);
    firstId = await h.subscription();
    const department = await h.bareDepartment();
    secondId = await h.subscription(5, 'K2', department.id);
  }, 120_000);

  afterAll(async () => {
    await h.stop();
    await relay?.stop();
  });

  it('reads exact vendor and owner summaries in one batch, omitting unknown ids and duplicates', async () => {
    const expected = (
      await h.ctx.sql.query<{ id: string; vendorId: string; ownerDepartmentId: string }>(
        `SELECT s.id, a.vendor_id AS "vendorId", s.owner_department_id AS "ownerDepartmentId"
           FROM subscriptions s JOIN plans p ON p.id = s.plan_id JOIN applications a ON a.id = p.application_id
          WHERE s.id = ANY($1::uuid[]) ORDER BY s.id`,
        [[firstId, secondId]],
      )
    ).rows;
    const { result, statements } = await counter.run(() =>
      catalog.getSubscriptionSummaries([secondId, firstId, firstId, randomUUID()]),
    );
    expect(result).toEqual(expected);
    expect(dataStatements(statements)).toHaveLength(1);
  });

  it('answers an empty batch without querying', async () => {
    const { result, statements } = await counter.run(() => catalog.getSubscriptionSummaries([]));
    expect(result).toEqual([]);
    expect(dataStatements(statements)).toHaveLength(0);
  });

  it('considers an existing vendor usable and an unknown vendor unusable', async () => {
    const vendor = (
      await h.ctx.sql.query<{ id: string }>(
        `SELECT a.vendor_id AS id FROM subscriptions s JOIN plans p ON p.id = s.plan_id
           JOIN applications a ON a.id = p.application_id WHERE s.id = $1`,
        [firstId],
      )
    ).rows[0];
    expect(await catalog.isVendorUsable(vendor.id)).toBe(true);
    expect(await catalog.isVendorUsable(randomUUID())).toBe(false);
  });

  it('sees caller transaction data and leaves no writes after rollback', async () => {
    const vendorId = randomUUID();
    const subscriptionId = randomUUID();
    await expect(
      h.ctx.app.get(TransactionRunner).run(async (tx) => {
        await tx.vendor.create({
          data: { id: vendorId, organizationId: h.seed.organizationId, name: 'Uncommitted', normalizedName: vendorId },
        });
        const original = await tx.subscription.findUniqueOrThrow({ where: { id: firstId }, select: { planId: true } });
        await tx.subscription.create({
          data: {
            id: subscriptionId,
            organizationId: h.seed.organizationId,
            planId: original.planId,
            kind: 'TERM',
            ownerDepartmentId: h.seed.departmentId,
          },
        });
        expect(await catalog.isVendorUsable(vendorId, tx)).toBe(true);
        expect(await catalog.getSubscriptionSummaries([subscriptionId], tx)).toHaveLength(1);
        throw new Error('Rollback reference fixture');
      }),
    ).rejects.toThrow('Rollback reference fixture');
    expect(await catalog.isVendorUsable(vendorId)).toBe(false);
    expect(await catalog.getSubscriptionSummaries([subscriptionId])).toEqual([]);
  });
});
