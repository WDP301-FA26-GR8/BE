import {
  matchInvoiceLine,
  planInvoiceMatch,
  type InvoiceMatchCommitment,
  type InvoiceMatchInvoice,
  type InvoiceMatchLine,
} from './invoice-match.policy';

const defaultInvoice: InvoiceMatchInvoice = {
  kind: 'INVOICE',
  vendorId: 'vendor-1',
};

const defaultLine: InvoiceMatchLine = {
  costReportingMinor: 20_000_000n,
  fiscalYear: 2026,
  alreadyMatched: false,
};

const defaultCommitment: InvoiceMatchCommitment = {
  state: 'HELD',
  year: 2026,
  amountMinor: 21_000_000n,
  releasedMinor: 0n,
  realizedMinor: 0n,
};

describe('invoice-match.policy (B07-8 Step 1)', () => {
  it('matches full line cost when line cost is less than held amount', () => {
    const result = matchInvoiceLine({
      invoice: defaultInvoice,
      line: { ...defaultLine, costReportingMinor: 18_000_000n },
      commitment: defaultCommitment, // held = 21m
      commitmentVendorId: 'vendor-1',
    });

    expect(result).toEqual({
      ok: true,
      matchedMinor: 18_000_000n,
    });
  });

  it('matches full line cost when line cost equals held amount', () => {
    const result = matchInvoiceLine({
      invoice: defaultInvoice,
      line: { ...defaultLine, costReportingMinor: 21_000_000n },
      commitment: defaultCommitment, // held = 21m
      commitmentVendorId: 'vendor-1',
    });

    expect(result).toEqual({
      ok: true,
      matchedMinor: 21_000_000n,
    });
  });

  it('caps matched amount to held when line cost exceeds held amount (US-12-09 AC-9)', () => {
    const result = matchInvoiceLine({
      invoice: defaultInvoice,
      line: { ...defaultLine, costReportingMinor: 23_000_000n },
      commitment: defaultCommitment, // held = 21m
      commitmentVendorId: 'vendor-1',
    });

    expect(result).toEqual({
      ok: true,
      matchedMinor: 21_000_000n,
    });
  });

  it('accounts for previously released and realized amounts in held amount', () => {
    const result = matchInvoiceLine({
      invoice: defaultInvoice,
      line: { ...defaultLine, costReportingMinor: 10_000_000n },
      commitment: {
        ...defaultCommitment,
        amountMinor: 20_000_000n,
        releasedMinor: 5_000_000n,
        realizedMinor: 7_000_000n, // held = 20 - 5 - 7 = 8m
      },
      commitmentVendorId: 'vendor-1',
    });

    expect(result).toEqual({
      ok: true,
      matchedMinor: 8_000_000n,
    });
  });

  it('allows matching when commitment vendor is unknown (null) (F-22)', () => {
    const result = matchInvoiceLine({
      invoice: defaultInvoice,
      line: defaultLine,
      commitment: defaultCommitment,
      commitmentVendorId: null,
    });

    expect(result).toEqual({
      ok: true,
      matchedMinor: 20_000_000n,
    });
  });

  describe('refusals in precedence order', () => {
    it('refuses CREDIT_NOTE invoice as INVOICE_NOT_MATCHABLE', () => {
      const result = matchInvoiceLine({
        invoice: { ...defaultInvoice, kind: 'CREDIT_NOTE' },
        line: defaultLine,
        commitment: defaultCommitment,
        commitmentVendorId: 'vendor-1',
      });

      expect(result).toEqual({ ok: false, refusal: 'INVOICE_NOT_MATCHABLE' });
    });

    it.each([0n, -1n, -1_000_000n])(
      'refuses costReportingMinor <= 0 (%s) as INVOICE_NOT_MATCHABLE',
      (costReportingMinor) => {
        const result = matchInvoiceLine({
          invoice: defaultInvoice,
          line: { ...defaultLine, costReportingMinor },
          commitment: defaultCommitment,
          commitmentVendorId: 'vendor-1',
        });

        expect(result).toEqual({ ok: false, refusal: 'INVOICE_NOT_MATCHABLE' });
      },
    );

    it('refuses already matched line as LINE_ALREADY_MATCHED', () => {
      const result = matchInvoiceLine({
        invoice: defaultInvoice,
        line: { ...defaultLine, alreadyMatched: true },
        commitment: defaultCommitment,
        commitmentVendorId: 'vendor-1',
      });

      expect(result).toEqual({ ok: false, refusal: 'LINE_ALREADY_MATCHED' });
    });

    it.each(['RELEASED', 'EXPENSED'] as const)('refuses commitment in state %s as COMMITMENT_NOT_HELD', (state) => {
      const result = matchInvoiceLine({
        invoice: defaultInvoice,
        line: defaultLine,
        commitment: { ...defaultCommitment, state },
        commitmentVendorId: 'vendor-1',
      });

      expect(result).toEqual({ ok: false, refusal: 'COMMITMENT_NOT_HELD' });
    });

    it('refuses when line fiscalYear differs from commitment year as YEAR_MISMATCH', () => {
      const result = matchInvoiceLine({
        invoice: defaultInvoice,
        line: { ...defaultLine, fiscalYear: 2027 },
        commitment: { ...defaultCommitment, year: 2026 },
        commitmentVendorId: 'vendor-1',
      });

      expect(result).toEqual({ ok: false, refusal: 'YEAR_MISMATCH' });
    });

    it('refuses when commitment vendor differs from invoice vendor as VENDOR_MISMATCH', () => {
      const result = matchInvoiceLine({
        invoice: { ...defaultInvoice, vendorId: 'vendor-1' },
        line: defaultLine,
        commitment: defaultCommitment,
        commitmentVendorId: 'vendor-2',
      });

      expect(result).toEqual({ ok: false, refusal: 'VENDOR_MISMATCH' });
    });

    it('evaluates INVOICE_NOT_MATCHABLE before LINE_ALREADY_MATCHED', () => {
      const result = matchInvoiceLine({
        invoice: { ...defaultInvoice, kind: 'CREDIT_NOTE' },
        line: { ...defaultLine, alreadyMatched: true },
        commitment: defaultCommitment,
        commitmentVendorId: 'vendor-1',
      });

      expect(result).toEqual({ ok: false, refusal: 'INVOICE_NOT_MATCHABLE' });
    });

    it('evaluates LINE_ALREADY_MATCHED before COMMITMENT_NOT_HELD', () => {
      const result = matchInvoiceLine({
        invoice: defaultInvoice,
        line: { ...defaultLine, alreadyMatched: true },
        commitment: { ...defaultCommitment, state: 'EXPENSED' },
        commitmentVendorId: 'vendor-1',
      });

      expect(result).toEqual({ ok: false, refusal: 'LINE_ALREADY_MATCHED' });
    });

    it('evaluates COMMITMENT_NOT_HELD before YEAR_MISMATCH', () => {
      const result = matchInvoiceLine({
        invoice: defaultInvoice,
        line: { ...defaultLine, fiscalYear: 2027 },
        commitment: { ...defaultCommitment, state: 'RELEASED', year: 2026 },
        commitmentVendorId: 'vendor-1',
      });

      expect(result).toEqual({ ok: false, refusal: 'COMMITMENT_NOT_HELD' });
    });

    it('evaluates YEAR_MISMATCH before VENDOR_MISMATCH', () => {
      const result = matchInvoiceLine({
        invoice: { ...defaultInvoice, vendorId: 'vendor-1' },
        line: { ...defaultLine, fiscalYear: 2027 },
        commitment: { ...defaultCommitment, year: 2026 },
        commitmentVendorId: 'vendor-2',
      });

      expect(result).toEqual({ ok: false, refusal: 'YEAR_MISMATCH' });
    });
  });

  it('planInvoiceMatch is an alias for matchInvoiceLine', () => {
    expect(planInvoiceMatch).toBe(matchInvoiceLine);
  });
});
