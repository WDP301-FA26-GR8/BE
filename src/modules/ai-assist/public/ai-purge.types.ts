/** What the operator typed, parsed: the last day (`YYYY-MM-DD`, UTC) whose calls are in scope, and whether to purge. */
export interface AiPurgeCommand {
  through: string;
  apply: boolean;
  /** Who runs the command (a reference); required to apply, where it becomes the operator reference of the Audit Trail event. */
  operator: string | null;
}

/** What the command answers: counts only, never what the histories held. */
export interface AiPurgeResult {
  mode: 'DRY_RUN' | 'APPLIED';
  through: string;
  /** Calls whose history was (or, for a dry run, would be) purged by this run. */
  contentCount: number;
  /** Tombstones MongoDB confirmed during this run, this purge's and those left over by an earlier one. */
  confirmedCount: number;
  /** Tombstones still waiting for MongoDB: the content is unreadable already, but not yet gone from MongoDB. */
  pendingCount: number;
  /**
   * Tombstones MongoDB refused for good (parked): running again does not deliver them; an operator looks at the parked rows of
   * `ai_history_deliveries`.
   */
  parkedCount: number;
}
