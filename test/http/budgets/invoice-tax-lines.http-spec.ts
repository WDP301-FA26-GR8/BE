import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { InvoiceTaxLineService } from '../../../src/modules/budgets/invoice/invoice-tax-line.service';
import { InvoiceNotFoundError } from '../../../src/modules/budgets/invoice/invoice.errors';
import { bodyOf } from '../../support/api-body';
import { bearer, createHttpContractApp, principal } from '../../support/http-contract-app';

describe('invoice tax line routes (HTTP contract, US-12-10 AC-3, AC-11)', () => {
  let app: INestApplication<App>;
  const update = jest.fn();

  const validBody = {
    taxType: 'GTGT',
    rateBp: 1000,
    amount: { amount: '100', currency: 'VND' },
    payer: 'VENDOR_COLLECTS',
    deductible: false,
    note: 'Updated tax note',
  };

  beforeAll(async () => {
    app = await createHttpContractApp({
      overrides: [{ token: InvoiceTaxLineService, useValue: { update } }],
    });
  });

  afterAll(async () => app?.close());

  beforeEach(() => {
    update.mockReset();
  });

  describe('PUT /api/v1/invoices/:id/tax-lines/:position', () => {
    const invoiceId = randomUUID();
    const position = 1;
    const url = `/api/v1/invoices/${invoiceId}/tax-lines/${position}`;

    it('requires authentication', async () => {
      await request(app.getHttpServer()).put(url).send(validBody).expect(401);
      expect(update).not.toHaveBeenCalled();
    });

    it.each([
      ['IT_ADMIN', ['IT_ADMIN'], []],
      ['MANAGER', [], ['MANAGER']],
      ['SPENDING_APPROVER', [], ['SPENDING_APPROVER']],
      ['SUPER_ADMIN', ['SUPER_ADMIN'], []],
    ])('US-12-10 AC-11: refuses %s with 403', async (_role, direct, derived) => {
      const response = await request(app.getHttpServer())
        .put(url)
        .set('Authorization', bearer(principal(direct, derived)))
        .send(validBody)
        .expect(403);

      expect(bodyOf(response).error.code).toBe('AUTHORIZATION.FORBIDDEN');
      expect(update).not.toHaveBeenCalled();
    });

    it.each([
      ['zero position', `/api/v1/invoices/${invoiceId}/tax-lines/0`],
      ['negative position', `/api/v1/invoices/${invoiceId}/tax-lines/-1`],
      ['invalid invoice uuid', `/api/v1/invoices/not-a-uuid/tax-lines/1`],
    ])('refuses invalid param %s with 422 VALIDATION_ERROR', async (_case, badUrl) => {
      const response = await request(app.getHttpServer())
        .put(badUrl)
        .set('Authorization', bearer(principal(['FINANCE'])))
        .send(validBody)
        .expect(422);

      expect(bodyOf(response).error.code).toBe('VALIDATION_ERROR');
      expect(update).not.toHaveBeenCalled();
    });

    it.each([
      ['missing taxType', { ...validBody, taxType: '' }],
      ['negative rateBp', { ...validBody, rateBp: -1 }],
      ['rateBp over 10000', { ...validBody, rateBp: 10001 }],
      ['negative amount', { ...validBody, amount: { amount: '-10', currency: 'VND' } }],
      ['invalid payer', { ...validBody, payer: 'OTHER' }],
    ])('refuses invalid body %s with 422 VALIDATION_ERROR', async (_case, badBody) => {
      const response = await request(app.getHttpServer())
        .put(url)
        .set('Authorization', bearer(principal(['FINANCE'])))
        .send(badBody)
        .expect(422);

      expect(bodyOf(response).error.code).toBe('VALIDATION_ERROR');
      expect(update).not.toHaveBeenCalled();
    });

    it('returns 404 when invoice is not found', async () => {
      update.mockRejectedValue(new InvoiceNotFoundError());

      const response = await request(app.getHttpServer())
        .put(url)
        .set('Authorization', bearer(principal(['FINANCE'])))
        .send(validBody)
        .expect(404);

      expect(bodyOf(response).error.code).toBe('INVOICE.NOT_FOUND');
    });

    it('allows Finance to update tax line and returns 200', async () => {
      update.mockResolvedValue({
        position,
        taxType: 'GTGT',
        rateBp: 1000,
        amount: { amount: '100', currency: 'VND' },
        amountReporting: { amount: '100', currency: 'VND' },
        payer: 'VENDOR_COLLECTS',
        deductible: false,
        note: 'Updated tax note',
      });

      const response = await request(app.getHttpServer())
        .put(url)
        .set('Authorization', bearer(principal(['FINANCE'])))
        .send(validBody)
        .expect(200);

      expect(update).toHaveBeenCalledWith(expect.anything(), invoiceId, position, validBody);
      expect(bodyOf(response).data).toEqual({
        position,
        taxType: 'GTGT',
        rateBp: 1000,
        amount: { amount: '100', currency: 'VND' },
        amountReporting: { amount: '100', currency: 'VND' },
        payer: 'VENDOR_COLLECTS',
        deductible: false,
        note: 'Updated tax note',
      });
    });
  });
});
