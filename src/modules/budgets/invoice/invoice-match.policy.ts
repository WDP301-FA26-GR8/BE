import { heldOf, type CommitmentRow } from '../budget/commitment-release.policy';

export type InvoiceMatchRefusal =
  'INVOICE_NOT_MATCHABLE' | 'LINE_ALREADY_MATCHED' | 'COMMITMENT_NOT_HELD' | 'YEAR_MISMATCH' | 'VENDOR_MISMATCH';

export interface InvoiceMatchInvoice {
  kind: string;
  vendorId: string;
}

export interface InvoiceMatchLine {
  costReportingMinor: bigint;
  fiscalYear: number;
  alreadyMatched: boolean;
}

export interface InvoiceMatchCommitment {
  state: string;
  year: number;
  amountMinor: bigint;
  releasedMinor: bigint;
  realizedMinor: bigint;
}

export interface InvoiceMatchInput {
  invoice: InvoiceMatchInvoice;
  line: InvoiceMatchLine;
  commitment: InvoiceMatchCommitment | CommitmentRow;
  commitmentVendorId: string | null;
}

export type InvoiceMatchPlan = { ok: true; matchedMinor: bigint } | { ok: false; refusal: InvoiceMatchRefusal };

export type InvoiceMatchDecision = InvoiceMatchPlan;

/**
 * Pure policy for matching an invoice line against a budget commitment (US-06-06, US-12-02, F-09, F-10, F-21, F-22).
 * Refusal conditions are evaluated strictly in order:
 * 1. Invoice is CREDIT_NOTE or line.costReportingMinor <= 0 -> INVOICE_NOT_MATCHABLE
 * 2. Line is already matched -> LINE_ALREADY_MATCHED
 * 3. Commitment state is not HELD -> COMMITMENT_NOT_HELD
 * 4. Line fiscalYear !== commitment.year -> YEAR_MISMATCH
 * 5. Commitment vendor is known and differs from invoice vendor -> VENDOR_MISMATCH
 *
 * Matched amount is min(line.costReportingMinor, heldOf(commitment)).
 * Any excess cost remains actual spend and does not open a new commitment.
 */
export function matchInvoiceLine(input: InvoiceMatchInput): InvoiceMatchDecision {
  if (input.invoice.kind === 'CREDIT_NOTE' || input.line.costReportingMinor <= 0n) {
    return { ok: false, refusal: 'INVOICE_NOT_MATCHABLE' };
  }
  if (input.line.alreadyMatched) {
    return { ok: false, refusal: 'LINE_ALREADY_MATCHED' };
  }
  if (input.commitment.state !== 'HELD') {
    return { ok: false, refusal: 'COMMITMENT_NOT_HELD' };
  }
  if (input.line.fiscalYear !== input.commitment.year) {
    return { ok: false, refusal: 'YEAR_MISMATCH' };
  }
  if (input.commitmentVendorId !== null && input.commitmentVendorId !== input.invoice.vendorId) {
    return { ok: false, refusal: 'VENDOR_MISMATCH' };
  }

  const held = heldOf(input.commitment as CommitmentRow);
  const matchedMinor = input.line.costReportingMinor < held ? input.line.costReportingMinor : held;

  return { ok: true, matchedMinor };
}

export const planInvoiceMatch = matchInvoiceLine;
