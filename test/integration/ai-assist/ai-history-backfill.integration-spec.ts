import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { historySnapshotSchema } from '../../../src/modules/ai-assist/invocation-history/invocation-history.types';
import { stopCliProcesses } from '../../support/cli-process';
import { dropDisposableDatabase, provisionDisposableDatabase } from '../../support/disposable-database';
import {
  DEPLOY_TIMEOUT_MS,
  deployMigrations,
  migrationBefore,
  migrationEndingWith,
  schemaDrift,
} from '../../support/migration-history';

const TARGET = migrationEndingWith('_ai_history_mongodb');

const CONTEXT = {
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
};
const PARSED = { items: [{ sourceRef: 'R001', stepKind: 'NEED_APPROVAL', summary: 'An cần Figma.' }] };
const REJECTIONS = [{ sourceRef: 'R001', code: 'NUMBER_NOT_IN_SOURCE' }];
const RESULT = {
  total: 1,
  steps: [{ sourceRef: 'R001', stepId: randomUUID(), requestId: randomUUID(), stepKind: 'NEED_APPROVAL' }],
  accepted: [],
  rejections: REJECTIONS,
};

/**
 * ADR-0020: migration `20261116100000_ai_history_mongodb` moves what `ai_invocation_contents` held into `ai_invocation_results` and
 * the outbox `ai_history_deliveries`, then drops the table, and it cannot be undone (DB-05). Every other suite applies the history to
 * an empty database, so a wrong key in the hand-written backfill JSON would pass them all and park every old call as
 * `PAYLOAD_INVALID` in production. This one applies the history up to the migration before it, writes calls the way the release
 * before left them, runs the migration, and decodes each snapshot with the codec of the worker.
 */
describe('the migration that moves the AI history out of PostgreSQL, on rows of the old shape (integration, real PostgreSQL)', () => {
  it(
    'keeps one result, queues one snapshot per call with a content in the shape the worker decodes, purges the call with none, drops the old table, and leaves no drift',
    async () => {
      const database = await provisionDisposableDatabase();
      const sql = new Client({ connectionString: database.url });
      await sql.connect();
      try {
        const before = await deployMigrations(database, { through: migrationBefore(TARGET) });
        if (before.code !== 0) throw new Error(`Deploying the history before the migration failed: ${before.stdout}`);

        const organizationId = randomUUID();
        const actorAppUserId = randomUUID();
        const actorEmployeeId = randomUUID();
        const call = async (status: string, revision: string, finished: string | null): Promise<string> => {
          const id = randomUUID();
          await sql.query(
            `INSERT INTO ai_invocations (id, organization_id, feature, actor_app_user_id, actor_employee_id, status, source_revision,
                                         created_at, finished_at)
             VALUES ($1, $2, 'ACCESS_REQUEST_QUEUE_SUMMARY', $3, $4, $5::"AiInvocationStatus", $6, '2026-11-04T09:00:00Z', $7)`,
            [id, organizationId, actorAppUserId, actorEmployeeId, status, revision, finished],
          );

          return id;
        };
        const content = (
          id: string,
          values: { prompt: string | null; raw: string | null; parsed: unknown; result: unknown },
        ) =>
          sql.query(
            `INSERT INTO ai_invocation_contents (invocation_id, context, prompt_text, raw_response, parsed, result)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              id,
              JSON.stringify(CONTEXT),
              values.prompt,
              values.raw,
              values.parsed === null ? null : JSON.stringify(values.parsed),
              values.result === null ? null : JSON.stringify(values.result),
            ],
          );

        // 1. Finished: the content and a result whose checks rejected something.
        const completed = await call('COMPLETED', 'rev-completed', '2026-11-04T09:00:05Z');
        await content(completed, { prompt: 'the prompt', raw: '{"items":[]}', parsed: PARSED, result: RESULT });
        // 2. Failed before the model answered: a content with the context only, and no result.
        const failed = await call('FAILED', 'rev-failed', '2026-11-04T09:00:06Z');
        await content(failed, { prompt: null, raw: null, parsed: null, result: null });
        // 3. A call whose content the old `ops:ai-purge` deleted: nothing of it is left to deliver.
        const purged = await call('COMPLETED', 'rev-purged', '2026-11-03T08:00:00Z');

        const applied = await deployMigrations(database);
        if (applied.code !== 0) throw new Error(`Deploying the migration failed: ${applied.stdout}\n${applied.stderr}`);

        // One result: only the call whose checks ran.
        const results = await sql.query<{ invocation_id: string; result: unknown }>(
          `SELECT invocation_id, result FROM ai_invocation_results`,
        );
        expect(results.rows).toEqual([{ invocation_id: completed, result: RESULT }]);

        // One snapshot, version 1 of generation 0, for each call that had a content, in the shape the worker decodes.
        const deliveries = await sql.query<{
          invocation_id: string;
          operation: string;
          version: number;
          generation: number;
          payload: unknown;
        }>(
          `SELECT invocation_id, operation, version, generation, payload FROM ai_history_deliveries ORDER BY invocation_id`,
        );
        expect(deliveries.rows.map((row) => row.invocation_id).sort()).toEqual([completed, failed].sort());
        for (const row of deliveries.rows) {
          expect(row.operation).toBe('SNAPSHOT');
          expect(row.version).toBe(1);
          expect(row.generation).toBe(0);
          // The strict codec of the worker: a wrong or an extra key would park the row as PAYLOAD_INVALID.
          expect(() => historySnapshotSchema.parse(row.payload)).not.toThrow();
        }
        const snapshotOf = (id: string) =>
          historySnapshotSchema.parse(deliveries.rows.find((row) => row.invocation_id === id)?.payload);
        expect(snapshotOf(completed)).toEqual({
          context: CONTEXT,
          promptText: 'the prompt',
          rawResponse: '{"items":[]}',
          parsed: PARSED,
          validation: { rejections: REJECTIONS },
        });
        // The checks never ran for the failed call: `validation` is null, nothing is made up.
        expect(snapshotOf(failed)).toEqual({
          context: CONTEXT,
          promptText: null,
          rawResponse: null,
          parsed: null,
          validation: null,
        });

        // The state of each call, and the purge stamp of the one whose content was already gone.
        const states = await sql.query<{ id: string; history_state: string; history_version: number; purged: boolean }>(
          `SELECT id, history_state, history_version, history_purged_at IS NOT NULL AS purged FROM ai_invocations ORDER BY id`,
        );
        const byId = new Map(states.rows.map((row) => [row.id, row]));
        expect(byId.get(completed)).toMatchObject({ history_state: 'PENDING', history_version: 1, purged: false });
        expect(byId.get(failed)).toMatchObject({ history_state: 'PENDING', history_version: 1, purged: false });
        expect(byId.get(purged)).toMatchObject({ history_state: 'PURGED', history_version: 0, purged: true });
        const stamp = await sql.query<{ same: boolean }>(
          `SELECT history_purged_at = finished_at AS same FROM ai_invocations WHERE id = $1`,
          [purged],
        );
        expect(stamp.rows[0].same).toBe(true);

        // The old table is gone, and the applied history matches the schema of the sources.
        const gone = await sql.query<{ present: boolean }>(
          `SELECT to_regclass('public.ai_invocation_contents') IS NOT NULL AS present`,
        );
        expect(gone.rows[0].present).toBe(false);
        expect((await schemaDrift(database)).code).toBe(0);
      } finally {
        await sql.end();
        await dropDisposableDatabase(database);
        stopCliProcesses();
      }
    },
    DEPLOY_TIMEOUT_MS * 2,
  );
});
