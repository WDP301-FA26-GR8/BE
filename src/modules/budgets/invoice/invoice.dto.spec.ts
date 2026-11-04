import { recordInvoiceSchema } from './invoice.dto';

describe('recordInvoiceSchema kind and creditedInvoiceId validation', () => {
  const basePayload = {
    vendorId: '123e4567-e89b-42d3-a456-426614174000',
    invoiceNumber: 'INV-2026-001',
    invoiceDate: '2026-11-04',
    amount: { amount: '1000', currency: 'VND' },
    lines: [
      {
        outOfCatalog: true,
        description: 'Cloud subscription credit',
        amount: '1000',
      },
    ],
    taxLines: [],
  };

  it('defaults kind to INVOICE when omitted and accepts valid invoice payload', () => {
    const parsed = recordInvoiceSchema.parse(basePayload);
    expect(parsed.kind).toBe('INVOICE');
    expect(parsed.creditedInvoiceId).toBeUndefined();
  });

  it('accepts explicit INVOICE without creditedInvoiceId', () => {
    const parsed = recordInvoiceSchema.parse({ ...basePayload, kind: 'INVOICE' });
    expect(parsed.kind).toBe('INVOICE');
    expect(parsed.creditedInvoiceId).toBeUndefined();
  });

  it('rejects INVOICE when creditedInvoiceId is provided', () => {
    expect(() =>
      recordInvoiceSchema.parse({
        ...basePayload,
        kind: 'INVOICE',
        creditedInvoiceId: '123e4567-e89b-42d3-a456-426614174001',
      }),
    ).toThrow();
  });

  it('accepts CREDIT_NOTE when creditedInvoiceId is provided', () => {
    const parsed = recordInvoiceSchema.parse({
      ...basePayload,
      kind: 'CREDIT_NOTE',
      creditedInvoiceId: '123e4567-e89b-42d3-a456-426614174001',
    });
    expect(parsed.kind).toBe('CREDIT_NOTE');
    expect(parsed.creditedInvoiceId).toBe('123e4567-e89b-42d3-a456-426614174001');
  });

  it('rejects CREDIT_NOTE when creditedInvoiceId is omitted', () => {
    expect(() =>
      recordInvoiceSchema.parse({
        ...basePayload,
        kind: 'CREDIT_NOTE',
      }),
    ).toThrow();
  });
});
