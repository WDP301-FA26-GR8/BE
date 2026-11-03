import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { InvoiceMatchService } from '../../../src/modules/budgets/invoice/invoice-match.service';
import { BudgetCommitmentNotFoundError } from '../../../src/modules/budgets/budget/budget.errors';
import {
  InvoiceLineNotFoundError,
  InvoiceMatchRefusedError,
  InvoiceNotFoundError,
} from '../../../src/modules/budgets/invoice/invoice.errors';
import { bodyOf } from '../../support/api-body';
import { bearer, createHttpContractApp, principal } from '../../support/http-contract-app';

describe('invoice commitment match routes (HTTP contract, B07-8)', () => {
  let app: INestApplication<App>;
  const match = jest.fn();
  const listMatches = jest.fn();

  beforeAll(async () => {
    app = await createHttpContractApp({
      overrides: [{ token: InvoiceMatchService, useValue: { match, listMatches } }],
    });
  });

  afterAll(async () => app?.close());

  beforeEach(() => {
    match.mockReset();
    listMatches.mockReset();
  });

  describe('POST /api/v1/invoices/:id/lines/:position/commitment-match', () => {
    const invoiceId = randomUUID();
    const commitmentId = randomUUID();
    const position = 1;
    const url = `/api/v1/invoices/${invoiceId}/lines/${position}/commitment-match`;

    it('requires authentication', async () => {
      await request(app.getHttpServer()).post(url).send({ commitmentId }).expect(401);
      expect(match).not.toHaveBeenCalled();
    });

    it.each([
      ['IT_ADMIN', ['IT_ADMIN'], []],
      ['MANAGER', [], ['MANAGER']],
      ['SPENDING_APPROVER', [], ['SPENDING_APPROVER']],
      ['SUPER_ADMIN', ['SUPER_ADMIN'], []],
    ])('refuses %s with 403 (only Finance matches lines)', async (_role, direct, derived) => {
      const response = await request(app.getHttpServer())
        .post(url)
        .set('Authorization', bearer(principal(direct, derived)))
        .send({ commitmentId })
        .expect(403);

      expect(bodyOf(response).error.code).toBe('AUTHORIZATION.FORBIDDEN');
      expect(match).not.toHaveBeenCalled();
    });

    it.each([
      ['missing body', {}],
      ['invalid UUID commitmentId', { commitmentId: 'not-a-uuid' }],
    ])('refuses %s with 422 VALIDATION_ERROR before calling service', async (_case, body) => {
      const response = await request(app.getHttpServer())
        .post(url)
        .set('Authorization', bearer(principal(['FINANCE'])))
        .send(body)
        .expect(422);

      expect(bodyOf(response).error.code).toBe('VALIDATION_ERROR');
      expect(match).not.toHaveBeenCalled();
    });

    it.each([
      ['zero position', `/api/v1/invoices/${invoiceId}/lines/0/commitment-match`],
      ['negative position', `/api/v1/invoices/${invoiceId}/lines/-1/commitment-match`],
      ['invalid invoice uuid', `/api/v1/invoices/not-a-uuid/lines/1/commitment-match`],
    ])('refuses invalid param %s with 422 VALIDATION_ERROR', async (_case, badUrl) => {
      const response = await request(app.getHttpServer())
        .post(badUrl)
        .set('Authorization', bearer(principal(['FINANCE'])))
        .send({ commitmentId })
        .expect(422);

      expect(bodyOf(response).error.code).toBe('VALIDATION_ERROR');
      expect(match).not.toHaveBeenCalled();
    });

    it('allows Finance to match line and returns 201 with result', async () => {
      const invoiceLineId = randomUUID();
      match.mockResolvedValue({
        commitmentId,
        invoiceId,
        invoiceLineId,
        position,
        matched: { amount: '20000000', currency: 'VND' },
        held: { amount: '1000000', currency: 'VND' },
        expensed: false,
      });

      const response = await request(app.getHttpServer())
        .post(url)
        .set('Authorization', bearer(principal(['FINANCE'])))
        .send({ commitmentId })
        .expect(201);

      expect(match).toHaveBeenCalledWith(expect.anything(), invoiceId, position, commitmentId);
      expect(bodyOf(response).data).toEqual({
        commitmentId,
        invoiceId,
        invoiceLineId,
        position,
        matched: { amount: '20000000', currency: 'VND' },
        held: { amount: '1000000', currency: 'VND' },
        expensed: false,
      });
    });

    it.each([
      ['invoice not found', new InvoiceNotFoundError(), 404, 'INVOICE.NOT_FOUND'],
      ['line not found', new InvoiceLineNotFoundError(), 404, 'INVOICE.LINE_NOT_FOUND'],
      ['commitment not found', new BudgetCommitmentNotFoundError(), 404, 'BUDGET.COMMITMENT_NOT_FOUND'],
      [
        'invoice not matchable',
        new InvoiceMatchRefusedError('INVOICE_NOT_MATCHABLE'),
        409,
        'INVOICE_MATCH.INVOICE_NOT_MATCHABLE',
      ],
      [
        'commitment not held',
        new InvoiceMatchRefusedError('COMMITMENT_NOT_HELD'),
        409,
        'INVOICE_MATCH.COMMITMENT_NOT_HELD',
      ],
      ['year mismatch', new InvoiceMatchRefusedError('YEAR_MISMATCH'), 409, 'INVOICE_MATCH.YEAR_MISMATCH'],
      ['vendor mismatch', new InvoiceMatchRefusedError('VENDOR_MISMATCH'), 409, 'INVOICE_MATCH.VENDOR_MISMATCH'],
      [
        'line already matched',
        new InvoiceMatchRefusedError('LINE_ALREADY_MATCHED'),
        409,
        'INVOICE_MATCH.LINE_ALREADY_MATCHED',
      ],
    ])('maps domain error for %s to %s %s', async (_case, error, status, code) => {
      match.mockRejectedValue(error);

      const response = await request(app.getHttpServer())
        .post(url)
        .set('Authorization', bearer(principal(['FINANCE'])))
        .send({ commitmentId })
        .expect(status);

      expect(bodyOf(response).error.code).toBe(code);
    });
  });

  describe('GET /api/v1/invoices/:id/commitment-matches', () => {
    const invoiceId = randomUUID();
    const url = `/api/v1/invoices/${invoiceId}/commitment-matches`;

    it('requires authentication', async () => {
      await request(app.getHttpServer()).get(url).expect(401);
      expect(listMatches).not.toHaveBeenCalled();
    });

    it.each([
      ['IT_ADMIN', ['IT_ADMIN'], []],
      ['MANAGER', [], ['MANAGER']],
      ['SPENDING_APPROVER', [], ['SPENDING_APPROVER']],
      ['SUPER_ADMIN', ['SUPER_ADMIN'], []],
    ])('refuses %s with 403 (only Finance views matches)', async (_role, direct, derived) => {
      const response = await request(app.getHttpServer())
        .get(url)
        .set('Authorization', bearer(principal(direct, derived)))
        .expect(403);

      expect(bodyOf(response).error.code).toBe('AUTHORIZATION.FORBIDDEN');
      expect(listMatches).not.toHaveBeenCalled();
    });

    it('returns 404 when invoice is not found', async () => {
      listMatches.mockRejectedValue(new InvoiceNotFoundError());

      const response = await request(app.getHttpServer())
        .get(url)
        .set('Authorization', bearer(principal(['FINANCE'])))
        .expect(404);

      expect(bodyOf(response).error.code).toBe('INVOICE.NOT_FOUND');
    });

    it('allows Finance to list commitment matches and returns 200 with pagination', async () => {
      const matchRow = {
        id: randomUUID(),
        commitmentId: randomUUID(),
        invoiceLineId: randomUUID(),
        position: 1,
        amount: { amount: '20000000', currency: 'VND' },
        recordedAt: new Date().toISOString(),
        recordedByEmployeeId: randomUUID(),
      };
      listMatches.mockResolvedValue({
        items: [matchRow],
        pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      });

      const response = await request(app.getHttpServer())
        .get(url)
        .set('Authorization', bearer(principal(['FINANCE'])))
        .expect(200);

      expect(listMatches).toHaveBeenCalledWith(expect.anything(), invoiceId, { page: 1, pageSize: 20 });
      expect(bodyOf(response).data).toEqual({
        items: [
          {
            ...matchRow,
            amount: { amount: '20000000', currency: 'VND' },
          },
        ],
        pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      });
    });
  });
});
