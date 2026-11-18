import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DepartmentAvatarFileRequiredError } from '../../../src/modules/organization/department/department.errors';
import { DepartmentAvatarService } from '../../../src/modules/organization/department-management/department-avatar.service';
import { DepartmentQueryService } from '../../../src/modules/organization/department-management/department-query.service';
import { bodyOf } from '../../support/api-body';
import { bearer, createHttpContractApp, principal } from '../../support/http-contract-app';
import { OPENAPI_DOCUMENT_BUDGET_MS } from '../../support/openapi-document-budget';

const ID = '3f0c7d54-9e1b-4f6a-8d2c-5b7a1e9c0d11';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

const avatars = {
  upload: jest.fn((): Promise<void> => Promise.resolve()),
  remove: jest.fn((): Promise<void> => Promise.resolve()),
};
const profile = {
  id: ID,
  code: 'P-ENG',
  name: 'Engineering',
  functionDescription: null,
  status: 'ACTIVE',
  effectiveFrom: '2026-01-01',
  costCenter: null,
  itAdmin: null,
  itAdminUsable: false,
  head: null,
  memberCount: 0,
  warnings: [],
  avatarUrl: 'https://storage.example/department-avatars/a.png?sig=1',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  deactivatedAt: null,
  successor: null,
  headHistory: [],
  headHistoryHasMore: false,
};
const queries = { profile: jest.fn(() => Promise.resolve(profile)) };

/** The routes of the picture of a department (`QĐ-113c`): Super Admin only, one multipart file, the profile with its link as the answer. */
describe('department avatar routes (http contract, no database)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createHttpContractApp({
      overrides: [
        { token: DepartmentAvatarService, useValue: avatars },
        { token: DepartmentQueryService, useValue: queries },
      ],
    });
  }, OPENAPI_DOCUMENT_BUDGET_MS);

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => jest.clearAllMocks());

  const asSuperAdmin = (req: request.Test) => req.set('Authorization', bearer(principal(['SUPER_ADMIN'])));

  it('passes the bytes and the declared type, and answers the profile with avatarUrl', async () => {
    const response = await asSuperAdmin(
      request(app.getHttpServer())
        .put(`/api/v1/departments/${ID}/avatar`)
        .attach('file', PNG, { filename: 'd.png', contentType: 'image/png' }),
    ).expect(200);

    expect(avatars.upload).toHaveBeenCalledWith(expect.anything(), ID, {
      bytes: PNG,
      declaredContentType: 'image/png',
    });
    expect(bodyOf(response).data.avatarUrl).toBe(profile.avatarUrl);
    expect(bodyOf(response).message).toBe('DEPARTMENT.AVATAR_CHANGED');
  });

  it('turns the refusal of the service into its code', async () => {
    avatars.upload.mockRejectedValueOnce(new DepartmentAvatarFileRequiredError());

    const response = await asSuperAdmin(request(app.getHttpServer()).put(`/api/v1/departments/${ID}/avatar`)).expect(
      422,
    );

    expect(bodyOf(response).error.code).toBe('DEPARTMENT.AVATAR_FILE_REQUIRED');
  });

  it('removes the picture and answers the profile', async () => {
    const response = await asSuperAdmin(request(app.getHttpServer()).delete(`/api/v1/departments/${ID}/avatar`)).expect(
      200,
    );

    expect(avatars.remove).toHaveBeenCalledWith(expect.anything(), ID);
    expect(bodyOf(response).message).toBe('DEPARTMENT.AVATAR_REMOVED');
  });
});
