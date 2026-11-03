import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { InvoiceQueryService } from '../../../src/modules/budgets/invoice/invoice-query.service';
import { InvoiceNotFoundError } from '../../../src/modules/budgets/invoice/invoice.errors';
import { bodyOf } from '../../support/api-body';
import { bearer, createHttpContractApp, principal } from '../../support/http-contract-app';

describe('invoice read routes (HTTP contract, B07-4, US-12-10 AC-11)', () => {
  let app: INestApplication<App>;
  const pageInvoices = jest.fn();
  const getInvoice = jest.fn();
  const pageLines = jest.fn();
  const pageTaxLines = jest.fn();

  beforeAll(async () => {
    app = await createHttpContractApp({
      overrides: [
        {
          token: InvoiceQueryService,
          useValue: { pageInvoices, getInvoice, pageLines, pageTaxLines },
        },
      ],
    });
  });

  afterAll(async () => app?.close());

  beforeEach(() => {
    pageInvoices.mockReset();
    getInvoice.mockReset();
    pageLines.mockReset();
    pageTaxLines.mockReset();
  });

  describe('GET /api/v1/invoices', () => {
    it('requires authentication', async () => {
      await request(app.getHttpServer()).get('/api/v1/invoices').expect(401);
      expect(pageInvoices).not.toHaveBeenCalled();
    });

    it.each([
      ['IT_ADMIN', ['IT_ADMIN'], []],
      ['MANAGER', [], ['MANAGER']],
      ['SPENDING_APPROVER', [], ['SPENDING_APPROVER']],
      ['SUPER_ADMIN', ['SUPER_ADMIN'], []],
    ])('refuses %s with 403 (only Finance reads invoice list)', async (_role, direct, derived) => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/invoices')
        .set('Authorization', bearer(principal(direct, derived)))
        .expect(403);

      expect(bodyOf(response).error.code).toBe('AUTHORIZATION.FORBIDDEN');
      expect(pageInvoices).not.toHaveBeenCalled();
    });

    it('allows Finance to read invoice list with pagination', async () => {
      const summary = {
        id: randomUUID(),
        vendorId: randomUUID(),
        contractId: null,
        creditedInvoiceId: null,
        invoiceNumber: 'INV-101',
        kind: 'INVOICE',
        invoiceDate: '2026-11-01',
        amount: { amount: '1000.00', currency: 'USD' },
        amountReporting: { amount: '25000000', currency: 'VND' },
        reconciliationStatus: 'NONE',
        recordedAt: new Date().toISOString(),
        recordedByEmployeeId: randomUUID(),
      };
      pageInvoices.mockResolvedValue({
        items: [summary],
        pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/invoices')
        .set('Authorization', bearer(principal(['FINANCE'])))
        .expect(200);

      expect(pageInvoices).toHaveBeenCalledWith(expect.anything(), expect.any(Object));
      expect(bodyOf(response).data).toEqual({
        items: [summary],
        pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      });
    });
  });

  describe('GET /api/v1/invoices/:id', () => {
    const invoiceId = randomUUID();
    const url = `/api/v1/invoices/${invoiceId}`;

    it('requires authentication', async () => {
      await request(app.getHttpServer()).get(url).expect(401);
      expect(getInvoice).not.toHaveBeenCalled();
    });

    it.each([
      ['MANAGER', [], ['MANAGER']],
      ['SPENDING_APPROVER', [], ['SPENDING_APPROVER']],
      ['SUPER_ADMIN', ['SUPER_ADMIN'], []],
    ])('refuses %s with 403', async (_role, direct, derived) => {
      const response = await request(app.getHttpServer())
        .get(url)
        .set('Authorization', bearer(principal(direct, derived)))
        .expect(403);

      expect(bodyOf(response).error.code).toBe('AUTHORIZATION.FORBIDDEN');
      expect(getInvoice).not.toHaveBeenCalled();
    });

    it('returns 404 when invoice is not found', async () => {
      getInvoice.mockRejectedValue(new InvoiceNotFoundError());

      const response = await request(app.getHttpServer())
        .get(url)
        .set('Authorization', bearer(principal(['FINANCE'])))
        .expect(404);

      expect(bodyOf(response).error.code).toBe('INVOICE.NOT_FOUND');
    });

    it.each([
      ['FINANCE', ['FINANCE'], []],
      ['IT_ADMIN', ['IT_ADMIN'], []],
    ])('allows %s to read invoice detail', async (_role, direct, derived) => {
      const detail = {
        id: invoiceId,
        vendorId: randomUUID(),
        contractId: null,
        creditedInvoiceId: null,
        invoiceNumber: 'INV-101',
        kind: 'INVOICE',
        invoiceDate: '2026-11-01',
        amount: { amount: '1000.00', currency: 'USD' },
        amountReporting: { amount: '25000000', currency: 'VND' },
        amountRate: '25000',
        amountRateDate: '2026-11-01',
        amountRateSource: 'MANUAL',
        effectiveCost: { amount: '26000000', currency: 'VND' },
        deductibleVat: { amount: '2500000', currency: 'VND' },
        reconciliationStatus: 'NONE',
        recordedAt: new Date().toISOString(),
        recordedByEmployeeId: randomUUID(),
      };
      getInvoice.mockResolvedValue(detail);

      const response = await request(app.getHttpServer())
        .get(url)
        .set('Authorization', bearer(principal(direct, derived)))
        .expect(200);

      expect(getInvoice).toHaveBeenCalledWith(expect.anything(), invoiceId);
      expect(bodyOf(response).data).toEqual({ invoice: detail });
    });
  });

  describe('GET /api/v1/invoices/:id/lines', () => {
    const invoiceId = randomUUID();
    const url = `/api/v1/invoices/${invoiceId}/lines`;

    it('requires authentication', async () => {
      await request(app.getHttpServer()).get(url).expect(401);
      expect(pageLines).not.toHaveBeenCalled();
    });

    it.each([
      ['MANAGER', [], ['MANAGER']],
      ['SUPER_ADMIN', ['SUPER_ADMIN'], []],
    ])('refuses %s with 403', async (_role, direct, derived) => {
      const response = await request(app.getHttpServer())
        .get(url)
        .set('Authorization', bearer(principal(direct, derived)))
        .expect(403);

      expect(bodyOf(response).error.code).toBe('AUTHORIZATION.FORBIDDEN');
    });

    it('allows Finance and IT Admin to read invoice lines with pagination', async () => {
      const lineItem = {
        id: randomUUID(),
        position: 1,
        subscriptionId: null,
        description: 'Software license',
        outOfCatalog: true,
        billedQuantity: 1,
        unitPrice: { amount: '1000.00', currency: 'USD' },
        servicePeriodStart: '2026-11-01',
        servicePeriodEnd: '2026-11-30',
        amount: { amount: '1000.00', currency: 'USD' },
        amountReporting: { amount: '25000000', currency: 'VND' },
        costReporting: { amount: '25000000', currency: 'VND' },
        deductibleVatReporting: { amount: '0', currency: 'VND' },
        costCenterId: randomUUID(),
        fiscalYear: 2026,
        realizationId: null,
      };
      pageLines.mockResolvedValue({
        items: [lineItem],
        pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      });

      const response = await request(app.getHttpServer())
        .get(url)
        .set('Authorization', bearer(principal(['IT_ADMIN'])))
        .expect(200);

      expect(pageLines).toHaveBeenCalledWith(expect.anything(), invoiceId, expect.any(Object));
      expect(bodyOf(response).data).toEqual({
        items: [lineItem],
        pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      });
    });
  });

  describe('GET /api/v1/invoices/:id/tax-lines', () => {
    const invoiceId = randomUUID();
    const url = `/api/v1/invoices/${invoiceId}/tax-lines`;

    it('requires authentication', async () => {
      await request(app.getHttpServer()).get(url).expect(401);
      expect(pageTaxLines).not.toHaveBeenCalled();
    });

    it.each([
      ['MANAGER', [], ['MANAGER']],
      ['SUPER_ADMIN', ['SUPER_ADMIN'], []],
    ])('refuses %s with 403', async (_role, direct, derived) => {
      const response = await request(app.getHttpServer())
        .get(url)
        .set('Authorization', bearer(principal(direct, derived)))
        .expect(403);

      expect(bodyOf(response).error.code).toBe('AUTHORIZATION.FORBIDDEN');
    });

    it('US-12-10 AC-11: allows IT Admin (and Finance) to read tax lines with pagination', async () => {
      const taxLineItem = {
        position: 1,
        taxType: 'GTGT',
        rateBp: 1000,
        amount: { amount: '100.00', currency: 'USD' },
        amountReporting: { amount: '2500000', currency: 'VND' },
        amountRate: '25000',
        amountRateDate: '2026-11-01',
        amountRateSource: 'MANUAL',
        payer: 'VENDOR_COLLECTS',
        deductible: true,
        note: null,
        proofDocumentId: null,
      };
      pageTaxLines.mockResolvedValue({
        items: [taxLineItem],
        pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      });

      const response = await request(app.getHttpServer())
        .get(url)
        .set('Authorization', bearer(principal(['IT_ADMIN'])))
        .expect(200);

      expect(pageTaxLines).toHaveBeenCalledWith(expect.anything(), invoiceId, expect.any(Object));
      expect(bodyOf(response).data).toEqual({
        items: [taxLineItem],
        pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      });
    });
  });
});
