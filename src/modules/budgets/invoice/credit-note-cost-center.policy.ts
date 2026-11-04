/**
 * Cost Center inheritance rule for credit note lines without a subscription (out of catalog).
 * If every line of the credited invoice belongs to the same non-null Cost Center,
 * the credit note line inherits that Cost Center; otherwise, it remains unallocated (null).
 */
export function inheritedCostCenterOf(creditedInvoiceLines: readonly { costCenterId: string | null }[]): string | null {
  if (creditedInvoiceLines.length === 0) {
    return null;
  }

  const firstLineCostCenterId = creditedInvoiceLines[0].costCenterId;
  if (firstLineCostCenterId === null) {
    return null;
  }

  for (let index = 1; index < creditedInvoiceLines.length; index += 1) {
    if (creditedInvoiceLines[index].costCenterId !== firstLineCostCenterId) {
      return null;
    }
  }

  return firstLineCostCenterId;
}
