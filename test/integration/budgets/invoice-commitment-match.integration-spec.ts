import { randomUUID } from 'node:crypto';
import { TransactionRunner } from '../../../src/infrastructure/database/transaction-runner';
import { BudgetViewService } from '../../../src/modules/budgets/budget-view/budget-view.service';
import { CommitmentRepo } from '../../../src/modules/budgets/budget/commitment.repo';
import { heldKey } from '../../../src/modules/budgets/budget/commitment-key.policy';
import { CommitmentService } from '../../../src/modules/budgets/commitment/commitment.service';
import { InvoiceService } from '../../../src/modules/budgets/invoice/invoice.service';
import { InvoiceTaxLineService } from '../../../src/modules/budgets/invoice/invoice-tax-line.service';
import { InvoiceMatchService } from '../../../src/modules/budgets/invoice/invoice-match.service';
import { BudgetCommitmentNotFoundError } from '../../../src/modules/budgets/budget/budget.errors';
import { InvoiceMatchRefusedError } from '../../../src/modules/budgets/invoice/invoice.errors';
import { InvoiceMatchHarness } from '../../support/invoice-match-harness';
import { Barrier } from '../../support/concurrency-harness';

const h = new InvoiceMatchHarness();

describe('invoice commitment match & concurrency (B07-8, integration PostgreSQL)', () => {
  let employeeId: string;
  let costCenterId: string;
  let departmentId: string;
  let runner: TransactionRunner;
  let commitmentRepo: CommitmentRepo;
  let commitmentService: CommitmentService;
  let invoiceService: InvoiceService;
  let matchService: InvoiceMatchService;
  let taxLineService: InvoiceTaxLineService;
  let defaultVendorId: string;
  let approvedVersionId: string;
  let approvedBudgetTotalMinor: bigint;

  const financeActor = () => h.principalOf(h.finance, ['FINANCE']);

  const insertApprovedBudget = (year = 2026, totalMinor = 100_000_000, ccId = costCenterId) =>
    h.approvedBudget(ccId, employeeId, year, totalMinor);

  beforeAll(async () => {
    await h.start();
    runner = h.ctx.app.get(TransactionRunner);
    commitmentRepo = h.ctx.app.get(CommitmentRepo);
    commitmentService = h.ctx.app.get(CommitmentService);
    invoiceService = h.ctx.app.get(InvoiceService);
    matchService = h.ctx.app.get(InvoiceMatchService);
    taxLineService = h.ctx.app.get(InvoiceTaxLineService);

    defaultVendorId = randomUUID();
    await h.ctx.sql.query(
      `INSERT INTO vendors (id, organization_id, name, normalized_name)
       VALUES ($1, $2, 'Default Match Vendor', 'default-match-vendor')`,
      [defaultVendorId, h.seed.organizationId],
    );
  }, 240000);

  let caseNumber = 0;
  beforeEach(async () => {
    const unit = await h.departmentWithHead(`P-MATCH-${++caseNumber}`);
    employeeId = unit.head.employeeId;
    costCenterId = unit.department.unitId;
    departmentId = unit.department.id;
    const budget = await insertApprovedBudget();
    approvedVersionId = budget.versionId;
    approvedBudgetTotalMinor = budget.totalMinor;
  });

  afterAll(async () => {
    await h.stop();
  });

  const insertCommitment = (over: Record<string, unknown> = {}) => h.commitment(costCenterId, approvedVersionId, over);

  const balances = async (year = 2026) => {
    const table = await h.ctx.app.get(BudgetViewService).table({ year, page: 1, pageSize: 100 });
    const row = table.items.find((item) => item.costCenter.id === costCenterId);
    if (!row) throw new Error('Missing budget table row');
    return {
      held: BigInt(row.committed.amount),
      spent: BigInt(row.spent.amount),
      remaining: BigInt(row.remaining.amount),
      deductibleVat: BigInt(row.deductibleVat.amount),
    };
  };

  it('US-06-06 AC-1: K1 21; price 20, deductible VAT 2, buyer-remits 1; recorded with commitmentId -> EXPENSED; held -21, spent +21, remaining unchanged', async () => {
    const totalMinor = approvedBudgetTotalMinor;
    const comm = await insertCommitment({
      attached_version_id: approvedVersionId,
      amount_minor: 21_000_000n,
    });

    expect(await balances()).toMatchObject({ held: 21_000_000n, spent: 0n, remaining: 79_000_000n });

    // Before invoice: held is 21m, spent is 0, remaining is 100m - 21m = 79m
    const beforeTotals = await commitmentRepo.totals([{ costCenterId, year: 2026 }]);
    expect(beforeTotals.get(heldKey(costCenterId, 2026))?.held).toBe(21_000_000n);
    expect(beforeTotals.get(heldKey(costCenterId, 2026))?.spent).toBe(0n);

    // Record invoice with base 20m, deductible VAT 2m, buyer-remits tax 1m -> cost is 21m
    const { id: invoiceId } = await invoiceService.record(financeActor(), {
      vendorId: defaultVendorId,
      invoiceNumber: `INV-AC1-${randomUUID().slice(0, 8)}`,
      invoiceDate: '2026-11-01',
      amount: { amount: '20000000', currency: 'VND' },
      lines: [
        {
          commitmentId: comm.id,
          outOfCatalog: true,
          description: 'Tool license',
          amount: '20000000',
        },
      ],
      taxLines: [
        {
          taxType: 'GTGT',
          rateBp: 1000,
          amount: { amount: '2000000', currency: 'VND' },
          payer: 'VENDOR_COLLECTS',
          deductible: true,
        },
        {
          taxType: 'NT',
          rateBp: 500,
          amount: { amount: '1000000', currency: 'VND' },
          payer: 'BUYER_REMITS',
          deductible: false,
        },
      ],
    });

    // Check commitment state: EXPENSED, realized = 21m
    const commDb = (
      await h.ctx.sql.query<{ state: string; realized_minor: string }>(
        'SELECT state, realized_minor FROM budget_commitments WHERE id = $1',
        [comm.id],
      )
    ).rows[0];
    expect(commDb.state).toBe('EXPENSED');
    expect(commDb.realized_minor).toBe('21000000');

    // Totals: held is 0, spent is 21m
    const afterTotals = await commitmentRepo.totals([{ costCenterId, year: 2026 }]);
    const entry = afterTotals.get(heldKey(costCenterId, 2026));
    expect(entry?.held).toBe(0n);
    expect(entry?.spent).toBe(21_000_000n);
    expect(entry?.deductibleVat).toBe(2_000_000n);

    // Remaining: 100m - 0 - 21m = 79m (unchanged compared to before recording!)
    const remaining = totalMinor - (entry?.held ?? 0n) - (entry?.spent ?? 0n);
    expect(remaining).toBe(79_000_000n);
    expect(await balances()).toMatchObject({ spent: 21_000_000n, remaining: 79_000_000n });

    // Commitment realization row created
    const real = (
      await h.ctx.sql.query<{ amount_minor: string }>(
        'SELECT amount_minor FROM commitment_realizations WHERE commitment_id = $1',
        [comm.id],
      )
    ).rows[0];
    expect(real.amount_minor).toBe('21000000');
    expect(invoiceId).toBeDefined();
  });

  it('F-24: recorded first without commitmentId, then matched later -> before match remaining is lower by 21m; after match equal', async () => {
    const { versionId, totalMinor } = await insertApprovedBudget(2028, 100_000_000);
    const comm = await insertCommitment({
      attached_version_id: versionId,
      year: 2028,
      amount_minor: 21_000_000n,
    });

    const subId = await h.matchSubscription(defaultVendorId, employeeId, departmentId);

    expect(await balances(2028)).toMatchObject({ held: 21_000_000n, spent: 0n, remaining: 79_000_000n });

    // Record invoice without commitmentId
    const { id: invoiceId } = await invoiceService.record(financeActor(), {
      vendorId: defaultVendorId,
      invoiceNumber: `INV-F24-${randomUUID().slice(0, 8)}`,
      invoiceDate: '2028-06-01',
      amount: { amount: '20000000', currency: 'VND' },
      lines: [
        {
          subscriptionId: subId,
          outOfCatalog: false,
          description: 'Deferred match tool',
          amount: '20000000',
        },
      ],
      taxLines: [
        {
          taxType: 'GTGT',
          rateBp: 1000,
          amount: { amount: '2000000', currency: 'VND' },
          payer: 'VENDOR_COLLECTS',
          deductible: true,
        },
        {
          taxType: 'NT',
          rateBp: 500,
          amount: { amount: '1000000', currency: 'VND' },
          payer: 'BUYER_REMITS',
          deductible: false,
        },
      ],
    });

    // Before match: held is 21m, spent is 21m -> remaining temporarily lower: 100 - 21 - 21 = 58m
    const interimTotals = await commitmentRepo.totals([{ costCenterId, year: 2028 }]);
    const interimEntry = interimTotals.get(heldKey(costCenterId, 2028));
    expect(interimEntry?.held).toBe(21_000_000n);
    expect(interimEntry?.spent).toBe(21_000_000n);
    expect(totalMinor - (interimEntry?.held ?? 0n) - (interimEntry?.spent ?? 0n)).toBe(58_000_000n);

    expect(await balances(2028)).toMatchObject({ spent: 21_000_000n, remaining: 58_000_000n });

    // Now match line position 1 to comm.id
    const matchRes = await matchService.match(financeActor(), invoiceId, 1, comm.id);
    expect(matchRes.expensed).toBe(true);
    expect(matchRes.matched).toEqual({ amount: '21000000', currency: 'VND' });

    // After match: held is 0, spent is 21m -> remaining recovers to 79m!
    const finalTotals = await commitmentRepo.totals([{ costCenterId, year: 2028 }]);
    const finalEntry = finalTotals.get(heldKey(costCenterId, 2028));
    expect(finalEntry?.held).toBe(0n);
    expect(finalEntry?.spent).toBe(21_000_000n);
    expect(totalMinor - (finalEntry?.held ?? 0n) - (finalEntry?.spent ?? 0n)).toBe(79_000_000n);
    expect(await balances(2028)).toMatchObject({ spent: 21_000_000n, remaining: 79_000_000n });
  });

  it('US-12-02 AC-4: K1 20m matches line cost of 20m -> commitment transitions to EXPENSED', async () => {
    const comm = await insertCommitment({ amount_minor: 20_000_000n });
    expect(await balances()).toMatchObject({ held: 20_000_000n, spent: 0n, remaining: 80_000_000n });
    const { id: invoiceId } = await invoiceService.record(financeActor(), {
      vendorId: defaultVendorId,
      invoiceNumber: `INV-AC4-${randomUUID().slice(0, 8)}`,
      invoiceDate: '2026-11-01',
      amount: { amount: '20000000', currency: 'VND' },
      lines: [{ outOfCatalog: true, description: 'Tool 20m', amount: '20000000' }],
      taxLines: [],
    });

    const res = await matchService.match(financeActor(), invoiceId, 1, comm.id);
    expect(res.expensed).toBe(true);
    expect(res.held).toEqual({ amount: '0', currency: 'VND' });
    expect(res.matched).toEqual({ amount: '20000000', currency: 'VND' });

    const row = (
      await h.ctx.sql.query<{ state: string }>('SELECT state FROM budget_commitments WHERE id = $1', [comm.id])
    ).rows[0];
    expect(row.state).toBe('EXPENSED');
    expect(await balances()).toMatchObject({ held: 0n, spent: 20_000_000n, remaining: 80_000_000n });
  });

  it('US-06-06 AC-5: two invoices of 13m and 8m against K1 21m -> after first HELD 8m; after second EXPENSED', async () => {
    const comm = await insertCommitment({ amount_minor: 21_000_000n });

    expect(await balances()).toMatchObject({ held: 21_000_000n, spent: 0n, remaining: 79_000_000n });

    const { id: inv1 } = await invoiceService.record(financeActor(), {
      vendorId: defaultVendorId,
      invoiceNumber: `INV-AC5-1-${randomUUID().slice(0, 8)}`,
      invoiceDate: '2026-11-01',
      amount: { amount: '13000000', currency: 'VND' },
      lines: [{ outOfCatalog: true, description: 'Part 1', amount: '13000000' }],
      taxLines: [],
    });
    // First match: 13m
    const res1 = await matchService.match(financeActor(), inv1, 1, comm.id);
    expect(res1.expensed).toBe(false);
    expect(res1.held).toEqual({ amount: '8000000', currency: 'VND' });

    const commAfter1 = (
      await h.ctx.sql.query<{ state: string; realized_minor: string }>(
        'SELECT state, realized_minor FROM budget_commitments WHERE id = $1',
        [comm.id],
      )
    ).rows[0];
    expect(commAfter1.state).toBe('HELD');
    expect(commAfter1.realized_minor).toBe('13000000');

    expect(await balances()).toMatchObject({ held: 8_000_000n, spent: 13_000_000n, remaining: 79_000_000n });

    const { id: inv2 } = await invoiceService.record(financeActor(), {
      vendorId: defaultVendorId,
      invoiceNumber: `INV-AC5-2-${randomUUID().slice(0, 8)}`,
      invoiceDate: '2026-11-01',
      amount: { amount: '8000000', currency: 'VND' },
      lines: [{ outOfCatalog: true, description: 'Part 2', amount: '8000000' }],
      taxLines: [],
    });

    // Second match: 8m
    const res2 = await matchService.match(financeActor(), inv2, 1, comm.id);
    expect(res2.expensed).toBe(true);
    expect(res2.held).toEqual({ amount: '0', currency: 'VND' });

    const commAfter2 = (
      await h.ctx.sql.query<{ state: string; realized_minor: string }>(
        'SELECT state, realized_minor FROM budget_commitments WHERE id = $1',
        [comm.id],
      )
    ).rows[0];
    expect(commAfter2.state).toBe('EXPENSED');
    expect(commAfter2.realized_minor).toBe('21000000');
    expect(await balances()).toMatchObject({ held: 0n, spent: 21_000_000n, remaining: 79_000_000n });
  });

  it('US-12-02 AC-8: two partial matches 13m and 7m on K1 20m do not deduct twice', async () => {
    const comm = await insertCommitment({ amount_minor: 20_000_000n });
    expect(await balances()).toMatchObject({ held: 20_000_000n, spent: 0n, remaining: 80_000_000n });

    const { id: inv1 } = await invoiceService.record(financeActor(), {
      vendorId: defaultVendorId,
      invoiceNumber: `INV-AC8-1-${randomUUID().slice(0, 8)}`,
      invoiceDate: '2026-11-01',
      amount: { amount: '13000000', currency: 'VND' },
      lines: [{ outOfCatalog: true, description: 'Batch 1', amount: '13000000' }],
      taxLines: [],
    });
    await matchService.match(financeActor(), inv1, 1, comm.id);
    expect(await balances()).toMatchObject({ held: 7_000_000n, spent: 13_000_000n, remaining: 80_000_000n });
    const { id: inv2 } = await invoiceService.record(financeActor(), {
      vendorId: defaultVendorId,
      invoiceNumber: `INV-AC8-2-${randomUUID().slice(0, 8)}`,
      invoiceDate: '2026-11-01',
      amount: { amount: '7000000', currency: 'VND' },
      lines: [{ outOfCatalog: true, description: 'Batch 2', amount: '7000000' }],
      taxLines: [],
    });

    await matchService.match(financeActor(), inv2, 1, comm.id);
    expect(await balances()).toMatchObject({ held: 0n, spent: 20_000_000n, remaining: 80_000_000n });

    const realizations = (
      await h.ctx.sql.query<{ amount_minor: string }>(
        'SELECT amount_minor FROM commitment_realizations WHERE commitment_id = $1 ORDER BY amount_minor',
        [comm.id],
      )
    ).rows;
    expect(realizations).toHaveLength(2);
    expect(realizations[0].amount_minor).toBe('7000000');
    expect(realizations[1].amount_minor).toBe('13000000');
  });

  it('US-12-09 AC-9: K1 21m, actual cost 23m -> realized 21m, spent 23m, EXPENSED (no excess error)', async () => {
    const comm = await insertCommitment({ amount_minor: 21_000_000n });
    expect(await balances()).toMatchObject({ held: 21_000_000n, spent: 0n, remaining: 79_000_000n });

    const { id: invoiceId } = await invoiceService.record(financeActor(), {
      vendorId: defaultVendorId,
      invoiceNumber: `INV-AC9-${randomUUID().slice(0, 8)}`,
      invoiceDate: '2026-11-01',
      amount: { amount: '23000000', currency: 'VND' },
      lines: [{ outOfCatalog: true, description: 'Over-spend tool', amount: '23000000' }],
      taxLines: [],
    });

    const res = await matchService.match(financeActor(), invoiceId, 1, comm.id);
    expect(res.expensed).toBe(true);
    expect(res.matched).toEqual({ amount: '21000000', currency: 'VND' }); // capped to 21m held

    const row = (
      await h.ctx.sql.query<{ state: string; realized_minor: string }>(
        'SELECT state, realized_minor FROM budget_commitments WHERE id = $1',
        [comm.id],
      )
    ).rows[0];
    expect(row.state).toBe('EXPENSED');
    expect(row.realized_minor).toBe('21000000');
    expect(await balances()).toMatchObject({ held: 0n, spent: 23_000_000n, remaining: 77_000_000n });
  });

  it('lower cost: K1 21m, cost 18m -> HELD 3m, Finance releases remainder later', async () => {
    const comm = await insertCommitment({ amount_minor: 21_000_000n });
    expect(await balances()).toMatchObject({ held: 21_000_000n, spent: 0n, remaining: 79_000_000n });

    const { id: invoiceId } = await invoiceService.record(financeActor(), {
      vendorId: defaultVendorId,
      invoiceNumber: `INV-LOWER-${randomUUID().slice(0, 8)}`,
      invoiceDate: '2026-11-01',
      amount: { amount: '18000000', currency: 'VND' },
      lines: [{ outOfCatalog: true, description: 'Lower tool', amount: '18000000' }],
      taxLines: [],
    });

    const res = await matchService.match(financeActor(), invoiceId, 1, comm.id);
    expect(res.expensed).toBe(false);
    expect(res.held).toEqual({ amount: '3000000', currency: 'VND' });
    expect(await balances()).toMatchObject({ held: 3_000_000n, spent: 18_000_000n, remaining: 79_000_000n });

    // Insert a need step and complete request so releaseRemainder succeeds
    await h.ctx.sql.query(
      `INSERT INTO access_request_steps (id, request_id, kind, sequence, state, routing_row, sla_working_days, assignee_employee_id, assigned_at, decided_at)
       VALUES (gen_random_uuid(), $1, 'NEED', 1, 'APPROVED', 1, 5, $2, now(), now())`,
      [comm.requestId, employeeId],
    );
    await h.ctx.sql.query('UPDATE access_requests SET state = $2::"AccessRequestState" WHERE id = $1', [
      comm.requestId,
      'COMPLETED',
    ]);

    const released = await commitmentService.releaseRemainder(financeActor(), comm.id, 'Invoice came lower');
    expect(released.state).toBe('EXPENSED');
    expect(released.held.amount).toBe('0');
    expect(await balances()).toMatchObject({ held: 0n, spent: 18_000_000n, remaining: 82_000_000n });
  });

  it('F-07: matched 21m then editing tax line to non-deductible -> spent increases to 23m, realized stays 21m', async () => {
    const comm = await insertCommitment({ amount_minor: 21_000_000n });
    expect(await balances()).toMatchObject({ held: 21_000_000n, spent: 0n, remaining: 79_000_000n });

    const { id: invoiceId } = await invoiceService.record(financeActor(), {
      vendorId: defaultVendorId,
      invoiceNumber: `INV-F07-${randomUUID().slice(0, 8)}`,
      invoiceDate: '2026-11-01',
      amount: { amount: '21000000', currency: 'VND' },
      lines: [{ outOfCatalog: true, description: 'F07 tool', amount: '21000000' }],
      taxLines: [
        {
          taxType: 'GTGT',
          rateBp: 1000,
          amount: { amount: '2000000', currency: 'VND' },
          payer: 'VENDOR_COLLECTS',
          deductible: true,
        },
      ],
    });

    await matchService.match(financeActor(), invoiceId, 1, comm.id);

    expect(await balances()).toMatchObject({ held: 0n, spent: 21_000_000n, remaining: 79_000_000n });

    // Edit tax line 1: deductible becomes false
    await taxLineService.update(financeActor(), invoiceId, 1, {
      taxType: 'GTGT',
      rateBp: 1000,
      amount: { amount: '2000000', currency: 'VND' },
      payer: 'VENDOR_COLLECTS',
      deductible: false,
    });

    const commDb = (
      await h.ctx.sql.query<{ realized_minor: string }>('SELECT realized_minor FROM budget_commitments WHERE id = $1', [
        comm.id,
      ])
    ).rows[0];
    expect(commDb.realized_minor).toBe('21000000'); // realized unchanged!

    const lineDb = (
      await h.ctx.sql.query<{ cost_reporting_minor: string }>(
        'SELECT cost_reporting_minor FROM invoice_lines WHERE invoice_id = $1',
        [invoiceId],
      )
    ).rows[0];
    expect(lineDb.cost_reporting_minor).toBe('23000000');
    expect(await balances()).toMatchObject({ held: 0n, spent: 23_000_000n, remaining: 77_000_000n });
    const audit = await h.ctx.sql.query<{ before: { deductible: boolean }; after: { deductible: boolean } }>(
      `SELECT before, after FROM audit_events WHERE resource_id = $1 AND action = 'INVOICE.TAX_LINE_CHANGED'`,
      [invoiceId],
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0].before.deductible).toBe(true);
    expect(audit.rows[0].after.deductible).toBe(false);
  });

  it('F-21: out of catalog line with costCenterId null receives commitment Cost Center', async () => {
    const comm = await insertCommitment({ amount_minor: 5_000_000n, cost_center_id: costCenterId });
    const { id: invoiceId } = await invoiceService.record(financeActor(), {
      vendorId: defaultVendorId,
      invoiceNumber: `INV-F21-${randomUUID().slice(0, 8)}`,
      invoiceDate: '2026-11-01',
      amount: { amount: '5000000', currency: 'VND' },
      lines: [{ outOfCatalog: true, description: 'Unassigned tool', amount: '5000000' }],
      taxLines: [],
    });

    // Before match: line has cost_center_id null
    const beforeLine = (
      await h.ctx.sql.query<{ cost_center_id: string | null }>(
        'SELECT cost_center_id FROM invoice_lines WHERE invoice_id = $1',
        [invoiceId],
      )
    ).rows[0];
    expect(beforeLine.cost_center_id).toBeNull();
    expect(await balances()).toMatchObject({ held: 5_000_000n, spent: 0n, remaining: 95_000_000n });

    await matchService.match(financeActor(), invoiceId, 1, comm.id);

    // After match: line receives commitment's Cost Center
    const afterLine = (
      await h.ctx.sql.query<{ cost_center_id: string | null }>(
        'SELECT cost_center_id FROM invoice_lines WHERE invoice_id = $1',
        [invoiceId],
      )
    ).rows[0];
    expect(afterLine.cost_center_id).toBe(costCenterId);
    expect(await balances()).toMatchObject({ held: 0n, spent: 5_000_000n, remaining: 95_000_000n });
  });

  it('rejects duplicate match on same line with LINE_ALREADY_MATCHED', async () => {
    const comm1 = await insertCommitment({ amount_minor: 5_000_000n });
    const comm2 = await insertCommitment({ amount_minor: 5_000_000n });

    const { id: invoiceId } = await invoiceService.record(financeActor(), {
      vendorId: defaultVendorId,
      invoiceNumber: `INV-DUP-${randomUUID().slice(0, 8)}`,
      invoiceDate: '2026-11-01',
      amount: { amount: '5000000', currency: 'VND' },
      lines: [{ outOfCatalog: true, description: 'Tool', amount: '5000000' }],
      taxLines: [],
    });

    await matchService.match(financeActor(), invoiceId, 1, comm1.id);

    const before = await balances();
    const auditBefore = await h.ctx.sql.query('SELECT id FROM audit_events ORDER BY id');
    await expect(matchService.match(financeActor(), invoiceId, 1, comm2.id)).rejects.toThrow(
      new InvoiceMatchRefusedError('LINE_ALREADY_MATCHED'),
    );
    expect(await balances()).toEqual(before);
    expect((await h.ctx.sql.query('SELECT id FROM audit_events ORDER BY id')).rows).toEqual(auditBefore.rows);
  });

  it('rejects commitment of different vendor with VENDOR_MISMATCH', async () => {
    // Setup vendor B and plan for vendor B
    const vendorB = randomUUID();
    await h.ctx.sql.query(
      `INSERT INTO vendors (id, organization_id, name, normalized_name) VALUES ($1, $2, 'Vendor B', 'vendor-b')`,
      [vendorB, h.seed.organizationId],
    );
    const planB = await h.vendorPlan(vendorB, employeeId);

    const reqB = await h.fixtureRequestId();
    await h.ctx.sql.query('UPDATE access_requests SET plan_id = $2 WHERE id = $1', [reqB, planB]);

    const commB = await insertCommitment({ request_id: reqB, amount_minor: 10_000_000n });

    // Invoice has defaultVendorId
    const { id: invoiceId } = await invoiceService.record(financeActor(), {
      vendorId: defaultVendorId,
      invoiceNumber: `INV-VEND-${randomUUID().slice(0, 8)}`,
      invoiceDate: '2026-11-01',
      amount: { amount: '10000000', currency: 'VND' },
      lines: [{ outOfCatalog: true, description: 'Tool', amount: '10000000' }],
      taxLines: [],
    });

    const before = await balances();
    const auditBefore = await h.ctx.sql.query('SELECT id FROM audit_events ORDER BY id');
    await expect(matchService.match(financeActor(), invoiceId, 1, commB.id)).rejects.toThrow(
      new InvoiceMatchRefusedError('VENDOR_MISMATCH'),
    );
    expect(await balances()).toEqual(before);
    expect((await h.ctx.sql.query('SELECT id FROM audit_events ORDER BY id')).rows).toEqual(auditBefore.rows);
  });

  it('rejects commitment of different fiscal year with YEAR_MISMATCH', async () => {
    const budget2027 = await insertApprovedBudget(2027);
    const comm2027 = await insertCommitment({
      year: 2027,
      attached_version_id: budget2027.versionId,
      amount_minor: 10_000_000n,
    });
    const { id: invoiceId } = await invoiceService.record(financeActor(), {
      vendorId: defaultVendorId,
      invoiceNumber: `INV-YR-${randomUUID().slice(0, 8)}`,
      invoiceDate: '2026-11-01', // fiscal year 2026
      amount: { amount: '10000000', currency: 'VND' },
      lines: [{ outOfCatalog: true, description: 'Tool 2026', amount: '10000000' }],
      taxLines: [],
    });

    const before = await balances();
    const auditBefore = await h.ctx.sql.query('SELECT id FROM audit_events ORDER BY id');
    await expect(matchService.match(financeActor(), invoiceId, 1, comm2027.id)).rejects.toThrow(
      new InvoiceMatchRefusedError('YEAR_MISMATCH'),
    );
    expect(await balances()).toEqual(before);
    expect((await h.ctx.sql.query('SELECT id FROM audit_events ORDER BY id')).rows).toEqual(auditBefore.rows);
  });

  it('rejects commitment in state RELEASED with COMMITMENT_NOT_HELD', async () => {
    const comm = await insertCommitment({
      amount_minor: 10_000_000n,
      released_minor: 10_000_000n,
      state: 'RELEASED',
      released_at: new Date().toISOString(),
    });

    const { id: invoiceId } = await invoiceService.record(financeActor(), {
      vendorId: defaultVendorId,
      invoiceNumber: `INV-NOTHELD-${randomUUID().slice(0, 8)}`,
      invoiceDate: '2026-11-01',
      amount: { amount: '10000000', currency: 'VND' },
      lines: [{ outOfCatalog: true, description: 'Tool', amount: '10000000' }],
      taxLines: [],
    });

    const before = await balances();
    const auditBefore = await h.ctx.sql.query('SELECT id FROM audit_events ORDER BY id');
    await expect(matchService.match(financeActor(), invoiceId, 1, comm.id)).rejects.toThrow(
      new InvoiceMatchRefusedError('COMMITMENT_NOT_HELD'),
    );
    expect(await balances()).toEqual(before);
    expect((await h.ctx.sql.query('SELECT id FROM audit_events ORDER BY id')).rows).toEqual(auditBefore.rows);
  });

  it('rejects matching a credit note line with INVOICE_NOT_MATCHABLE', async () => {
    const comm = await insertCommitment({ amount_minor: 10_000_000n });

    const credId = await h.creditNote(defaultVendorId, employeeId, costCenterId);

    const before = await balances();
    const auditBefore = await h.ctx.sql.query('SELECT id FROM audit_events ORDER BY id');
    await expect(matchService.match(financeActor(), credId, 1, comm.id)).rejects.toThrow(
      new InvoiceMatchRefusedError('INVOICE_NOT_MATCHABLE'),
    );
    expect(await balances()).toEqual(before);
    expect((await h.ctx.sql.query('SELECT id FROM audit_events ORDER BY id')).rows).toEqual(auditBefore.rows);
  });

  it('refuses a zero-cost line without changing spend, remaining or audit', async () => {
    const comm = await insertCommitment({ amount_minor: 10_000_000n });
    const { id } = await invoiceService.record(financeActor(), {
      vendorId: defaultVendorId,
      invoiceNumber: `INV-ZERO-${randomUUID()}`,
      invoiceDate: '2026-11-01',
      amount: { amount: '0', currency: 'VND' },
      lines: [{ outOfCatalog: true, description: 'Free line', amount: '0' }],
      taxLines: [],
    });
    const artifacts = await h.matchArtifactCounts();
    expect(await balances()).toMatchObject({ held: 10_000_000n, spent: 0n, remaining: 90_000_000n });
    await expect(matchService.match(financeActor(), id, 1, comm.id)).rejects.toThrow(
      new InvoiceMatchRefusedError('INVOICE_NOT_MATCHABLE'),
    );
    expect(await balances()).toMatchObject({ held: 10_000_000n, spent: 0n, remaining: 90_000_000n });
    expect(await h.matchArtifactCounts()).toEqual(artifacts);
  });

  it.each(['missing commitment', 'wrong year'])('F-24: rolls back recording and all matches on %s', async (failure) => {
    const comm = await insertCommitment();
    const secondId =
      failure === 'missing commitment'
        ? randomUUID()
        : (
            await insertCommitment({
              year: 2027,
              attached_version_id: (await insertApprovedBudget(2027)).versionId,
            })
          ).id;
    const artifacts = await h.matchArtifactCounts();
    expect(await balances()).toMatchObject({ held: 21_000_000n, spent: 0n, remaining: 79_000_000n });
    await expect(
      invoiceService.record(financeActor(), {
        vendorId: defaultVendorId,
        invoiceNumber: `INV-ROLLBACK-${randomUUID()}`,
        invoiceDate: '2026-11-01',
        amount: { amount: '20000000', currency: 'VND' },
        lines: [
          { outOfCatalog: true, description: 'First', amount: '10000000', commitmentId: comm.id },
          { outOfCatalog: true, description: 'Second', amount: '10000000', commitmentId: secondId },
        ],
        taxLines: [
          {
            taxType: 'GTGT',
            rateBp: 1000,
            amount: { amount: '2000000', currency: 'VND' },
            payer: 'VENDOR_COLLECTS',
            deductible: true,
          },
        ],
      }),
    ).rejects.toThrow(
      failure === 'missing commitment'
        ? new BudgetCommitmentNotFoundError()
        : new InvoiceMatchRefusedError('YEAR_MISMATCH'),
    );
    expect(await balances()).toMatchObject({ held: 21_000_000n, spent: 0n, remaining: 79_000_000n });
    expect(await h.matchArtifactCounts()).toEqual(artifacts);
    const row = await h.ctx.sql.query<{ state: string; realized_minor: string }>(
      'SELECT state, realized_minor FROM budget_commitments WHERE id = $1',
      [comm.id],
    );
    expect(row.rows[0]).toEqual({ state: 'HELD', realized_minor: '0' });
  });

  it('US-06-06 AC-4 regression: moving EXPENSED back to HELD via SQL is refused by trigger', async () => {
    const comm = await insertCommitment({
      amount_minor: 10_000_000n,
      realized_minor: 10_000_000n,
      state: 'EXPENSED',
    });

    const before = await balances();
    await expect(
      h.ctx.sql.query('UPDATE budget_commitments SET state = $2::"CommitmentState" WHERE id = $1', [comm.id, 'HELD']),
    ).rejects.toMatchObject({ code: '23001' });
    expect(await balances()).toEqual(before);
  });

  describe('concurrency: realize holds lock, release runs in parallel (F-11)', () => {
    it('serializes realize and release: release waits, released + realized <= amount, and no 500', async () => {
      const comm = await insertCommitment();

      expect(await balances()).toMatchObject({ held: 21_000_000n, spent: 0n, remaining: 79_000_000n });
      const { id: invoiceId } = await invoiceService.record(financeActor(), {
        vendorId: defaultVendorId,
        invoiceNumber: `INV-LOCK-${randomUUID()}`,
        invoiceDate: '2026-11-01',
        amount: { amount: '13000000', currency: 'VND' },
        lines: [{ outOfCatalog: true, description: 'Matched tool', amount: '13000000' }],
        taxLines: [],
      });
      const locked = new Barrier(2);
      const realize = commitmentRepo.realize.bind(commitmentRepo);
      let blockedPid = 0;
      const spy = jest.spyOn(commitmentRepo, 'realize').mockImplementationOnce(async (tx, row, input) => {
        const [{ pid }] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
        const locks = await h.ctx.sql.query<{ held: boolean }>(
          `SELECT EXISTS (SELECT 1 FROM pg_locks WHERE pid = $1 AND locktype = 'advisory' AND granted) AS held`,
          [pid],
        );
        expect(locks.rows[0].held).toBe(true);
        await locked.wait();
        blockedPid = await h.waitForBlockedBy(pid);
        return realize(tx, row, input);
      });
      try {
        const matching = matchService.match(financeActor(), invoiceId, 1, comm.id);
        const releasing = (async () => {
          await locked.wait();
          return runner.run((tx) =>
            commitmentService.release(tx, {
              requestId: comm.requestId,
              reason: 'REQUEST_WITHDRAWN',
              now: new Date(),
            }),
          );
        })();
        const [match, released] = await Promise.all([matching, releasing]);
        expect(blockedPid).toBeGreaterThan(0);
        expect(match.matched).toEqual({ amount: '13000000', currency: 'VND' });
        expect(released).toHaveLength(1);
      } finally {
        spy.mockRestore();
      }
      expect(await balances()).toMatchObject({ held: 0n, spent: 13_000_000n, remaining: 87_000_000n });

      const finalRow = (
        await h.ctx.sql.query<{
          state: string;
          amount_minor: string;
          released_minor: string;
          realized_minor: string;
        }>('SELECT state, amount_minor, released_minor, realized_minor FROM budget_commitments WHERE id = $1', [
          comm.id,
        ])
      ).rows[0];

      const releasedMinor = BigInt(finalRow.released_minor);
      const realizedMinor = BigInt(finalRow.realized_minor);
      const amountMinor = BigInt(finalRow.amount_minor);

      expect(releasedMinor + realizedMinor).toBeLessThanOrEqual(amountMinor);
      expect(finalRow.state).toBe('EXPENSED');
      expect(realizedMinor).toBe(13_000_000n);
      expect(releasedMinor).toBe(8_000_000n);
    });
  });
});
