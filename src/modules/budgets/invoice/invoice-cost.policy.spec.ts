import { invoiceCostOf, splitAcrossLines, type InvoiceSplitLine } from './invoice-cost.policy';

describe('invoiceCostOf', () => {
  it('keeps deductible VAT separate from the effective cost (US-12-10 AC-4)', () => {
    expect(
      invoiceCostOf({
        kind: 'INVOICE',
        amountReportingMinor: 20_000_000n,
        taxLines: [
          { amountReportingMinor: 2_000_000n, deductible: true },
          { amountReportingMinor: 1_000_000n, deductible: false },
        ],
        markedFeeReportingMinor: 0n,
      }),
    ).toEqual({ effectiveCostMinor: 21_000_000n, deductibleVatMinor: 2_000_000n });
  });

  it('returns the price and no deductible VAT when there are no tax lines (US-12-10 AC-6)', () => {
    expect(
      invoiceCostOf({
        kind: 'INVOICE',
        amountReportingMinor: 1_000n,
        taxLines: [],
        markedFeeReportingMinor: 0n,
      }),
    ).toEqual({ effectiveCostMinor: 1_000n, deductibleVatMinor: 0n });
  });

  it('adds only marked statement fees to the effective cost (F-19)', () => {
    expect(
      invoiceCostOf({
        kind: 'INVOICE',
        amountReportingMinor: 1_000n,
        taxLines: [
          { amountReportingMinor: 100n, deductible: true },
          { amountReportingMinor: 50n, deductible: true },
          { amountReportingMinor: 30n, deductible: false },
          { amountReportingMinor: 20n, deductible: false },
        ],
        markedFeeReportingMinor: 40n,
      }),
    ).toEqual({ effectiveCostMinor: 1_090n, deductibleVatMinor: 150n });
  });

  it('negates the cost and deductible VAT of a credit note, including marked fees', () => {
    expect(
      invoiceCostOf({
        kind: 'CREDIT_NOTE',
        amountReportingMinor: 1_000n,
        taxLines: [
          { amountReportingMinor: 100n, deductible: true },
          { amountReportingMinor: 50n, deductible: false },
        ],
        markedFeeReportingMinor: 25n,
      }),
    ).toEqual({ effectiveCostMinor: -1_075n, deductibleVatMinor: -100n });
  });

  it('keeps minor units exact above the safe integer range', () => {
    expect(
      invoiceCostOf({
        kind: 'INVOICE',
        amountReportingMinor: 9_007_199_254_740_993n,
        taxLines: [{ amountReportingMinor: 1n, deductible: false }],
        markedFeeReportingMinor: 1n,
      }),
    ).toEqual({ effectiveCostMinor: 9_007_199_254_740_995n, deductibleVatMinor: 0n });
  });
});

describe('splitAcrossLines (F-23)', () => {
  it('breaks equal remainders by position, keeping the input order', () => {
    expect(
      splitAcrossLines(100n, [
        { position: 3, amountMinor: 1n },
        { position: 1, amountMinor: 1n },
        { position: 2, amountMinor: 1n },
      ]),
    ).toEqual([
      { position: 3, amountMinor: 33n },
      { position: 1, amountMinor: 34n },
      { position: 2, amountMinor: 33n },
    ]);
  });

  it('awards the remainder to the larger fraction before considering position', () => {
    expect(
      splitAcrossLines(10n, [
        { position: 1, amountMinor: 2n },
        { position: 2, amountMinor: 1n },
        { position: 3, amountMinor: 3n },
      ]),
    ).toEqual([
      { position: 1, amountMinor: 3n },
      { position: 2, amountMinor: 2n },
      { position: 3, amountMinor: 5n },
    ]);
  });

  it('awards multiple remainder units to different lines', () => {
    expect(
      splitAcrossLines(2n, [
        { position: 1, amountMinor: 1n },
        { position: 2, amountMinor: 1n },
        { position: 3, amountMinor: 1n },
      ]),
    ).toEqual([
      { position: 1, amountMinor: 1n },
      { position: 2, amountMinor: 1n },
      { position: 3, amountMinor: 0n },
    ]);
  });

  it('allocates a discount line using exact signed fractions', () => {
    expect(
      splitAcrossLines(5n, [
        { position: 1, amountMinor: 5n },
        { position: 2, amountMinor: -2n },
      ]),
    ).toEqual([
      { position: 1, amountMinor: 8n },
      { position: 2, amountMinor: -3n },
    ]);
  });

  it('uses position when a discount and a positive line have equal fractions', () => {
    expect(
      splitAcrossLines(1n, [
        { position: 1, amountMinor: 3n },
        { position: 2, amountMinor: -1n },
      ]),
    ).toEqual([
      { position: 1, amountMinor: 2n },
      { position: 2, amountMinor: -1n },
    ]);
  });

  it('allocates a negative total as the negation of the positive allocation', () => {
    expect(
      splitAcrossLines(-100n, [
        { position: 1, amountMinor: 1n },
        { position: 2, amountMinor: 1n },
        { position: 3, amountMinor: 1n },
      ]),
    ).toEqual([
      { position: 1, amountMinor: -34n },
      { position: 2, amountMinor: -33n },
      { position: 3, amountMinor: -33n },
    ]);
  });

  it('allocates proportionally when the sum of weights is negative', () => {
    expect(
      splitAcrossLines(5n, [
        { position: 1, amountMinor: -5n },
        { position: 2, amountMinor: 2n },
      ]),
    ).toEqual([
      { position: 1, amountMinor: 8n },
      { position: 2, amountMinor: -3n },
    ]);
  });

  it('puts the total on the first line when all weights are zero', () => {
    expect(
      splitAcrossLines(11n, [
        { position: 2, amountMinor: 0n },
        { position: 1, amountMinor: 0n },
      ]),
    ).toEqual([
      { position: 2, amountMinor: 11n },
      { position: 1, amountMinor: 0n },
    ]);
  });

  it.each([7n, -7n])('puts a total of %s on the first input line when weights sum to zero', (total) => {
    expect(
      splitAcrossLines(total, [
        { position: 2, amountMinor: 10n },
        { position: 1, amountMinor: -10n },
      ]),
    ).toEqual([
      { position: 2, amountMinor: total },
      { position: 1, amountMinor: 0n },
    ]);
  });

  it('gives the full total to the only line, including a zero-weight line', () => {
    expect(splitAcrossLines(9n, [{ position: 1, amountMinor: 0n }])).toEqual([{ position: 1, amountMinor: 9n }]);
  });

  it('does not allocate any of a zero total to a line', () => {
    expect(
      splitAcrossLines(0n, [
        { position: 1, amountMinor: 5n },
        { position: 2, amountMinor: -2n },
      ]),
    ).toEqual([
      { position: 1, amountMinor: 0n },
      { position: 2, amountMinor: 0n },
    ]);
  });

  it('keeps fractions exact above the safe integer range', () => {
    expect(
      splitAcrossLines(9_007_199_254_740_993n, [
        { position: 1, amountMinor: 1n },
        { position: 2, amountMinor: 1n },
      ]),
    ).toEqual([
      { position: 1, amountMinor: 4_503_599_627_370_497n },
      { position: 2, amountMinor: 4_503_599_627_370_496n },
    ]);
  });

  it('preserves the exact sum and sign symmetry over a deterministic grid of signed weights', () => {
    for (let first = -3n; first <= 3n; first++) {
      for (let second = -3n; second <= 3n; second++) {
        for (let total = 0n; total <= 7n; total++) {
          const lines: readonly [InvoiceSplitLine, ...InvoiceSplitLine[]] = [
            { position: 2, amountMinor: first },
            { position: 1, amountMinor: second },
            { position: 3, amountMinor: 1n },
          ];
          const positive = splitAcrossLines(total, lines);
          const negative = splitAcrossLines(-total, lines);
          expect(positive.reduce((sum, line) => sum + line.amountMinor, 0n)).toBe(total);
          expect(negative).toEqual(positive.map((line) => ({ ...line, amountMinor: -line.amountMinor })));
        }
      }
    }
  });

  it('leaves the input rows and their order unchanged', () => {
    const lines = Object.freeze([
      Object.freeze({ position: 2, amountMinor: 2n }),
      Object.freeze({ position: 1, amountMinor: 1n }),
    ] as const);
    expect(splitAcrossLines(10n, lines)).toEqual([
      { position: 2, amountMinor: 7n },
      { position: 1, amountMinor: 3n },
    ]);
    expect(lines).toEqual([
      { position: 2, amountMinor: 2n },
      { position: 1, amountMinor: 1n },
    ]);
  });
});
