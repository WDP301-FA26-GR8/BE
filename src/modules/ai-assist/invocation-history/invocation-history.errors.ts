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
