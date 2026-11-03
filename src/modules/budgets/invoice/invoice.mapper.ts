import type { z } from 'zod';
import { fromDateColumn } from '../../../core/business-date';
import type { MoneyView } from '../budget/budget-support.service';
import type {
  invoiceDetailSchema,
  invoiceLineViewSchema,
  invoiceSummarySchema,
  invoiceTaxLineViewSchema,
} from './invoice.dto';

export type InvoiceSummaryWire = z.infer<typeof invoiceSummarySchema>;
export type InvoiceDetailWire = z.infer<typeof invoiceDetailSchema>;
export type InvoiceLineWire = z.infer<typeof invoiceLineViewSchema>;
export type InvoiceTaxLineWire = z.infer<typeof invoiceTaxLineViewSchema>;

export function toInvoiceSummaryWire(
  row: {
    id: string;
    vendorId: string;
    contractId: string | null;
    creditedInvoiceId: string | null;
    invoiceNumber: string;
    kind: string;
    invoiceDate: Date;
    amountMinor: bigint;
    amountCurrency: string;
    amountReportingMinor: bigint;
    reconciliationStatus: string;
    recordedAt: Date;
    recordedByEmployeeId: string;
  },
  formatAmount: (minor: bigint) => MoneyView,
  formatReporting: (minor: bigint) => MoneyView,
): InvoiceSummaryWire {
  return {
    id: row.id,
    vendorId: row.vendorId,
    contractId: row.contractId,
    creditedInvoiceId: row.creditedInvoiceId,
    invoiceNumber: row.invoiceNumber,
    kind: row.kind as 'INVOICE' | 'CREDIT_NOTE',
    invoiceDate: fromDateColumn(row.invoiceDate),
    amount: formatAmount(row.amountMinor),
    amountReporting: formatReporting(row.amountReportingMinor),
    reconciliationStatus: row.reconciliationStatus as 'NONE' | 'PARTIAL' | 'FULL',
    recordedAt: row.recordedAt.toISOString(),
    recordedByEmployeeId: row.recordedByEmployeeId,
  };
}

export function toInvoiceDetailWire(
  row: {
    id: string;
    vendorId: string;
    contractId: string | null;
    creditedInvoiceId: string | null;
    invoiceNumber: string;
    kind: string;
    invoiceDate: Date;
    amountMinor: bigint;
    amountCurrency: string;
    amountRate: { toString: () => string };
    amountRateDate: Date;
    amountRateSource: string;
    amountReportingMinor: bigint;
    reconciliationStatus: string;
    recordedAt: Date;
    recordedByEmployeeId: string;
  },
  cost: { effectiveCostMinor: bigint; deductibleVatMinor: bigint },
  formatAmount: (minor: bigint) => MoneyView,
  formatReporting: (minor: bigint) => MoneyView,
): InvoiceDetailWire {
  return {
    id: row.id,
    vendorId: row.vendorId,
    contractId: row.contractId,
    creditedInvoiceId: row.creditedInvoiceId,
    invoiceNumber: row.invoiceNumber,
    kind: row.kind as 'INVOICE' | 'CREDIT_NOTE',
    invoiceDate: fromDateColumn(row.invoiceDate),
    amount: formatAmount(row.amountMinor),
    amountReporting: formatReporting(row.amountReportingMinor),
    amountRate: row.amountRate.toString(),
    amountRateDate: fromDateColumn(row.amountRateDate),
    amountRateSource: row.amountRateSource,
    effectiveCost: formatReporting(cost.effectiveCostMinor),
    deductibleVat: formatReporting(cost.deductibleVatMinor),
    reconciliationStatus: row.reconciliationStatus as 'NONE' | 'PARTIAL' | 'FULL',
    recordedAt: row.recordedAt.toISOString(),
    recordedByEmployeeId: row.recordedByEmployeeId,
  };
}

export function toInvoiceLineWire(
  row: {
    id: string;
    position: number;
    subscriptionId: string | null;
    description: string;
    outOfCatalog: boolean;
    billedQuantity: number | null;
    unitPriceMinor: bigint | null;
    servicePeriodStart: Date | null;
    servicePeriodEnd: Date | null;
    amountMinor: bigint;
    amountReportingMinor: bigint;
    costReportingMinor: bigint;
    deductibleVatReportingMinor: bigint;
    costCenterId: string | null;
    fiscalYear: number;
    realization?: { id: string } | null;
  },
  formatAmount: (minor: bigint) => MoneyView,
  formatReporting: (minor: bigint) => MoneyView,
): InvoiceLineWire {
  return {
    id: row.id,
    position: row.position,
    subscriptionId: row.subscriptionId,
    description: row.description,
    outOfCatalog: row.outOfCatalog,
    billedQuantity: row.billedQuantity,
    unitPrice: row.unitPriceMinor !== null ? formatAmount(row.unitPriceMinor) : null,
    servicePeriodStart: row.servicePeriodStart ? fromDateColumn(row.servicePeriodStart) : null,
    servicePeriodEnd: row.servicePeriodEnd ? fromDateColumn(row.servicePeriodEnd) : null,
    amount: formatAmount(row.amountMinor),
    amountReporting: formatReporting(row.amountReportingMinor),
    costReporting: formatReporting(row.costReportingMinor),
    deductibleVatReporting: formatReporting(row.deductibleVatReportingMinor),
    costCenterId: row.costCenterId,
    fiscalYear: row.fiscalYear,
    realizationId: row.realization?.id ?? null,
  };
}

export function toInvoiceTaxLineWire(
  row: {
    position: number;
    taxType: string;
    rateBp: number;
    amountMinor: bigint;
    amountCurrency: string;
    amountRate: { toString: () => string };
    amountRateDate: Date;
    amountRateSource: string;
    amountReportingMinor: bigint;
    payer: string;
    deductible: boolean;
    note: string | null;
    proofDocumentId: string | null;
  },
  formatAmount: (minor: bigint) => MoneyView,
  formatReporting: (minor: bigint) => MoneyView,
): InvoiceTaxLineWire {
  return {
    position: row.position,
    taxType: row.taxType,
    rateBp: row.rateBp,
    amount: formatAmount(row.amountMinor),
    amountReporting: formatReporting(row.amountReportingMinor),
    amountRate: row.amountRate.toString(),
    amountRateDate: fromDateColumn(row.amountRateDate),
    amountRateSource: row.amountRateSource,
    payer: row.payer as 'VENDOR_COLLECTS' | 'BUYER_REMITS',
    deductible: row.deductible,
    note: row.note,
    proofDocumentId: row.proofDocumentId,
  };
}
