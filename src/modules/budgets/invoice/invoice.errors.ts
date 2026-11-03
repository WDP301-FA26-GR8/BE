import type { InvoiceMatchRefusal } from './invoice-match.policy';

export class InvoiceDuplicateError extends Error {
  constructor() {
    super('An invoice with this number, vendor and kind already exists in the organization.');
    this.name = 'InvoiceDuplicateError';
  }
}

export class InvoiceNotFoundError extends Error {
  constructor() {
    super('The invoice does not exist.');
    this.name = 'InvoiceNotFoundError';
  }
}

export class InvoiceRateMissingError extends Error {
  constructor() {
    super('The exchange rate required for the invoice is missing on the specified date.');
    this.name = 'InvoiceRateMissingError';
  }
}

export class InvoiceVendorUnusableError extends Error {
  constructor() {
    super('The vendor is not available for invoice recording.');
    this.name = 'InvoiceVendorUnusableError';
  }
}

export class InvoiceLineVendorMismatchError extends Error {
  constructor() {
    super('An invoice line subscription belongs to a different vendor.');
    this.name = 'InvoiceLineVendorMismatchError';
  }
}

export class InvoiceLinesDoNotAddUpError extends Error {
  constructor() {
    super('The invoice line amounts must add up to the invoice amount.');
    this.name = 'InvoiceLinesDoNotAddUpError';
  }
}

export class InvoiceTaxLineNotFoundError extends Error {
  constructor() {
    super('The specified tax line position was not found on this invoice.');
    this.name = 'InvoiceTaxLineNotFoundError';
  }
}

export class InvoiceTaxLineNotBuyerRemitsError extends Error {
  constructor() {
    super('Only tax lines with buyer-remits payer can be linked to proof documents.');
    this.name = 'InvoiceTaxLineNotBuyerRemitsError';
  }
}

export class InvoiceLineNotFoundError extends Error {
  constructor() {
    super('The specified line position was not found on this invoice.');
    this.name = 'InvoiceLineNotFoundError';
  }
}

export class InvoiceMatchRefusedError extends Error {
  constructor(readonly refusal: InvoiceMatchRefusal) {
    super(`The invoice line cannot be matched to the commitment: ${refusal}.`);
    this.name = 'InvoiceMatchRefusedError';
  }
}
