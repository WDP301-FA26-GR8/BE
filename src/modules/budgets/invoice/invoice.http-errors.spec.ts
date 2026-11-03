import { ApiException } from '../../../infrastructure/http/errors/api.exception';
import { BudgetCommitmentNotFoundError } from '../budget/budget.errors';
import {
  InvoiceDuplicateError,
  InvoiceLineNotFoundError,
  InvoiceLineVendorMismatchError,
  InvoiceLinesDoNotAddUpError,
  InvoiceMatchRefusedError,
  InvoiceNotFoundError,
  InvoiceRateMissingError,
  InvoiceVendorUnusableError,
  InvoiceTaxLineNotFoundError,
  InvoiceTaxLineNotBuyerRemitsError,
} from './invoice.errors';
import { toInvoiceApiException } from './invoice.http-errors';

describe('invoice error mapping (B07-2 step 2, B07-8)', () => {
  it.each([
    [new InvoiceDuplicateError(), 409, 'INVOICE.DUPLICATE'],
    [new InvoiceNotFoundError(), 404, 'INVOICE.NOT_FOUND'],
    [new InvoiceLineNotFoundError(), 404, 'INVOICE.LINE_NOT_FOUND'],
    [new BudgetCommitmentNotFoundError(), 404, 'BUDGET.COMMITMENT_NOT_FOUND'],
    [new InvoiceRateMissingError(), 409, 'INVOICE.RATE_MISSING'],
    [new InvoiceVendorUnusableError(), 409, 'INVOICE.VENDOR_UNUSABLE'],
    [new InvoiceLineVendorMismatchError(), 409, 'INVOICE.LINE_VENDOR_MISMATCH'],
    [new InvoiceLinesDoNotAddUpError(), 422, 'INVOICE.LINES_DO_NOT_ADD_UP'],
    [new InvoiceTaxLineNotFoundError(), 404, 'INVOICE.TAX_LINE_NOT_FOUND'],
    [new InvoiceTaxLineNotBuyerRemitsError(), 422, 'INVOICE.TAX_LINE_NOT_BUYER_REMITS'],
    [new InvoiceMatchRefusedError('INVOICE_NOT_MATCHABLE'), 409, 'INVOICE_MATCH.INVOICE_NOT_MATCHABLE'],
    [new InvoiceMatchRefusedError('COMMITMENT_NOT_HELD'), 409, 'INVOICE_MATCH.COMMITMENT_NOT_HELD'],
    [new InvoiceMatchRefusedError('YEAR_MISMATCH'), 409, 'INVOICE_MATCH.YEAR_MISMATCH'],
    [new InvoiceMatchRefusedError('VENDOR_MISMATCH'), 409, 'INVOICE_MATCH.VENDOR_MISMATCH'],
    [new InvoiceMatchRefusedError('LINE_ALREADY_MATCHED'), 409, 'INVOICE_MATCH.LINE_ALREADY_MATCHED'],
  ])('maps %s to HTTP %s with code %s', (error, status, code) => {
    const mapped = toInvoiceApiException(error);
    expect(mapped).toBeInstanceOf(ApiException);
    if (!(mapped instanceof ApiException)) throw new Error('Expected an invoice API exception.');
    expect(mapped.getStatus()).toBe(status);
    expect(mapped.getResponse()).toEqual({ code, message: error.message });
  });

  it('preserves an API exception already mapped', () => {
    const error = new ApiException(409, { code: 'OTHER.CONFLICT', message: 'Already mapped.' });
    expect(toInvoiceApiException(error)).toBe(error);
  });

  it('leaves an unrecognized error unchanged for the global filter', () => {
    const error = new Error('Unexpected failure.');
    expect(toInvoiceApiException(error)).toBe(error);
  });

  it('does not recognize a domain error by its name alone', () => {
    const error = new Error('Unexpected failure.');
    error.name = 'InvoiceDuplicateError';
    expect(toInvoiceApiException(error)).toBe(error);
  });
});
