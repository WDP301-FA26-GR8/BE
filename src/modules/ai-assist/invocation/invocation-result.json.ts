import { z } from 'zod';
import { jsonColumn } from '../../../infrastructure/database/json-column';
import { SOURCE_REF_PATTERN, STEP_KINDS } from '../ai-service/ai-service.types';

/*
 * `ai_invocation_results.result`, the result the checks of the backend kept for the summary of a queue (`US-15-05`). It stays in
 * PostgreSQL: the summary of the owner is built from it on every GET. What was sent to the model and what it answered is the raw
 * history in MongoDB (`invocation-history/`). Written in exactly the shape it is read in, the shape the old
 * `ai_invocation_contents.result` had.
 */

const sourceRef = z.string().regex(SOURCE_REF_PATTERN);

/**
 * What the checks of the backend kept of an answer: how many steps waited when the summary was composed, the step and request each
 * reference stood for (real ids stay in the backend), the lines that passed with the cost written in, and why each other line was
 * rejected.
 */
const resultSchema = z.strictObject({
  total: z.number().int().nonnegative(),
  steps: z.array(
    z.strictObject({
      sourceRef,
      stepId: z.string().min(1),
      requestId: z.string().min(1),
      stepKind: z.enum(STEP_KINDS),
    }),
  ),
  accepted: z.array(z.strictObject({ sourceRef, summary: z.string() })),
  rejections: z.array(z.strictObject({ sourceRef, code: z.string().regex(/^[A-Z][A-Z_]*$/) })),
});
export type InvocationResult = z.output<typeof resultSchema>;

/** `ai_invocation_results.result`: a row exists only once the checks of the backend have run. */
export const aiInvocationResultJson = jsonColumn({
  table: 'ai_invocation_results',
  column: 'result',
  schema: resultSchema,
  encode: (value: InvocationResult) => value,
});
