import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../../../infrastructure/http/errors/api.exception';
import { toUnavailableApiException } from '../../../infrastructure/http/errors/service-unavailable';
import { errorExampleOf } from '../../../infrastructure/http/openapi-error-examples';
import {
  InvocationContentNotFoundError,
  InvocationContentPendingError,
  InvocationContentUnavailableError,
} from './invocation-content.errors';

/**
 * The one place the refusal of the read of a content becomes an HTTP answer; anything else reaches the global filter. The wording is
 * the mapper's own, never the message of the error.
 */
export function toInvocationContentApiException(error: unknown): unknown {
  if (error instanceof ApiException) return error;
  if (error instanceof InvocationContentNotFoundError) {
    return new ApiException(HttpStatus.NOT_FOUND, { code: 'AI.NOT_FOUND', message: 'There is no such content.' });
  }
  if (error instanceof InvocationContentPendingError) {
    return new ApiException(HttpStatus.CONFLICT, {
      code: 'AI.HISTORY_PENDING',
      message: 'The history of this call is still being stored. Try again shortly.',
    });
  }
  if (error instanceof InvocationContentUnavailableError) {
    return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, {
      code: 'AI.HISTORY_UNAVAILABLE',
      message: 'The history of this call cannot be opened now.',
    });
  }

  return toUnavailableApiException(error) ?? error;
}

/** The answer above as an OpenAPI example, produced by the mapper that gives it at runtime. */
export const INVOCATION_CONTENT_ERROR_EXAMPLES = {
  NOT_FOUND: errorExampleOf(toInvocationContentApiException(new InvocationContentNotFoundError())),
  HISTORY_PENDING: errorExampleOf(toInvocationContentApiException(new InvocationContentPendingError())),
  HISTORY_UNAVAILABLE: errorExampleOf(toInvocationContentApiException(new InvocationContentUnavailableError())),
} as const;
