import { prorateInternalCostForFiscalYear, prorateInternalCostForYears } from './internal-cost-spend.policy';

describe('internal-cost-spend.policy', () => {
  const startMonth = 1; // Calendar fiscal year

  it('allocates 100% of amount when period is completely inside fiscal year', () => {
    const entry = {
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
      amountReportingMinor: 40_000_000n,
    };
    const amount = prorateInternalCostForFiscalYear(entry, 2026, startMonth);
    expect(amount).toBe(40_000_000n);
  });

  it('allocates 0 when period is completely outside fiscal year', () => {
    const entry = {
      periodStart: '2027-01-01',
      periodEnd: '2027-12-31',
      amountReportingMinor: 120_000_000n,
    };
    const amount2026 = prorateInternalCostForFiscalYear(entry, 2026, startMonth);
    expect(amount2026).toBe(0n);
  });

  it('prorates by day count when period spans across two fiscal years with deterministic remainder', () => {
    // 2026-10-01 to 2027-03-31:
    // 2026 days: 31 (Oct) + 30 (Nov) + 31 (Dec) = 92 days
    // 2027 days: 31 (Jan) + 28 (Feb) + 31 (Mar) = 90 days
    // Total days: 182 days
    const entry = {
      periodStart: '2026-10-01',
      periodEnd: '2027-03-31',
      amountReportingMinor: 100_000n,
    };
    const map = prorateInternalCostForYears(entry, [2026, 2027], startMonth);
    // 2026 share: floor(100000 * 92 / 182) = 50549
    // 2027 share: 100000 - 50549 = 49451
    expect(map.get(2026)).toBe(50_549n);
    expect(map.get(2027)).toBe(49_451n);
    expect((map.get(2026) ?? 0n) + (map.get(2027) ?? 0n)).toBe(100_000n);
  });

  it('handles non-calendar fiscal year start month (e.g. April startMonth = 4)', () => {
    const aprilStart = 4;
    // Fiscal year 2026 runs 2026-04-01 to 2027-03-31
    const entry = {
      periodStart: '2026-05-01',
      periodEnd: '2026-08-31',
      amountReportingMinor: 50_000_000n,
    };
    expect(prorateInternalCostForFiscalYear(entry, 2026, aprilStart)).toBe(50_000_000n);
    expect(prorateInternalCostForFiscalYear(entry, 2025, aprilStart)).toBe(0n);
  });
});
