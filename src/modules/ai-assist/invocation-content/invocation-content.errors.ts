/* The refusals of the read of the content of a call of the AI. Each maps to one stable code and one HTTP status in the HTTP layer. */

/** `AI.NOT_FOUND`: there is no content for the id: the call was never made, or its history was purged. */
export class InvocationContentNotFoundError extends Error {
  constructor() {
    super('No such content.');
    this.name = 'InvocationContentNotFoundError';
  }
}
