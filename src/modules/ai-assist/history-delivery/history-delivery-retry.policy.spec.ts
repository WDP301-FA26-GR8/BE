import { retryAt } from './history-delivery-retry.policy';

const NOW = new Date('2026-11-16T00:00:00.000Z');
const seconds = (attempts: number, random = 0.5) =>
  (retryAt(attempts, NOW, () => random).getTime() - NOW.getTime()) / 1000;

describe('when a failed delivery is taken again', () => {
  it('waits 1 s, 5 s, 30 s, 60 s, then 300 s for every later attempt, without end', () => {
    expect([1, 2, 3, 4, 5, 6, 50].map((attempts) => seconds(attempts))).toEqual([1, 5, 30, 60, 300, 300, 300]);
  });

  it('spreads deliveries that failed together by up to a fifth either way', () => {
    expect(seconds(3, 0)).toBe(24);
    expect(seconds(3, 1)).toBe(36);
  });

  it('reads an attempt count below 1 as the first attempt', () => {
    expect(seconds(0)).toBe(1);
  });
});
