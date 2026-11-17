import { canonicalJson, snapshotHashOf } from './invocation-history-hash.policy';
import type { HistorySnapshot } from './invocation-history.types';

const SNAPSHOT: HistorySnapshot = {
  context: { generatedAt: '2026-11-15T10:00:00.000Z', requests: [] },
  promptText: 'prompt',
  rawResponse: 'raw',
  parsed: { items: [] },
  validation: { rejections: [{ sourceRef: 'R001', code: 'INVENTED_NUMBER' }] },
};

describe('the fingerprint of a snapshot', () => {
  it('writes the keys of every object in lexical order, arrays in their order', () => {
    expect(canonicalJson({ b: 1, a: { d: [2, 1], c: null } })).toBe('{"a":{"c":null,"d":[2,1]},"b":1}');
  });

  it('gives two equal snapshots the same hash whatever order their keys were built in', () => {
    const reordered = {
      validation: SNAPSHOT.validation,
      parsed: SNAPSHOT.parsed,
      rawResponse: 'raw',
      promptText: 'prompt',
      context: { requests: [], generatedAt: '2026-11-15T10:00:00.000Z' },
    };

    expect(snapshotHashOf(reordered)).toBe(snapshotHashOf(SNAPSHOT));
    expect(snapshotHashOf(SNAPSHOT)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('gives a snapshot that differs by one character another hash', () => {
    expect(snapshotHashOf({ ...SNAPSHOT, rawResponse: 'raw.' })).not.toBe(snapshotHashOf(SNAPSHOT));
  });

  it('refuses what JSON cannot write instead of hashing it silently', () => {
    expect(() => canonicalJson({ a: undefined })).toThrow(TypeError);
    expect(() => canonicalJson(Number.NaN)).toThrow(TypeError);
    expect(() => canonicalJson(Infinity)).toThrow(TypeError);
  });
});
