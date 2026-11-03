import { splitInternalCostAcrossPeriods } from './internal-cost-split.policy';

describe('internal-cost-split.policy (AC-11)', () => {
  it('splits annual 120tr equally across 4 quarters in 2027', () => {
    const entry = {
      periodStart: '2027-01-01',
      periodEnd: '2027-12-31',
      amountReportingMinor: 120_000_000n,
    };
    const quarters = [
      { id: '2027-Q1', start: '2027-01-01', end: '2027-03-31' },
      { id: '2027-Q2', start: '2027-04-01', end: '2027-06-30' },
      { id: '2027-Q3', start: '2027-07-01', end: '2027-09-30' },
      { id: '2027-Q4', start: '2027-10-01', end: '2027-12-31' },
    ];

    const result = splitInternalCostAcrossPeriods(entry, quarters);
    // Each quarter gets approximately 30tr, and total equals exactly 120tr
    let sum = 0n;
    for (const q of quarters) {
      const val = result.get(q.id) ?? 0n;
      expect(val).toBeGreaterThan(29_000_000n);
      expect(val).toBeLessThan(31_000_000n);
      sum += val;
    }
    expect(sum).toBe(120_000_000n);
  });

  it('allocates 0 to periods with no overlap', () => {
    const entry = {
      periodStart: '2027-01-01',
      periodEnd: '2027-03-31',
      amountReportingMinor: 30_000_000n,
    };
    const quarters = [
      { id: '2027-Q1', start: '2027-01-01', end: '2027-03-31' },
      { id: '2027-Q2', start: '2027-04-01', end: '2027-06-30' },
    ];
    const result = splitInternalCostAcrossPeriods(entry, quarters);
    expect(result.get('2027-Q1')).toBe(30_000_000n);
    expect(result.get('2027-Q2')).toBe(0n);
  });
});
