import type { BusinessDate } from '../../../core/business-date';
import type { AuthenticatedPrincipal } from '../../../infrastructure/security/tokens/access-token-verifier.port';
import type { IdentityAccessApi } from '../../identity-access/public/identity-access.api';
import type { OrganizationHistoryApi } from '../../organization/public/organization-history.api';
import type { OrganizationApi } from '../../organization/public/organization.api';
import { TransferRefusedError } from './transfer.errors';
import { TransferQueryService } from './transfer-query.service';
import type { TransferRepo } from './transfer.repo';
import type { TransferRecord } from './transfer.types';

describe('TransferQueryService.get (US-01-12 AC-4, BM-04)', () => {
  const FROM_DEPT_ID = 'dept-old';
  const TO_DEPT_ID = 'dept-new';
  const THIRD_DEPT_ID = 'dept-third';
  const RECORD_ID = 'transfer-1';

  const TODAY = '2026-11-01' as BusinessDate;

  const mockRecord: TransferRecord = {
    id: RECORD_ID,
    organizationId: 'org-1',
    employeeId: 'emp-target',
    fromDepartmentId: FROM_DEPT_ID,
    toDepartmentId: TO_DEPT_ID,
    effectiveOn: '2026-11-15',
    grounds: { type: 'DECISION', reference: 'REF-01', issuer: 'HR', issuedOn: '2026-10-15' },
    status: 'PENDING',
    closesPlacementId: 'placement-1',
    opensPlacementId: 'placement-2',
    recordedByAppUserId: 'user-admin',
    recordedByTicketId: null,
    recordedAt: new Date('2026-10-15T10:00:00Z'),
    effectiveAt: null,
    headHandover: null,
    cancelledAt: null,
    cancelledByAppUserId: null,
    cancelledByTicketId: null,
    cancelledReason: null,
    closedAt: null,
    closedByAppUserId: null,
  };

  const actor = (roles: string[], employeeId: string = 'emp-caller'): AuthenticatedPrincipal => ({
    subject: 'user-caller',
    appUserId: 'user-caller',
    sessionId: 'session-1',
    employeeId,
    roles,
    directRoles: roles,
    derivedRoles: [],
  });

  let mockTransfers: { find: jest.Mock };
  let mockOrganization: {
    businessToday: jest.Mock;
    getEmployees: jest.Mock;
    getDepartmentBriefs: jest.Mock;
    getItAdminScope: jest.Mock;
  };
  let mockHistory: { getHeadPeriodsOf: jest.Mock };
  let mockIdentity: { findUsableItAdminEmployeeIds: jest.Mock };
  let service: TransferQueryService;

  beforeEach(() => {
    mockTransfers = {
      find: jest.fn().mockResolvedValue(mockRecord),
    };
    mockOrganization = {
      businessToday: jest.fn().mockResolvedValue(TODAY),
      getEmployees: jest.fn().mockResolvedValue([]),
      getDepartmentBriefs: jest.fn().mockResolvedValue([]),
      getItAdminScope: jest.fn().mockResolvedValue([FROM_DEPT_ID]),
    };
    mockHistory = {
      getHeadPeriodsOf: jest.fn().mockResolvedValue([]),
    };
    mockIdentity = {
      findUsableItAdminEmployeeIds: jest.fn().mockResolvedValue([]),
    };

    service = new TransferQueryService(
      mockTransfers as unknown as TransferRepo,
      mockOrganization as unknown as OrganizationApi,
      mockHistory as unknown as OrganizationHistoryApi,
      mockIdentity as unknown as IdentityAccessApi,
    );
  });

  it('allows the head of the old department to view the full transfer detail (US-01-12 AC-4)', async () => {
    mockHistory.getHeadPeriodsOf.mockResolvedValueOnce([
      { departmentId: FROM_DEPT_ID, validFrom: '2026-01-01' as BusinessDate, validTo: null },
    ]);

    const result = await service.get(actor(['MANAGER']), RECORD_ID);

    expect(result.id).toBe(RECORD_ID);
    expect(result.grounds).toEqual(mockRecord.grounds);
  });

  it('allows the head of the new department to view the full transfer detail (US-01-12 AC-4)', async () => {
    mockHistory.getHeadPeriodsOf.mockResolvedValueOnce([
      { departmentId: TO_DEPT_ID, validFrom: '2026-01-01' as BusinessDate, validTo: null },
    ]);

    const result = await service.get(actor(['MANAGER']), RECORD_ID);

    expect(result.id).toBe(RECORD_ID);
    expect(result.grounds).toEqual(mockRecord.grounds);
  });

  it('refuses the head of a third unrelated department with NOT_FOUND', async () => {
    mockHistory.getHeadPeriodsOf.mockResolvedValueOnce([
      { departmentId: THIRD_DEPT_ID, validFrom: '2026-01-01' as BusinessDate, validTo: null },
    ]);

    await expect(service.get(actor(['MANAGER']), RECORD_ID)).rejects.toThrow(new TransferRefusedError('NOT_FOUND'));
  });

  it('refuses a former department head whose head period has already ended with NOT_FOUND', async () => {
    mockHistory.getHeadPeriodsOf.mockResolvedValueOnce([
      { departmentId: FROM_DEPT_ID, validFrom: '2025-01-01' as BusinessDate, validTo: '2026-10-31' as BusinessDate },
    ]);

    await expect(service.get(actor(['MANAGER']), RECORD_ID)).rejects.toThrow(new TransferRefusedError('NOT_FOUND'));
  });

  it('allows the IT Admin in charge to view minimal projection without grounds', async () => {
    mockOrganization.getItAdminScope.mockResolvedValueOnce([FROM_DEPT_ID]);

    const result = await service.get(actor(['IT_ADMIN']), RECORD_ID);

    expect(result.id).toBe(RECORD_ID);
    expect(result.grounds).toBeNull();
  });

  it('gives the broader full view when the actor is both IT Admin and old department head', async () => {
    mockHistory.getHeadPeriodsOf.mockResolvedValueOnce([
      { departmentId: FROM_DEPT_ID, validFrom: '2026-01-01' as BusinessDate, validTo: null },
    ]);

    const result = await service.get(actor(['IT_ADMIN', 'MANAGER']), RECORD_ID);

    expect(result.id).toBe(RECORD_ID);
    expect(result.grounds).toEqual(mockRecord.grounds);
  });

  it('allows the Super Admin to view the full transfer detail', async () => {
    const result = await service.get(actor(['SUPER_ADMIN']), RECORD_ID);

    expect(result.id).toBe(RECORD_ID);
    expect(result.grounds).toEqual(mockRecord.grounds);
  });

  it('refuses a manager without employeeId with NOT_FOUND', async () => {
    const principalWithoutEmp = { ...actor(['MANAGER']), employeeId: undefined };

    await expect(service.get(principalWithoutEmp as unknown as AuthenticatedPrincipal, RECORD_ID)).rejects.toThrow(
      new TransferRefusedError('NOT_FOUND'),
    );
  });

  it('refuses when the transfer record does not exist', async () => {
    mockTransfers.find.mockResolvedValueOnce(null);

    await expect(service.get(actor(['SUPER_ADMIN']), 'non-existent')).rejects.toThrow(
      new TransferRefusedError('NOT_FOUND'),
    );
  });
});
