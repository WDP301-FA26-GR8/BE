import { inheritedCostCenterOf } from './credit-note-cost-center.policy';

describe('inheritedCostCenterOf', () => {
  it('returns null when there are no lines on the credited invoice', () => {
    expect(inheritedCostCenterOf([])).toBeNull();
  });

  it('inherits the Cost Center when all credited lines share the same non-null Cost Center', () => {
    const lines = [
      { costCenterId: 'cc-00000000-0000-4000-8000-000000000001' },
      { costCenterId: 'cc-00000000-0000-4000-8000-000000000001' },
    ];
    expect(inheritedCostCenterOf(lines)).toBe('cc-00000000-0000-4000-8000-000000000001');
  });

  it('returns null when lines belong to different Cost Centers', () => {
    const lines = [
      { costCenterId: 'cc-00000000-0000-4000-8000-000000000001' },
      { costCenterId: 'cc-00000000-0000-4000-8000-000000000002' },
    ];
    expect(inheritedCostCenterOf(lines)).toBeNull();
  });

  it('returns null when any line has a null Cost Center', () => {
    const lines = [{ costCenterId: 'cc-00000000-0000-4000-8000-000000000001' }, { costCenterId: null }];
    expect(inheritedCostCenterOf(lines)).toBeNull();
  });

  it('returns null when all lines have a null Cost Center', () => {
    const lines = [{ costCenterId: null }, { costCenterId: null }];
    expect(inheritedCostCenterOf(lines)).toBeNull();
  });
});
