import { parseArgs } from 'node:util';
import { isBusinessDate } from '../../core/business-date';
import type { AiPurgeCommand } from '../../modules/ai-assist/public/ai-purge.types';

export class AiPurgeArgumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiPurgeArgumentError';
  }
}

export const AI_PURGE_USAGE = `Usage: pnpm ops:ai-purge --through YYYY-MM-DD [--apply --operator <reference>]

Purges the raw history of the AI calls (the context, the prompt, the raw answer, the parsed output, kept in MongoDB) and the result
of their checks (kept in PostgreSQL) for the calls created on or before the end of the day --through (UTC). The calls themselves
(who, when, status, the model that answered) are kept. A call still live (PENDING or RUNNING) is never purged, whatever its date:
the run in progress has still to write it. The cut-off is the operator's: nothing is inferred from a retention period.

The default is a dry run: it counts the histories that would be purged and writes nothing. Nothing is purged without --apply.

Options
  --through <date>         The last day in scope, YYYY-MM-DD (UTC). Required. A day after today is refused.
  --apply                  Purge, instead of counting. Needs --operator.
  --operator <reference>   Who runs the command (a reference, never a password or a token); 1 to 200 characters.
                           Recorded as the operator reference of the Audit Trail event.
  --help

Prints only the cut-off, the mode and counts; never a content. With --apply, PostgreSQL first marks the histories purged, deletes
the results and writes the Audit Trail event (AI_INVOCATION.PURGED: the count and the cut-off) in one transaction: from then on
the content reads as not found. Then MongoDB replaces each history with a tombstone. A tombstone MongoDB did not take stays queued
for the worker and for the next run, which finishes it. Reads the database and MongoDB settings (NODE_ENV, DATABASE_URL, DB_*,
MONGODB_*).

A tombstone MongoDB refused for good is reported as parked: running again does not deliver it; an operator looks at it.

Exit codes: 0 done (purged, or the dry run found work for --apply) · 2 nothing to do · 1 invalid arguments, failed, or
tombstones still pending in MongoDB (run again) or parked.`;

const OPTIONS = {
  through: { type: 'string' },
  apply: { type: 'boolean' },
  operator: { type: 'string' },
  help: { type: 'boolean' },
} as const;

const OPERATOR_MAX_LENGTH = 200;

export type ParsedAiPurgeArguments = { help: true } | { help: false; command: AiPurgeCommand };

/** The calendar day of `now` in UTC, as `YYYY-MM-DD`. */
const dayOf = (now: Date): string => now.toISOString().slice(0, 10);

function throughOf(value: string | boolean | undefined, now: Date): string {
  if (typeof value !== 'string' || value.trim() === '') throw new AiPurgeArgumentError('--through is required.');
  const through = value.trim();
  if (!isBusinessDate(through)) throw new AiPurgeArgumentError('--through must be a real date written YYYY-MM-DD.');
  // `YYYY-MM-DD` dates compare as text.
  if (through > dayOf(now)) throw new AiPurgeArgumentError('--through must not be in the future.');

  return through;
}

function operatorOf(value: string | boolean | undefined, apply: boolean): string | null {
  const operator = typeof value === 'string' ? value.trim() : '';
  if (!apply) return operator === '' ? null : operator;
  if (operator === '') throw new AiPurgeArgumentError('--operator is required with --apply.');
  if (operator.length > OPERATOR_MAX_LENGTH) {
    throw new AiPurgeArgumentError(`--operator must be 1 to ${OPERATOR_MAX_LENGTH} characters.`);
  }

  return operator;
}

/** `--through`, `--apply`, `--operator`, nothing else; a leading `--` (forwarded by pnpm) is ignored. `now` is the clock the future is judged by. */
export function parseAiPurgeArguments(argv: readonly string[], now: Date = new Date()): ParsedAiPurgeArguments {
  const args = argv[0] === '--' ? argv.slice(1) : [...argv];
  let values: Partial<Record<keyof typeof OPTIONS, string | boolean>>;
  try {
    values = parseArgs({ args, options: OPTIONS, allowPositionals: false, strict: true }).values;
  } catch (error) {
    throw new AiPurgeArgumentError(error instanceof Error ? error.message : String(error));
  }
  if (values.help) return { help: true };

  const through = throughOf(values.through, now);
  const apply = values.apply === true;

  return { help: false, command: { through, apply, operator: operatorOf(values.operator, apply) } };
}
