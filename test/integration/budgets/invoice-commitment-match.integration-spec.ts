import { randomUUID } from 'node:crypto';
import { TransactionRunner } from '../../../src/infrastructure/database/transaction-runner';
import { CommitmentRepo, heldKey } from '../../../src/modules/budgets/budget/commitment.repo';
import { CommitmentService } from '../../../src/modules/budgets/commitment/commitment.service';
import { InvoiceService } from '../../../src/modules/budgets/invoice/invoice.service';
import { InvoiceTaxLineService } from '../../../src/modules/budgets/invoice/invoice-tax-line.service';
import { InvoiceMatchService } from '../../../src/modules/budgets/invoice/invoice-match.service';
import { InvoiceMatchRefusedError } from '../../../src/modules/budgets/invoice/invoice.errors';
import { BudgetHarness } from '../../support/budget-harness';
import { Barrier } from '../../support/concurrency-harness';

const h = new BudgetHarness();

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

  const insertApprovedBudget = async (year = 2026, totalMinor = 100_000_000, ccId = costCenterId) => {
    const proposalId = randomUUID();
    await h.ctx.sql.query(
      `INSERT INTO budget_proposals (id, organization_id, cost_center_id, year, state, total_minor, currency, submitted_by_employee_id)
       VALUES ($1, $2, $3, $4, 'REVIEWED', $5, 'VND', $6)`,
      [proposalId, h.seed.organizationId, ccId, year, totalMinor, employeeId],
    );
    const versionId = randomUUID();
    await h.ctx.sql.query(
      `INSERT INTO budget_versions (id, organization_id, cost_center_id, year, number, kind, state, proposal_id, base_minor, reserve_minor, total_minor, currency, high_value_percent, created_by_employee_id, sent_at, sent_by_employee_id)
       VALUES ($1, $2, $3, $4, 1, 'INITIAL', 'APPROVED', $5, $6, 0, $6, 'VND', 10, $7, now(), $7)`,
      [versionId, h.seed.organizationId, ccId, year, proposalId, totalMinor, employeeId],
    );
    return { versionId, totalMinor: BigInt(totalMinor) };
  };

  beforeAll(async () => {
    await h.start();
    runner = h.ctx.app.get(TransactionRunner);
    commitmentRepo = h.ctx.app.get(CommitmentRepo);
    commitmentService = h.ctx.app.get(CommitmentService);
    invoiceService = h.ctx.app.get(InvoiceService);
    matchService = h.ctx.app.get(InvoiceMatchService);
    taxLineService = h.ctx.app.get(InvoiceTaxLineService);

    const unit = await h.departmentWithHead('P-MATCH');
    employeeId = unit.head.employeeId;
    costCenterId = unit.department.unitId;
    departmentId = unit.department.id;

    defaultVendorId = randomUUID();
    await h.ctx.sql.query(
      `INSERT INTO vendors (id, organization_id, name, normalized_name)
       VALUES ($1, $2, 'Default Match Vendor', 'default-match-vendor')`,
      [defaultVendorId, h.seed.organizationId],
    );

    const budget = await insertApprovedBudget(2026, 100_000_000);
    approvedVersionId = budget.versionId;
    approvedBudgetTotalMinor = budget.totalMinor;
  }, 240000);

  afterAll(async () => {
    await h.stop();
  });

  const insertCommitment = async (over: Record<string, unknown> = {}) => {
    const id = (over.id as string) ?? randomUUID();
    const hasAttachment = Boolean(over.attached_version_id);
    const row = {
      id,
      organization_id: h.seed.organizationId,
      request_id: (over.request_id as string) ?? (await h.fixtureRequestId()),
      cost_center_id: (over.cost_center_id as string) ?? costCenterId,
      year: (over.year as number) ?? 2026,
      amount_minor: 21_000_000n,
      currency: 'VND',
      state: 'HELD',
      attached_version_id: null,
      attached_at: hasAttachment ? new Date().toISOString() : null,
      unattached_reason: hasAttachment ? null : 'NO_BUDGET',
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
    return { id, requestId: row.request_id, amountMinor: BigInt(row.amount_minor) };
  };

  it('US-06-06 AC-1: K1 21; price 20, deductible VAT 2, buyer-remits 1; recorded with commitmentId -> EXPENSED; held -21, spent +21, remaining unchanged', async () => {
    const totalMinor = approvedBudgetTotalMinor;
    const comm = await insertCommitment({
      attached_version_id: approvedVersionId,
      amount_minor: 21_000_000n,
    });

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

    const planId = randomUUID();
    const appId = randomUUID();
    await h.ctx.sql.query(
      `INSERT INTO applications (
         id, organization_id, vendor_id, name, normalized_name,
         kind, business_owner_employee_id, data_sensitivity,
         comm_person_to_person_messaging, comm_calls_or_meetings, comm_mailbox, is_communication_service
       ) VALUES ($1, $2, $3, 'App F24', 'app-f24', 'SAAS', $4, 'LOW', false, false, false, false)`,
      [appId, h.seed.organizationId, defaultVendorId, employeeId],
    );
    await h.ctx.sql.query(
      `INSERT INTO plans (id, organization_id, application_id, name, normalized_name, provisioning_type, pricing_model, control_level)
       VALUES ($1, $2, $3, 'Plan F24', 'plan-f24', 'K2', 'PER_SEAT', 'FULL')`,
      [planId, h.seed.organizationId, appId],
    );
    const subId = randomUUID();
    await h.ctx.sql.query(
      `INSERT INTO subscriptions (id, organization_id, plan_id, kind, status, owner_department_id)
       VALUES ($1, $2, $3, 'TERM', 'DRAFT', $4)`,
      [subId, h.seed.organizationId, planId, departmentId],
    );

    // Record invoice without commitmentId
    const { id: invoiceId } = await invoiceService.record(financeActor(), {
      vendorId: defaultVendorId,
      invoiceNumber: `INV-F24-${randomUUID().slice(0, 8)}`,
      invoiceDate: '2028-06-01',
      amount: { amount: '20000000', currency: 'VND' },
      lines: [
        {
          subscriptionId: subId,
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

    // Now match line position 1 to comm.id
    const matchRes = await matchService.match(financeActor(), invoiceId, 1, comm.id);
    expect(matchRes.expensed).toBe(true);
    expect(matchRes.matchedMinor).toBe(21_000_000n);

    // After match: held is 0, spent is 21m -> remaining recovers to 79m!
    const finalTotals = await commitmentRepo.totals([{ costCenterId, year: 2028 }]);
    const finalEntry = finalTotals.get(heldKey(costCenterId, 2028));
    expect(finalEntry?.held).toBe(0n);
    expect(finalEntry?.spent).toBe(21_000_000n);
    expect(totalMinor - (finalEntry?.held ?? 0n) - (finalEntry?.spent ?? 0n)).toBe(79_000_000n);
  });

  it('US-12-02 AC-4: K1 20m matches line cost of 20m -> commitment transitions to EXPENSED', async () => {
    const comm = await insertCommitment({ amount_minor: 20_000_000n });
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
    expect(res.heldMinor).toBe(0n);
    expect(res.matchedMinor).toBe(20_000_000n);

    const row = (
      await h.ctx.sql.query<{ state: string }>('SELECT state FROM budget_commitments WHERE id = $1', [comm.id])
    ).rows[0];
    expect(row.state).toBe('EXPENSED');
  });

  it('US-06-06 AC-5: two invoices of 13m and 8m against K1 21m -> after first HELD 8m; after second EXPENSED', async () => {
    const comm = await insertCommitment({ amount_minor: 21_000_000n });

    const { id: inv1 } = await invoiceService.record(financeActor(), {
      vendorId: defaultVendorId,
      invoiceNumber: `INV-AC5-1-${randomUUID().slice(0, 8)}`,
      invoiceDate: '2026-11-01',
      amount: { amount: '13000000', currency: 'VND' },
      lines: [{ outOfCatalog: true, description: 'Part 1', amount: '13000000' }],
      taxLines: [],
    });
    const { id: inv2 } = await invoiceService.record(financeActor(), {
      vendorId: defaultVendorId,
      invoiceNumber: `INV-AC5-2-${randomUUID().slice(0, 8)}`,
      invoiceDate: '2026-11-01',
      amount: { amount: '8000000', currency: 'VND' },
      lines: [{ outOfCatalog: true, description: 'Part 2', amount: '8000000' }],
      taxLines: [],
    });

    // First match: 13m
    const res1 = await matchService.match(financeActor(), inv1, 1, comm.id);
    expect(res1.expensed).toBe(false);
    expect(res1.heldMinor).toBe(8_000_000n);

    const commAfter1 = (
      await h.ctx.sql.query<{ state: string; realized_minor: string }>(
        'SELECT state, realized_minor FROM budget_commitments WHERE id = $1',
        [comm.id],
      )
    ).rows[0];
    expect(commAfter1.state).toBe('HELD');
    expect(commAfter1.realized_minor).toBe('13000000');

    // Second match: 8m
    const res2 = await matchService.match(financeActor(), inv2, 1, comm.id);
    expect(res2.expensed).toBe(true);
    expect(res2.heldMinor).toBe(0n);

    const commAfter2 = (
      await h.ctx.sql.query<{ state: string; realized_minor: string }>(
        'SELECT state, realized_minor FROM budget_commitments WHERE id = $1',
        [comm.id],
      )
    ).rows[0];
    expect(commAfter2.state).toBe('EXPENSED');
    expect(commAfter2.realized_minor).toBe('21000000');
  });

  it('US-12-02 AC-8: two partial matches 13m and 7m on K1 20m do not deduct twice', async () => {
    const comm = await insertCommitment({ amount_minor: 20_000_000n });

    const { id: inv1 } = await invoiceService.record(financeActor(), {
      vendorId: defaultVendorId,
      invoiceNumber: `INV-AC8-1-${randomUUID().slice(0, 8)}`,
      invoiceDate: '2026-11-01',
      amount: { amount: '13000000', currency: 'VND' },
      lines: [{ outOfCatalog: true, description: 'Batch 1', amount: '13000000' }],
      taxLines: [],
    });
    const { id: inv2 } = await invoiceService.record(financeActor(), {
      vendorId: defaultVendorId,
      invoiceNumber: `INV-AC8-2-${randomUUID().slice(0, 8)}`,
      invoiceDate: '2026-11-01',
      amount: { amount: '7000000', currency: 'VND' },
      lines: [{ outOfCatalog: true, description: 'Batch 2', amount: '7000000' }],
      taxLines: [],
    });

    await matchService.match(financeActor(), inv1, 1, comm.id);
    await matchService.match(financeActor(), inv2, 1, comm.id);

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
    expect(res.matchedMinor).toBe(21_000_000n); // capped to 21m held

    const row = (
      await h.ctx.sql.query<{ state: string; realized_minor: string }>(
        'SELECT state, realized_minor FROM budget_commitments WHERE id = $1',
        [comm.id],
      )
    ).rows[0];
    expect(row.state).toBe('EXPENSED');
    expect(row.realized_minor).toBe('21000000');
  });

  it('lower cost: K1 21m, cost 18m -> HELD 3m, Finance releases remainder later', async () => {
    const comm = await insertCommitment({ amount_minor: 21_000_000n });
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
    expect(res.heldMinor).toBe(3_000_000n);

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
  });

  it('F-07: matched 21m then editing tax line to non-deductible -> spent increases to 23m, realized stays 21m', async () => {
    const comm = await insertCommitment({ amount_minor: 21_000_000n });
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
    expect(lineDb.cost_reporting_minor).toBe('23000000'); // effective cost updated to 23m!
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

    await matchService.match(financeActor(), invoiceId, 1, comm.id);

    // After match: line receives commitment's Cost Center
    const afterLine = (
      await h.ctx.sql.query<{ cost_center_id: string | null }>(
        'SELECT cost_center_id FROM invoice_lines WHERE invoice_id = $1',
        [invoiceId],
      )
    ).rows[0];
    expect(afterLine.cost_center_id).toBe(costCenterId);
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

    await expect(matchService.match(financeActor(), invoiceId, 1, comm2.id)).rejects.toThrow(
      new InvoiceMatchRefusedError('LINE_ALREADY_MATCHED'),
    );
  });

  it('rejects commitment of different vendor with VENDOR_MISMATCH', async () => {
    // Setup vendor B and plan for vendor B
    const vendorB = randomUUID();
    await h.ctx.sql.query(
      `INSERT INTO vendors (id, organization_id, name, normalized_name) VALUES ($1, $2, 'Vendor B', 'vendor-b')`,
      [vendorB, h.seed.organizationId],
    );
    const appId = randomUUID();
    await h.ctx.sql.query(
      `INSERT INTO applications (
         id, organization_id, vendor_id, name, normalized_name,
         kind, business_owner_employee_id, data_sensitivity,
         comm_person_to_person_messaging, comm_calls_or_meetings, comm_mailbox, is_communication_service
       ) VALUES ($1, $2, $3, 'App B', 'app-b', 'SAAS', $4, 'LOW', false, false, false, false)`,
      [appId, h.seed.organizationId, vendorB, employeeId],
    );
    const planB = randomUUID();
    await h.ctx.sql.query(
      `INSERT INTO plans (id, organization_id, application_id, name, normalized_name, provisioning_type, pricing_model, control_level)
       VALUES ($1, $2, $3, 'Plan B', 'plan-b', 'K2', 'PER_SEAT', 'FULL')`,
      [planB, h.seed.organizationId, appId],
    );

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

    await expect(matchService.match(financeActor(), invoiceId, 1, commB.id)).rejects.toThrow(
      new InvoiceMatchRefusedError('VENDOR_MISMATCH'),
    );
  });

  it('rejects commitment of different fiscal year with YEAR_MISMATCH', async () => {
    const comm2027 = await insertCommitment({ year: 2027, amount_minor: 10_000_000n });
    const { id: invoiceId } = await invoiceService.record(financeActor(), {
      vendorId: defaultVendorId,
      invoiceNumber: `INV-YR-${randomUUID().slice(0, 8)}`,
      invoiceDate: '2026-11-01', // fiscal year 2026
      amount: { amount: '10000000', currency: 'VND' },
      lines: [{ outOfCatalog: true, description: 'Tool 2026', amount: '10000000' }],
      taxLines: [],
    });

    await expect(matchService.match(financeActor(), invoiceId, 1, comm2027.id)).rejects.toThrow(
      new InvoiceMatchRefusedError('YEAR_MISMATCH'),
    );
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

    await expect(matchService.match(financeActor(), invoiceId, 1, comm.id)).rejects.toThrow(
      new InvoiceMatchRefusedError('COMMITMENT_NOT_HELD'),
    );
  });

  it('rejects matching a credit note line with INVOICE_NOT_MATCHABLE', async () => {
    const comm = await insertCommitment({ amount_minor: 10_000_000n });

    const credId = randomUUID();
    await h.ctx.sql.query(
      `INSERT INTO invoices (
         id, organization_id, vendor_id, invoice_number, kind, invoice_date,
         amount_minor, amount_currency, amount_rate, amount_rate_date,
         amount_rate_source, amount_reporting_minor, reconciliation_status,
         recorded_by_employee_id
       ) VALUES ($1, $2, $3, $4, 'CREDIT_NOTE', '2026-11-01',
                 10000000, 'VND', 1, '2026-11-01', 'MANUAL', 10000000, 'NONE', $5)`,
      [credId, h.seed.organizationId, defaultVendorId, `CN-${randomUUID().slice(0, 8)}`, employeeId],
    );

    const lineId = randomUUID();
    await h.ctx.sql.query(
      `INSERT INTO invoice_lines (
         id, invoice_id, position, description, out_of_catalog,
         amount_minor, amount_reporting_minor, cost_center_id, fiscal_year,
         cost_reporting_minor, deductible_vat_reporting_minor
       ) VALUES ($1, $2, 1, 'Credit item', true,
                 -10000000, -10000000, $3, 2026, -10000000, 0)`,
      [lineId, credId, costCenterId],
    );

    await expect(matchService.match(financeActor(), credId, 1, comm.id)).rejects.toThrow(
      new InvoiceMatchRefusedError('INVOICE_NOT_MATCHABLE'),
    );
  });

  it('US-06-06 AC-4 regression: moving EXPENSED back to HELD via SQL is refused by trigger', async () => {
    const comm = await insertCommitment({
      amount_minor: 10_000_000n,
      realized_minor: 10_000_000n,
      state: 'EXPENSED',
    });

    await expect(
      h.ctx.sql.query('UPDATE budget_commitments SET state = $2::"CommitmentState" WHERE id = $1', [comm.id, 'HELD']),
    ).rejects.toThrow();
  });

  describe('concurrency: realize holds lock, release runs in parallel (F-11)', () => {
    it('serializes realize and release: release waits, released + realized <= amount, and no 500', async () => {
      const comm = await insertCommitment();

      const invoiceId = randomUUID();
      await h.ctx.sql.query(
        `INSERT INTO invoices (
           id, organization_id, vendor_id, invoice_number, kind, invoice_date,
           amount_minor, amount_currency, amount_rate, amount_rate_date,
           amount_rate_source, amount_reporting_minor, reconciliation_status,
           recorded_by_employee_id
         ) VALUES ($1, $2, $3, 'INV-LOCK-1', 'INVOICE', '2026-11-01',
                   13000000, 'VND', 1, '2026-11-01', 'MANUAL', 13000000, 'NONE', $4)`,
        [invoiceId, h.seed.organizationId, defaultVendorId, employeeId],
      );

      const lineId = randomUUID();
      await h.ctx.sql.query(
        `INSERT INTO invoice_lines (
           id, invoice_id, position, description, out_of_catalog,
           amount_minor, amount_reporting_minor, cost_center_id, fiscal_year,
           cost_reporting_minor, deductible_vat_reporting_minor
         ) VALUES ($1, $2, 1, 'Matched tool', true,
                   13000000, 13000000, $3, 2026, 13000000, 0)`,
        [lineId, invoiceId, costCenterId],
      );

      const barrier = new Barrier(2);

      // Thread 1: realize (takes 13m)
      const threadRealize = runner.run(async (tx) => {
        const row = await commitmentRepo.lockById(tx, comm.id);
        if (!row) throw new Error('Commitment not found');

        // Signal barrier that realize holds the row lock
        await barrier.wait();

        return commitmentRepo.realize(tx, row, {
          takeMinor: 13_000_000n,
          invoiceLineId: lineId,
          employeeId,
          now: new Date(),
        });
      });

      // Thread 2: release (runs in parallel, waits on barrier then calls release)
      const threadRelease = (async () => {
        await barrier.wait();
        return runner.run((tx) =>
          commitmentService.release(tx, {
            requestId: comm.requestId,
            reason: 'REQUEST_WITHDRAWN',
            now: new Date(),
          }),
        );
      })();

      const [realizeResult, releaseResult] = await Promise.all([threadRealize, threadRelease]);

      expect(realizeResult).toBeDefined();
      expect(releaseResult).toBeDefined();

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
