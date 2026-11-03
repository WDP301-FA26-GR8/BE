import { Injectable } from '@nestjs/common';
import { pageOf, type Page } from '../../../core/application/pagination';
import { TransactionRunner } from '../../../infrastructure/database/transaction-runner';
import type { AuthenticatedPrincipal } from '../../../infrastructure/security/tokens/access-token-verifier.port';
import { AuditApi } from '../../audit/public/audit.api';
import { CatalogApi } from '../../catalog/public/catalog.api';
import type { AttachedDocument } from '../../catalog/public/catalog.types';
import { budgetAuditEvent, BudgetSupportService } from '../budget/budget-support.service';
import { InvoiceNotFoundError, InvoiceTaxLineNotBuyerRemitsError, InvoiceTaxLineNotFoundError } from './invoice.errors';
import { InvoiceRepo } from './invoice.repo';

export interface InvoiceDocumentWire {
  id: string;
  purpose: string;
  status: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: string;
  contractId: string | null;
  invoiceId: string | null;
  attachedAt: string | null;
}

export function toInvoiceDocumentWire(doc: AttachedDocument): InvoiceDocumentWire {
  return {
    id: doc.id,
    purpose: doc.purpose,
    status: doc.status,
    fileName: doc.fileName,
    contentType: doc.contentType,
    sizeBytes: doc.sizeBytes,
    uploadedBy: doc.uploadedByAppUserId,
    createdAt: doc.createdAt.toISOString(),
    contractId: doc.contractId,
    invoiceId: doc.invoiceId,
    attachedAt: doc.attachedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class InvoiceDocumentService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly repo: InvoiceRepo,
    private readonly catalog: CatalogApi,
    private readonly support: BudgetSupportService,
    private readonly audit: AuditApi,
  ) {}

  /**
   * Attaches a document to an invoice (`US-04-04` AC-4, `US-12-10` AC-5, `US-01-12` AC-10).
   * Only FINANCE role can attach to invoices.
   * If taxLinePosition is provided, verifies that the tax line exists and has payer = BUYER_REMITS,
   * then updates proof_document_id on that tax line.
   */
  async attach(
    actor: AuthenticatedPrincipal,
    invoiceId: string,
    input: { documentId: string; taxLinePosition?: number },
  ): Promise<{ document: InvoiceDocumentWire }> {
    this.support.requireFinance(actor);

    return this.transactions.run(async (tx) => {
      const invoice = await this.repo.lockInvoice(tx, invoiceId);
      if (!invoice) throw new InvoiceNotFoundError();

      if (input.taxLinePosition !== undefined) {
        const taxLine = await this.repo.findTaxLine(tx, invoiceId, input.taxLinePosition);
        if (!taxLine) throw new InvoiceTaxLineNotFoundError();
        if (taxLine.payer !== 'BUYER_REMITS') throw new InvoiceTaxLineNotBuyerRemitsError();
      }

      const document = await this.catalog.attachDocumentToInvoice(tx, actor, input.documentId, invoiceId);

      if (input.taxLinePosition !== undefined) {
        await this.repo.linkProofDocument(tx, invoiceId, input.taxLinePosition, input.documentId);
      }

      await this.audit.record(
        tx,
        budgetAuditEvent(actor, invoice.organizationId, 'INVOICE.DOCUMENT_ATTACHED', 'INVOICE', invoiceId, {
          documentId: input.documentId,
          ...(input.taxLinePosition !== undefined ? { taxLinePosition: input.taxLinePosition } : {}),
        }),
      );

      return { document: toInvoiceDocumentWire(document) };
    });
  }

  /**
   * Lists the documents attached to an invoice (`FINANCE`, `IT_ADMIN`).
   */
  async list(invoiceId: string, query: { page: number; pageSize: number }): Promise<Page<InvoiceDocumentWire>> {
    const invoice = await this.repo.findInvoice(invoiceId);
    if (!invoice) throw new InvoiceNotFoundError();

    const documents = await this.catalog.getInvoiceDocuments(invoiceId);
    const totalItems = documents.length;
    const page = query.page;
    const pageSize = query.pageSize;
    const offset = (page - 1) * pageSize;
    const paged = documents.slice(offset, offset + pageSize);

    return pageOf(paged.map(toInvoiceDocumentWire), totalItems, page, pageSize);
  }
}
