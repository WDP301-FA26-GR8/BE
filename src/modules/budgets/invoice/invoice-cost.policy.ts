export interface InvoiceCostInput {
  kind: 'INVOICE' | 'CREDIT_NOTE';
  amountReportingMinor: bigint;
  taxLines: readonly { amountReportingMinor: bigint; deductible: boolean }[];
  /** Card fees and FX marked at reconciliation (US-12-10 AC-12); zero until statement recording exists. */
  markedFeeReportingMinor: bigint;
}

export interface InvoiceCost {
  effectiveCostMinor: bigint;
  deductibleVatMinor: bigint;
}

export interface InvoiceSplitLine {
  position: number;
  amountMinor: bigint;
}

/** Effective cost and deductible VAT use the recorded reporting amounts (US-12-10 AC-4, AC-6). */
export function invoiceCostOf(input: InvoiceCostInput): InvoiceCost {
  let effectiveCostMinor = input.amountReportingMinor + input.markedFeeReportingMinor;
  let deductibleVatMinor = 0n;
  for (const line of input.taxLines) {
    if (line.deductible) deductibleVatMinor += line.amountReportingMinor;
    else effectiveCostMinor += line.amountReportingMinor;
  }

  const sign = input.kind === 'CREDIT_NOTE' ? -1n : 1n;
  return { effectiveCostMinor: sign * effectiveCostMinor, deductibleVatMinor: sign * deductibleVatMinor };
}

/**
 * Largest-remainder allocation within one invoice (F-23). Positions are unique, as on invoice lines.
 * Negative quotas use floor division so discounts keep a nonnegative fractional remainder.
 * A negative total negates the positive allocation, including its rounding, for credit notes.
 * Zero-sum weights put the total on the first input line. The returned rows keep the input order.
 */
export function splitAcrossLines(
  totalMinor: bigint,
  lines: readonly [InvoiceSplitLine, ...InvoiceSplitLine[]],
): InvoiceSplitLine[] {
  const weightSum = lines.reduce((sum, line) => sum + line.amountMinor, 0n);
  if (weightSum === 0n) {
    return lines.map((line, index) => ({ position: line.position, amountMinor: index === 0 ? totalMinor : 0n }));
  }

  const sign = totalMinor < 0n ? -1n : 1n;
  const magnitude = totalMinor * sign;
  const weightSign = weightSum < 0n ? -1n : 1n;
  const denominator = weightSum * weightSign;
  const allocated = lines.map((line) => {
    const numerator = magnitude * line.amountMinor * weightSign;
    const truncated = numerator / denominator;
    const amountMinor = numerator % denominator < 0n ? truncated - 1n : truncated;
    return {
      position: line.position,
      amountMinor,
      remainder: numerator - amountMinor * denominator,
    };
  });

  let left = magnitude - allocated.reduce((sum, line) => sum + line.amountMinor, 0n);
  const ranked = [...allocated].sort((a, b) => {
    if (a.remainder === b.remainder) return a.position - b.position;
    return a.remainder > b.remainder ? -1 : 1;
  });
  for (const line of ranked) {
    if (left === 0n) break;
    line.amountMinor += 1n;
    left -= 1n;
  }
  return allocated.map((line) => ({ position: line.position, amountMinor: sign * line.amountMinor }));
}
