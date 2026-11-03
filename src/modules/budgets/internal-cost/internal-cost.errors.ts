export class InternalCostNotFoundError extends Error {
  constructor() {
    super('The internal cost entry does not exist.');
    this.name = 'InternalCostNotFoundError';
  }
}

export class InternalCostAlreadyCancelledError extends Error {
  constructor() {
    super('The internal cost entry has already been cancelled.');
    this.name = 'InternalCostAlreadyCancelledError';
  }
}

export class InternalCostCostCenterNotFoundError extends Error {
  constructor() {
    super('The cost center does not exist in the catalogue.');
    this.name = 'InternalCostCostCenterNotFoundError';
  }
}

export class InternalCostCostCenterInvalidError extends Error {
  constructor() {
    super('Internal costs can only be charged to a Unit cost center; Company is not a cost center.');
    this.name = 'InternalCostCostCenterInvalidError';
  }
}

export class InternalCostCostCenterInactiveError extends Error {
  constructor() {
    super('The cost center is not active.');
    this.name = 'InternalCostCostCenterInactiveError';
  }
}

export class InternalCostApplicationNotFoundError extends Error {
  constructor() {
    super('The application does not exist in the catalogue.');
    this.name = 'InternalCostApplicationNotFoundError';
  }
}

export class InternalCostApplicationNotInternalError extends Error {
  constructor() {
    super('The application is commercial software; commercial costs must be recorded through invoices.');
    this.name = 'InternalCostApplicationNotInternalError';
  }
}

export class InternalCostRateMissingError extends Error {
  constructor() {
    super('The exchange rate required for the internal cost entry is missing on the specified date.');
    this.name = 'InternalCostRateMissingError';
  }
}

export class InternalCostPeriodInvalidError extends Error {
  constructor() {
    super('The end date of the period must not precede the start date.');
    this.name = 'InternalCostPeriodInvalidError';
  }
}

export class InternalCostReasonRequiredError extends Error {
  constructor() {
    super('A non-empty cancellation reason is required.');
    this.name = 'InternalCostReasonRequiredError';
  }
}
