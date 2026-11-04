import { assertCreditedInvoiceValid } from './credit-note.policy';
import { InvoiceReferenceInvalidError } from './invoice-record.errors';

describe('assertCreditedInvoiceValid', () => {
  const vendorId = '123e4567-e89b-42d3-a456-426614174000';

  it('accepts an invoice that is of kind INVOICE and belongs to the same vendor', () => {
    expect(() => assertCreditedInvoiceValid({ kind: 'INVOICE', vendorId }, vendorId)).not.toThrow();
  });

  it('rejects when the credited invoice is not of kind INVOICE', () => {
    expect(() => assertCreditedInvoiceValid({ kind: 'CREDIT_NOTE', vendorId }, vendorId)).toThrow(
      InvoiceReferenceInvalidError,
    );
  });

  it('rejects when the credited invoice belongs to a different vendor', () => {
    const otherVendorId = '123e4567-e89b-42d3-a456-426614174001';
    expect(() => assertCreditedInvoiceValid({ kind: 'INVOICE', vendorId: otherVendorId }, vendorId)).toThrow(
      InvoiceReferenceInvalidError,
    );
  });
});
