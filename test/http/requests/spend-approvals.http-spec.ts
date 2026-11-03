import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { bodyOf } from '../../support/api-body';
import { bearer, createHttpContractApp, principal } from '../../support/http-contract-app';

const ID = '3f0c7d54-9e1b-4f6a-8d2c-5b7a1e9c0d11';
const URL = `/api/v1/access-requests/${ID}/spend-approval`;
const QUEUE_URL = '/api/v1/spend-approvals';

/**
 * HTTP validation and guards for spend approvals (US-16-03 AC-1, AC-2; e2e, no database):
 * authenticated-only access, route param validation, and strict decision body checks ensuring
 * snapshot figures cannot be submitted.
 */
describe('spend approvals contract (e2e, no database)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createHttpContractApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('GET /api/v1/spend-approvals', () => {
    it('needs a token', async () => {
      const response = await request(app.getHttpServer()).get(QUEUE_URL).expect(401);
      expect(bodyOf(response).error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('rejects invalid pagination with 422', async () => {
      const response = await request(app.getHttpServer())
        .get(QUEUE_URL)
        .set('Authorization', bearer(principal([], ['SPENDING_APPROVER'])))
        .query({ page: 0 })
        .expect(422);

      expect(bodyOf(response).error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/access-requests/:id/spend-approval', () => {
    it('needs a token', async () => {
      const response = await request(app.getHttpServer()).get(URL).expect(401);
      expect(bodyOf(response).error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('rejects non-uuid id with 422', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/access-requests/not-a-uuid/spend-approval')
        .set('Authorization', bearer(principal([], ['SPENDING_APPROVER'])))
        .expect(422);

      expect(bodyOf(response).error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/access-requests/:id/spend-approval', () => {
    const actor = bearer(principal([], ['SPENDING_APPROVER']));

    it('needs a token', async () => {
      const response = await request(app.getHttpServer()).post(URL).send({ decision: 'APPROVE' }).expect(401);

      expect(bodyOf(response).error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('rejects non-uuid id with 422', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/access-requests/not-a-uuid/spend-approval')
        .set('Authorization', actor)
        .send({ decision: 'APPROVE' })
        .expect(422);

      expect(bodyOf(response).error.code).toBe('VALIDATION_ERROR');
    });

    it.each([
      ['empty body', {}],
      ['invalid decision', { decision: 'MAYBE' }],
      ['refusal without reason', { decision: 'REJECT' }],
      ['refusal with blank reason', { decision: 'REJECT', reason: '   ' }],
      [
        'refusal with override',
        { decision: 'REJECT', reason: 'Too expensive', override: { reason: 'No', years: [2026] } },
      ],
      ['approval with decision reason', { decision: 'APPROVE', reason: 'Looks good' }],
      ['approval with empty override years', { decision: 'APPROVE', override: { reason: 'Project need', years: [] } }],
      [
        'approval with duplicate override years',
        { decision: 'APPROVE', override: { reason: 'Need', years: [2026, 2026] } },
      ],
      ['approval with out of range year', { decision: 'APPROVE', override: { reason: 'Need', years: [1999] } }],
      [
        'submitting snapshot figures (snapshot is read-only; US-16-03 AC-1, AC-2)',
        {
          decision: 'APPROVE',
          snapshot: { budget: '100000000', spent: '40000000', remaining: '40000000' },
        },
      ],
      [
        'submitting budget fields directly',
        {
          decision: 'APPROVE',
          remaining: '40000000',
        },
      ],
    ])('rejects %s with 422', async (_case, body) => {
      const response = await request(app.getHttpServer()).post(URL).set('Authorization', actor).send(body).expect(422);

      expect(bodyOf(response).error.code).toBe('VALIDATION_ERROR');
    });
  });
});
