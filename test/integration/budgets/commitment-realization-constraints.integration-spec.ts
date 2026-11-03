import { randomUUID } from 'node:crypto';
import { BudgetHarness } from '../../support/budget-harness';
import { CommitmentRepo } from '../../../src/modules/budgets/budget/commitment.repo';
import { heldKey } from '../../../src/modules/budgets/budget/commitment-key.policy';
import { InvoiceRepo } from '../../../src/modules/budgets/invoice/invoice.repo';
import { TransactionRunner } from '../../../src/infrastructure/database/transaction-runner';
import type { CommitmentRow } from '../../../src/modules/budgets/budget/commitment-release.policy';

const h = new BudgetHarness();
const CHECK = '23514';
const RESTRICT = '23001';
const UNIQUE = '23505';

/** The SQLSTATE a rejected statement carries: the constraint, not the application, said no. */
async function sqlState(text: string, values: unknown[] = []): Promise<string | null> {
  try {
    await h.ctx.sql.query(text, values);

    return null;
  } catch (error) {
    return (error as { code?: string }).code ?? 'unknown';
  }
}

describe('commitment realization schema and constraints (B07-6, integration PostgreSQL)', () => {
  let vendorId: string;
  let employeeId: string;
  let costCenterId: string;
  let invoiceId: string;
  let lineId: string;
  let repo: CommitmentRepo;
  let invoiceRepo: InvoiceRepo;
  let runner: TransactionRunner;

  beforeAll(async () => {
    await h.start();
    repo = h.ctx.app.get(CommitmentRepo);
    invoiceRepo = h.ctx.app.get(InvoiceRepo);
    runner = h.ctx.app.get(TransactionRunner);
    const unit = await h.departmentWithHead('P-REALCON');
    employeeId = unit.head.employeeId;
    costCenterId = unit.department.unitId;

    vendorId = randomUUID();
    await h.ctx.sql.query(
      `INSERT INTO vendors (id, organization_id, name, normalized_name)
       VALUES ($1, $2, 'Realization Vendor', 'realization-vendor')`,
      [vendorId, h.seed.organizationId],
    );

    invoiceId = randomUUID();
    await h.ctx.sql.query(
      `INSERT INTO invoices (
         id, organization_id, vendor_id, invoice_number, kind, invoice_date,
         amount_minor, amount_currency, amount_rate, amount_rate_date,
         amount_rate_source, amount_reporting_minor, reconciliation_status,
         recorded_by_employee_id
       ) VALUES ($1, $2, $3, 'INV-REAL-1', 'INVOICE', '2026-11-01',
                 1000000, 'VND', 1, '2026-11-01', 'MANUAL', 1000000, 'NONE', $4)`,
      [invoiceId, h.seed.organizationId, vendorId, employeeId],
    );

    lineId = randomUUID();
    await h.ctx.sql.query(
      `INSERT INTO invoice_lines (
         id, invoice_id, position, description, out_of_catalog,
         amount_minor, amount_reporting_minor, cost_center_id, fiscal_year,
         cost_reporting_minor, deductible_vat_reporting_minor
       ) VALUES ($1, $2, 1, 'Out of catalog tool', true,
                 1000000, 1000000, $3, 2026, 1000000, 0)`,
      [lineId, invoiceId, costCenterId],
    );
  }, 240000);

  afterAll(async () => {
    await h.stop();
  });

  const insertCommitment = async (over: Record<string, unknown> = {}) => {
    const id = (over.id as string) ?? randomUUID();
    const row = {
      id,
      organization_id: h.seed.organizationId,
      request_id: await h.fixtureRequestId(),
      cost_center_id: costCenterId,
      year: 2026,
      amount_minor: 1000000,
      currency: 'VND',
      state: 'HELD',
      unattached_reason: 'NO_BUDGET',
      released_minor: 0,
      realized_minor: 0,
      released_at: null,
      ...over,
    };

    const keys = Object.keys(row);
    const cols = keys.map((k) => `"${k}"`).join(', ');
    const params = keys.map((_, i) => `$${i + 1}`).join(', ');
    const values = Object.values(row);

    return { id, state: await sqlState(`INSERT INTO budget_commitments (${cols}) VALUES (${params})`, values) };
  };

  describe('budget_commitments_release_check (CHECK constraint)', () => {
    it('refuses released_minor + realized_minor > amount_minor', async () => {
      const result = await insertCommitment({
        amount_minor: 1000000,
        released_minor: 600000,
        realized_minor: 500000,
      });
      expect(result.state).toBe(CHECK);
    });

    it('refuses RELEASED state when realized_minor > 0', async () => {
      const result = await insertCommitment({
        amount_minor: 1000000,
        released_minor: 900000,
        realized_minor: 100000,
        state: 'RELEASED',
        released_at: new Date().toISOString(),
      });
      expect(result.state).toBe(CHECK);
    });

    it('refuses EXPENSED state when realized_minor = 0', async () => {
      const result = await insertCommitment({
        amount_minor: 1000000,
        released_minor: 1000000,
        realized_minor: 0,
        state: 'EXPENSED',
        released_at: null,
      });
      expect(result.state).toBe(CHECK);
    });

    it('refuses EXPENSED state when released_minor + realized_minor < amount_minor', async () => {
      const result = await insertCommitment({
        amount_minor: 1000000,
        released_minor: 0,
        realized_minor: 500000,
        state: 'EXPENSED',
        released_at: null,
      });
      expect(result.state).toBe(CHECK);
    });

    it('refuses HELD state when released_minor + realized_minor = amount_minor', async () => {
      const result = await insertCommitment({
        amount_minor: 1000000,
        released_minor: 500000,
        realized_minor: 500000,
        state: 'HELD',
        released_at: null,
      });
      expect(result.state).toBe(CHECK);
    });

    it('accepts valid EXPENSED state with realized_minor > 0 and sum = amount_minor', async () => {
      const result = await insertCommitment({
        amount_minor: 1000000,
        released_minor: 200000,
        realized_minor: 800000,
        state: 'EXPENSED',
        released_at: null,
      });
      expect(result.state).toBeNull();
    });
  });

  describe('budget_commitments_guard (TRIGGER constraint)', () => {
    it('refuses decreasing realized_minor', async () => {
      const comm = await insertCommitment({
        amount_minor: 1000000,
        released_minor: 0,
        realized_minor: 500000,
        state: 'HELD',
      });
      expect(comm.state).toBeNull();

      const updateState = await sqlState('UPDATE budget_commitments SET realized_minor = 400000 WHERE id = $1', [
        comm.id,
      ]);
      expect(updateState).toBe(RESTRICT);
    });
  });

  describe('commitment_realizations (append-only trigger & constraints)', () => {
    it('accepts inserting a valid realization', async () => {
      const comm = await insertCommitment({
        amount_minor: 1000000,
        released_minor: 0,
        realized_minor: 500000,
        state: 'HELD',
      });
      expect(comm.state).toBeNull();

      const realId = randomUUID();
      const insertState = await sqlState(
        `INSERT INTO commitment_realizations (
           id, commitment_id, invoice_line_id, amount_minor, recorded_by_employee_id
         ) VALUES ($1, $2, $3, 500000, $4)`,
        [realId, comm.id, lineId, employeeId],
      );
      expect(insertState).toBeNull();

      // Trigger refuses UPDATE
      const updateState = await sqlState('UPDATE commitment_realizations SET amount_minor = 600000 WHERE id = $1', [
        realId,
      ]);
      expect(updateState).toBe(RESTRICT);

      // Trigger refuses DELETE
      const deleteState = await sqlState('DELETE FROM commitment_realizations WHERE id = $1', [realId]);
      expect(deleteState).toBe(RESTRICT);
    });

    it('refuses non-positive amount_minor', async () => {
      const comm = await insertCommitment();
      const secondLineId = randomUUID();
      await h.ctx.sql.query(
        `INSERT INTO invoice_lines (
           id, invoice_id, position, description, out_of_catalog,
           amount_minor, amount_reporting_minor, cost_center_id, fiscal_year,
           cost_reporting_minor, deductible_vat_reporting_minor
         ) VALUES ($1, $2, 2, 'Another line', true,
                   500000, 500000, $3, 2026, 500000, 0)`,
        [secondLineId, invoiceId, costCenterId],
      );

      const state = await sqlState(
        `INSERT INTO commitment_realizations (
           id, commitment_id, invoice_line_id, amount_minor, recorded_by_employee_id
         ) VALUES ($1, $2, $3, 0, $4)`,
        [randomUUID(), comm.id, secondLineId, employeeId],
      );
      expect(state).toBe(CHECK);
    });

    it('refuses duplicate invoice_line_id (UNIQUE constraint)', async () => {
      const comm1 = await insertCommitment();
      const comm2 = await insertCommitment();

      const thirdLineId = randomUUID();
      await h.ctx.sql.query(
        `INSERT INTO invoice_lines (
           id, invoice_id, position, description, out_of_catalog,
           amount_minor, amount_reporting_minor, cost_center_id, fiscal_year,
           cost_reporting_minor, deductible_vat_reporting_minor
         ) VALUES ($1, $2, 3, 'Third line', true,
                   500000, 500000, $3, 2026, 500000, 0)`,
        [thirdLineId, invoiceId, costCenterId],
      );

      const first = await sqlState(
        `INSERT INTO commitment_realizations (
           id, commitment_id, invoice_line_id, amount_minor, recorded_by_employee_id
         ) VALUES ($1, $2, $3, 200000, $4)`,
        [randomUUID(), comm1.id, thirdLineId, employeeId],
      );
      expect(first).toBeNull();

      const second = await sqlState(
        `INSERT INTO commitment_realizations (
           id, commitment_id, invoice_line_id, amount_minor, recorded_by_employee_id
         ) VALUES ($1, $2, $3, 300000, $4)`,
        [randomUUID(), comm2.id, thirdLineId, employeeId],
      );
      expect(second).toBe(UNIQUE);
    });
  });

  describe('CommitmentRepo.release (F-02)', () => {
    it('sets state to EXPENSED and released_at to null when realized is 13 and remaining 8 is released', async () => {
      const comm = await insertCommitment({
        amount_minor: 21,
        released_minor: 0,
        realized_minor: 13,
        state: 'HELD',
      });
      expect(comm.state).toBeNull();

      const row: CommitmentRow = {
        id: comm.id,
        year: 2026,
        amountMinor: 21n,
        releasedMinor: 0n,
        realizedMinor: 13n,
        state: 'HELD',
      };

      const now = new Date();
      const result = await runner.run((tx) =>
        repo.release(tx, row, {
          takeMinor: 8n,
          reason: 'REQUEST_CANCELLED',
          reasonText: null,
          releasedByEmployeeId: null,
          now,
        }),
      );

      expect(result).toEqual({ released: true, heldMinor: 0n });

      const updated = (
        await h.ctx.sql.query<{
          state: string;
          released_at: Date | null;
          released_minor: string;
          realized_minor: string;
        }>('SELECT state, released_at, released_minor, realized_minor FROM budget_commitments WHERE id = $1', [comm.id])
      ).rows[0];

      expect(updated.state).toBe('EXPENSED');
      expect(updated.released_at).toBeNull();
      expect(updated.released_minor).toBe('8');
      expect(updated.realized_minor).toBe('13');
    });

    it('sets state to RELEASED and sets released_at when realized is 0 and all is released', async () => {
      const comm = await insertCommitment({
        amount_minor: 21,
        released_minor: 0,
        realized_minor: 0,
        state: 'HELD',
      });
      expect(comm.state).toBeNull();

      const row: CommitmentRow = {
        id: comm.id,
        year: 2026,
        amountMinor: 21n,
        releasedMinor: 0n,
        realizedMinor: 0n,
        state: 'HELD',
      };

      const now = new Date();
      const result = await runner.run((tx) =>
        repo.release(tx, row, {
          takeMinor: 21n,
          reason: 'REQUEST_CANCELLED',
          reasonText: null,
          releasedByEmployeeId: null,
          now,
        }),
      );

      expect(result).toEqual({ released: true, heldMinor: 0n });

      const updated = (
        await h.ctx.sql.query<{
          state: string;
          released_at: Date | null;
          released_minor: string;
          realized_minor: string;
        }>('SELECT state, released_at, released_minor, realized_minor FROM budget_commitments WHERE id = $1', [comm.id])
      ).rows[0];

      expect(updated.state).toBe('RELEASED');
      expect(updated.released_at).not.toBeNull();
      expect(updated.released_minor).toBe('21');
      expect(updated.realized_minor).toBe('0');
    });
  });

  describe('CommitmentRepo.totals (F-03)', () => {
    it('computes held as 8 with HELD 21 and realized 13', async () => {
      const proposalId = randomUUID();
      await h.ctx.sql.query(
        `INSERT INTO budget_proposals (
           id, organization_id, cost_center_id, year, state, total_minor, currency, submitted_by_employee_id
         ) VALUES ($1, $2, $3, 2026, 'REVIEWED', 100000000, 'VND', $4)`,
        [proposalId, h.seed.organizationId, costCenterId, employeeId],
      );

      const versionId = randomUUID();
      await h.ctx.sql.query(
        `INSERT INTO budget_versions (
           id, organization_id, cost_center_id, year, number, kind, state, proposal_id,
           base_minor, reserve_minor, total_minor, currency, high_value_percent,
           created_by_employee_id
         ) VALUES ($1, $2, $3, 2026, 1, 'INITIAL', 'DRAFT', $4,
                   100000000, 0, 100000000, 'VND', 10, $5)`,
        [versionId, h.seed.organizationId, costCenterId, proposalId, employeeId],
      );

      const comm = await insertCommitment({
        amount_minor: 21,
        released_minor: 0,
        realized_minor: 13,
        state: 'HELD',
        attached_version_id: versionId,
        attached_at: new Date().toISOString(),
        unattached_reason: null,
      });
      expect(comm.state).toBeNull();

      const totals = await repo.totals([{ costCenterId, year: 2026 }]);
      const entry = totals.get(heldKey(costCenterId, 2026));

      expect(entry).toBeDefined();
      expect(entry?.held).toBe(8n);
    });
  });

  describe('CommitmentRepo.realize and lockOfRequest (B07-8 Step 3)', () => {
    const createTestLine = async () => {
      const invId = randomUUID();
      await h.ctx.sql.query(
        `INSERT INTO invoices (
           id, organization_id, vendor_id, invoice_number, kind, invoice_date,
           amount_minor, amount_currency, amount_rate, amount_rate_date,
           amount_rate_source, amount_reporting_minor, reconciliation_status,
           recorded_by_employee_id
         ) VALUES ($1, $2, $3, $4, 'INVOICE', '2026-11-01',
                   10000000, 'VND', 1, '2026-11-01', 'MANUAL', 10000000, 'NONE', $5)`,
        [invId, h.seed.organizationId, vendorId, `INV-TEST-${randomUUID().slice(0, 8)}`, employeeId],
      );
      const lId = randomUUID();
      await h.ctx.sql.query(
        `INSERT INTO invoice_lines (
           id, invoice_id, position, description, out_of_catalog,
           amount_minor, amount_reporting_minor, cost_center_id, fiscal_year,
           cost_reporting_minor, deductible_vat_reporting_minor
         ) VALUES ($1, $2, 1, 'Test line', true,
                   10000000, 10000000, $3, 2026, 10000000, 0)`,
        [lId, invId, costCenterId],
      );
      return { invoiceId: invId, lineId: lId };
    };

    it('records partial realization, updates realized_minor, and leaves commitment HELD', async () => {
      const { lineId: testLineId } = await createTestLine();
      const comm = await insertCommitment({
        amount_minor: 21,
        released_minor: 0,
        realized_minor: 0,
        state: 'HELD',
      });

      const row: CommitmentRow = {
        id: comm.id,
        year: 2026,
        amountMinor: 21n,
        releasedMinor: 0n,
        realizedMinor: 0n,
        state: 'HELD',
      };

      const now = new Date();
      const result = await runner.run((tx) =>
        repo.realize(tx, row, {
          takeMinor: 13n,
          invoiceLineId: testLineId,
          employeeId,
          now,
        }),
      );

      expect(result).toEqual({ expensed: false, heldMinor: 8n });

      const updated = (
        await h.ctx.sql.query<{
          state: string;
          realized_minor: string;
          released_minor: string;
        }>('SELECT state, realized_minor, released_minor FROM budget_commitments WHERE id = $1', [comm.id])
      ).rows[0];

      expect(updated.state).toBe('HELD');
      expect(updated.realized_minor).toBe('13');

      const real = (
        await h.ctx.sql.query<{
          commitment_id: string;
          invoice_line_id: string;
          amount_minor: string;
        }>(
          'SELECT commitment_id, invoice_line_id, amount_minor FROM commitment_realizations WHERE invoice_line_id = $1',
          [testLineId],
        )
      ).rows[0];

      expect(real.commitment_id).toBe(comm.id);
      expect(real.amount_minor).toBe('13');
    });

    it('transitions to EXPENSED when realization consumes all remaining held amount', async () => {
      const { lineId: secondLineId } = await createTestLine();

      const comm = await insertCommitment({
        amount_minor: 21,
        released_minor: 0,
        realized_minor: 13,
        state: 'HELD',
      });

      const row: CommitmentRow = {
        id: comm.id,
        year: 2026,
        amountMinor: 21n,
        releasedMinor: 0n,
        realizedMinor: 13n,
        state: 'HELD',
      };

      const now = new Date();
      const result = await runner.run((tx) =>
        repo.realize(tx, row, {
          takeMinor: 8n,
          invoiceLineId: secondLineId,
          employeeId,
          now,
        }),
      );

      expect(result).toEqual({ expensed: true, heldMinor: 0n });

      const updated = (
        await h.ctx.sql.query<{
          state: string;
          realized_minor: string;
        }>('SELECT state, realized_minor FROM budget_commitments WHERE id = $1', [comm.id])
      ).rows[0];

      expect(updated.state).toBe('EXPENSED');
      expect(updated.realized_minor).toBe('21');
    });

    it('throws when commitment was modified concurrently (optimistic lock)', async () => {
      const { lineId: thirdLineId } = await createTestLine();

      const comm = await insertCommitment({
        amount_minor: 21,
        released_minor: 0,
        realized_minor: 0,
        state: 'HELD',
      });

      // Stale row data (claims realizedMinor is 5 instead of 0)
      const staleRow: CommitmentRow = {
        id: comm.id,
        year: 2026,
        amountMinor: 21n,
        releasedMinor: 0n,
        realizedMinor: 5n,
        state: 'HELD',
      };

      await expect(
        runner.run((tx) =>
          repo.realize(tx, staleRow, {
            takeMinor: 5n,
            invoiceLineId: thirdLineId,
            employeeId,
            now: new Date(),
          }),
        ),
      ).rejects.toThrow(`The commitment ${comm.id} changed while it was being realized.`);
    });

    it('lockOfRequest locks and orders commitments of request by year ascending (F-11)', async () => {
      const reqId = await h.fixtureRequestId();
      const comm2027 = await insertCommitment({
        request_id: reqId,
        year: 2027,
        amount_minor: 50,
      });
      const comm2026 = await insertCommitment({
        request_id: reqId,
        year: 2026,
        amount_minor: 30,
      });

      const locked = await runner.run((tx) => repo.lockOfRequest(tx, reqId));

      expect(locked.map((c) => ({ id: c.id, year: c.year }))).toEqual([
        { id: comm2026.id, year: 2026 },
        { id: comm2027.id, year: 2027 },
      ]);
    });
  });

  describe('InvoiceRepo methods (B07-8 Step 3)', () => {
    it('locks invoice and returns id, organizationId, vendorId, kind', async () => {
      const locked = await runner.run((tx) => invoiceRepo.lockInvoice(tx, invoiceId));

      expect(locked).toMatchObject({
        id: invoiceId,
        organizationId: h.seed.organizationId,
        vendorId,
        kind: 'INVOICE',
      });
    });

    it('reads line and its realization status with findLine', async () => {
      const found = await runner.run((tx) => invoiceRepo.findLine(tx, invoiceId, 1));

      expect(found).not.toBeNull();
      expect(found).toMatchObject({
        id: lineId,
        invoiceId,
        position: 1,
        fiscalYear: 2026,
        costCenterId,
        costReportingMinor: 1000000n,
      });
    });

    it('sets cost_center_id on line only when currently null', async () => {
      const unassignedLineId = randomUUID();
      await h.ctx.sql.query(
        `INSERT INTO invoice_lines (
           id, invoice_id, position, description, out_of_catalog,
           amount_minor, amount_reporting_minor, cost_center_id, fiscal_year,
           cost_reporting_minor, deductible_vat_reporting_minor
         ) VALUES ($1, $2, 99, 'Unassigned item', true,
                   100, 100, NULL, 2026, 100, 0)`,
        [unassignedLineId, invoiceId],
      );

      const assignedFirst = await runner.run((tx) =>
        invoiceRepo.setLineCostCenterIfNull(tx, unassignedLineId, costCenterId),
      );
      expect(assignedFirst).toBe(true);

      const otherCostCenterId = randomUUID();
      const assignedSecond = await runner.run((tx) =>
        invoiceRepo.setLineCostCenterIfNull(tx, unassignedLineId, otherCostCenterId),
      );
      expect(assignedSecond).toBe(false);

      const check = (
        await h.ctx.sql.query<{ cost_center_id: string }>('SELECT cost_center_id FROM invoice_lines WHERE id = $1', [
          unassignedLineId,
        ])
      ).rows[0];
      expect(check.cost_center_id).toBe(costCenterId);
    });
  });
});
