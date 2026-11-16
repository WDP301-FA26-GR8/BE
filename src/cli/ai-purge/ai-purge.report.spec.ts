import type { AiPurgeResult } from '../../modules/ai-assist/public/ai-purge.types';
import { EXIT, exitOf, reportOf } from './ai-purge.report';

const result = (overrides: Partial<AiPurgeResult>): AiPurgeResult => ({
  mode: 'APPLIED',
  through: '2026-12-01',
  contentCount: 0,
  confirmedCount: 0,
  pendingCount: 0,
  parkedCount: 0,
  ...overrides,
});
const dry = (overrides: Partial<AiPurgeResult>) => result({ mode: 'DRY_RUN', ...overrides });

describe('ops:ai-purge report and exit code', () => {
  it.each([
    ['a dry run that would purge', dry({ contentCount: 3 }), EXIT.done, 'Run again with --apply'],
    ['a dry run with nothing in scope and nothing left', dry({}), EXIT.nothingToDelete, 'Nothing to purge.'],
    [
      'a dry run with tombstones of an earlier run waiting',
      dry({ pendingCount: 4 }),
      EXIT.done,
      '--apply delivers them',
    ],
    ['a purge MongoDB confirmed', result({ contentCount: 3, confirmedCount: 3 }), EXIT.done, 'are purged'],
    [
      'a run that only finished the tombstones of an earlier one',
      result({ confirmedCount: 2 }),
      EXIT.done,
      'are purged',
    ],
    ['a run with nothing to do', result({}), EXIT.nothingToDelete, 'Nothing to purge.'],
    [
      'a purge MongoDB did not take yet',
      result({ contentCount: 3, pendingCount: 2 }),
      EXIT.failed,
      'Run again to finish',
    ],
    [
      'a purge with a tombstone refused for good',
      result({ contentCount: 1, parkedCount: 1 }),
      EXIT.failed,
      'An operator',
    ],
  ])('%s', (_name, outcome, exit, says) => {
    expect(exitOf(outcome)).toBe(exit);
    expect(reportOf(outcome).join('\n')).toContain(says);
  });

  it('never tells to run again for a parked tombstone alone: running again does not deliver it', () => {
    const report = reportOf(result({ parkedCount: 1 })).join('\n');

    expect(report).toContain('parked:    1');
    expect(report).not.toContain('Run again');
  });
});
