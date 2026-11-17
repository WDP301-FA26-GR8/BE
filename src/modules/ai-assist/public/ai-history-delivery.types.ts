/** What one round of the delivery of the raw history did; never a content. */
export interface AiHistoryDeliveryResult {
  /** Rows taken this round; a full batch means more are due at once. */
  claimed: number;
  batchSize: number;
  delivered: number;
  obsolete: number;
  retried: number;
  parked: number;
}
