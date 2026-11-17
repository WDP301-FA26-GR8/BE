import { snapshotOutcomeAgainst, tombstoneOutcomeAgainst } from './invocation-history-write.policy';

const ORG = 'org-1';
const existing = (overrides = {}) => ({
  organizationId: ORG,
  generation: 0,
  version: 2,
  payloadHash: 'h2',
  purged: false,
  ...overrides,
});
const incoming = (overrides = {}) => ({
  organizationId: ORG,
  generation: 0,
  version: 2,
  payloadHash: 'h2',
  ...overrides,
});

describe('a snapshot that met a document with the same id', () => {
  it('is the same write done twice when version and hash are equal', () => {
    expect(snapshotOutcomeAgainst(existing(), incoming())).toBe('WRITTEN');
  });

  it('is a conflict, never an overwrite, when the same version has another hash', () => {
    expect(snapshotOutcomeAgainst(existing(), incoming({ payloadHash: 'other' }))).toBe('CONTENT_CONFLICT');
  });

  it('is obsolete when MongoDB holds a later version: a late v1 never lowers v2', () => {
    expect(snapshotOutcomeAgainst(existing(), incoming({ version: 1 }))).toBe('OBSOLETE');
  });

  it('is obsolete against a tombstone or a later purge generation: purged content never comes back', () => {
    expect(snapshotOutcomeAgainst(existing({ purged: true, version: 0 }), incoming({ version: 5 }))).toBe('OBSOLETE');
    expect(snapshotOutcomeAgainst(existing({ generation: 1 }), incoming({ version: 9 }))).toBe('OBSOLETE');
  });

  it('is tried again when an earlier version is still there: the document changed between the two operations', () => {
    expect(snapshotOutcomeAgainst(existing({ version: 1 }), incoming())).toBe('RETRY');
  });

  it('is refused for an id held under another organization', () => {
    expect(snapshotOutcomeAgainst(existing({ organizationId: 'org-2' }), incoming())).toBe('SCOPE_CONFLICT');
  });
});

describe('a tombstone that met a document with the same id', () => {
  it('is done when MongoDB holds a tombstone of this generation or a later one', () => {
    expect(
      tombstoneOutcomeAgainst(existing({ purged: true, generation: 1 }), { organizationId: ORG, generation: 1 }),
    ).toBe('WRITTEN');
    expect(
      tombstoneOutcomeAgainst(existing({ purged: true, generation: 2 }), { organizationId: ORG, generation: 1 }),
    ).toBe('WRITTEN');
  });

  it('is tried again against live content, and refused under another organization', () => {
    expect(tombstoneOutcomeAgainst(existing({ generation: 1 }), { organizationId: ORG, generation: 1 })).toBe('RETRY');
    expect(tombstoneOutcomeAgainst(existing({ organizationId: 'org-2' }), { organizationId: ORG, generation: 1 })).toBe(
      'SCOPE_CONFLICT',
    );
  });
});
