import { CommitmentVendorHook } from '../../budgets/public/budgets.extension-points';
import type { DbTx } from '../../../infrastructure/database/transaction-runner';
import type { AccessRequestRepo } from '../access-request/access-request.repo';
import type { CatalogApi } from '../../catalog/public/catalog.api';
import type { AuditApi } from '../../audit/public/audit.api';
import { CommitmentVendorListener } from './commitment-vendor.listener';

describe('CommitmentVendorListener (B07-8 Step 2)', () => {
  let hook: CommitmentVendorHook;
  let requests: { findPlanAndOrg: jest.Mock };
  let catalog: { getPlanVendorId: jest.Mock };
  let audit: { record: jest.Mock };
  let listener: CommitmentVendorListener;

  beforeEach(() => {
    hook = new CommitmentVendorHook();
    requests = { findPlanAndOrg: jest.fn() };
    catalog = { getPlanVendorId: jest.fn() };
    audit = { record: jest.fn() };
    listener = new CommitmentVendorListener(
      requests as unknown as AccessRequestRepo,
      catalog as unknown as CatalogApi,
      audit as unknown as AuditApi,
      hook,
    );
  });

  it('binds itself to CommitmentVendorHook on module init', () => {
    expect(hook.isBound()).toBe(false);
    listener.onModuleInit();
    expect(hook.isBound()).toBe(true);
    expect(hook.get()).toBe(listener);
  });

  it('declares CommitmentVendorHook in static binds', () => {
    expect(CommitmentVendorListener.binds).toEqual([CommitmentVendorHook]);
  });

  it('returns null when request is not found', async () => {
    requests.findPlanAndOrg.mockResolvedValue(null);

    const vendorId = await listener.getVendorId('req-1');

    expect(vendorId).toBeNull();
    expect(audit.record).not.toHaveBeenCalled();
    expect(catalog.getPlanVendorId).not.toHaveBeenCalled();
  });

  it('returns null and records audit when request has no planId (F-22)', async () => {
    const mockRequest = {
      id: 'req-1',
      organizationId: 'org-1',
      planId: null,
    };
    requests.findPlanAndOrg.mockResolvedValue(mockRequest);
    const mockTx = {} as DbTx;

    const vendorId = await listener.getVendorId('req-1', mockTx);

    expect(vendorId).toBeNull();
    expect(catalog.getPlanVendorId).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(mockTx, {
      organizationId: 'org-1',
      actorKind: 'SYSTEM',
      actorAppUserId: null,
      actorRoles: [],
      action: 'ACCESS_REQUEST.COMMITMENT_VENDOR_UNCHECKED',
      resourceType: 'ACCESS_REQUEST',
      resourceId: 'req-1',
      before: null,
      after: { requestId: 'req-1', reason: 'NO_PLAN' },
      correlationId: 'req-1',
    });
  });

  it('returns null and does not record audit if tx is not passed and request has no planId', async () => {
    const mockRequest = {
      id: 'req-1',
      organizationId: 'org-1',
      planId: null,
    };
    requests.findPlanAndOrg.mockResolvedValue(mockRequest);

    const vendorId = await listener.getVendorId('req-1');

    expect(vendorId).toBeNull();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('resolves vendor via CatalogApi when request has planId', async () => {
    const mockRequest = {
      id: 'req-1',
      organizationId: 'org-1',
      planId: 'plan-123',
    };
    requests.findPlanAndOrg.mockResolvedValue(mockRequest);
    catalog.getPlanVendorId.mockResolvedValue('vendor-xyz');
    const mockTx = {} as DbTx;

    const vendorId = await listener.getVendorId('req-1', mockTx);

    expect(vendorId).toBe('vendor-xyz');
    expect(requests.findPlanAndOrg).toHaveBeenCalledWith('req-1', mockTx);
    expect(catalog.getPlanVendorId).toHaveBeenCalledWith('plan-123', mockTx);
    expect(audit.record).not.toHaveBeenCalled();
  });
});
