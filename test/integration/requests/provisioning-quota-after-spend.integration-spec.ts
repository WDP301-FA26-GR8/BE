import { SpendHarness, type Unit } from '../../support/spend-harness';

const h = new SpendHarness();
const M = 1_000_000;

/**
 * US-07-04 AC-4: When provisioning fails with QUOTA_EXCEEDED after spend approval,
 * the task enters the IT Admin queue without automatic retries, and no new spend
 * approval step is inserted into the request.
 */
describe('provisioning quota failure after spend decision (US-07-04 AC-4)', () => {
  let subscriptionId: string;
  let plan: string;
  let unit: Unit;

  beforeAll(async () => {
    await h.start();
    await h.withApprover();
    subscriptionId = await h.subscription(10);
    plan = await h.planOf(subscriptionId);
    unit = await h.departmentWithHead('P-QUOTA');
    await h.budgetFor(unit, { total: 100 * M, held: 0, spent: 0 });
  }, 240000);

  afterAll(async () => {
    await h.stop();
  });

  const taskOf = async (requestId: string) =>
    h.dataOf<{ task: { id: string; status: string } }>(await h.grant({ requestId, subscriptionId }).expect(201)).task;

  it('places the task into IT Admin queue on QUOTA_EXCEEDED without retrying or adding spend steps', async () => {
    const requestId = await h.waitingForApprover(unit, plan, { amount: 10 * M });
    await h.decideSpend(requestId, { decision: 'APPROVE' }, h.boss.account).expect(200);

    const stepsBefore = (
      await h.ctx.sql.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM access_request_steps WHERE request_id = $1 AND kind = 'SPEND_APPROVAL'`,
        [requestId],
      )
    ).rows[0].count;

    const task = await taskOf(requestId);
    await h.makeConnector(task.id);
    await h.recordFailure(task.id, 'QUOTA_EXCEEDED', 'License quota exceeded by vendor');

    const taskRow = (
      await h.ctx.sql.query<{ status: string; attempts: number }>(
        `SELECT status, attempts FROM provisioning_tasks WHERE id = $1`,
        [task.id],
      )
    ).rows[0];
    expect(taskRow.status).toBe('FAILED');
    expect(taskRow.attempts).toBe(1);

    const requestRow = (
      await h.ctx.sql.query<{ state: string }>(`SELECT state FROM access_requests WHERE id = $1`, [requestId])
    ).rows[0];
    expect(requestRow.state).toBe('EXECUTING');

    const stepsAfter = (
      await h.ctx.sql.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM access_request_steps WHERE request_id = $1 AND kind = 'SPEND_APPROVAL'`,
        [requestId],
      )
    ).rows[0].count;
    expect(stepsAfter).toBe(stepsBefore);
  });
});
