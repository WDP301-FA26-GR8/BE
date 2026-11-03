import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import { fromDateColumn, toDateColumn, type BusinessDate } from '../../../core/business-date';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { DbTx } from '../../../infrastructure/database/transaction-runner';

export interface CreateInternalCostRecord {
  organizationId: string;
  applicationId: string;
  costCenterId: string;
  amountCurrency: string;
  periodStart: BusinessDate;
  periodEnd: BusinessDate;
  amountMinor: bigint;
  amountRate: Prisma.Decimal;
  amountRateDate: BusinessDate;
  amountRateSource: 'MANUAL' | 'SAME_CURRENCY';
  amountReportingMinor: bigint;
  note: string | null;
  recordedByEmployeeId: string;
}

export interface InternalCostListQueryFilter {
  costCenterIds?: string[];
  applicationId?: string;
  periodFrom?: BusinessDate;
  periodTo?: BusinessDate;
  status: 'ALL' | 'ACTIVE' | 'CANCELLED';
  skip: number;
  take: number;
}

export type InternalCostRow = Prisma.InternalCostEntryGetPayload<{
  include: {
    application: { select: { id: true; name: true } };
    costCenter: { select: { id: true; code: true; name: true } };
  };
}>;

@Injectable()
export class InternalCostRepo {
  constructor(private readonly prisma: PrismaService) {}

  async insert(tx: DbTx, data: CreateInternalCostRecord): Promise<InternalCostRow> {
    return tx.internalCostEntry.create({
      data: {
        organizationId: data.organizationId,
        applicationId: data.applicationId,
        costCenterId: data.costCenterId,
        amountCurrency: data.amountCurrency,
        periodStart: toDateColumn(data.periodStart),
        periodEnd: toDateColumn(data.periodEnd),
        amountMinor: data.amountMinor,
        amountRate: data.amountRate,
        amountRateDate: toDateColumn(data.amountRateDate),
        amountRateSource: data.amountRateSource,
        amountReportingMinor: data.amountReportingMinor,
        note: data.note,
        recordedByEmployeeId: data.recordedByEmployeeId,
      },
      include: {
        application: { select: { id: true, name: true } },
        costCenter: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async lockById(tx: DbTx, id: string): Promise<InternalCostRow | null> {
    const [row] = await tx.$queryRaw<
      {
        id: string;
        organization_id: string;
        application_id: string;
        cost_center_id: string;
        amount_currency: string;
        period_start: Date;
        period_end: Date;
        amount_minor: bigint;
        amount_rate: Prisma.Decimal;
        amount_rate_date: Date;
        amount_rate_source: 'MANUAL' | 'SAME_CURRENCY';
        amount_reporting_minor: bigint;
        note: string | null;
        cancel_reason: string | null;
        recorded_at: Date;
        cancelled_at: Date | null;
        recorded_by_employee_id: string;
      }[]
    >`SELECT * FROM "internal_cost_entries" WHERE "id" = ${id}::uuid FOR UPDATE`;

    if (!row) return null;

    return tx.internalCostEntry.findUnique({
      where: { id },
      include: {
        application: { select: { id: true, name: true } },
        costCenter: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async cancel(tx: DbTx, id: string, cancelReason: string, cancelledAt: Date): Promise<InternalCostRow> {
    return tx.internalCostEntry.update({
      where: { id },
      data: {
        cancelReason,
        cancelledAt,
      },
      include: {
        application: { select: { id: true, name: true } },
        costCenter: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async findById(id: string, tx?: DbTx): Promise<InternalCostRow | null> {
    const db = tx ?? this.prisma;
    return db.internalCostEntry.findUnique({
      where: { id },
      include: {
        application: { select: { id: true, name: true } },
        costCenter: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async findList(filter: InternalCostListQueryFilter, tx?: DbTx): Promise<{ items: InternalCostRow[]; total: number }> {
    const db = tx ?? this.prisma;
    const where: Prisma.InternalCostEntryWhereInput = {};

    if (filter.costCenterIds && filter.costCenterIds.length > 0) {
      where.costCenterId = { in: filter.costCenterIds };
    }
    if (filter.applicationId) {
      where.applicationId = filter.applicationId;
    }
    if (filter.periodFrom) {
      where.periodEnd = { gte: toDateColumn(filter.periodFrom) };
    }
    if (filter.periodTo) {
      where.periodStart = { lte: toDateColumn(filter.periodTo) };
    }
    if (filter.status === 'ACTIVE') {
      where.cancelledAt = null;
    } else if (filter.status === 'CANCELLED') {
      where.cancelledAt = { not: null };
    }

    const items = await db.internalCostEntry.findMany({
      where,
      include: {
        application: { select: { id: true, name: true } },
        costCenter: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ periodStart: 'desc' }, { id: 'desc' }],
      skip: filter.skip,
      take: filter.take,
    });
    const total = await db.internalCostEntry.count({ where });

    return { items, total };
  }
}
