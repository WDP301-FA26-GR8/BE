import { costCenterLinkedOn } from './cost-center-link.policy';

const period = {
  linkedAt: new Date('2026-10-01T18:30:00.000Z'),
  deactivatedAt: new Date('2026-10-10T18:30:00.000Z'),
};

describe('Cost Center linkage on an organization calendar day (B07-2 step 3)', () => {
  it('includes the link day in the organization time zone, even before the link time', () => {
    expect(costCenterLinkedOn(period, '2026-10-02', 'Asia/Ho_Chi_Minh')).toBe(true);
  });

  it('excludes the day before linkage in the organization time zone', () => {
    expect(costCenterLinkedOn(period, '2026-10-01', 'Asia/Ho_Chi_Minh')).toBe(false);
  });

  it('includes the last day before retirement', () => {
    expect(costCenterLinkedOn(period, '2026-10-10', 'Asia/Ho_Chi_Minh')).toBe(true);
  });

  it('excludes the retirement day in the organization time zone', () => {
    expect(costCenterLinkedOn(period, '2026-10-11', 'Asia/Ho_Chi_Minh')).toBe(false);
  });

  it('excludes a later day', () => {
    expect(costCenterLinkedOn(period, '2026-10-12', 'Asia/Ho_Chi_Minh')).toBe(false);
  });

  it('uses the organization zone rather than assuming UTC or the host zone', () => {
    expect(costCenterLinkedOn(period, '2026-10-01', 'UTC')).toBe(true);
    expect(costCenterLinkedOn(period, '2026-10-10', 'UTC')).toBe(false);
  });

  it('keeps a link without retirement valid on later dates', () => {
    expect(costCenterLinkedOn({ ...period, deactivatedAt: null }, '2030-01-01', 'Asia/Ho_Chi_Minh')).toBe(true);
  });

  it('does not charge a row with no link date', () => {
    expect(costCenterLinkedOn({ ...period, linkedAt: null }, '2026-10-05', 'Asia/Ho_Chi_Minh')).toBe(false);
  });
});
