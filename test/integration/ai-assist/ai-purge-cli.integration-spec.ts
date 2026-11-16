import { randomUUID } from 'node:crypto';
import { CLI_COLD_START_MS, CliResult, cliWorkingDirectory, runCli, stopCliProcesses } from '../../support/cli-process';
import {
  type DisposableHistoryStore,
  dropHistoryStore,
  historyDocument,
  provisionHistoryStore,
} from '../../support/disposable-history-store';
import { HttpTestApp, SeededInstallation, createHttpTestApp, seedInstallation } from '../../support/http-test-app';

/**
 * `pnpm ops:ai-purge --through YYYY-MM-DD [--apply]` (`US-15-05`, ADR-0020): the raw history of the calls of the AI created on or
 * before the end of a day (UTC) is purged in two steps. In PostgreSQL, in one transaction with the audit event as the operator: the
 * state PURGING, the result deleted, a tombstone queued. Then MongoDB replaces each document with a tombstone; a tombstone it did
 * not take keeps the command at exit 1 until a run finishes it. The calls themselves (`ai_invocations`) are kept. The default run
 * only counts.
 */
const OPERATOR = 'ops-lead@acme.example';
const THROUGH = '2026-10-31';
const LIVE = new Set(['PENDING', 'RUNNING']);

describe('ops:ai-purge (integration, real CLI, PostgreSQL and MongoDB)', () => {
  let ctx: HttpTestApp;
  let seed: SeededInstallation;
  let store: DisposableHistoryStore;
  /** One call with its history for each instant, by name. */
  const ids = new Map<string, string>();

  // The test MongoDB has no user; outside production a URI without credentials is accepted. Under NODE_ENV=test the
  // database comes from TEST_DATABASE_URL (DATABASE_URL alone gets `_test` appended: resolveDatabaseUrl).
  const run = (args: string[], mongo: Record<string, string> = store.env): Promise<CliResult> =>
    runCli('ai-purge', args, {
      cwd: cliWorkingDirectory('slm-ai-purge'),
      environment: { NODE_ENV: 'test', TEST_DATABASE_URL: ctx.database.url, ...mongo },
    });
  const apply = (mongo?: Record<string, string>) =>
    run(['--through', THROUGH, '--apply', '--operator', OPERATOR], mongo);
  const count = async (table: string, where = 'true'): Promise<number> =>
    Number((await ctx.sql.query<{ n: string }>(`SELECT count(*) AS n FROM ${table} WHERE ${where}`)).rows[0].n);
  const state = async () => ({
    invocations: await count('ai_invocations'),
    live: await count('ai_invocations', `history_state NOT IN ('PURGING', 'PURGED')`),
    results: await count('ai_invocation_results'),
    purged: await count('audit_events', `action = 'AI_INVOCATION.PURGED'`),
  });
  /** The calls whose history is still there, by name, in the order they were made. */
  const keptHistories = async (): Promise<string[]> => {
    const rows = await ctx.sql.query<{ id: string }>(
      `SELECT id FROM ai_invocations WHERE history_state NOT IN ('PURGING', 'PURGED') ORDER BY created_at`,
    );
    const names = new Map([...ids].map(([name, id]) => [id, name]));

    return rows.rows.map((row) => names.get(row.id) ?? row.id);
  };
  const document = (name: string) => historyDocument(store, ids.get(name) ?? '');
  const statuses = async (): Promise<Record<string, string>> => {
    const rows = await ctx.sql.query<{ id: string; status: string }>('SELECT id, status FROM ai_invocations');
    const byId = new Map(rows.rows.map((row) => [row.id, row.status]));

    return Object.fromEntries([...ids].map(([name, id]) => [name, byId.get(id) ?? 'MISSING']));
  };

  async function insertCall(name: string, createdAt: string, status = 'COMPLETED'): Promise<void> {
    const id = randomUUID();
    ids.set(name, id);
    await ctx.sql.query(
      `INSERT INTO ai_invocations (id, organization_id, feature, actor_app_user_id, actor_employee_id, status, source_revision, created_at, finished_at)
       VALUES ($1, $2, 'ACCESS_REQUEST_QUEUE_SUMMARY', $3, $4, $7::"AiInvocationStatus", $5, $6, $8)`,
      [
        id,
        seed.organizationId,
        randomUUID(),
        randomUUID(),
        `revision-${name}`,
        createdAt,
        status,
        LIVE.has(status) ? null : createdAt,
      ],
    );
    // Version 1 of the history, delivered: confirmed in PostgreSQL and held in MongoDB.
    await ctx.sql.query(
      `UPDATE ai_invocations SET history_state = 'AVAILABLE', history_version = 1, history_stored_version = 1 WHERE id = $1`,
      [id],
    );
    if (status === 'COMPLETED') {
      await ctx.sql.query(`INSERT INTO ai_invocation_results (invocation_id, result, created_at) VALUES ($1, $2, $3)`, [
        id,
        { total: 0, steps: [], accepted: [], rejections: [] },
        createdAt,
      ]);
    }
    await store.client
      .db(store.database)
      .collection<{ _id: string } & Record<string, unknown>>('ai_invocation_histories')
      .insertOne({
        _id: id,
        schemaVersion: 1,
        organizationId: seed.organizationId,
        generation: 0,
        version: 1,
        payloadHash: 'h',
        purged: false,
        context: { generatedAt: '2026-10-01T00:00:00.000Z', requests: [] },
        promptText: 'a prompt',
        rawResponse: 'an answer',
        parsed: null,
        validation: null,
        createdAt: new Date(createdAt),
        updatedAt: new Date(createdAt),
        purgedAt: null,
      });
  }

  beforeAll(async () => {
    store = await provisionHistoryStore();
    ctx = await createHttpTestApp();
    seed = await seedInstallation(ctx.app);
    await insertCall('old', '2026-10-01T08:00:00.000Z');
    await insertCall('last-millisecond', '2026-10-31T23:59:59.999Z');
    await insertCall('first-millisecond-after', '2026-11-01T00:00:00.000Z');
    await insertCall('recent', '2026-11-03T08:00:00.000Z');
    // Live calls older than the cut-off: their history is what the run in progress still has to write.
    await insertCall('pending-old', '2026-10-02T08:00:00.000Z', 'PENDING');
    await insertCall('running-old', '2026-10-03T08:00:00.000Z', 'RUNNING');
    // A call that failed holds no place of its revision: its history goes, its status stays.
    await insertCall('failed-old', '2026-10-04T08:00:00.000Z', 'FAILED');
  }, 120000);

  afterAll(async () => {
    await ctx?.close();
    if (store) await dropHistoryStore(store);
    stopCliProcesses();
  });

  it(
    'prints the usage with the arguments and the exit codes for --help, with nothing configured',
    async () => {
      const result = await runCli('ai-purge', ['--help'], {
        cwd: cliWorkingDirectory('slm-ai-purge'),
        environment: { NODE_ENV: 'test' },
      });

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('ops:ai-purge');
      expect(result.stdout).toContain('--through');
      expect(result.stdout).toContain('--apply');
      expect(result.stdout).toMatch(/Exit codes: 0 .* 2 .* 1/s);
    },
    CLI_COLD_START_MS,
  );

  it(
    'refuses a --through that is missing, not a date, not a real day or in the future with exit 1, and changes nothing',
    async () => {
      const before = await state();
      const refused = [
        await run([]),
        await run(['--through', '31/10/2026']),
        await run(['--through', '2026-02-30']),
        await run(['--through', '2999-01-01']),
        await run(['--through', THROUGH, '--apply']),
      ];

      expect(refused.map((result) => result.code)).toEqual([1, 1, 1, 1, 1]);
      expect(refused[0].stderr).toContain('--through is required');
      expect(refused[4].stderr).toContain('--operator is required with --apply');
      expect(await state()).toEqual(before);
    },
    CLI_COLD_START_MS * 5,
  );

  it(
    'by default only counts: it says how many histories would go and writes nothing, not a row, not an event',
    async () => {
      const before = await state();

      const result = await run(['--through', THROUGH]);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('mode:      DRY RUN');
      expect(result.stdout).toContain(`through:   ${THROUGH}`);
      expect(result.stdout).toContain('histories: 3');
      expect(result.stdout).toContain('Nothing was purged');
      // Nothing of what the histories hold is printed.
      expect(result.stdout + result.stderr).not.toMatch(/a prompt|an answer|generatedAt/);
      expect(await state()).toEqual(before);
    },
    CLI_COLD_START_MS,
  );

  it(
    'exits 2 on a dry run that finds nothing to purge',
    async () => {
      const result = await run(['--through', '2026-09-30']);

      expect(result.code).toBe(2);
      expect(result.stdout).toContain('histories: 0');
    },
    CLI_COLD_START_MS,
  );

  it(
    'rolls the purge back and exits 1 when its audit event cannot be written: the histories stay, in both stores',
    async () => {
      await ctx.sql.query(`CREATE FUNCTION refuse_purge_audit() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF NEW.action = 'AI_INVOCATION.PURGED' THEN RAISE EXCEPTION 'audit refused'; END IF;
          RETURN NEW;
        END $$`);
      await ctx.sql.query(
        `CREATE TRIGGER refuse_purge_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION refuse_purge_audit()`,
      );
      try {
        const before = await state();

        const result = await apply();

        expect(result.code).toBe(1);
        expect(await state()).toEqual(before);
        expect(await document('old')).toMatchObject({ purged: false, promptText: 'a prompt' });
      } finally {
        await ctx.sql.query('DROP TRIGGER refuse_purge_audit ON audit_events');
        await ctx.sql.query('DROP FUNCTION refuse_purge_audit()');
      }
    },
    CLI_COLD_START_MS,
  );

  it(
    'with --apply and MongoDB out of reach purges in PostgreSQL at once, with one OPERATOR event, and exits 1: tombstones pending',
    async () => {
      const result = await apply({
        MONGODB_URI: 'mongodb://127.0.0.1:1',
        MONGODB_DATABASE: store.database,
        MONGODB_SERVER_SELECTION_TIMEOUT_MS: '200',
      });

      expect(result.code).toBe(1);
      expect(result.stdout).toContain('histories: 3');
      expect(result.stdout).toContain('pending:   3');
      // The last millisecond of the day goes; the first millisecond of the next day stays, and so does what is later.
      // ... and so do the two live calls older than the cut-off: a call that is still running keeps its history.
      expect(await keptHistories()).toEqual(['pending-old', 'running-old', 'first-millisecond-after', 'recent']);
      expect(await count('ai_invocations', `history_state = 'PURGING' AND history_generation = 1`)).toBe(3);
      expect(await count('ai_history_deliveries', `operation = 'PURGE' AND closed_at IS NULL`)).toBe(3);
      // PostgreSQL already reads the content as gone; MongoDB still holds it until the tombstone lands.
      expect(await document('old')).toMatchObject({ purged: false });
      expect(await count('ai_invocations')).toBe(7);
      // A completed call whose history went is STALE: it no longer holds the place of its queue revision, so the same
      // revision may be asked again. The others keep their status, and every call keeps its end.
      expect(await statuses()).toEqual({
        old: 'STALE',
        'last-millisecond': 'STALE',
        'first-millisecond-after': 'COMPLETED',
        recent: 'COMPLETED',
        'pending-old': 'PENDING',
        'running-old': 'RUNNING',
        'failed-old': 'FAILED',
      });
      expect(await count('ai_invocations', `status = 'STALE' AND finished_at IS NULL`)).toBe(0);
      expect(await count('ai_invocation_results')).toBe(2);
      const events = await ctx.sql.query(
        `SELECT actor_kind, actor_app_user_id, actor_roles, action, resource_type, operator_reference, after, organization_id
           FROM audit_events WHERE action = 'AI_INVOCATION.PURGED'`,
      );
      expect(events.rows).toEqual([
        {
          actor_kind: 'OPERATOR',
          actor_app_user_id: null,
          actor_roles: [],
          action: 'AI_INVOCATION.PURGED',
          resource_type: 'AiInvocationContent',
          operator_reference: OPERATOR,
          after: { deletedCount: 3, through: THROUGH },
          organization_id: seed.organizationId,
        },
      ]);
    },
    CLI_COLD_START_MS,
  );

  it(
    'run again with MongoDB finishes the purge it left: tombstones in MongoDB, PURGED, exit 0, and no second event',
    async () => {
      // The tombstones of the failed run wait for their retry; make them due now rather than waiting.
      await ctx.sql.query(`UPDATE ai_history_deliveries SET available_at = now() WHERE operation = 'PURGE'`);

      const result = await apply();

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('histories: 0');
      expect(result.stdout).toContain('confirmed: 3');
      expect(result.stdout).toContain('pending:   0');
      expect(await count('ai_invocations', `history_state = 'PURGED'`)).toBe(3);
      for (const name of ['old', 'last-millisecond', 'failed-old']) {
        const tombstone = await document(name);
        expect(tombstone).toMatchObject({
          purged: true,
          generation: 1,
          context: null,
          promptText: null,
          rawResponse: null,
        });
      }
      expect(await document('recent')).toMatchObject({ purged: false, promptText: 'a prompt' });
      expect(await count('audit_events', `action = 'AI_INVOCATION.PURGED'`)).toBe(1);
    },
    CLI_COLD_START_MS,
  );

  it(
    'run again exits 2 and writes no second event: only live calls are left on or before that day, and a live call is never purged',
    async () => {
      const before = await state();

      const result = await apply();

      expect(result.code).toBe(2);
      expect(result.stdout).toContain('histories: 0');
      expect(await state()).toEqual(before);
      expect(before.purged).toBe(1);
    },
    CLI_COLD_START_MS,
  );
  it(
    'a dry run that finds only live calls on or before the day counts none and exits 2',
    async () => {
      const result = await run(['--through', '2026-10-03']);

      expect(result.code).toBe(2);
      expect(result.stdout).toContain('histories: 0');
    },
    CLI_COLD_START_MS,
  );

  it(
    'accepts today (UTC) as --through, and still counts only the calls that are not live',
    async () => {
      await insertCall('today', new Date().toISOString());
      await insertCall('running-today', new Date().toISOString(), 'RUNNING');
      const before = await state();

      const result = await run(['--through', new Date().toISOString().slice(0, 10)]);

      expect(result.code).toBe(0);
      // The call of the 1st (first millisecond after), the recent one and the one of this moment; the live ones stay out.
      expect(result.stdout).toContain('histories: 3');
      expect(await state()).toEqual(before);
    },
    CLI_COLD_START_MS,
  );
});
