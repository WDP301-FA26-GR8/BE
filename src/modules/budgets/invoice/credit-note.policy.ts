import { InvoiceReferenceInvalidError } from './invoice-record.errors';

export interface CreditedInvoiceFacts {
  kind: string;
  vendorId: string;
}

/**
 * Validates that the referenced original invoice for a credit note is a valid invoice
 * belonging to the same vendor (US-06-06 AC-11, LD-06).
 */
export function assertCreditedInvoiceValid(creditedInvoice: CreditedInvoiceFacts, expectedVendorId: string): void {
  if (creditedInvoice.kind !== 'INVOICE') {
    throw new InvoiceReferenceInvalidError('The credited invoice must be an invoice.');
  }

  if (creditedInvoice.vendorId !== expectedVendorId) {
    throw new InvoiceReferenceInvalidError('The credited invoice must belong to the same vendor.');
  }
}
