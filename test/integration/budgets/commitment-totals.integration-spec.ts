import { randomUUID } from 'node:crypto';
import { BudgetHarness } from '../../support/budget-harness';
import { CommitmentRepo, heldKey } from '../../../src/modules/budgets/budget/commitment.repo';

const h = new BudgetHarness();

describe('commitment totals and spent from invoice lines (B07-7, integration PostgreSQL)', () => {
  let employeeId: string;
  let costCenterA: string;
  let costCenterB: string;
  let vendorId: string;
  let repo: CommitmentRepo;

  beforeAll(async () => {
    await h.start();
    repo = h.ctx.app.get(CommitmentRepo);

    const unitA = await h.departmentWithHead('P-TOTA');
    const unitB = await h.departmentWithHead('P-TOTB');
    employeeId = unitA.head.employeeId;
    costCenterA = unitA.department.unitId;
    costCenterB = unitB.department.unitId;

    vendorId = randomUUID();
    await h.ctx.sql.query(
      `INSERT INTO vendors (id, organization_id, name, normalized_name)
       VALUES ($1, $2, 'Totals Vendor', 'totals-vendor')`,
      [vendorId, h.seed.organizationId],
    );
  }, 240000);

  afterAll(async () => {
    await h.stop();
  });

  const insertInvoice = async (invoiceId = randomUUID(), date = '2026-06-15') => {
    await h.ctx.sql.query(
      `INSERT INTO invoices (
         id, organization_id, vendor_id, invoice_number, kind, invoice_date,
         amount_minor, amount_currency, amount_rate, amount_rate_date,
         amount_rate_source, amount_reporting_minor, reconciliation_status,
         recorded_by_employee_id
       ) VALUES ($1, $2, $3, $4, 'INVOICE', $5,
                 100000000, 'VND', 1, $5, 'MANUAL', 100000000, 'NONE', $6)`,
      [invoiceId, h.seed.organizationId, vendorId, `INV-${randomUUID().slice(0, 8)}`, date, employeeId],
    );
    return invoiceId;
  };

  const insertLine = async (over: {
    invoiceId: string;
    position?: number;
    costCenterId?: string | null;
    fiscalYear?: number;
    costReportingMinor?: number | bigint;
    deductibleVatReportingMinor?: number | bigint;
  }) => {
    const id = randomUUID();
    await h.ctx.sql.query(
      `INSERT INTO invoice_lines (
         id, invoice_id, position, description, out_of_catalog,
         amount_minor, amount_reporting_minor, cost_center_id, fiscal_year,
         cost_reporting_minor, deductible_vat_reporting_minor
       ) VALUES ($1, $2, $3, 'Line desc', true,
                 $4, $4, $5, $6, $7, $8)`,
      [
        id,
        over.invoiceId,
        over.position ?? 1,
        over.costReportingMinor ?? 10_000_000n,
        over.costCenterId !== undefined ? over.costCenterId : costCenterA,
        over.fiscalYear ?? 2026,
        over.costReportingMinor ?? 10_000_000n,
        over.deductibleVatReportingMinor ?? 0n,
      ],
    );
    return id;
  };

  const insertCommitment = async (over: Record<string, unknown> = {}) => {
    const id = (over.id as string) ?? randomUUID();
    const row = {
      id,
      organization_id: h.seed.organizationId,
      request_id: await h.fixtureRequestId(),
      cost_center_id: costCenterA,
      year: 2026,
      amount_minor: 21_000_000n,
      currency: 'VND',
      state: 'HELD',
      unattached_reason: 'NO_BUDGET',
      released_minor: 0n,
      realized_minor: 0n,
      released_at: null,
      ...over,
    };

    const keys = Object.keys(row);
    const cols = keys.map((k) => `"${k}"`).join(', ');
    const params = keys.map((_, i) => `$${i + 1}`).join(', ');
    const values = Object.values(row);

    await h.ctx.sql.query(`INSERT INTO budget_commitments (${cols}) VALUES (${params})`, values);
    return id;
  };

  it('unmatched invoice of 10m on CC-A, year 2026 results in spent 10m', async () => {
    const invId = await insertInvoice();
    await insertLine({
      invoiceId: invId,
      position: 1,
      costCenterId: costCenterA,
      fiscalYear: 2026,
      costReportingMinor: 10_000_000n,
      deductibleVatReportingMinor: 0n,
    });

    const totals = await repo.totals([{ costCenterId: costCenterA, year: 2026 }]);
    const entry = totals.get(heldKey(costCenterA, 2026));

    expect(entry).toBeDefined();
    expect(entry?.spent).toBe(10_000_000n);
    expect(entry?.held).toBe(0n);
  });

  it('two lines for two Cost Centers in one invoice attribute to each Cost Center correctly', async () => {
    const invId = await insertInvoice();
    await insertLine({
      invoiceId: invId,
      position: 1,
      costCenterId: costCenterA,
      fiscalYear: 2026,
      costReportingMinor: 7_000_000n,
    });
    await insertLine({
      invoiceId: invId,
      position: 2,
      costCenterId: costCenterB,
      fiscalYear: 2026,
      costReportingMinor: 3_000_000n,
    });

    const totals = await repo.totals([
      { costCenterId: costCenterA, year: 2026 },
      { costCenterId: costCenterB, year: 2026 },
    ]);

    expect(totals.get(heldKey(costCenterA, 2026))?.spent).toBe(17_000_000n); // 10m from prev test + 7m
    expect(totals.get(heldKey(costCenterB, 2026))?.spent).toBe(3_000_000n);
  });

  it('line with cost_center_id null does not count into spent of any Cost Center', async () => {
    const invId = await insertInvoice();
    await insertLine({
      invoiceId: invId,
      position: 1,
      costCenterId: null,
      fiscalYear: 2026,
      costReportingMinor: 50_000_000n,
    });

    const totals = await repo.totals([{ costCenterId: costCenterA, year: 2026 }]);
    expect(totals.get(heldKey(costCenterA, 2026))?.spent).toBe(17_000_000n); // unchanged
  });

  it('separates spend by fiscal year', async () => {
    const invId = await insertInvoice();
    await insertLine({
      invoiceId: invId,
      position: 1,
      costCenterId: costCenterA,
      fiscalYear: 2027,
      costReportingMinor: 12_000_000n,
    });

    const totals = await repo.totals([
      { costCenterId: costCenterA, year: 2026 },
      { costCenterId: costCenterA, year: 2027 },
    ]);

    expect(totals.get(heldKey(costCenterA, 2026))?.spent).toBe(17_000_000n);
    expect(totals.get(heldKey(costCenterA, 2027))?.spent).toBe(12_000_000n);
  });

  it('records deductible VAT beside spent (US-06-09 AC-12): price 20, VAT 2, buyer-remits 1 -> spent 21, deductibleVat 2', async () => {
    const invId = await insertInvoice();
    await insertLine({
      invoiceId: invId,
      position: 1,
      costCenterId: costCenterB,
      fiscalYear: 2027,
      costReportingMinor: 21_000_000n,
      deductibleVatReportingMinor: 2_000_000n,
    });

    const totals = await repo.totals([{ costCenterId: costCenterB, year: 2027 }]);
    const entry = totals.get(heldKey(costCenterB, 2027));

    expect(entry?.spent).toBe(21_000_000n);
    expect(entry?.deductibleVat).toBe(2_000_000n);
  });

  it('commitment of 21m with realized 13m and invoice of 13m results in held 8m and spent 13m', async () => {
    const proposalId = randomUUID();
    await h.ctx.sql.query(
      `INSERT INTO budget_proposals (
         id, organization_id, cost_center_id, year, state, total_minor, currency, submitted_by_employee_id
       ) VALUES ($1, $2, $3, 2028, 'REVIEWED', 100000000, 'VND', $4)`,
      [proposalId, h.seed.organizationId, costCenterA, employeeId],
    );

    const versionId = randomUUID();
    await h.ctx.sql.query(
      `INSERT INTO budget_versions (
         id, organization_id, cost_center_id, year, number, kind, state, proposal_id,
         base_minor, reserve_minor, total_minor, currency, high_value_percent,
         created_by_employee_id
       ) VALUES ($1, $2, $3, 2028, 1, 'INITIAL', 'DRAFT', $4,
                 100000000, 0, 100000000, 'VND', 10, $5)`,
      [versionId, h.seed.organizationId, costCenterA, proposalId, employeeId],
    );

    await insertCommitment({
      cost_center_id: costCenterA,
      year: 2028,
      amount_minor: 21_000_000n,
      released_minor: 0n,
      realized_minor: 13_000_000n,
      state: 'HELD',
      attached_version_id: versionId,
      attached_at: new Date().toISOString(),
      unattached_reason: null,
    });

    const invId = await insertInvoice();
    await insertLine({
      invoiceId: invId,
      position: 1,
      costCenterId: costCenterA,
      fiscalYear: 2028,
      costReportingMinor: 13_000_000n,
    });

    const totals = await repo.totals([{ costCenterId: costCenterA, year: 2028 }]);
    const entry = totals.get(heldKey(costCenterA, 2028));

    expect(entry?.held).toBe(8_000_000n); // 21 - 0 - 13
    expect(entry?.spent).toBe(13_000_000n); // from invoice line
  });

  it('RELEASED commitment does not affect spent', async () => {
    await insertCommitment({
      cost_center_id: costCenterA,
      year: 2029,
      amount_minor: 15_000_000n,
      released_minor: 15_000_000n,
      realized_minor: 0n,
      state: 'RELEASED',
      released_at: new Date().toISOString(),
    });

    const totals = await repo.totals([{ costCenterId: costCenterA, year: 2029 }]);
    const entry = totals.get(heldKey(costCenterA, 2029));

    expect(entry?.held ?? 0n).toBe(0n);
    expect(entry?.spent ?? 0n).toBe(0n);
  });
});
