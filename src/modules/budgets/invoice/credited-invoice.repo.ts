import { Injectable } from '@nestjs/common';
import type { DbTx } from '../../../infrastructure/database/transaction-runner';

/** Reads the original invoice referenced by a credit note. */
@Injectable()
export class CreditedInvoiceRepo {
  async findCreditedInvoice(
    tx: DbTx,
    id: string,
  ): Promise<{
    id: string;
    vendorId: string;
    kind: string;
    lines: { costCenterId: string | null }[];
  } | null> {
    const invoice = await tx.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        vendorId: true,
        kind: true,
        lines: { select: { costCenterId: true }, orderBy: { position: 'asc' } },
      },
    });
    if (!invoice) return null;

    return {
      id: invoice.id,
      vendorId: invoice.vendorId,
      kind: invoice.kind,
      lines: invoice.lines,
    };
  }
}
