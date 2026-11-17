import { createHash } from 'node:crypto';
import type { HistorySnapshot } from './invocation-history.types';

/**
 * The JSON of a value with the keys of every object in lexical order, arrays in their order: two equal snapshots give the same text
 * whatever order their keys were built in. Only JSON values are accepted; `undefined`, a function or a number that JSON cannot write
 * (NaN, Infinity) is a mistake of the caller, not something to hash silently.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('canonicalJson: a number JSON cannot write');

    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  throw new TypeError(`canonicalJson: a ${typeof value} is not a JSON value`);
}

/**
 * The fingerprint of one snapshot: SHA-256 of its canonical JSON in UTF-8. The delivery writes it into the document and compares it
 * when MongoDB already holds the same version: equal is the same write done twice, different is a conflict never overwritten.
 */
export function snapshotHashOf(snapshot: HistorySnapshot): string {
  return createHash('sha256').update(canonicalJson(snapshot), 'utf8').digest('hex');
}
