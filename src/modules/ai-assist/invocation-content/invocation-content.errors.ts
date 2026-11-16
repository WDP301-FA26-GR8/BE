/* The refusals of the read of the content of a call of the AI. Each maps to one stable code and one HTTP status in the HTTP layer. */

/** `AI.NOT_FOUND`: there is no content for the id: the call was never made, or its history was purged. */
export class InvocationContentNotFoundError extends Error {
  constructor() {
    super('No such content.');
    this.name = 'InvocationContentNotFoundError';
  }
}

/** `AI.HISTORY_PENDING`: the last snapshot of the history is not in MongoDB yet; an earlier one is never served as the last. */
export class InvocationContentPendingError extends Error {
  constructor() {
    super('The history is not stored yet.');
    this.name = 'InvocationContentPendingError';
  }
}

/** `AI.HISTORY_UNAVAILABLE`: MongoDB did not answer, refused the history, or holds a document this backend does not recognise. */
export class InvocationContentUnavailableError extends Error {
  constructor(options?: { cause?: unknown }) {
    super('The history cannot be read now.', options);
    this.name = 'InvocationContentUnavailableError';
  }
}
