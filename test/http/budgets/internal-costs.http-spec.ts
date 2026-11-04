import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { InternalCostQueryService } from '../../../src/modules/budgets/internal-cost/internal-cost-query.service';
import { InternalCostService } from '../../../src/modules/budgets/internal-cost/internal-cost.service';
import {
  InternalCostAlreadyCancelledError,
  InternalCostApplicationNotFoundError,
  InternalCostApplicationNotInternalError,
  InternalCostCostCenterInactiveError,
  InternalCostCostCenterInvalidError,
  InternalCostCostCenterNotFoundError,
  InternalCostNotFoundError,
  InternalCostRateMissingError,
} from '../../../src/modules/budgets/internal-cost/internal-cost.errors';
import { bodyOf } from '../../support/api-body';
import { bearer, createHttpContractApp, principal } from '../../support/http-contract-app';

const VALID_BODY = {
  applicationId: randomUUID(),
  costCenterId: randomUUID(),
  amount: '40000000',
  currency: 'VND',
  periodStart: '2026-10-01',
  periodEnd: '2026-10-31',
  note: 'Chi phí tháng 10',
};

const FULL_VIEW = {
  id: randomUUID(),
  applicationId: VALID_BODY.applicationId,
  applicationName: 'Portal',
  costCenterId: VALID_BODY.costCenterId,
  costCenterCode: 'CC-ENG',
  costCenterName: 'Engineering',
  amount: '40000000',
  currency: 'VND',
  amountReporting: '40000000',
  reportingCurrency: 'VND',
  amountRate: '1',
  amountRateDate: '2026-10-01',
  amountRateSource: 'SAME_CURRENCY',
  periodStart: '2026-10-01',
  periodEnd: '2026-10-31',
  note: 'Chi phí tháng 10',
  cancelReason: null,
  recordedAt: '2026-10-01T08:00:00.000Z',
  cancelledAt: null,
  recordedByEmployeeId: randomUUID(),
};

describe('internal costs HTTP contract (US-12-11)', () => {
  let app: INestApplication<App>;
  const record = jest.fn();
  const cancel = jest.fn();
  const list = jest.fn();
  const getById = jest.fn();

  beforeAll(async () => {
    app = await createHttpContractApp({
      overrides: [
        { token: InternalCostService, useValue: { record, cancel } },
        { token: InternalCostQueryService, useValue: { list, getById } },
      ],
    });
  });

  afterAll(async () => app?.close());
  beforeEach(() => {
    record.mockReset();
    cancel.mockReset();
    list.mockReset();
    getById.mockReset();
  });

  describe('POST /api/v1/internal-costs', () => {
    it('requires authentication before recording', async () => {
      await request(app.getHttpServer()).post('/api/v1/internal-costs').send(VALID_BODY).expect(401);
      expect(record).not.toHaveBeenCalled();
    });

    it.each([
      ['IT_ADMIN', ['IT_ADMIN'], []],
      ['DEPARTMENT_HEAD', [], ['DEPARTMENT_HEAD']],
      ['SPENDING_APPROVER', [], ['SPENDING_APPROVER']],
      ['SUPER_ADMIN', ['SUPER_ADMIN'], []],
    ])('refuses %s without calling the writer (AC-8a)', async (_role, direct, derived) => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/internal-costs')
        .set('Authorization', bearer(principal(direct, derived)))
        .send(VALID_BODY)
        .expect(403);
      expect(bodyOf(response).error.code).toBe('AUTHORIZATION.FORBIDDEN');
      expect(record).not.toHaveBeenCalled();
    });

    it.each([
      ['missing fields', {}],
      ['allocationRatio not allowed (AC-3)', { ...VALID_BODY, allocationRatio: 0.6 }],
      ['periodEnd precedes periodStart', { ...VALID_BODY, periodStart: '2026-10-31', periodEnd: '2026-10-01' }],
      ['zero amount', { ...VALID_BODY, amount: '0' }],
      ['negative amount', { ...VALID_BODY, amount: '-500000' }],
      ['invalid currency', { ...VALID_BODY, currency: 'vnd' }],
    ])('refuses %s with VALIDATION_ERROR before writing', async (_case, input) => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/internal-costs')
        .set('Authorization', bearer(principal(['FINANCE'])))
        .send(input)
        .expect(422);
      expect(bodyOf(response).error.code).toBe('VALIDATION_ERROR');
      expect(record).not.toHaveBeenCalled();
    });

    it('allows Finance to record internal software cost (AC-1)', async () => {
      const mockResult = { ...FULL_VIEW };
      record.mockResolvedValue(mockResult);

      const response = await request(app.getHttpServer())
        .post('/api/v1/internal-costs')
        .set('Authorization', bearer(principal(['FINANCE'])))
        .send(VALID_BODY)
        .expect(201);

      expect(bodyOf(response).data).toEqual(mockResult);
      expect(bodyOf(response).message).toBe('INTERNAL_COST.RECORDED');
      expect(record).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['INTERNAL_COST.COST_CENTER_NOT_FOUND', 404, new InternalCostCostCenterNotFoundError()],
      ['INTERNAL_COST.APPLICATION_NOT_FOUND', 404, new InternalCostApplicationNotFoundError()],
      ['INTERNAL_COST.RATE_MISSING', 409, new InternalCostRateMissingError()],
      ['INTERNAL_COST.COST_CENTER_INACTIVE', 409, new InternalCostCostCenterInactiveError()],
      ['INTERNAL_COST.COST_CENTER_INVALID', 422, new InternalCostCostCenterInvalidError()],
      ['INTERNAL_COST.APPLICATION_NOT_INTERNAL', 422, new InternalCostApplicationNotInternalError()],
    ])('maps domain error to %s (%s)', async (code, status, error) => {
      record.mockRejectedValue(error);

      const response = await request(app.getHttpServer())
        .post('/api/v1/internal-costs')
        .set('Authorization', bearer(principal(['FINANCE'])))
        .send(VALID_BODY)
        .expect(status);

      expect(bodyOf(response).error.code).toBe(code);
    });
  });

  describe('POST /api/v1/internal-costs/:id/cancel', () => {
    const id = randomUUID();

    it('refuses non-Finance role', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/internal-costs/${id}/cancel`)
        .set('Authorization', bearer(principal([], ['DEPARTMENT_HEAD'])))
        .send({ reason: 'Mistake' })
        .expect(403);
      expect(cancel).not.toHaveBeenCalled();
    });

    it('refuses empty reason with 422 VALIDATION_ERROR', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/internal-costs/${id}/cancel`)
        .set('Authorization', bearer(principal(['FINANCE'])))
        .send({ reason: '' })
        .expect(422);
      expect(bodyOf(response).error.code).toBe('VALIDATION_ERROR');
      expect(cancel).not.toHaveBeenCalled();
    });

    it('allows Finance to cancel internal cost entry with reason', async () => {
      const mockCancelled = {
        ...FULL_VIEW,
        id,
        cancelReason: 'Ghi nham Cost Center',
        cancelledAt: '2026-10-02T10:00:00.000Z',
      };
      cancel.mockResolvedValue(mockCancelled);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/internal-costs/${id}/cancel`)
        .set('Authorization', bearer(principal(['FINANCE'])))
        .send({ reason: 'Ghi nham Cost Center' })
        .expect(200);

      expect(bodyOf(response).data).toEqual(mockCancelled);
      expect(bodyOf(response).message).toBe('INTERNAL_COST.CANCELLED');
    });

    it('maps ALREADY_CANCELLED to 409', async () => {
      cancel.mockRejectedValue(new InternalCostAlreadyCancelledError());

      const response = await request(app.getHttpServer())
        .post(`/api/v1/internal-costs/${id}/cancel`)
        .set('Authorization', bearer(principal(['FINANCE'])))
        .send({ reason: 'Already done' })
        .expect(409);

      expect(bodyOf(response).error.code).toBe('INTERNAL_COST.ALREADY_CANCELLED');
    });

    it('maps NOT_FOUND to 404', async () => {
      cancel.mockRejectedValue(new InternalCostNotFoundError());

      const response = await request(app.getHttpServer())
        .post(`/api/v1/internal-costs/${id}/cancel`)
        .set('Authorization', bearer(principal(['FINANCE'])))
        .send({ reason: 'Not found' })
        .expect(404);

      expect(bodyOf(response).error.code).toBe('INTERNAL_COST.NOT_FOUND');
    });
  });

  describe('GET /api/v1/internal-costs and GET /api/v1/internal-costs/:id', () => {
    const id = randomUUID();

    it('rejects an invalid list query before calling the service', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/internal-costs?page=0')
        .set('Authorization', bearer(principal(['FINANCE'])))
        .expect(422);
      expect(bodyOf(response).error.code).toBe('VALIDATION_ERROR');
      expect(list).not.toHaveBeenCalled();
    });

    it('rejects an invalid ID before calling the service', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/internal-costs/not-a-uuid')
        .set('Authorization', bearer(principal(['FINANCE'])))
        .expect(422);
      expect(bodyOf(response).error.code).toBe('VALIDATION_ERROR');
      expect(getById).not.toHaveBeenCalled();
    });

    it('allows Finance to list internal costs', async () => {
      list.mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } });

      const response = await request(app.getHttpServer())
        .get('/api/v1/internal-costs')
        .set('Authorization', bearer(principal(['FINANCE'])))
        .expect(200);

      expect(bodyOf(response).message).toBe('INTERNAL_COST.LISTED');
      expect(list).toHaveBeenCalled();
    });

    it('allows Department Head to list internal costs (AC-9b)', async () => {
      list.mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } });

      const response = await request(app.getHttpServer())
        .get('/api/v1/internal-costs')
        .set('Authorization', bearer(principal([], ['DEPARTMENT_HEAD'])))
        .expect(200);

      expect(bodyOf(response).message).toBe('INTERNAL_COST.LISTED');
      expect(list).toHaveBeenCalled();
    });

    it('refuses IT_ADMIN from listing internal costs', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/internal-costs')
        .set('Authorization', bearer(principal(['IT_ADMIN'])))
        .expect(403);
    });

    it('allows Finance and Department Head to get detail by id', async () => {
      const mockDetail = { ...FULL_VIEW, id, note: 'detail' };
      getById.mockResolvedValue(mockDetail);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/internal-costs/${id}`)
        .set('Authorization', bearer(principal(['FINANCE'])))
        .expect(200);

      expect(bodyOf(response).message).toBe('INTERNAL_COST.RETRIEVED');
      expect(bodyOf(response).data).toEqual(mockDetail);
    });
  });
});
