import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { InvoiceDocumentService } from '../../../src/modules/budgets/invoice/invoice-document.service';
import {
  InvoiceNotFoundError,
  InvoiceTaxLineNotBuyerRemitsError,
  InvoiceTaxLineNotFoundError,
} from '../../../src/modules/budgets/invoice/invoice.errors';
import {
  DocumentAlreadyAttachedError,
  DocumentNotFoundError,
  DocumentNotReadyToAttachError,
  DocumentPurposeForbiddenError,
} from '../../../src/modules/catalog/public/catalog.errors';
import { bodyOf } from '../../support/api-body';
import { bearer, createHttpContractApp, principal } from '../../support/http-contract-app';

describe('invoice document routes (HTTP contract, US-04-04 AC-4, AC-7, US-12-10 AC-5, US-01-12 AC-10)', () => {
  let app: INestApplication<App>;
  const attach = jest.fn();
  const list = jest.fn();

  beforeAll(async () => {
    app = await createHttpContractApp({
      overrides: [{ token: InvoiceDocumentService, useValue: { attach, list } }],
    });
  });

  afterAll(async () => app?.close());
  beforeEach(() => {
    attach.mockReset();
    list.mockReset();
  });

  describe('POST /api/v1/invoices/:id/documents', () => {
    const invoiceId = randomUUID();
    const documentId = randomUUID();

    it('requires authentication', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/invoices/${invoiceId}/documents`)
        .send({ documentId })
        .expect(401);
      expect(attach).not.toHaveBeenCalled();
    });

    it.each([
      ['IT_ADMIN', ['IT_ADMIN'], []],
      ['MANAGER', [], ['MANAGER']],
      ['EMPLOYEE', [], ['EMPLOYEE']],
      ['SPENDING_APPROVER', [], ['SPENDING_APPROVER']],
      ['SUPER_ADMIN', ['SUPER_ADMIN'], []],
    ])('US-01-12 AC-10: refuses %s (only Finance may attach to invoices)', async (_name, direct, derived) => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/invoices/${invoiceId}/documents`)
        .set('Authorization', bearer(principal(direct, derived)))
        .send({ documentId })
        .expect(403);
      expect(bodyOf(response).error.code).toBe('AUTHORIZATION.FORBIDDEN');
      expect(attach).not.toHaveBeenCalled();
    });

    it('allows Finance to attach a document and returns 201', async () => {
      const doc = {
        id: documentId,
        purpose: 'PURCHASE_DOCUMENT',
        status: 'READY',
        fileName: 'hoa-don.pdf',
        contentType: 'application/pdf',
        sizeBytes: 2048,
        uploadedBy: randomUUID(),
        createdAt: new Date().toISOString(),
        contractId: null,
        invoiceId,
        attachedAt: new Date().toISOString(),
      };
      attach.mockResolvedValue({ document: doc });

      const response = await request(app.getHttpServer())
        .post(`/api/v1/invoices/${invoiceId}/documents`)
        .set('Authorization', bearer(principal(['FINANCE'])))
        .send({ documentId, taxLinePosition: 1 })
        .expect(201);

      expect(bodyOf(response).message).toBe('INVOICE.DOCUMENT_ATTACHED');
      expect(bodyOf(response).data).toEqual({ document: doc });
      expect(attach).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['invalid invoice ID', 'not-a-uuid', { documentId }],
      ['missing documentId', invoiceId, {}],
      ['invalid documentId', invoiceId, { documentId: 'bad' }],
      ['invalid taxLinePosition', invoiceId, { documentId, taxLinePosition: 0 }],
      ['negative taxLinePosition', invoiceId, { documentId, taxLinePosition: -5 }],
    ])('refuses %s with 422 VALIDATION_ERROR', async (_case, id, body) => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/invoices/${id}/documents`)
        .set('Authorization', bearer(principal(['FINANCE'])))
        .send(body)
        .expect(422);
      expect(bodyOf(response).error.code).toBe('VALIDATION_ERROR');
      expect(attach).not.toHaveBeenCalled();
    });

    it.each([
      ['INVOICE.NOT_FOUND', new InvoiceNotFoundError(), 404],
      ['INVOICE.TAX_LINE_NOT_FOUND', new InvoiceTaxLineNotFoundError(), 404],
      ['INVOICE.TAX_LINE_NOT_BUYER_REMITS', new InvoiceTaxLineNotBuyerRemitsError(), 422],
      ['DOCUMENT.NOT_FOUND', new DocumentNotFoundError(), 404],
      ['DOCUMENT.PURPOSE_FORBIDDEN', new DocumentPurposeForbiddenError(), 403],
      ['DOCUMENT.ALREADY_ATTACHED', new DocumentAlreadyAttachedError(), 409],
      ['DOCUMENT.NOT_READY_TO_ATTACH', new DocumentNotReadyToAttachError(), 409],
    ])('maps domain error to %s (%d)', async (code, error, status) => {
      attach.mockRejectedValue(error);
      const response = await request(app.getHttpServer())
        .post(`/api/v1/invoices/${invoiceId}/documents`)
        .set('Authorization', bearer(principal(['FINANCE'])))
        .send({ documentId })
        .expect(status);
      expect(bodyOf(response).error.code).toBe(code);
    });
  });

  describe('GET /api/v1/invoices/:id/documents', () => {
    const invoiceId = randomUUID();

    it('requires authentication', async () => {
      await request(app.getHttpServer()).get(`/api/v1/invoices/${invoiceId}/documents`).expect(401);
      expect(list).not.toHaveBeenCalled();
    });

    it.each([
      ['EMPLOYEE', [], ['EMPLOYEE']],
      ['MANAGER', [], ['MANAGER']],
      ['SPENDING_APPROVER', [], ['SPENDING_APPROVER']],
      ['SUPER_ADMIN', ['SUPER_ADMIN'], []],
    ])('refuses %s (only Finance and IT Admin may list documents)', async (_name, direct, derived) => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/invoices/${invoiceId}/documents`)
        .set('Authorization', bearer(principal(direct, derived)))
        .expect(403);
      expect(bodyOf(response).error.code).toBe('AUTHORIZATION.FORBIDDEN');
      expect(list).not.toHaveBeenCalled();
    });

    it.each([
      ['FINANCE', ['FINANCE']],
      ['IT_ADMIN', ['IT_ADMIN']],
    ])('allows %s to list invoice documents', async (_name, roles) => {
      list.mockResolvedValue({
        items: [],
        pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
      });

      const response = await request(app.getHttpServer())
        .get(`/api/v1/invoices/${invoiceId}/documents`)
        .set('Authorization', bearer(principal(roles)))
        .expect(200);

      expect(bodyOf(response).message).toBe('INVOICE.DOCUMENTS_LISTED');
      expect(bodyOf(response).data).toEqual({
        items: [],
        pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
      });
      expect(list).toHaveBeenCalledTimes(1);
    });

    it('refuses an invalid invoice ID with 422', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/invoices/not-a-uuid/documents')
        .set('Authorization', bearer(principal(['FINANCE'])))
        .expect(422);
      expect(bodyOf(response).error.code).toBe('VALIDATION_ERROR');
      expect(list).not.toHaveBeenCalled();
    });

    it('maps InvoiceNotFoundError to 404', async () => {
      list.mockRejectedValue(new InvoiceNotFoundError());
      const response = await request(app.getHttpServer())
        .get(`/api/v1/invoices/${invoiceId}/documents`)
        .set('Authorization', bearer(principal(['FINANCE'])))
        .expect(404);
      expect(bodyOf(response).error.code).toBe('INVOICE.NOT_FOUND');
    });
  });
});
