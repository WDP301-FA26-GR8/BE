import type { Money } from '../../../core/money/money';
import type { ConversionSnapshot } from '../../finance/public/finance.types';
import type { RecordInvoiceInput } from './invoice.dto';

export interface InvoiceMoney {
  money: Money;
  snapshot: ConversionSnapshot;
}

export type NewInvoice = Pick<
  RecordInvoiceInput,
  'vendorId' | 'contractId' | 'invoiceNumber' | 'invoiceDate' | 'kind' | 'creditedInvoiceId'
> &
  InvoiceMoney & {
    organizationId: string;
    recordedByEmployeeId: string;
  };

export type NewInvoiceLine = Pick<
  RecordInvoiceInput['lines'][number],
  'subscriptionId' | 'outOfCatalog' | 'description' | 'billedQuantity' | 'servicePeriodStart' | 'servicePeriodEnd'
> & {
  position: number;
  amountMinor: bigint;
  unitPriceMinor: bigint | null;
  amountReportingMinor: bigint;
  costReportingMinor: bigint;
  deductibleVatReportingMinor: bigint;
  costCenterId: string | null;
  fiscalYear: number;
};

export type NewInvoiceTaxLine = Pick<
  RecordInvoiceInput['taxLines'][number],
  'taxType' | 'rateBp' | 'payer' | 'deductible' | 'note'
> &
  InvoiceMoney & { position: number };

export type ParsedInvoiceLine = Omit<
  NewInvoiceLine,
  'amountReportingMinor' | 'costReportingMinor' | 'deductibleVatReportingMinor' | 'costCenterId' | 'fiscalYear'
>;
