import type { AiPurgeResult } from '../../modules/ai-assist/public/ai-purge.types';

/** Exit codes are part of the command's contract (see --help). */
export const EXIT = { done: 0, failed: 1, nothingToDelete: 2 } as const;

/** Nothing new in scope and no tombstone of an earlier run left: there is nothing for `--apply` to do either. */
const nothingLeft = (result: AiPurgeResult) =>
  result.contentCount === 0 && result.pendingCount === 0 && result.parkedCount === 0;

/** What the command prints: counts only, never a content. */
export function reportOf(result: AiPurgeResult): string[] {
  const dry = result.mode === 'DRY_RUN';
  const lines = [
    `mode:      ${dry ? 'DRY RUN' : 'APPLIED'}`,
    `through:   ${result.through}`,
    `histories: ${result.contentCount}`,
  ];
  if (!dry) lines.push(`confirmed: ${result.confirmedCount}`);
  lines.push(`pending:   ${result.pendingCount}`);
  if (result.parkedCount > 0) lines.push(`parked:    ${result.parkedCount}`);
  if (dry) {
    if (result.contentCount > 0) {
      lines.push('Nothing was purged. Run again with --apply and --operator to purge them.');
    } else if (result.pendingCount > 0) {
      lines.push('Nothing new to purge, but tombstones of an earlier run are waiting: --apply delivers them.');
    } else if (result.parkedCount === 0) {
      lines.push('Nothing to purge.');
    }
  } else if (result.pendingCount > 0) {
    lines.push(
      'The histories read as purged already, but MongoDB has not taken every tombstone yet: they stay queued (the worker ' +
        'and the next run deliver them). Run again to finish.',
    );
  } else if (result.parkedCount === 0) {
    lines.push(
      result.contentCount + result.confirmedCount === 0
        ? 'Nothing to purge.'
        : 'The histories are purged; the calls are kept.',
    );
  }
  if (result.parkedCount > 0) {
    lines.push(
      'MongoDB refused some tombstones for good (parked): running again does not deliver them. An operator looks at the ' +
        'parked PURGE rows of ai_history_deliveries.',
    );
  }

  return lines;
}

/** 2 when there is nothing to do; 1 while a tombstone is still waiting for MongoDB or parked: the purge is not finished. */
export function exitOf(result: AiPurgeResult): number {
  if (result.mode === 'DRY_RUN') return nothingLeft(result) ? EXIT.nothingToDelete : EXIT.done;
  if (result.pendingCount > 0 || result.parkedCount > 0) return EXIT.failed;

  return result.contentCount + result.confirmedCount === 0 ? EXIT.nothingToDelete : EXIT.done;
}
