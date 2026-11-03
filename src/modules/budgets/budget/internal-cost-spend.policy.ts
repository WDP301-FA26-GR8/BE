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
  const overlaps: { year: number; days: number }[] = [];

  for (const year of sortedYears) {
    const range = fiscalYearDateRange(year, startMonth);
    const days = overlapDays(entry.periodStart, entry.periodEnd, range.start, range.end);
    overlaps.push({ year, days });
  }

  // Find last overlapping year among target years
  let lastOverlappingYearIndex = -1;
  for (let i = overlaps.length - 1; i >= 0; i--) {
    if (overlaps[i].days > 0) {
      lastOverlappingYearIndex = i;
      break;
    }
  }

  let allocated = 0n;
  for (let i = 0; i < overlaps.length; i++) {
    const { year, days } = overlaps[i];
    if (days <= 0) {
      result.set(year, 0n);
      continue;
    }
    if (days === totalDays) {
      result.set(year, entry.amountReportingMinor);
      allocated += entry.amountReportingMinor;
      continue;
    }
    if (i === lastOverlappingYearIndex) {
      // Last overlapping year gets remainder to guarantee exact sum
      const remainder = entry.amountReportingMinor - allocated;
      result.set(year, remainder > 0n ? remainder : 0n);
      allocated += remainder;
    } else {
      const share = (entry.amountReportingMinor * BigInt(days)) / BigInt(totalDays);
      result.set(year, share);
      allocated += share;
    }
  }

  return result;
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
