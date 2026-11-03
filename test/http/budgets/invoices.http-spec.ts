import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { InvoiceService } from '../../../src/modules/budgets/invoice/invoice.service';
import {
  InvoiceDuplicateError,
  InvoiceRateMissingError,
  InvoiceMatchRefusedError,
} from '../../../src/modules/budgets/invoice/invoice.errors';
import { BudgetCommitmentNotFoundError } from '../../../src/modules/budgets/budget/budget.errors';
import { bodyOf } from '../../support/api-body';
import { bearer, createHttpContractApp, principal } from '../../support/http-contract-app';

const BODY = {
  vendorId: randomUUID(),
  invoiceNumber: 'INV-001',
  invoiceDate: '2026-11-01',
  amount: { amount: '1000', currency: 'USD' },
  lines: [{ outOfCatalog: true, description: 'Software', amount: '1000' }],
  taxLines: [],
};

describe('record invoices (HTTP contract, US-12-02 AC-9, US-12-10 AC-11)', () => {
  let app: INestApplication<App>;
  const record = jest.fn();

  beforeAll(async () => {
    app = await createHttpContractApp({ overrides: [{ token: InvoiceService, useValue: { record } }] });
  });
  afterAll(async () => app?.close());
  beforeEach(() => record.mockReset());

  it('requires authentication before recording', async () => {
    await request(app.getHttpServer()).post('/api/v1/invoices').send(BODY).expect(401);
    expect(record).not.toHaveBeenCalled();
  });

  it.each([
    ['IT_ADMIN', ['IT_ADMIN'], []],
    ['MANAGER', [], ['MANAGER']],
    ['SPENDING_APPROVER', [], ['SPENDING_APPROVER']],
    ['SUPER_ADMIN', ['SUPER_ADMIN'], []],
  ])('refuses %s without calling the writer', async (_role, direct, derived) => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/invoices')
      .set('Authorization', bearer(principal(direct, derived)))
      .send(BODY)
      .expect(403);
    expect(bodyOf(response).error.code).toBe('AUTHORIZATION.FORBIDDEN');
    expect(record).not.toHaveBeenCalled();
  });

  it.each([
    ['missing fields', {}],
    ['negative header', { ...BODY, amount: { amount: '-1', currency: 'USD' } }],
    ['missing subject', { ...BODY, lines: [{ description: 'Software', amount: '1000' }] }],
    ['both subjects', { ...BODY, lines: [{ ...BODY.lines[0], subscriptionId: randomUUID() }] }],
    ['no lines', { ...BODY, lines: [] }],
    ['invalid date', { ...BODY, invoiceDate: '2026-02-30' }],
    ['too many lines', { ...BODY, lines: Array.from({ length: 501 }, () => BODY.lines[0]) }],
    ['too many tax lines', { ...BODY, taxLines: Array.from({ length: 101 }, () => ({})) }],
  ])('refuses %s with VALIDATION_ERROR before writing', async (_case, input) => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/invoices')
      .set('Authorization', bearer(principal(['FINANCE'])))
      .send(input)
      .expect(422);
    expect(bodyOf(response).error.code).toBe('VALIDATION_ERROR');
    expect(record).not.toHaveBeenCalled();
  });

  it('allows Finance to record a discount line and returns the created id', async () => {
    const id = randomUUID();
    record.mockResolvedValue({ id });
    const input = {
      ...BODY,
      lines: [
        { outOfCatalog: true, description: 'Price', amount: '1100' },
        { outOfCatalog: true, description: 'Discount', amount: '-100' },
      ],
    };
    const response = await request(app.getHttpServer())
      .post('/api/v1/invoices')
      .set('Authorization', bearer(principal(['FINANCE'])))
      .send(input)
      .expect(201);
    expect(bodyOf(response).data).toEqual({ id });
    expect(bodyOf(response).message).toBe('INVOICE.RECORDED');
    expect(record).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['INVOICE.DUPLICATE', new InvoiceDuplicateError()],
    ['INVOICE.RATE_MISSING', new InvoiceRateMissingError()],
    ['INVOICE_MATCH.INVOICE_NOT_MATCHABLE', new InvoiceMatchRefusedError('INVOICE_NOT_MATCHABLE')],
    ['INVOICE_MATCH.COMMITMENT_NOT_HELD', new InvoiceMatchRefusedError('COMMITMENT_NOT_HELD')],
    ['INVOICE_MATCH.YEAR_MISMATCH', new InvoiceMatchRefusedError('YEAR_MISMATCH')],
    ['INVOICE_MATCH.VENDOR_MISMATCH', new InvoiceMatchRefusedError('VENDOR_MISMATCH')],
    ['INVOICE_MATCH.LINE_ALREADY_MATCHED', new InvoiceMatchRefusedError('LINE_ALREADY_MATCHED')],
  ])('maps a domain conflict to %s', async (code, error) => {
    record.mockRejectedValue(error);
    const response = await request(app.getHttpServer())
      .post('/api/v1/invoices')
      .set('Authorization', bearer(principal(['FINANCE'])))
      .send(BODY)
      .expect(409);
    expect(bodyOf(response).error.code).toBe(code);
  });

  it('maps a missing commitment selected during recording to 404', async () => {
    record.mockRejectedValue(new BudgetCommitmentNotFoundError());
    const response = await request(app.getHttpServer())
      .post('/api/v1/invoices')
      .set('Authorization', bearer(principal(['FINANCE'])))
      .send({ ...BODY, lines: [{ ...BODY.lines[0], commitmentId: randomUUID() }] })
      .expect(404);
    expect(bodyOf(response).error.code).toBe('BUDGET.COMMITMENT_NOT_FOUND');
  });
});
