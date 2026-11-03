import { z } from 'zod';
import { businessDate, responseBusinessDate } from '../../../infrastructure/http/dto/business-date.dto';
import { successEnvelopeSchema } from '../../../infrastructure/http/dto/success-envelope.dto';
import { createZodDto } from '../../../infrastructure/http/dto/zod-dto';

const positiveDecimal = z
  .string()
  .max(40)
  .refine((value) => /^(?:0\.\d*[1-9]\d*|[1-9]\d*(?:\.\d+)?)$/.test(value), 'Must be a positive decimal string.');

export const recordInternalCostSchema = z
  .strictObject({
    applicationId: z.string().uuid(),
    costCenterId: z.string().uuid(),
    amount: positiveDecimal,
    currency: z.string().regex(/^[A-Z]{3}$/),
    periodStart: businessDate,
    periodEnd: businessDate,
    note: z.string().trim().max(2000).optional(),
  })
  .refine((data) => data.periodEnd >= data.periodStart, {
    message: 'The end date of the period must not precede the start date.',
    path: ['periodEnd'],
  });

export class RecordInternalCostDto extends createZodDto(recordInternalCostSchema) {}
export class RecordInternalCostBodyDto extends RecordInternalCostDto {}

export const cancelInternalCostSchema = z.strictObject({
  reason: z.string().trim().min(1, 'Reason must not be empty').max(500),
});

export class CancelInternalCostDto extends createZodDto(cancelInternalCostSchema) {}
export class CancelInternalCostBodyDto extends CancelInternalCostDto {}

export const internalCostFilterSchema = z.strictObject({
  costCenterId: z.string().uuid().optional(),
  applicationId: z.string().uuid().optional(),
  periodFrom: businessDate.optional(),
  periodTo: businessDate.optional(),
  status: z.enum(['ALL', 'ACTIVE', 'CANCELLED']).default('ACTIVE'),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export class InternalCostFilterDto extends createZodDto(internalCostFilterSchema) {}
export class ListInternalCostsQueryDto extends InternalCostFilterDto {}

export const paginationSchema = z.strictObject({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export const internalCostSummarySchema = z.strictObject({
  id: z.string().uuid(),
  applicationId: z.string().uuid(),
  applicationName: z.string(),
  costCenterId: z.string().uuid(),
  costCenterCode: z.string(),
  amount: z.string(),
  currency: z.string(),
  amountReporting: z.string(),
  reportingCurrency: z.string(),
  periodStart: responseBusinessDate,
  periodEnd: responseBusinessDate,
  recordedAt: z.string(),
  cancelledAt: z.string().nullable(),
});

export type InternalCostSummary = z.infer<typeof internalCostSummarySchema>;

export const internalCostDetailSchema = z.strictObject({
  id: z.string().uuid(),
  applicationId: z.string().uuid(),
  applicationName: z.string(),
  costCenterId: z.string().uuid(),
  costCenterCode: z.string(),
  costCenterName: z.string(),
  amount: z.string(),
  currency: z.string(),
  amountReporting: z.string(),
  reportingCurrency: z.string(),
  amountRate: z.string(),
  amountRateDate: responseBusinessDate,
  amountRateSource: z.string(),
  periodStart: responseBusinessDate,
  periodEnd: responseBusinessDate,
  note: z.string().nullable(),
  cancelReason: z.string().nullable(),
  recordedAt: z.string(),
  cancelledAt: z.string().nullable(),
  recordedByEmployeeId: z.string().uuid(),
});

export type InternalCostDetail = z.infer<typeof internalCostDetailSchema>;

export const internalCostListResponseSchema = successEnvelopeSchema(
  z.strictObject({
    items: z.array(internalCostSummarySchema),
    pagination: paginationSchema,
  }),
);

export const internalCostItemResponseSchema = successEnvelopeSchema(internalCostDetailSchema);

export class InternalCostIdParamDto extends createZodDto(z.strictObject({ id: z.string().uuid() })) {}
export class RecordInternalCostResponseDto extends createZodDto(internalCostItemResponseSchema) {}
export class CancelInternalCostResponseDto extends createZodDto(internalCostItemResponseSchema) {}
export class InternalCostDetailResponseDto extends createZodDto(internalCostItemResponseSchema) {}
export class ListInternalCostsResponseDto extends createZodDto(internalCostListResponseSchema) {}
