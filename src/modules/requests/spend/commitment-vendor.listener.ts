import { Injectable, OnModuleInit } from '@nestjs/common';
import type { DbTx } from '../../../infrastructure/database/transaction-runner';
import { AuditApi } from '../../audit/public/audit.api';
import { CommitmentVendorHook, type CommitmentVendorReader } from '../../budgets/public/budgets.extension-points';
import { CatalogApi } from '../../catalog/public/catalog.api';
import { AccessRequestRepo } from '../access-request/access-request.repo';

/**
 * Resolves the vendor of the software a request holds a commitment for (F-22).
 * Reads the request's planId and resolves the vendor via CatalogApi.
 * Requests without a plan return null and write an audit event without blocking.
 */
@Injectable()
export class CommitmentVendorListener implements CommitmentVendorReader, OnModuleInit {
  /** The extension points this class registers with (gate extension-wiring, R1). */
  static readonly binds = [CommitmentVendorHook] as const;

  constructor(
    private readonly requests: AccessRequestRepo,
    private readonly catalog: CatalogApi,
    private readonly audit: AuditApi,
    private readonly hook: CommitmentVendorHook,
  ) {}

  onModuleInit(): void {
    this.hook.bind(this);
  }

  async getVendorId(requestId: string, tx?: DbTx): Promise<string | null> {
    const request = await this.requests.findPlanAndOrg(requestId, tx);
    if (!request) return null;

    if (!request.planId) {
      if (tx) {
        await this.audit.record(tx, {
          organizationId: request.organizationId,
          actorKind: 'SYSTEM',
          actorAppUserId: null,
          actorRoles: [],
          action: 'ACCESS_REQUEST.COMMITMENT_VENDOR_UNCHECKED',
          resourceType: 'ACCESS_REQUEST',
          resourceId: request.id,
          before: null,
          after: { requestId: request.id, reason: 'NO_PLAN' },
          correlationId: request.id,
        });
      }
      return null;
    }

    return this.catalog.getPlanVendorId(request.planId, tx);
  }
}
