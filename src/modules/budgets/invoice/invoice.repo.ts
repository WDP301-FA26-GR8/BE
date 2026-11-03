import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { Injectable } from '@nestjs/common';
import { toDateColumn } from '../../../core/business-date';
import { formatRate } from '../../../core/money/rate';
import { Prisma } from '../../../generated/prisma/client';
import type { DbTx } from '../../../infrastructure/database/transaction-runner';
import { isUniqueViolation } from '../../../infrastructure/database/unique-violation';
import { InvoiceDuplicateError } from './invoice.errors';
import { InvoiceReferenceInvalidError } from './invoice-record.errors';
import type { InvoiceMoney, NewInvoice, NewInvoiceLine, NewInvoiceTaxLine } from './invoice.types';

function moneyColumns({ money, snapshot }: InvoiceMoney) {
  return {
    amountMinor: money.amountMinor,
    amountCurrency: money.currency,
    amountRate: formatRate(snapshot.rate),
    amountRateDate: toDateColumn(snapshot.rateDate),
    amountRateSource: snapshot.rateSource,
    amountReportingMinor: snapshot.reportingAmountMinor,
  };
}

/** All invoice persistence uses the caller's transaction, including the header's unique constraint. */
@Injectable()
export class InvoiceRepo {
  constructor(private readonly prisma: PrismaService) {}
  async insert(tx: DbTx, input: NewInvoice): Promise<{ id: string }> {
    try {
      return await tx.invoice.create({
        data: {
          organizationId: input.organizationId,
          vendorId: input.vendorId,
          contractId: input.contractId,
          invoiceNumber: input.invoiceNumber,
          kind: 'INVOICE',
          invoiceDate: toDateColumn(input.invoiceDate),
          recordedByEmployeeId: input.recordedByEmployeeId,
          reconciliationStatus: 'NONE',
          ...moneyColumns(input),
        },
        select: { id: true },
      });
    } catch (error) {
      if (isUniqueViolation(error, 'invoiceNumber', 'invoice_number')) throw new InvoiceDuplicateError();
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new InvoiceReferenceInvalidError();
      }
      throw error;
    }
  }

  async insertLines(tx: DbTx, invoiceId: string, lines: readonly NewInvoiceLine[]): Promise<void> {
    await tx.invoiceLine.createMany({
      data: lines.map(({ servicePeriodStart, servicePeriodEnd, ...line }) => ({
        ...line,
        invoiceId,
        servicePeriodStart: servicePeriodStart ? toDateColumn(servicePeriodStart) : null,
        servicePeriodEnd: servicePeriodEnd ? toDateColumn(servicePeriodEnd) : null,
      })),
    });
  }

  async insertTaxLines(tx: DbTx, invoiceId: string, lines: readonly NewInvoiceTaxLine[]): Promise<void> {
    if (lines.length === 0) return;
    await tx.invoiceTaxLine.createMany({
      data: lines.map(({ money, snapshot, ...line }) => ({
        ...line,
        invoiceId,
        cardFeeOrFx: false,
        ...moneyColumns({ money, snapshot }),
      })),
    });
  }

  async lockInvoice(
    tx: DbTx,
    id: string,
  ): Promise<{
    id: string;
    organizationId: string;
    vendorId: string;
    kind: 'INVOICE' | 'CREDIT_NOTE';
    invoiceDate: Date;
    amountReportingMinor: bigint;
  } | null> {
    const locked = await tx.$queryRaw<
      {
        id: string;
        organization_id: string;
        vendor_id: string;
        kind: string;
        invoice_date: Date;
        amount_reporting_minor: bigint;
      }[]
    >`
      SELECT id, organization_id, vendor_id, kind, invoice_date, amount_reporting_minor
      FROM invoices WHERE id = ${id}::uuid FOR UPDATE
    `;
    if (locked.length === 0) return null;
    return {
      id: locked[0].id,
      organizationId: locked[0].organization_id,
      vendorId: locked[0].vendor_id,
      kind: locked[0].kind as 'INVOICE' | 'CREDIT_NOTE',
      invoiceDate: locked[0].invoice_date,
      amountReportingMinor: BigInt(locked[0].amount_reporting_minor),
    };
  }

  async findLine(
    tx: DbTx,
    invoiceId: string,
    position: number,
  ): Promise<{
    id: string;
    invoiceId: string;
    position: number;
    costCenterId: string | null;
    fiscalYear: number;
    costReportingMinor: bigint;
    realizationId: string | null;
  } | null> {
    const line = await tx.invoiceLine.findUnique({
      where: { invoiceId_position: { invoiceId, position } },
      select: {
        id: true,
        invoiceId: true,
        position: true,
        costCenterId: true,
        fiscalYear: true,
        costReportingMinor: true,
        realization: { select: { id: true } },
      },
    });
    if (!line) return null;
    return {
      id: line.id,
      invoiceId: line.invoiceId,
      position: line.position,
      costCenterId: line.costCenterId,
      fiscalYear: line.fiscalYear,
      costReportingMinor: line.costReportingMinor,
      realizationId: line.realization?.id ?? null,
    };
  }

  async findLines(
    tx: DbTx,
    invoiceId: string,
  ): Promise<
    Array<{
      id: string;
      invoiceId: string;
      position: number;
      costCenterId: string | null;
      fiscalYear: number;
      costReportingMinor: bigint;
      realizationId: string | null;
    }>
  > {
    const lines = await tx.invoiceLine.findMany({
      where: { invoiceId },
      select: {
        id: true,
        invoiceId: true,
        position: true,
        costCenterId: true,
        fiscalYear: true,
        costReportingMinor: true,
        realization: { select: { id: true } },
      },
      orderBy: { position: 'asc' },
    });
    return lines.map((line) => ({
      id: line.id,
      invoiceId: line.invoiceId,
      position: line.position,
      costCenterId: line.costCenterId,
      fiscalYear: line.fiscalYear,
      costReportingMinor: line.costReportingMinor,
      realizationId: line.realization?.id ?? null,
    }));
  }

  async setLineCostCenterIfNull(tx: DbTx, lineId: string, costCenterId: string): Promise<boolean> {
    const updated = await tx.invoiceLine.updateMany({
      where: { id: lineId, costCenterId: null },
      data: { costCenterId },
    });
    return updated.count > 0;
  }

  async findInvoice(id: string, tx?: DbTx): Promise<{ id: string; amountCurrency: string } | null> {
    return (tx ?? this.prisma).invoice.findUnique({
      where: { id },
      select: { id: true, amountCurrency: true },
    });
  }

  async findTaxLine(
    tx: DbTx,
    invoiceId: string,
    position: number,
  ): Promise<{ invoiceId: string; position: number; payer: string; proofDocumentId: string | null } | null> {
    return tx.invoiceTaxLine.findUnique({
      where: { invoiceId_position: { invoiceId, position } },
      select: { invoiceId: true, position: true, payer: true, proofDocumentId: true },
    });
  }

  async findTaxLineFull(
    tx: DbTx,
    invoiceId: string,
    position: number,
  ): Promise<{
    invoiceId: string;
    position: number;
    taxType: string;
    rateBp: number;
    amountMinor: bigint;
    amountCurrency: string;
    amountReportingMinor: bigint;
    payer: 'VENDOR_COLLECTS' | 'BUYER_REMITS';
    deductible: boolean;
    note: string | null;
    proofDocumentId: string | null;
  } | null> {
    const row = await tx.invoiceTaxLine.findUnique({
      where: { invoiceId_position: { invoiceId, position } },
    });
    if (!row) return null;
    return {
      invoiceId: row.invoiceId,
      position: row.position,
      taxType: row.taxType,
      rateBp: row.rateBp,
      amountMinor: row.amountMinor,
      amountCurrency: row.amountCurrency,
      amountReportingMinor: row.amountReportingMinor,
      payer: row.payer,
      deductible: row.deductible,
      note: row.note,
      proofDocumentId: row.proofDocumentId,
    };
  }

  async findTaxLines(
    tx: DbTx,
    invoiceId: string,
  ): Promise<
    Array<{
      invoiceId: string;
      position: number;
      taxType: string;
      rateBp: number;
      amountMinor: bigint;
      amountCurrency: string;
      amountReportingMinor: bigint;
      payer: 'VENDOR_COLLECTS' | 'BUYER_REMITS';
      deductible: boolean;
      note: string | null;
      proofDocumentId: string | null;
    }>
  > {
    const rows = await tx.invoiceTaxLine.findMany({
      where: { invoiceId },
      orderBy: { position: 'asc' },
    });
    return rows.map((row) => ({
      invoiceId: row.invoiceId,
      position: row.position,
      taxType: row.taxType,
      rateBp: row.rateBp,
      amountMinor: row.amountMinor,
      amountCurrency: row.amountCurrency,
      amountReportingMinor: row.amountReportingMinor,
      payer: row.payer,
      deductible: row.deductible,
      note: row.note,
      proofDocumentId: row.proofDocumentId,
    }));
  }

  async upsertTaxLine(tx: DbTx, invoiceId: string, position: number, line: NewInvoiceTaxLine): Promise<void> {
    const data = {
      taxType: line.taxType,
      rateBp: line.rateBp,
      payer: line.payer,
      deductible: line.deductible,
      note: line.note,
      cardFeeOrFx: false,
      ...moneyColumns({ money: line.money, snapshot: line.snapshot }),
    };
    await tx.invoiceTaxLine.upsert({
      where: { invoiceId_position: { invoiceId, position } },
      create: {
        invoiceId,
        position,
        ...data,
      },
      update: data,
    });
  }

  async findLinesForCostRecalc(
    tx: DbTx,
    invoiceId: string,
  ): Promise<Array<{ id: string; position: number; amountMinor: bigint }>> {
    return tx.invoiceLine.findMany({
      where: { invoiceId },
      select: { id: true, position: true, amountMinor: true },
      orderBy: { position: 'asc' },
    });
  }

  async updateLineCosts(
    tx: DbTx,
    lines: Array<{ id: string; costReportingMinor: bigint; deductibleVatReportingMinor: bigint }>,
  ): Promise<void> {
    for (const line of lines) {
      await tx.invoiceLine.update({
        where: { id: line.id },
        data: {
          costReportingMinor: line.costReportingMinor,
          deductibleVatReportingMinor: line.deductibleVatReportingMinor,
        },
      });
    }
  }

  async findMatches(
    invoiceId: string,
    query?: { skip?: number; take?: number },
    tx?: DbTx,
  ): Promise<{
    items: Array<{
      id: string;
      commitmentId: string;
      invoiceLineId: string;
      position: number;
      amountMinor: bigint;
      recordedAt: Date;
      recordedByEmployeeId: string;
    }>;
    total: number;
  }> {
    const db = tx ?? this.prisma;
    const where = { invoiceLine: { invoiceId } };
    const rows = await db.commitmentRealization.findMany({
      where,
      select: {
        id: true,
        commitmentId: true,
        invoiceLineId: true,
        amountMinor: true,
        recordedAt: true,
        recordedByEmployeeId: true,
        invoiceLine: { select: { position: true } },
      },
      orderBy: { invoiceLine: { position: 'asc' } },
      skip: query?.skip,
      take: query?.take,
    });
    const total = await db.commitmentRealization.count({ where });
    return {
      items: rows.map((r) => ({
        id: r.id,
        commitmentId: r.commitmentId,
        invoiceLineId: r.invoiceLineId,
        position: r.invoiceLine.position,
        amountMinor: r.amountMinor,
        recordedAt: r.recordedAt,
        recordedByEmployeeId: r.recordedByEmployeeId,
      })),
      total,
    };
  }

  async linkProofDocument(tx: DbTx, invoiceId: string, position: number, proofDocumentId: string): Promise<void> {
    await tx.invoiceTaxLine.update({
      where: { invoiceId_position: { invoiceId, position } },
      data: { proofDocumentId },
    });
  }

  async pageInvoices(
    filter: {
      vendorId?: string;
      from?: string;
      to?: string;
      reconciliationStatus?: 'NONE' | 'PARTIAL' | 'FULL';
      skip: number;
      take: number;
    },
    tx?: DbTx,
  ) {
    const where: Prisma.InvoiceWhereInput = {
      ...(filter.vendorId ? { vendorId: filter.vendorId } : {}),
      ...(filter.reconciliationStatus ? { reconciliationStatus: filter.reconciliationStatus } : {}),
      ...(filter.from || filter.to
        ? {
            invoiceDate: {
              ...(filter.from ? { gte: toDateColumn(filter.from) } : {}),
              ...(filter.to ? { lte: toDateColumn(filter.to) } : {}),
            },
          }
        : {}),
    };
    if (!tx) {
      const [items, total] = await this.prisma.$transaction(
        [
          this.prisma.invoice.findMany({
            where,
            orderBy: [{ invoiceDate: 'desc' }, { id: 'desc' }],
            skip: filter.skip,
            take: filter.take,
          }),
          this.prisma.invoice.count({ where }),
        ],
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
      return { items, total };
    }
    const items = await tx.invoice.findMany({
      where,
      orderBy: [{ invoiceDate: 'desc' }, { id: 'desc' }],
      skip: filter.skip,
      take: filter.take,
    });
    const total = await tx.invoice.count({ where });
    return { items, total };
  }

  async findInvoiceDetail(id: string, tx?: DbTx) {
    return (tx ?? this.prisma).invoice.findUnique({
      where: { id },
      include: {
        taxLines: { orderBy: { position: 'asc' } },
      },
    });
  }

  async pageInvoiceLines(invoiceId: string, skip: number, take: number, tx?: DbTx) {
    const where = { invoiceId };
    if (!tx) {
      const [items, total] = await this.prisma.$transaction(
        [
          this.prisma.invoiceLine.findMany({
            where,
            orderBy: { position: 'asc' },
            skip,
            take,
            include: { realization: { select: { id: true } } },
          }),
          this.prisma.invoiceLine.count({ where }),
        ],
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
      return { items, total };
    }
    const items = await tx.invoiceLine.findMany({
      where,
      orderBy: { position: 'asc' },
      skip,
      take,
      include: { realization: { select: { id: true } } },
    });
    const total = await tx.invoiceLine.count({ where });
    return { items, total };
  }

  async pageInvoiceTaxLines(invoiceId: string, skip: number, take: number, tx?: DbTx) {
    const where = { invoiceId };
    if (!tx) {
      const [items, total] = await this.prisma.$transaction(
        [
          this.prisma.invoiceTaxLine.findMany({
            where,
            orderBy: { position: 'asc' },
            skip,
            take,
          }),
          this.prisma.invoiceTaxLine.count({ where }),
        ],
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
      return { items, total };
    }
    const items = await tx.invoiceTaxLine.findMany({
      where,
      orderBy: { position: 'asc' },
      skip,
      take,
    });
    const total = await tx.invoiceTaxLine.count({ where });
    return { items, total };
  }
}
