import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../src/infrastructure/database/prisma.service';
import { TransactionRunner } from '../../../src/infrastructure/database/transaction-runner';
import { AiInvocationRepo } from '../../../src/modules/ai-assist/invocation/invocation.repo';
import { InvocationHistoryOutboxRepo } from '../../../src/modules/ai-assist/invocation-history/invocation-history-outbox.repo';
import type {
  ClaimedDelivery,
  HistorySnapshot,
} from '../../../src/modules/ai-assist/invocation-history/invocation-history.types';
import {
  type DisposableDatabase,
  dropDisposableDatabase,
  migrateDisposableDatabase,
  provisionDisposableDatabase,
} from '../../support/disposable-database';
import { testConfig } from '../../support/test-config';

const SNAPSHOT: HistorySnapshot = {
  context: {
    generatedAt: '2026-11-04T09:00:00.000Z',
    requests: [
      {
        sourceRef: 'R001',
        stepKind: 'NEED_APPROVAL',
        softwareName: 'Figma',
        beneficiaryDisplayName: 'Nhóm 5 người',
        reason: 'Thiết kế giao diện',
        requestedDurationLabel: '3 tháng',
        estimatedCostRef: null,
      },
    ],
  },
  promptText: 'the prompt',
  rawResponse: '{"items":[]}',
  parsed: null,
  validation: null,
};

/**
 * The raw SQL of the outbox of the AI history (ADR-0020), on a real PostgreSQL (docs/rules/security-jobs.md: mocks do not prove real
 * storage access or worker retry behavior): the claim with `FOR UPDATE SKIP LOCKED`, the lease, the acknowledgement under the lease,
 * the retry, the park, and a purge that closes the snapshot a worker holds. The delivery service is unit-tested with mocks; what a mock
 * cannot say is whether the statements do this.
 */
describe('InvocationHistoryOutboxRepo (integration, real PostgreSQL)', () => {
  let database: DisposableDatabase;
  let prisma: PrismaService;
  let runner: TransactionRunner;
  let outbox: InvocationHistoryOutboxRepo;
  let calls: AiInvocationRepo;
  const organizationId = randomUUID();

  beforeAll(async () => {
    database = await provisionDisposableDatabase();
    await migrateDisposableDatabase(database);
    const config = testConfig({ DATABASE_URL: database.url });
    prisma = new PrismaService(config);
    runner = new TransactionRunner(prisma, config);
    outbox = new InvocationHistoryOutboxRepo(prisma);
    calls = new AiInvocationRepo(prisma);
  }, 240000);

  afterAll(async () => {
    await prisma?.$disconnect();
    if (database) await dropDisposableDatabase(database);
  });

  let revision = 0;
  /** A call with its first snapshot queued, as the application leaves it. */
  async function queuedCall(): Promise<string> {
    revision += 1;
    const { id } = await runner.run((tx) =>
      calls.insert(tx, {
        organizationId,
        actorAppUserId: randomUUID(),
        actorEmployeeId: randomUUID(),
        feature: 'ACCESS_REQUEST_QUEUE_SUMMARY',
        sourceRevision: revision.toString(16).padStart(64, '0'),
        status: 'PENDING',
        errorCode: null,
        at: new Date(),
      }),
    );
    await runner.run((tx) =>
      outbox.enqueueSnapshot(tx, { invocationId: id, organizationId, snapshot: SNAPSHOT, at: new Date() }),
    );

    return id;
  }
  const claim = (
    limit: number,
    token = randomUUID(),
    options: { now?: Date; leaseUntil?: Date; dueBy?: Date; operation?: 'SNAPSHOT' | 'PURGE' | null } = {},
  ) => {
    const now = options.now ?? new Date();

    return runner.run((tx) =>
      outbox.claimDue(tx, {
        now,
        dueBy: options.dueBy ?? now,
        leaseToken: token,
        leaseUntil: options.leaseUntil ?? new Date(now.getTime() + 60_000),
        limit,
        operation: options.operation ?? null,
      }),
    );
  };
  const standing = (id: string) => outbox.standingOf(id);
  const deliveries = (id: string) =>
    prisma.aiHistoryDelivery.findMany({
      where: { invocationId: id },
      orderBy: [{ version: 'asc' }, { createdAt: 'asc' }],
    });
  /** Claims only the rows of the calls of the test, so tests that run one after the other never see one another's rows. */
  const claimOf = async (ids: string[], limit = 50, token = randomUUID(), options: Parameters<typeof claim>[2] = {}) =>
    (await claim(limit, token, options)).filter((row) => ids.includes(row.invocationId));

  it('hands two concurrent claims disjoint rows: a claim never waits for a row another claim holds (FOR UPDATE SKIP LOCKED)', async () => {
    const ids = [await queuedCall(), await queuedCall(), await queuedCall(), await queuedCall()];

    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let held!: () => void;
    const holding = new Promise<void>((resolve) => (held = resolve));
    // The first claim keeps its transaction open (rows locked) until the second one is done.
    const first = runner.run(async (tx) => {
      const now = new Date();
      const rows = await outbox.claimDue(tx, {
        now,
        dueBy: now,
        leaseToken: randomUUID(),
        leaseUntil: new Date(now.getTime() + 60_000),
        limit: 3,
        operation: null,
      });
      held();
      await gate;

      return rows;
    });
    await holding;
    // Were `SKIP LOCKED` missing, this would wait for the first transaction, which waits for this: the test would time out.
    const second = await claim(10);
    release();
    const firstRows = await first;

    const mine = (rows: ClaimedDelivery[]) => rows.filter((row) => ids.includes(row.invocationId)).map((row) => row.id);
    expect(mine(firstRows)).toHaveLength(3);
    expect(mine(second)).toHaveLength(1);
    expect(mine(firstRows).filter((id) => mine(second).includes(id))).toEqual([]);
  }, 60000);

  it('takes a row again once its lease has run out, and the acknowledgement of the old lease then writes nothing', async () => {
    const id = await queuedCall();
    const now = new Date();
    const stale = randomUUID();
    const [slow] = await claimOf([id], 50, stale, { now, leaseUntil: new Date(now.getTime() - 1_000) });
    expect(slow.attempts).toBe(1);

    const fresh = randomUUID();
    const [again] = await claimOf([id], 50, fresh);
    expect(again.id).toBe(slow.id);
    expect(again.attempts).toBe(2);

    await expect(runner.run((tx) => outbox.acknowledge(tx, slow, stale, new Date()))).resolves.toBe(false);
    expect(await standing(id)).toMatchObject({ state: 'PENDING', storedVersion: 0 });
    expect((await deliveries(id))[0]).toMatchObject({ closedAt: null, leaseToken: fresh });

    await expect(runner.run((tx) => outbox.acknowledge(tx, again, fresh, new Date()))).resolves.toBe(true);
    expect(await standing(id)).toMatchObject({ state: 'AVAILABLE', storedVersion: 1, version: 1 });
    const [closed] = await deliveries(id);
    expect(closed.closedAt).toBeInstanceOf(Date);
    expect(closed.leaseToken).toBeNull();
    // The payload is wiped once MongoDB confirmed it.
    expect(closed.payload).toBeNull();
  });

  it('keeps a row under a live lease away from every other claim', async () => {
    const id = await queuedCall();
    expect(await claimOf([id])).toHaveLength(1);

    expect(await claimOf([id])).toEqual([]);
  });

  it('acknowledges nothing under a token that does not hold the lease', async () => {
    const id = await queuedCall();
    const token = randomUUID();
    const [row] = await claimOf([id], 50, token);

    await expect(runner.run((tx) => outbox.acknowledge(tx, row, randomUUID(), new Date()))).resolves.toBe(false);
    await expect(runner.run((tx) => outbox.closeObsolete(tx, row, randomUUID(), new Date()))).resolves.toBe(false);
    expect(await standing(id)).toMatchObject({ state: 'PENDING', storedVersion: 0 });
  });

  it('retries a failed row later: the lease is released, the row is not due before its time and is due after it', async () => {
    const id = await queuedCall();
    const token = randomUUID();
    const [row] = await claimOf([id], 50, token);
    const later = new Date(Date.now() + 120_000);

    await outbox.retryLater(row, token, later, 'MONGODB_UNAVAILABLE');

    const [waiting] = await deliveries(id);
    expect(waiting).toMatchObject({
      leaseToken: null,
      leaseUntil: null,
      lastErrorCode: 'MONGODB_UNAVAILABLE',
      attempts: 1,
    });
    expect(waiting.availableAt.getTime()).toBe(later.getTime());
    expect(await claimOf([id])).toEqual([]);
    const [due] = await claimOf([id], 50, randomUUID(), { dueBy: new Date(later.getTime() + 1_000), now: new Date() });
    expect(due.attempts).toBe(2);
  });

  it('parks a refused row with its payload; only the refusal of the latest version makes the history ERROR', async () => {
    const id = await queuedCall();
    // A second, later snapshot of the same call.
    await runner.run((tx) =>
      outbox.enqueueSnapshot(tx, { invocationId: id, organizationId, snapshot: SNAPSHOT, at: new Date() }),
    );
    const token = randomUUID();
    const rows = await claimOf([id], 50, token);
    const v1 = rows.find((row) => row.version === 1)!;
    const v2 = rows.find((row) => row.version === 2)!;
    expect(await standing(id)).toMatchObject({ state: 'PENDING', version: 2 });

    // A refused older snapshot is superseded by the later one: the call does not turn ERROR.
    await expect(runner.run((tx) => outbox.park(tx, v1, token, 'PAYLOAD_INVALID', new Date()))).resolves.toBe(true);
    expect(await standing(id)).toMatchObject({ state: 'PENDING' });
    // A park under a lease that is not ours writes nothing.
    await expect(runner.run((tx) => outbox.park(tx, v2, randomUUID(), 'PAYLOAD_INVALID', new Date()))).resolves.toBe(
      false,
    );
    expect(await standing(id)).toMatchObject({ state: 'PENDING' });

    await expect(runner.run((tx) => outbox.park(tx, v2, token, 'PAYLOAD_INVALID', new Date()))).resolves.toBe(true);
    expect(await standing(id)).toMatchObject({ state: 'ERROR' });
    const parked = (await deliveries(id)).filter((row) => row.parkedAt !== null);
    expect(parked).toHaveLength(2);
    // Parked rows keep their payload for an operator, hold no lease, and are never claimed again.
    for (const row of parked) {
      expect(row.payload).not.toBeNull();
      expect(row.leaseToken).toBeNull();
      expect(row.lastErrorCode).toBe('PAYLOAD_INVALID');
    }
    expect(await claimOf([id], 50, randomUUID(), { dueBy: new Date(Date.now() + 3_600_000) })).toEqual([]);
  });

  it('a purge closes the snapshot a worker holds: its late acknowledgement is refused and the call stays purged, never available', async () => {
    const id = await queuedCall();
    const token = randomUUID();
    const [row] = await claimOf([id], 50, token);
    // The purge takes calls that are over.
    await prisma.$executeRaw`UPDATE ai_invocations SET status = 'FAILED', finished_at = now() WHERE id = ${id}::uuid`;

    await runner.run(async (tx) => {
      const locked = await outbox.lockPurgeable(tx, new Date(Date.now() + 60_000));
      expect(locked).toContain(id);
      await outbox.beginPurge(tx, [id], new Date());
    });

    // The worker finishes writing MongoDB and acknowledges, too late.
    await expect(runner.run((tx) => outbox.acknowledge(tx, row, token, new Date()))).resolves.toBe(false);
    await expect(runner.run((tx) => outbox.park(tx, row, token, 'PAYLOAD_INVALID', new Date()))).resolves.toBe(false);
    expect(await standing(id)).toMatchObject({ state: 'PURGING', generation: 1, storedVersion: 0 });

    const all = await deliveries(id);
    const snapshot = all.find((entry) => entry.operation === 'SNAPSHOT')!;
    expect(snapshot).toMatchObject({ lastErrorCode: 'OBSOLETE', payload: null, leaseToken: null });
    expect(snapshot.closedAt).toBeInstanceOf(Date);
    // One tombstone of the new generation is queued, and its confirmation makes the call PURGED.
    const tombstone = all.find((entry) => entry.operation === 'PURGE')!;
    expect(tombstone).toMatchObject({ generation: 1, closedAt: null });
    const tombToken = randomUUID();
    const [claimed] = await claimOf([id], 50, tombToken, { operation: 'PURGE' });
    await expect(runner.run((tx) => outbox.acknowledge(tx, claimed, tombToken, new Date()))).resolves.toBe(true);
    expect(await standing(id)).toMatchObject({ state: 'PURGED', generation: 1 });
  });

  it('an acknowledgement of an older generation never moves a call that is in a newer one', async () => {
    const id = await queuedCall();
    const token = randomUUID();
    const [row] = await claimOf([id], 50, token);
    // The call moved to the next generation while the worker held its row; the call is not purged, so only the generation says so.
    await prisma.$executeRaw`UPDATE ai_invocations SET history_generation = history_generation + 1 WHERE id = ${id}::uuid`;

    await expect(runner.run((tx) => outbox.acknowledge(tx, row, token, new Date()))).resolves.toBe(true);

    expect(await standing(id)).toMatchObject({ state: 'PENDING', generation: 1, storedVersion: 0 });
  });
});
