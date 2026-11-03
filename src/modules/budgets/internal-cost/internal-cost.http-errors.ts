import { HttpStatus } from '@nestjs/common';
import {
  CurrencyNotSupportedError,
  MoneyOutOfRangeError,
  MoneyScaleExceededError,
  ReportingCurrencyNotSupportedError,
} from '../../../core/money/money.errors';
import { VALIDATION_EXAMPLE } from '../../../infrastructure/http/decorators/api-error-responses.decorator';
import { ApiException } from '../../../infrastructure/http/errors/api.exception';
import { errorExampleOf, type ErrorExample } from '../../../infrastructure/http/openapi-error-examples';
import {
  InternalCostAlreadyCancelledError,
  InternalCostApplicationNotFoundError,
  InternalCostApplicationNotInternalError,
  InternalCostCostCenterInactiveError,
  InternalCostCostCenterInvalidError,
  InternalCostCostCenterNotFoundError,
  InternalCostNotFoundError,
  InternalCostPeriodInvalidError,
  InternalCostRateMissingError,
  InternalCostReasonRequiredError,
} from './internal-cost.errors';

export function toInternalCostApiException(error: unknown): unknown {
  if (error instanceof ApiException) return error;

  if (error instanceof InternalCostNotFoundError) {
    return new ApiException(HttpStatus.NOT_FOUND, {
      code: 'INTERNAL_COST.NOT_FOUND',
      message: error.message,
    });
  }

  if (error instanceof InternalCostCostCenterNotFoundError) {
    return new ApiException(HttpStatus.NOT_FOUND, {
      code: 'INTERNAL_COST.COST_CENTER_NOT_FOUND',
      message: error.message,
    });
  }

  if (error instanceof InternalCostApplicationNotFoundError) {
    return new ApiException(HttpStatus.NOT_FOUND, {
      code: 'INTERNAL_COST.APPLICATION_NOT_FOUND',
      message: error.message,
    });
  }

  if (error instanceof InternalCostAlreadyCancelledError) {
    return new ApiException(HttpStatus.CONFLICT, {
      code: 'INTERNAL_COST.ALREADY_CANCELLED',
      message: error.message,
    });
  }

  if (error instanceof InternalCostRateMissingError) {
    return new ApiException(HttpStatus.CONFLICT, {
      code: 'INTERNAL_COST.RATE_MISSING',
      message: error.message,
    });
  }

  if (error instanceof InternalCostCostCenterInactiveError) {
    return new ApiException(HttpStatus.CONFLICT, {
      code: 'INTERNAL_COST.COST_CENTER_INACTIVE',
      message: error.message,
    });
  }

  if (error instanceof InternalCostCostCenterInvalidError) {
    return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, {
      code: 'INTERNAL_COST.COST_CENTER_INVALID',
      message: error.message,
    });
  }

  if (error instanceof InternalCostApplicationNotInternalError) {
    return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, {
      code: 'INTERNAL_COST.APPLICATION_NOT_INTERNAL',
      message: error.message,
    });
  }

  if (error instanceof InternalCostPeriodInvalidError) {
    return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, {
      code: 'INTERNAL_COST.PERIOD_INVALID',
      message: error.message,
    });
  }

  if (error instanceof InternalCostReasonRequiredError) {
    return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, {
      code: 'INTERNAL_COST.REASON_REQUIRED',
      message: error.message,
    });
  }

  if (error instanceof CurrencyNotSupportedError || error instanceof ReportingCurrencyNotSupportedError) {
    return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, {
      code: 'CURRENCY_NOT_SUPPORTED',
      message: error.message,
    });
  }

  if (error instanceof MoneyOutOfRangeError || error instanceof MoneyScaleExceededError) {
    return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, {
      code: 'MONEY_INVALID',
      message: error.message,
    });
  }

  return error;
}

export const INTERNAL_COST_ERROR_EXAMPLES: Record<string, ErrorExample> = {
  VALIDATION_ERROR: VALIDATION_EXAMPLE,
  NOT_FOUND: errorExampleOf(toInternalCostApiException(new InternalCostNotFoundError())),
  COST_CENTER_NOT_FOUND: errorExampleOf(toInternalCostApiException(new InternalCostCostCenterNotFoundError())),
  APPLICATION_NOT_FOUND: errorExampleOf(toInternalCostApiException(new InternalCostApplicationNotFoundError())),
  RATE_MISSING: errorExampleOf(toInternalCostApiException(new InternalCostRateMissingError())),
  ALREADY_CANCELLED: errorExampleOf(toInternalCostApiException(new InternalCostAlreadyCancelledError())),
  COST_CENTER_INACTIVE: errorExampleOf(toInternalCostApiException(new InternalCostCostCenterInactiveError())),
  COST_CENTER_INVALID: errorExampleOf(toInternalCostApiException(new InternalCostCostCenterInvalidError())),
  APPLICATION_NOT_INTERNAL: errorExampleOf(toInternalCostApiException(new InternalCostApplicationNotInternalError())),
  PERIOD_INVALID: errorExampleOf(toInternalCostApiException(new InternalCostPeriodInvalidError())),
  REASON_REQUIRED: errorExampleOf(toInternalCostApiException(new InternalCostReasonRequiredError())),
};
