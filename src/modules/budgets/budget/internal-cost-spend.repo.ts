import { Injectable } from '@nestjs/common';
import { fromDateColumn } from '../../../core/business-date';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { DbTx } from '../../../infrastructure/database/transaction-runner';
import { OperatingParametersApi } from '../../operating-parameters/public/operating-parameters.api';
import { heldKey } from './commitment-key.policy';
import { fiscalYearDateRange, prorateInternalCostForYears } from './internal-cost-spend.policy';

/**
 * Reads effective reporting spend from uncancelled `internal_cost_entries` for each Cost Center and fiscal year (US-12-11 AC-1, AC-11).
 * Resides in budget core so `CommitmentRepo` reads directly without importing capability `internal-cost/`.
 */
@Injectable()
export class InternalCostSpendRepo {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parameters: OperatingParametersApi,
  ) {}

  /**
   * Sums the reporting cost of internal software costs for each Cost Center and fiscal year.
   * Cancelled entries are excluded (OQ-F-10 / LD-11). Entries spanning multiple years are prorated by day count.
   */
  async totals(pairs: readonly { costCenterId: string; year: number }[], tx?: DbTx): Promise<Map<string, bigint>> {
    const totals = new Map<string, bigint>();
    if (pairs.length === 0) return totals;

    for (const pair of pairs) {
      totals.set(heldKey(pair.costCenterId, pair.year), 0n);
    }

    const startMonthVal = await this.parameters.getValue('FISCAL_YEAR_START_MONTH').catch(() => '1');
    const startMonth = Number(startMonthVal) || 1;
    const costCenterIds = [...new Set(pairs.map((p) => p.costCenterId))];
    const years = [...new Set(pairs.map((p) => p.year))].sort((a, b) => a - b);
    const minYear = years[0];
    const maxYear = years[years.length - 1];

    const overallStart = fiscalYearDateRange(minYear, startMonth).start;
    const overallEnd = fiscalYearDateRange(maxYear, startMonth).end;

    const db = tx ?? this.prisma;
    const entries = await db.internalCostEntry.findMany({
      where: {
        costCenterId: { in: costCenterIds },
        cancelledAt: null,
        periodStart: { lte: new Date(`${overallEnd}T00:00:00.000Z`) },
        periodEnd: { gte: new Date(`${overallStart}T00:00:00.000Z`) },
      },
      select: {
        costCenterId: true,
        periodStart: true,
        periodEnd: true,
        amountReportingMinor: true,
      },
    });

    for (const entry of entries) {
      const periodStart = fromDateColumn(entry.periodStart);
      const periodEnd = fromDateColumn(entry.periodEnd);
      const costCenterYears = pairs.filter((p) => p.costCenterId === entry.costCenterId).map((p) => p.year);

      if (costCenterYears.length === 0) continue;

      const prorated = prorateInternalCostForYears(
        { periodStart, periodEnd, amountReportingMinor: entry.amountReportingMinor },
        costCenterYears,
        startMonth,
      );

      for (const [year, amount] of prorated) {
        const key = heldKey(entry.costCenterId, year);
        const current = totals.get(key) ?? 0n;
        totals.set(key, current + amount);
      }
    }

    return totals;
  }
}
