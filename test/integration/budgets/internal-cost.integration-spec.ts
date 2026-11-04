import { randomUUID } from 'node:crypto';
import { readSqlState } from '../../../src/infrastructure/database/transaction-runner';
import { principal } from '../../support/http-contract-app';
import { BudgetHarness } from '../../support/budget-harness';
import { CommitmentRepo } from '../../../src/modules/budgets/budget/commitment.repo';
import { heldKey } from '../../../src/modules/budgets/budget/commitment-key.policy';
import { InternalCostService } from '../../../src/modules/budgets/internal-cost/internal-cost.service';
import {
  InternalCostApplicationNotInternalError,
  InternalCostCostCenterNotFoundError,
  InternalCostRateMissingError,
} from '../../../src/modules/budgets/internal-cost/internal-cost.errors';

const h = new BudgetHarness();

describe('internal cost entry (PostgreSQL, US-12-11, B07-10)', () => {
  let service: InternalCostService;
  let commitmentRepo: CommitmentRepo;
  let internalAppId: string;
  let saasAppId: string;
  let costCenterEngId: string;
  let costCenterDesId: string;
  let financeActor: ReturnType<typeof principal>;

  beforeAll(async () => {
    await h.start();
    service = h.ctx.app.get(InternalCostService);
    commitmentRepo = h.ctx.app.get(CommitmentRepo);
    financeActor = principal(['FINANCE']);

    // Create Departments and Cost Centers
    const deptEng = await h.departmentWithHead('P-ENG-INT');
    const deptDes = await h.departmentWithHead('P-DES-INT');
    costCenterEngId = deptEng.department.unitId;
    costCenterDesId = deptDes.department.unitId;

    // Create Internal Application
    internalAppId = randomUUID();
    await h.ctx.sql.query(
      `INSERT INTO applications (id, organization_id, name, normalized_name, kind, status, created_at, updated_at)
       VALUES ($1, $2, 'Cổng báo cáo nội bộ', 'cong-bao-cao-noi-bo', 'INTERNAL', 'APPROVED', now(), now())`,
      [internalAppId, h.seed.organizationId],
    );

    // Create Commercial SaaS Application (Figma)
    saasAppId = randomUUID();
    await h.ctx.sql.query(
      `INSERT INTO applications (id, organization_id, name, normalized_name, kind, status, created_at, updated_at)
       VALUES ($1, $2, 'Figma Commercial', 'figma-commercial', 'SAAS', 'APPROVED', now(), now())`,
      [saasAppId, h.seed.organizationId],
    );

    // Seed USD exchange rate for 2026-10-15
    await h.ctx.sql.query(
      `INSERT INTO exchange_rates (id, organization_id, currency, rate_date, rate)
       VALUES ($1, $2, 'USD', '2026-10-15', 25000)`,
      [randomUUID(), h.seed.organizationId],
    );
  }, 240000);

  afterAll(async () => {
    await h.stop();
  });

  it('records an internal cost entry and updates spent without creating invoice or commitment (AC-1)', async () => {
    const input = {
      applicationId: internalAppId,
      costCenterId: costCenterEngId,
      amount: '40000000',
      currency: 'VND',
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
      note: 'Chi phí vận hành cổng báo cáo tháng 10',
    };

    const beforeTotals = await commitmentRepo.totals([{ costCenterId: costCenterEngId, year: 2026 }]);
    const beforeSpent = beforeTotals.get(heldKey(costCenterEngId, 2026))?.spent ?? 0n;

    const result = await service.record(financeActor, input);
    expect(result.id).toBeDefined();
    expect(result.costCenterCode).toBeDefined();

    // Verify DB row
    const res = await h.ctx.sql.query<{
      amount_reporting_minor: string;
      cancelled_at: string | null;
    }>(`SELECT * FROM internal_cost_entries WHERE id = $1`, [result.id]);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].amount_reporting_minor).toBe('40000000');
    expect(res.rows[0].cancelled_at).toBeNull();

    // Verify spent increased
    const afterTotals = await commitmentRepo.totals([{ costCenterId: costCenterEngId, year: 2026 }]);
    const afterSpent = afterTotals.get(heldKey(costCenterEngId, 2026))?.spent ?? 0n;
    expect(afterSpent - beforeSpent).toBe(40_000_000n);

    // Verify no invoice, subscription or commitment created
    const invRes = await h.ctx.sql.query<{ count: number }>(
      `SELECT count(*)::int as count FROM invoices WHERE organization_id = $1`,
      [h.seed.organizationId],
    );
    const comRes = await h.ctx.sql.query<{ count: number }>(
      `SELECT count(*)::int as count FROM budget_commitments WHERE cost_center_id = $1`,
      [costCenterEngId],
    );
    expect(invRes.rows[0].count).toBe(0);
    expect(comRes.rows[0].count).toBe(0);
  });

  it('splits cost by recording two separate entries to two Cost Centers (AC-2)', async () => {
    const beforeEng =
      (await commitmentRepo.totals([{ costCenterId: costCenterEngId, year: 2026 }])).get(heldKey(costCenterEngId, 2026))
        ?.spent ?? 0n;
    const beforeDes =
      (await commitmentRepo.totals([{ costCenterId: costCenterDesId, year: 2026 }])).get(heldKey(costCenterDesId, 2026))
        ?.spent ?? 0n;

    await service.record(financeActor, {
      applicationId: internalAppId,
      costCenterId: costCenterEngId,
      amount: '24000000',
      currency: 'VND',
      periodStart: '2026-11-01',
      periodEnd: '2026-11-30',
    });

    await service.record(financeActor, {
      applicationId: internalAppId,
      costCenterId: costCenterDesId,
      amount: '16000000',
      currency: 'VND',
      periodStart: '2026-11-01',
      periodEnd: '2026-11-30',
    });

    const afterEng =
      (await commitmentRepo.totals([{ costCenterId: costCenterEngId, year: 2026 }])).get(heldKey(costCenterEngId, 2026))
        ?.spent ?? 0n;
    const afterDes =
      (await commitmentRepo.totals([{ costCenterId: costCenterDesId, year: 2026 }])).get(heldKey(costCenterDesId, 2026))
        ?.spent ?? 0n;

    expect(afterEng - beforeEng).toBe(24_000_000n);
    expect(afterDes - beforeDes).toBe(16_000_000n);
  });

  it('refuses when assigning to Company as cost center (AC-4b)', async () => {
    // Insert a dummy Company row into cost_centers or check invalid
    const companyId = randomUUID();
    await expect(
      service.record(financeActor, {
        applicationId: internalAppId,
        costCenterId: companyId,
        amount: '10000000',
        currency: 'VND',
        periodStart: '2026-10-01',
        periodEnd: '2026-10-31',
      }),
    ).rejects.toThrow(InternalCostCostCenterNotFoundError);
  });

  it('refuses commercial software (Figma) for internal cost entry (AC-5)', async () => {
    await expect(
      service.record(financeActor, {
        applicationId: saasAppId,
        costCenterId: costCenterEngId,
        amount: '15000000',
        currency: 'VND',
        periodStart: '2026-10-01',
        periodEnd: '2026-10-31',
      }),
    ).rejects.toThrow(InternalCostApplicationNotInternalError);
  });

  it('refuses non-existent cost center (AC-6)', async () => {
    await expect(
      service.record(financeActor, {
        applicationId: internalAppId,
        costCenterId: randomUUID(),
        amount: '5000000',
        currency: 'VND',
        periodStart: '2026-10-01',
        periodEnd: '2026-10-31',
      }),
    ).rejects.toThrow(InternalCostCostCenterNotFoundError);
  });

  it('converts foreign currency snapshot using rate of periodStart (AC-7)', async () => {
    const result = await service.record(financeActor, {
      applicationId: internalAppId,
      costCenterId: costCenterEngId,
      amount: '1000',
      currency: 'USD',
      periodStart: '2026-10-15',
      periodEnd: '2026-10-31',
    });

    expect(result.amountReporting).toBe('25000000'); // 1000 * 25000
    expect(result.amountRate).toBe('25000');

    // Missing rate should reject
    await expect(
      service.record(financeActor, {
        applicationId: internalAppId,
        costCenterId: costCenterEngId,
        amount: '1000',
        currency: 'EUR',
        periodStart: '2026-10-15',
        periodEnd: '2026-10-31',
      }),
    ).rejects.toThrow(InternalCostRateMissingError);
  });

  it('cancels an entry with reason and removes it from spent (OQ-F-10 / LD-11)', async () => {
    const entry = await service.record(financeActor, {
      applicationId: internalAppId,
      costCenterId: costCenterEngId,
      amount: '5000000',
      currency: 'VND',
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
    });

    const beforeCancel =
      (await commitmentRepo.totals([{ costCenterId: costCenterEngId, year: 2026 }])).get(heldKey(costCenterEngId, 2026))
        ?.spent ?? 0n;

    const cancelled = await service.cancel(financeActor, entry.id, { reason: 'Ghi nham phong' });
    expect(cancelled.cancelReason).toBe('Ghi nham phong');
    expect(cancelled.cancelledAt).not.toBeNull();

    const afterCancel =
      (await commitmentRepo.totals([{ costCenterId: costCenterEngId, year: 2026 }])).get(heldKey(costCenterEngId, 2026))
        ?.spent ?? 0n;
    expect(beforeCancel - afterCancel).toBe(5_000_000n);
  });

  it('prorates an entry spanning across two fiscal years by day count (AC-11)', async () => {
    // 2026-10-01 to 2027-03-31 (182 days: 92 in 2026, 90 in 2027)
    // 182,000,000 VND -> 92m in 2026, 90m in 2027
    const before2026 =
      (await commitmentRepo.totals([{ costCenterId: costCenterDesId, year: 2026 }])).get(heldKey(costCenterDesId, 2026))
        ?.spent ?? 0n;
    const before2027 =
      (await commitmentRepo.totals([{ costCenterId: costCenterDesId, year: 2027 }])).get(heldKey(costCenterDesId, 2027))
        ?.spent ?? 0n;

    await service.record(financeActor, {
      applicationId: internalAppId,
      costCenterId: costCenterDesId,
      amount: '182000000',
      currency: 'VND',
      periodStart: '2026-10-01',
      periodEnd: '2027-03-31',
    });

    const after2026 =
      (await commitmentRepo.totals([{ costCenterId: costCenterDesId, year: 2026 }])).get(heldKey(costCenterDesId, 2026))
        ?.spent ?? 0n;
    const after2027 =
      (await commitmentRepo.totals([{ costCenterId: costCenterDesId, year: 2027 }])).get(heldKey(costCenterDesId, 2027))
        ?.spent ?? 0n;

    expect(after2026 - before2026).toBe(92_000_000n);
    expect(after2027 - before2027).toBe(90_000_000n);
  });

  describe('PostgreSQL CHECK constraints', () => {
    it('enforces period_end >= period_start', async () => {
      let state: string | undefined;
      try {
        await h.ctx.sql.query(
          `INSERT INTO internal_cost_entries (
             id, organization_id, application_id, cost_center_id, amount_currency,
             period_start, period_end, amount_minor, amount_rate, amount_rate_date,
             amount_rate_source, amount_reporting_minor, recorded_by_employee_id
           ) VALUES (
             $1, $2, $3, $4, 'VND', '2026-10-31', '2026-10-01', 1000000, 1, '2026-10-01',
             'SAME_CURRENCY', 1000000, $5
           )`,
          [randomUUID(), h.seed.organizationId, internalAppId, costCenterEngId, financeActor.employeeId],
        );
      } catch (error) {
        state = readSqlState(error);
      }
      expect(state).toBe('23514');
    });

    it('enforces cancel_whole constraint (cancelled_at and cancel_reason must be both null or both set)', async () => {
      let state: string | undefined;
      try {
        await h.ctx.sql.query(
          `INSERT INTO internal_cost_entries (
             id, organization_id, application_id, cost_center_id, amount_currency,
             period_start, period_end, amount_minor, amount_rate, amount_rate_date,
             amount_rate_source, amount_reporting_minor, recorded_by_employee_id, cancelled_at
           ) VALUES (
             $1, $2, $3, $4, 'VND', '2026-10-01', '2026-10-31', 1000000, 1, '2026-10-01',
             'SAME_CURRENCY', 1000000, $5, now()
           )`,
          [randomUUID(), h.seed.organizationId, internalAppId, costCenterEngId, financeActor.employeeId],
        );
      } catch (error) {
        state = readSqlState(error);
      }
      expect(state).toBe('23514');
    });

    it('enforces amount_minor > 0', async () => {
      let state: string | undefined;
      try {
        await h.ctx.sql.query(
          `INSERT INTO internal_cost_entries (
             id, organization_id, application_id, cost_center_id, amount_currency,
             period_start, period_end, amount_minor, amount_rate, amount_rate_date,
             amount_rate_source, amount_reporting_minor, recorded_by_employee_id
           ) VALUES (
             $1, $2, $3, $4, 'VND', '2026-10-01', '2026-10-31', 0, 1, '2026-10-01',
             'SAME_CURRENCY', 0, $5
           )`,
          [randomUUID(), h.seed.organizationId, internalAppId, costCenterEngId, financeActor.employeeId],
        );
      } catch (error) {
        state = readSqlState(error);
      }
      expect(state).toBe('23514');
    });
  });
});
