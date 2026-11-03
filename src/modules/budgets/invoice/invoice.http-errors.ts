import { HttpStatus } from '@nestjs/common';
import {
  CurrencyNotSupportedError,
  MoneyOutOfRangeError,
  MoneyScaleExceededError,
  ReportingCurrencyNotSupportedError,
} from '../../../core/money/money.errors';
import {
  DocumentAlreadyAttachedError,
  DocumentNotFoundError,
  DocumentNotReadyToAttachError,
  DocumentPurposeForbiddenError,
} from '../../catalog/public/catalog.errors';
import { VALIDATION_EXAMPLE } from '../../../infrastructure/http/decorators/api-error-responses.decorator';
import { ApiException } from '../../../infrastructure/http/errors/api.exception';
import { errorExampleOf, type ErrorExample } from '../../../infrastructure/http/openapi-error-examples';
import { toBudgetApiException } from '../budget/budget.http-errors';
import { BudgetCommitmentNotFoundError } from '../budget/budget.errors';
import {
  InvoiceDuplicateError,
  InvoiceLineNotFoundError,
  InvoiceLinesDoNotAddUpError,
  InvoiceLineVendorMismatchError,
  InvoiceMatchRefusedError,
  InvoiceNotFoundError,
  InvoiceRateMissingError,
  InvoiceVendorUnusableError,
  InvoiceTaxLineNotFoundError,
  InvoiceTaxLineNotBuyerRemitsError,
} from './invoice.errors';
import { InvoiceReferenceInvalidError } from './invoice-record.errors';

/** Maps invoice domain errors; unknown errors keep their identity for the global filter. */
export function toInvoiceApiException(error: unknown): unknown {
  if (error instanceof InvoiceDuplicateError) {
    return new ApiException(HttpStatus.CONFLICT, { code: 'INVOICE.DUPLICATE', message: error.message });
  }
  if (error instanceof InvoiceNotFoundError) {
    return new ApiException(HttpStatus.NOT_FOUND, { code: 'INVOICE.NOT_FOUND', message: error.message });
  }
  if (error instanceof InvoiceRateMissingError) {
    return new ApiException(HttpStatus.CONFLICT, { code: 'INVOICE.RATE_MISSING', message: error.message });
  }
  if (error instanceof InvoiceVendorUnusableError) {
    return new ApiException(HttpStatus.CONFLICT, { code: 'INVOICE.VENDOR_UNUSABLE', message: error.message });
  }
  if (error instanceof InvoiceLineVendorMismatchError) {
    return new ApiException(HttpStatus.CONFLICT, { code: 'INVOICE.LINE_VENDOR_MISMATCH', message: error.message });
  }
  if (error instanceof InvoiceLinesDoNotAddUpError) {
    return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, {
      code: 'INVOICE.LINES_DO_NOT_ADD_UP',
      message: error.message,
    });
  }
  if (error instanceof InvoiceTaxLineNotFoundError) {
    return new ApiException(HttpStatus.NOT_FOUND, {
      code: 'INVOICE.TAX_LINE_NOT_FOUND',
      message: error.message,
    });
  }
  if (error instanceof InvoiceTaxLineNotBuyerRemitsError) {
    return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, {
      code: 'INVOICE.TAX_LINE_NOT_BUYER_REMITS',
      message: error.message,
    });
  }
  if (error instanceof InvoiceLineNotFoundError) {
    return new ApiException(HttpStatus.NOT_FOUND, {
      code: 'INVOICE.LINE_NOT_FOUND',
      message: error.message,
    });
  }
  if (error instanceof BudgetCommitmentNotFoundError) {
    return new ApiException(HttpStatus.NOT_FOUND, {
      code: 'BUDGET.COMMITMENT_NOT_FOUND',
      message: error.message,
    });
  }
  if (error instanceof InvoiceMatchRefusedError) {
    return new ApiException(HttpStatus.CONFLICT, {
      code: `INVOICE_MATCH.${error.refusal}`,
      message: error.message,
    });
  }
  if (error instanceof DocumentNotFoundError) {
    return new ApiException(HttpStatus.NOT_FOUND, { code: 'DOCUMENT.NOT_FOUND', message: error.message });
  }
  if (error instanceof DocumentPurposeForbiddenError) {
    return new ApiException(HttpStatus.FORBIDDEN, { code: 'DOCUMENT.PURPOSE_FORBIDDEN', message: error.message });
  }
  if (error instanceof DocumentAlreadyAttachedError) {
    return new ApiException(HttpStatus.CONFLICT, { code: 'DOCUMENT.ALREADY_ATTACHED', message: error.message });
  }
  if (error instanceof DocumentNotReadyToAttachError) {
    return new ApiException(HttpStatus.CONFLICT, { code: 'DOCUMENT.NOT_READY_TO_ATTACH', message: error.message });
  }
  return error;
}

export function mapInvoiceError(error: unknown): unknown {
  if (error instanceof InvoiceReferenceInvalidError) {
    return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, { code: 'VALIDATION_ERROR', message: error.message });
  }
  return toBudgetApiException(toInvoiceApiException(error));
}

export const invoiceExample = (error: Error): ErrorExample => errorExampleOf(mapInvoiceError(error));

export const RECORD_EXAMPLE = {
  vendorId: '123e4567-e89b-42d3-a456-426614174000',
  invoiceNumber: 'INV-001',
  invoiceDate: '2026-11-01',
  amount: { amount: '1000', currency: 'USD' },
  lines: [{ outOfCatalog: true, description: 'Software', amount: '1000' }],
  taxLines: [
    {
      taxType: 'GTGT',
      rateBp: 1000,
      amount: { amount: '100', currency: 'USD' },
      payer: 'BUYER_REMITS',
      deductible: true,
    },
  ],
};

export const RECORD_CONFLICT_EXAMPLES: readonly [ErrorExample, ...ErrorExample[]] = [
  invoiceExample(new InvoiceDuplicateError()),
  invoiceExample(new InvoiceRateMissingError()),
  invoiceExample(new InvoiceVendorUnusableError()),
  invoiceExample(new InvoiceLineVendorMismatchError()),
  invoiceExample(new ReportingCurrencyNotSupportedError('XYZ')),
];

export const RECORD_UNPROCESSABLE_EXAMPLES: readonly [ErrorExample, ...ErrorExample[]] = [
  VALIDATION_EXAMPLE,
  invoiceExample(new InvoiceLinesDoNotAddUpError()),
  invoiceExample(new CurrencyNotSupportedError('XYZ')),
  invoiceExample(new MoneyScaleExceededError(2)),
  invoiceExample(new MoneyOutOfRangeError()),
];

export const ATTACH_DOC_NOT_FOUND_EXAMPLES: readonly [ErrorExample, ...ErrorExample[]] = [
  invoiceExample(new InvoiceNotFoundError()),
  invoiceExample(new InvoiceTaxLineNotFoundError()),
  invoiceExample(new DocumentNotFoundError()),
];

export const ATTACH_DOC_CONFLICT_EXAMPLES: readonly [ErrorExample, ...ErrorExample[]] = [
  invoiceExample(new DocumentAlreadyAttachedError()),
  invoiceExample(new DocumentNotReadyToAttachError()),
];

export const MATCH_LINE_NOT_FOUND_EXAMPLES: readonly [ErrorExample, ...ErrorExample[]] = [
  invoiceExample(new InvoiceNotFoundError()),
  invoiceExample(new InvoiceLineNotFoundError()),
  invoiceExample(new BudgetCommitmentNotFoundError()),
];

export const MATCH_LINE_CONFLICT_EXAMPLES: readonly [ErrorExample, ...ErrorExample[]] = [
  invoiceExample(new InvoiceMatchRefusedError('INVOICE_NOT_MATCHABLE')),
  invoiceExample(new InvoiceMatchRefusedError('COMMITMENT_NOT_HELD')),
  invoiceExample(new InvoiceMatchRefusedError('YEAR_MISMATCH')),
  invoiceExample(new InvoiceMatchRefusedError('VENDOR_MISMATCH')),
  invoiceExample(new InvoiceMatchRefusedError('LINE_ALREADY_MATCHED')),
];
