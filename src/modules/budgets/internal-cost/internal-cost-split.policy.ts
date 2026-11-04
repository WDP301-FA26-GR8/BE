import type { BusinessDate } from '../../../core/business-date';

export interface SplitPeriod {
  id: string;
  start: BusinessDate;
  end: BusinessDate;
}

function daysBetween(start: BusinessDate, end: BusinessDate): number {
  const ms = Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`);
  return Math.round(ms / 86_400_000) + 1;
}

function overlapDays(s1: BusinessDate, e1: BusinessDate, s2: BusinessDate, e2: BusinessDate): number {
  const start = s1 > s2 ? s1 : s2;
  const end = e1 < e2 ? e1 : e2;
  if (start > end) return 0;
  return daysBetween(start, end);
}

function allocatePeriodOverlaps(
  overlaps: readonly { id: string; days: number }[],
  totalDays: number,
  totalAmountMinor: bigint,
): Map<string, bigint> {
  const result = new Map<string, bigint>();
  let lastIndex = -1;
  for (let index = overlaps.length - 1; index >= 0; index -= 1) {
    if (overlaps[index].days > 0) {
      lastIndex = index;
      break;
    }
  }

  let allocated = 0n;
  for (let index = 0; index < overlaps.length; index += 1) {
    const { id, days } = overlaps[index];
    if (days <= 0) {
      result.set(id, 0n);
      continue;
    }
    if (days === totalDays) {
      result.set(id, totalAmountMinor);
      allocated += totalAmountMinor;
      continue;
    }
    if (index === lastIndex) {
      const remainder = totalAmountMinor - allocated;
      result.set(id, remainder > 0n ? remainder : 0n);
      allocated += remainder;
    } else {
      const share = (totalAmountMinor * BigInt(days)) / BigInt(totalDays);
      result.set(id, share);
      allocated += share;
    }
  }

  return result;
}

/**
 * Splits an internal cost entry evenly by time across the reporting periods it covers (US-12-11 AC-11, FR-5.3).
 * Residual minor units are assigned deterministically to the last covered period.
 */
export function splitInternalCostAcrossPeriods(
  entry: { periodStart: BusinessDate; periodEnd: BusinessDate; amountReportingMinor: bigint },
  periods: readonly SplitPeriod[],
): Map<string, bigint> {
  const result = new Map<string, bigint>();
  if (periods.length === 0) return result;

  const totalDays = daysBetween(entry.periodStart, entry.periodEnd);
  if (totalDays <= 0 || entry.amountReportingMinor <= 0n) {
    for (const p of periods) result.set(p.id, 0n);
    return result;
  }

  const overlaps = periods.map((period) => ({
    id: period.id,
    days: overlapDays(entry.periodStart, entry.periodEnd, period.start, period.end),
  }));

  return allocatePeriodOverlaps(overlaps, totalDays, entry.amountReportingMinor);
}
