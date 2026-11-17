/*
 * Why MongoDB refused the history of a call for good, or gave back a document the backend does not recognise. A refusal is never
 * retried: the delivery parks its row and the call shows `ERROR` until an operator looks. The codes are stable words stored in
 * `history_error_code` / `last_error_code`; none carries data.
 */

/** The codes a refused delivery is parked with. */
export type HistoryRefusal = 'CONTENT_CONFLICT' | 'SCOPE_CONFLICT' | 'PAYLOAD_INVALID';

/** MongoDB already holds this version of the history with another content, or the id under another organization. */
export class HistoryWriteRefusedError extends Error {
  constructor(readonly refusal: HistoryRefusal) {
    super(`The history write was refused (${refusal}).`);
    this.name = 'HistoryWriteRefusedError';
  }
}

/** The document read from MongoDB is not one this backend writes. The message names no field value. */
export class HistoryDocumentShapeError extends Error {
  constructor() {
    super('The history document does not have the expected shape.');
    this.name = 'HistoryDocumentShapeError';
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
