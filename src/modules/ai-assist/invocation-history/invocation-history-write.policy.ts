import type { HistoryRefusal } from './invocation-history.errors';
import type { SnapshotWriteOutcome } from './invocation-history.types';

/** What the conditional write needs to know of the document MongoDB already holds for the id. */
export interface ExistingHistory {
  organizationId: string;
  generation: number;
  version: number;
  payloadHash: string | null;
  purged: boolean;
}

/** The snapshot a delivery is writing. */
export interface IncomingSnapshot {
  organizationId: string;
  generation: number;
  version: number;
  payloadHash: string;
}

/**
 * What to make of a snapshot whose conditional update matched nothing and whose insert met a document with the same id. Only a later
 * version ever replaces an earlier one, and a tombstone (or a later purge generation) always wins: a delivery that comes late never
 * brings purged content back nor lowers the version. The same version with the same hash is the same write done twice; with another
 * hash it is a conflict, never a silent overwrite. An earlier version still there means the document changed between the two
 * operations: try again.
 */
export function snapshotOutcomeAgainst(
  existing: ExistingHistory,
  incoming: IncomingSnapshot,
): SnapshotWriteOutcome | HistoryRefusal {
  if (existing.organizationId !== incoming.organizationId) return 'SCOPE_CONFLICT';
  if (existing.purged || existing.generation > incoming.generation) return 'OBSOLETE';
  if (existing.generation < incoming.generation) return 'RETRY';
  if (existing.version > incoming.version) return 'OBSOLETE';
  if (existing.version < incoming.version) return 'RETRY';

  return existing.payloadHash === incoming.payloadHash ? 'WRITTEN' : 'CONTENT_CONFLICT';
}

/** The same for a tombstone: done when MongoDB already holds one of this generation or later; another organization is refused. */
export function tombstoneOutcomeAgainst(
  existing: ExistingHistory,
  incoming: { organizationId: string; generation: number },
): 'WRITTEN' | 'RETRY' | HistoryRefusal {
  if (existing.organizationId !== incoming.organizationId) return 'SCOPE_CONFLICT';

  return existing.purged && existing.generation >= incoming.generation ? 'WRITTEN' : 'RETRY';
}
