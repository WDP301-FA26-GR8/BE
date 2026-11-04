import type { BusinessDate } from '../../../core/business-date';

export interface InternalCostPeriodInput {
  periodStart: BusinessDate;
  periodEnd: BusinessDate;
  amountReportingMinor: bigint;
}

const pad = (n: number, width: number) => String(n).padStart(width, '0');

const DAYS_IN_MONTH = (year: number, month: number): number => new Date(Date.UTC(year, month, 0)).getUTCDate();

export function fiscalYearDateRange(year: number, startMonth: number): { start: BusinessDate; end: BusinessDate } {
  const startDay = '01';
  const startStr = `${pad(year, 4)}-${pad(startMonth, 2)}-${startDay}`;
  if (startMonth === 1) {
    return {
      start: startStr,
      end: `${pad(year, 4)}-12-31`,
    };
  }
  const endYear = year + 1;
  const endMonth = startMonth - 1;
  const endDay = DAYS_IN_MONTH(endYear, endMonth);
  return {
    start: startStr,
    end: `${pad(endYear, 4)}-${pad(endMonth, 2)}-${pad(endDay, 2)}`,
  };
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

function allocateProratedOverlaps(
  overlaps: readonly { year: number; days: number }[],
  totalDays: number,
  totalAmountMinor: bigint,
): Map<number, bigint> {
  const result = new Map<number, bigint>();
  let lastOverlappingYearIndex = -1;
  for (let index = overlaps.length - 1; index >= 0; index -= 1) {
    if (overlaps[index].days > 0) {
      lastOverlappingYearIndex = index;
      break;
    }
  }

  let allocated = 0n;
  for (let index = 0; index < overlaps.length; index += 1) {
    const { year, days } = overlaps[index];
    if (days <= 0) {
      result.set(year, 0n);
      continue;
    }
    if (days === totalDays) {
      result.set(year, totalAmountMinor);
      allocated += totalAmountMinor;
      continue;
    }
    if (index === lastOverlappingYearIndex) {
      const remainder = totalAmountMinor - allocated;
      result.set(year, remainder > 0n ? remainder : 0n);
      allocated += remainder;
    } else {
      const share = (totalAmountMinor * BigInt(days)) / BigInt(totalDays);
      result.set(year, share);
      allocated += share;
    }
  }

  return result;
}

/**
 * Prorates an internal cost entry across multiple fiscal years based on calendar day overlap.
 * Residual minor units are assigned deterministically to the last overlapping fiscal year.
 */
export function prorateInternalCostForYears(
  entry: InternalCostPeriodInput,
  targetYears: readonly number[],
  startMonth: number,
): Map<number, bigint> {
  const result = new Map<number, bigint>();
  if (targetYears.length === 0) return result;

  const totalDays = daysBetween(entry.periodStart, entry.periodEnd);
  if (totalDays <= 0 || entry.amountReportingMinor <= 0n) {
    for (const y of targetYears) result.set(y, 0n);
    return result;
  }

  const sortedYears = [...new Set(targetYears)].sort((a, b) => a - b);
  const overlaps = sortedYears.map((year) => {
    const range = fiscalYearDateRange(year, startMonth);
    const days = overlapDays(entry.periodStart, entry.periodEnd, range.start, range.end);
    return { year, days };
  });

  return allocateProratedOverlaps(overlaps, totalDays, entry.amountReportingMinor);
}

/**
 * Calculates how much of an internal cost entry belongs to one fiscal year.
 */
export function prorateInternalCostForFiscalYear(
  entry: InternalCostPeriodInput,
  year: number,
  startMonth: number,
): bigint {
  const range = fiscalYearDateRange(year, startMonth);
  const days = overlapDays(entry.periodStart, entry.periodEnd, range.start, range.end);
  if (days <= 0) return 0n;

  const totalDays = daysBetween(entry.periodStart, entry.periodEnd);
  if (days >= totalDays) return entry.amountReportingMinor;

  return (entry.amountReportingMinor * BigInt(days)) / BigInt(totalDays);
}
