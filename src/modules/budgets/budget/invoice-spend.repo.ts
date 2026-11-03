import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { DbTx } from '../../../infrastructure/database/transaction-runner';
import { heldKey } from './commitment.repo';

export interface InvoiceSpendTotals {
  spent: bigint;
  deductibleVat: bigint;
}

/**
 * Reads effective cost and deductible VAT from `invoice_lines` for each Cost Center and fiscal year (FR-5.4, US-06-09 AC-12).
 * Resides in budget core so `CommitmentRepo` reads directly without importing `invoice/` capability.
 */
@Injectable()
export class InvoiceSpendRepo {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sums the effective cost and deductible VAT of invoice lines for each Cost Center and fiscal year.
   * Lines with null costCenterId are unassigned and excluded. Negative lines (credit notes) reduce spend.
   */
  async totals(
    pairs: readonly { costCenterId: string; year: number }[],
    tx?: DbTx,
  ): Promise<Map<string, InvoiceSpendTotals>> {
    const totals = new Map<string, InvoiceSpendTotals>();
    if (pairs.length === 0) return totals;

    const db = tx ?? this.prisma;
    const groups = await db.invoiceLine.groupBy({
      by: ['costCenterId', 'fiscalYear'],
      where: {
        costCenterId: { not: null },
        OR: pairs.map((pair) => ({ costCenterId: pair.costCenterId, fiscalYear: pair.year })),
      },
      _sum: {
        costReportingMinor: true,
        deductibleVatReportingMinor: true,
      },
    });

    for (const group of groups) {
      if (group.costCenterId === null) continue;
      const key = heldKey(group.costCenterId, group.fiscalYear);
      totals.set(key, {
        spent: group._sum.costReportingMinor ?? 0n,
        deductibleVat: group._sum.deductibleVatReportingMinor ?? 0n,
      });
    }

    return totals;
  }
}
