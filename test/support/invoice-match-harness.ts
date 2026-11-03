import { randomUUID } from 'node:crypto';
import { BudgetHarness } from './budget-harness';

/** SQL fixtures for commitment matching; each case gets its own Cost Center and approved budget. */
export class InvoiceMatchHarness extends BudgetHarness {
  async waitForBlockedBy(holderPid: number): Promise<number> {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const { rows } = await this.ctx.sql.query<{ pid: number }>(
        'SELECT pid FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))',
        [holderPid],
      );
      if (rows[0]) return rows[0].pid;
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    throw new Error('Release did not wait for the matching transaction');
  }

  async matchArtifactCounts() {
    return (
      await this.ctx.sql.query<{
        invoices: string;
        lines: string;
        taxes: string;
        realizations: string;
        audits: string;
      }>(`SELECT
      (SELECT count(*)::text FROM invoices) AS invoices,
      (SELECT count(*)::text FROM invoice_lines) AS lines,
      (SELECT count(*)::text FROM invoice_tax_lines) AS taxes,
      (SELECT count(*)::text FROM commitment_realizations) AS realizations,
      (SELECT count(*)::text FROM audit_events) AS audits`)
    ).rows;
  }

  async approvedBudget(costCenterId: string, employeeId: string, year = 2026, totalMinor = 100_000_000) {
    const proposalId = randomUUID();
    await this.ctx.sql.query(
      `INSERT INTO budget_proposals (id, organization_id, cost_center_id, year, state, total_minor, currency, submitted_by_employee_id)
       VALUES ($1, $2, $3, $4, 'REVIEWED', $5, 'VND', $6)`,
      [proposalId, this.seed.organizationId, costCenterId, year, totalMinor, employeeId],
    );
    const versionId = randomUUID();
    await this.ctx.sql.query(
      `INSERT INTO budget_versions (id, organization_id, cost_center_id, year, number, kind, state, proposal_id, base_minor, reserve_minor, total_minor, currency, high_value_percent, created_by_employee_id, sent_at, sent_by_employee_id)
       VALUES ($1, $2, $3, $4, 1, 'INITIAL', 'APPROVED', $5, $6, 0, $6, 'VND', 10, $7, now(), $7)`,
      [versionId, this.seed.organizationId, costCenterId, year, proposalId, totalMinor, employeeId],
    );
    return { versionId, totalMinor: BigInt(totalMinor) };
  }

  async commitment(costCenterId: string, versionId: string, over: Record<string, unknown> = {}) {
    const requestId = typeof over.request_id === 'string' ? over.request_id : await this.fixtureRequestId();
    const attachedVersionId = over.attached_version_id === undefined ? versionId : over.attached_version_id;
    const row = {
      id: randomUUID(),
      organization_id: this.seed.organizationId,
      request_id: requestId,
      cost_center_id: costCenterId,
      year: 2026,
      amount_minor: 21_000_000n,
      currency: 'VND',
      state: 'HELD',
      attached_version_id: attachedVersionId,
      attached_at: attachedVersionId ? new Date().toISOString() : null,
      unattached_reason: attachedVersionId ? null : 'NO_BUDGET',
      released_minor: 0n,
      realized_minor: 0n,
      released_at: null,
      ...over,
    };
    const keys = Object.keys(row);
    const columns = keys.map((key) => `"${key}"`).join(', ');
    const params = keys.map((_, i) => `$${i + 1}`).join(', ');
    await this.ctx.sql.query(`INSERT INTO budget_commitments (${columns}) VALUES (${params})`, Object.values(row));
    return { id: row.id, requestId, amountMinor: row.amount_minor };
  }

  async vendorPlan(vendorId: string, employeeId: string) {
    const appId = randomUUID();
    await this.ctx.sql.query(
      `INSERT INTO applications (
         id, organization_id, vendor_id, name, normalized_name,
         kind, business_owner_employee_id, data_sensitivity,
         comm_person_to_person_messaging, comm_calls_or_meetings, comm_mailbox, is_communication_service
       ) VALUES ($1, $2, $3, $5, $5, 'SAAS', $4, 'LOW', false, false, false, false)`,
      [appId, this.seed.organizationId, vendorId, employeeId, `match-${appId}`],
    );
    const planId = randomUUID();
    await this.ctx.sql.query(
      `INSERT INTO plans (id, organization_id, application_id, name, normalized_name, provisioning_type, pricing_model, control_level)
       VALUES ($1, $2, $3, 'Match Plan', 'match-plan', 'K2', 'PER_SEAT', 'FULL')`,
      [planId, this.seed.organizationId, appId],
    );
    return planId;
  }

  async matchSubscription(vendorId: string, employeeId: string, departmentId: string) {
    const planId = await this.vendorPlan(vendorId, employeeId);
    const id = randomUUID();
    await this.ctx.sql.query(
      `INSERT INTO subscriptions (id, organization_id, plan_id, kind, status, owner_department_id)
       VALUES ($1, $2, $3, 'TERM', 'DRAFT', $4)`,
      [id, this.seed.organizationId, planId, departmentId],
    );
    return id;
  }

  async creditNote(
    vendorId: string,
    employeeId: string,
    costCenterId: string,
    creditedInvoiceId: string | null = null,
  ) {
    const id = randomUUID();
    await this.ctx.sql.query(
      `INSERT INTO invoices (
         id, organization_id, vendor_id, invoice_number, kind, invoice_date,
         amount_minor, amount_currency, amount_rate, amount_rate_date,
         amount_rate_source, amount_reporting_minor, reconciliation_status,
         recorded_by_employee_id, credited_invoice_id
       ) VALUES ($1, $2, $3, $4, 'CREDIT_NOTE', '2026-11-01',
                 10000000, 'VND', 1, '2026-11-01', 'MANUAL', 10000000, 'NONE', $5, $6)`,
      [id, this.seed.organizationId, vendorId, `CN-${id}`, employeeId, creditedInvoiceId],
    );
    await this.ctx.sql.query(
      `INSERT INTO invoice_lines (
         id, invoice_id, position, description, out_of_catalog,
         amount_minor, amount_reporting_minor, cost_center_id, fiscal_year,
         cost_reporting_minor, deductible_vat_reporting_minor
       ) VALUES (gen_random_uuid(), $1, 1, 'Credit item', true,
                 -10000000, -10000000, $2, 2026, -10000000, 0)`,
      [id, costCenterId],
    );
    return id;
  }
}
