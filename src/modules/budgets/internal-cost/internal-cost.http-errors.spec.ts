import { ApiException } from '../../../infrastructure/http/errors/api.exception';
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
import { toInternalCostApiException } from './internal-cost.http-errors';

describe('internal-cost error mapping (B07-10)', () => {
  it.each([
    [new InternalCostNotFoundError(), 404, 'INTERNAL_COST.NOT_FOUND'],
    [new InternalCostCostCenterNotFoundError(), 404, 'INTERNAL_COST.COST_CENTER_NOT_FOUND'],
    [new InternalCostApplicationNotFoundError(), 404, 'INTERNAL_COST.APPLICATION_NOT_FOUND'],
    [new InternalCostAlreadyCancelledError(), 409, 'INTERNAL_COST.ALREADY_CANCELLED'],
    [new InternalCostRateMissingError(), 409, 'INTERNAL_COST.RATE_MISSING'],
    [new InternalCostCostCenterInactiveError(), 409, 'INTERNAL_COST.COST_CENTER_INACTIVE'],
    [new InternalCostCostCenterInvalidError(), 422, 'INTERNAL_COST.COST_CENTER_INVALID'],
    [new InternalCostApplicationNotInternalError(), 422, 'INTERNAL_COST.APPLICATION_NOT_INTERNAL'],
    [new InternalCostPeriodInvalidError(), 422, 'INTERNAL_COST.PERIOD_INVALID'],
    [new InternalCostReasonRequiredError(), 422, 'INTERNAL_COST.REASON_REQUIRED'],
  ])('maps %s to HTTP %s with code %s', (error, status, code) => {
    const mapped = toInternalCostApiException(error);
    expect(mapped).toBeInstanceOf(ApiException);
    if (!(mapped instanceof ApiException)) throw new Error('Expected an internal cost API exception.');
    expect(mapped.getStatus()).toBe(status);
    expect(mapped.getResponse()).toEqual({ code, message: error.message });
  });

  it('preserves an API exception already mapped', () => {
    const error = new ApiException(409, { code: 'OTHER.CONFLICT', message: 'Already mapped.' });
    expect(toInternalCostApiException(error)).toBe(error);
  });

  it('leaves an unrecognized error unchanged for the global filter', () => {
    const error = new Error('Unexpected failure.');
    expect(toInternalCostApiException(error)).toBe(error);
  });
});
