import { z } from 'zod';
import { businessDate, responseBusinessDate } from '../../../infrastructure/http/dto/business-date.dto';
import { successEnvelopeSchema } from '../../../infrastructure/http/dto/success-envelope.dto';
import { createZodDto } from '../../../infrastructure/http/dto/zod-dto';

const decimal = z
  .string()
  .max(40)
  .refine((value) => /^-?\d+(?:\.\d+)?$/.test(value), 'Must be a plain decimal string.');
const nonnegative = z
  .string()
  .max(40)
  .refine((value) => /^\d+(?:\.\d+)?$/.test(value), 'Must be a nonnegative decimal string.');
const money = z.strictObject({ amount: nonnegative, currency: z.string().regex(/^[A-Z]{3}$/) });
export const moneyView = z.strictObject({ amount: z.string(), currency: z.string() });

const line = z
  .strictObject({
    commitmentId: z.uuid().optional(),
    subscriptionId: z.uuid().optional(),
    outOfCatalog: z.boolean().default(false),
    description: z.string().trim().min(1).max(2000),
    amount: decimal.describe('A decimal amount in the invoice currency; discounts may be negative.'),
    billedQuantity: z.number().int().nonnegative().max(2147483647).optional(),
    unitPrice: nonnegative.optional(),
    servicePeriodStart: businessDate.optional(),
    servicePeriodEnd: businessDate.optional(),
  })
  .refine((value) => Boolean(value.subscriptionId) !== value.outOfCatalog, {
    message: 'Choose a subscription or mark the line as out of catalog.',
  })
  .refine(
    (value) =>
      !value.servicePeriodStart || !value.servicePeriodEnd || value.servicePeriodStart <= value.servicePeriodEnd,
    {
      message: 'The service period must end on or after its start.',
    },
  );

const taxLine = z.strictObject({
  taxType: z.string().trim().min(1).max(100),
  rateBp: z.number().int().min(0).max(10000),
  amount: money,
  payer: z.enum(['VENDOR_COLLECTS', 'BUYER_REMITS']),
  deductible: z.boolean(),
  note: z.string().trim().max(2000).optional(),
});

export const recordInvoiceSchema = z.strictObject({
  vendorId: z.uuid(),
  contractId: z.uuid().optional(),
  invoiceNumber: z.string().trim().min(1).max(200),
  invoiceDate: businessDate,
  amount: money,
  lines: z.array(line).min(1).max(500),
  taxLines: z.array(taxLine).max(100),
});

export type RecordInvoiceInput = z.infer<typeof recordInvoiceSchema>;
export class RecordInvoiceBodyDto extends createZodDto(recordInvoiceSchema) {}
export class RecordInvoiceResponseDto extends createZodDto(successEnvelopeSchema(z.strictObject({ id: z.uuid() }))) {}

export const invoiceIdParamSchema = z.strictObject({ id: z.uuid() });
export class InvoiceIdParamDto extends createZodDto(invoiceIdParamSchema) {}

export const attachInvoiceDocumentBodySchema = z.strictObject({
  documentId: z.uuid(),
  taxLinePosition: z.number().int().min(1).max(32767).optional(),
});
export class AttachInvoiceDocumentBodyDto extends createZodDto(attachInvoiceDocumentBodySchema) {}

export const invoiceDocumentSchema = z.strictObject({
  id: z.uuid(),
  purpose: z.string(),
  status: z.string(),
  fileName: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int().positive(),
  uploadedBy: z.uuid(),
  createdAt: z.iso.datetime(),
  contractId: z.uuid().nullable(),
  invoiceId: z.uuid().nullable(),
  attachedAt: z.iso.datetime().nullable(),
});

export const attachInvoiceDocumentResponseSchema = successEnvelopeSchema(
  z.strictObject({ document: invoiceDocumentSchema }),
);
export class AttachInvoiceDocumentResponseDto extends createZodDto(attachInvoiceDocumentResponseSchema) {}

export const listInvoiceDocumentsQuerySchema = z.strictObject({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export class ListInvoiceDocumentsQueryDto extends createZodDto(listInvoiceDocumentsQuerySchema) {}

const paginationSchema = z.strictObject({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export const listInvoiceDocumentsResponseSchema = successEnvelopeSchema(
  z.strictObject({
    items: z.array(invoiceDocumentSchema),
    pagination: paginationSchema,
  }),
);
export class ListInvoiceDocumentsResponseDto extends createZodDto(listInvoiceDocumentsResponseSchema) {}

export const invoiceLineParamSchema = z.strictObject({
  id: z.uuid(),
  position: z.coerce.number().int().min(1).max(32767),
});
export class InvoiceLineParamDto extends createZodDto(invoiceLineParamSchema) {}

export const matchCommitmentBodySchema = z.strictObject({
  commitmentId: z.uuid(),
});
export class MatchCommitmentBodyDto extends createZodDto(matchCommitmentBodySchema) {}

export const commitmentMatchResponseSchema = successEnvelopeSchema(
  z.strictObject({
    commitmentId: z.uuid(),
    invoiceId: z.uuid(),
    invoiceLineId: z.uuid(),
    position: z.number().int(),
    matched: moneyView,
    held: moneyView,
    expensed: z.boolean(),
  }),
);
export class CommitmentMatchResponseDto extends createZodDto(commitmentMatchResponseSchema) {}

export const updateInvoiceTaxLineBodySchema = z.strictObject({
  taxType: z.string().trim().min(1).max(100),
  rateBp: z.number().int().min(0).max(10000),
  amount: money,
  payer: z.enum(['VENDOR_COLLECTS', 'BUYER_REMITS']),
  deductible: z.boolean(),
  note: z.string().trim().max(2000).optional(),
});
export type UpdateInvoiceTaxLineInput = z.infer<typeof updateInvoiceTaxLineBodySchema>;
export class UpdateInvoiceTaxLineBodyDto extends createZodDto(updateInvoiceTaxLineBodySchema) {}

export const updateInvoiceTaxLineResponseSchema = successEnvelopeSchema(
  z.strictObject({
    position: z.number().int(),
    taxType: z.string(),
    rateBp: z.number().int(),
    amount: moneyView,
    amountReporting: moneyView,
    payer: z.enum(['VENDOR_COLLECTS', 'BUYER_REMITS']),
    deductible: z.boolean(),
    note: z.string().nullable(),
  }),
);
export class UpdateInvoiceTaxLineResponseDto extends createZodDto(updateInvoiceTaxLineResponseSchema) {}

export const listCommitmentMatchesQuerySchema = z.strictObject({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export class ListCommitmentMatchesQueryDto extends createZodDto(listCommitmentMatchesQuerySchema) {}

export const commitmentMatchItemSchema = z.strictObject({
  id: z.uuid(),
  commitmentId: z.uuid(),
  invoiceLineId: z.uuid(),
  position: z.number().int(),
  amount: moneyView,
  recordedAt: z.iso.datetime(),
  recordedByEmployeeId: z.uuid(),
});

export const listCommitmentMatchesResponseSchema = successEnvelopeSchema(
  z.strictObject({
    items: z.array(commitmentMatchItemSchema),
    pagination: paginationSchema,
  }),
);
export class ListCommitmentMatchesResponseDto extends createZodDto(listCommitmentMatchesResponseSchema) {}

export const listInvoicesQuerySchema = z.strictObject({
  vendorId: z.uuid().optional(),
  from: businessDate.optional(),
  to: businessDate.optional(),
  reconciliationStatus: z.enum(['NONE', 'PARTIAL', 'FULL']).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export class ListInvoicesQueryDto extends createZodDto(listInvoicesQuerySchema) {}

export const invoiceSummarySchema = z.strictObject({
  id: z.uuid(),
  vendorId: z.uuid(),
  contractId: z.uuid().nullable(),
  creditedInvoiceId: z.uuid().nullable(),
  invoiceNumber: z.string(),
  kind: z.enum(['INVOICE', 'CREDIT_NOTE']),
  invoiceDate: responseBusinessDate,
  amount: moneyView,
  amountReporting: moneyView,
  reconciliationStatus: z.enum(['NONE', 'PARTIAL', 'FULL']),
  recordedAt: z.iso.datetime(),
  recordedByEmployeeId: z.uuid(),
});

export const listInvoicesResponseSchema = successEnvelopeSchema(
  z.strictObject({
    items: z.array(invoiceSummarySchema),
    pagination: paginationSchema,
  }),
);
export class ListInvoicesResponseDto extends createZodDto(listInvoicesResponseSchema) {}

export const invoiceDetailSchema = z.strictObject({
  id: z.uuid(),
  vendorId: z.uuid(),
  contractId: z.uuid().nullable(),
  creditedInvoiceId: z.uuid().nullable(),
  invoiceNumber: z.string(),
  kind: z.enum(['INVOICE', 'CREDIT_NOTE']),
  invoiceDate: responseBusinessDate,
  amount: moneyView,
  amountReporting: moneyView,
  amountRate: z.string(),
  amountRateDate: responseBusinessDate,
  amountRateSource: z.string(),
  effectiveCost: moneyView,
  deductibleVat: moneyView,
  reconciliationStatus: z.enum(['NONE', 'PARTIAL', 'FULL']),
  recordedAt: z.iso.datetime(),
  recordedByEmployeeId: z.uuid(),
});

export const invoiceDetailResponseSchema = successEnvelopeSchema(z.strictObject({ invoice: invoiceDetailSchema }));
export class InvoiceDetailResponseDto extends createZodDto(invoiceDetailResponseSchema) {}

export const listInvoiceLinesQuerySchema = z.strictObject({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export class ListInvoiceLinesQueryDto extends createZodDto(listInvoiceLinesQuerySchema) {}

export const invoiceLineViewSchema = z.strictObject({
  id: z.uuid(),
  position: z.number().int(),
  subscriptionId: z.uuid().nullable(),
  description: z.string(),
  outOfCatalog: z.boolean(),
  billedQuantity: z.number().int().nullable(),
  unitPrice: moneyView.nullable(),
  servicePeriodStart: responseBusinessDate.nullable(),
  servicePeriodEnd: responseBusinessDate.nullable(),
  amount: moneyView,
  amountReporting: moneyView,
  costReporting: moneyView,
  deductibleVatReporting: moneyView,
  costCenterId: z.uuid().nullable(),
  fiscalYear: z.number().int(),
  realizationId: z.uuid().nullable(),
});

export const listInvoiceLinesResponseSchema = successEnvelopeSchema(
  z.strictObject({
    items: z.array(invoiceLineViewSchema),
    pagination: paginationSchema,
  }),
);
export class ListInvoiceLinesResponseDto extends createZodDto(listInvoiceLinesResponseSchema) {}

export const listInvoiceTaxLinesQuerySchema = z.strictObject({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export class ListInvoiceTaxLinesQueryDto extends createZodDto(listInvoiceTaxLinesQuerySchema) {}

export const invoiceTaxLineViewSchema = z.strictObject({
  position: z.number().int(),
  taxType: z.string(),
  rateBp: z.number().int(),
  amount: moneyView,
  amountReporting: moneyView,
  amountRate: z.string(),
  amountRateDate: responseBusinessDate,
  amountRateSource: z.string(),
  payer: z.enum(['VENDOR_COLLECTS', 'BUYER_REMITS']),
  deductible: z.boolean(),
  note: z.string().nullable(),
  proofDocumentId: z.uuid().nullable(),
});

export const listInvoiceTaxLinesResponseSchema = successEnvelopeSchema(
  z.strictObject({
    items: z.array(invoiceTaxLineViewSchema),
    pagination: paginationSchema,
  }),
);
export class ListInvoiceTaxLinesResponseDto extends createZodDto(listInvoiceTaxLinesResponseSchema) {}
