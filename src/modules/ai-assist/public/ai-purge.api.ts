import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { addDays, toDateColumn } from '../../../core/business-date';
import { TransactionRunner } from '../../../infrastructure/database/transaction-runner';
import { AuditApi } from '../../audit/public/audit.api';
import { OrganizationReadApi } from '../../organization/public/organization-read.api';
import { HistoryDeliveryService } from '../history-delivery/history-delivery.service';
import { InvocationHistoryOutboxRepo } from '../invocation-history/invocation-history-outbox.repo';
import { contentsPurgedEvent } from '../invocation/invocation-audit-event.mapper';
import { AiInvocationHistoryStore } from '../invocation/invocation-history-store.types';
import { AiPurgeRefusedError } from './ai-purge.errors';
import type { AiPurgeCommand, AiPurgeResult } from './ai-purge.types';

/**
 * The retention of what was said to the AI (`US-15-05`, ADR-0020): purges the raw history of the calls created on or before the end
 * of a day, UTC, and keeps every call (`ai_invocations`). A live call (PENDING, RUNNING) is never in scope. PostgreSQL and MongoDB
 * share no transaction, so a purge has two steps. First, in one PostgreSQL transaction: each call gets a new purge generation and
 * the state PURGING (its content reads as not found from that commit on), its result is deleted (a COMPLETED call becomes STALE, so
 * it no longer holds the place of its queue revision), every snapshot not yet delivered is made obsolete, one tombstone per call is
 * queued, and `AI_INVOCATION.PURGED` (the count and the cut-off, never a content) is written. Then the tombstones are written into
 * MongoDB; the ones MongoDB did not take stay queued for the worker and for the next run, and the result says how many. A dry run
 * only counts. There is no principal: the command is the operator's, and the Audit Trail says so (`OPERATOR`).
 */
@Injectable()
export class AiPurgeApi {
  constructor(
    private readonly runner: TransactionRunner,
    private readonly history: AiInvocationHistoryStore,
    private readonly outbox: InvocationHistoryOutboxRepo,
    private readonly delivery: HistoryDeliveryService,
    private readonly organizations: OrganizationReadApi,
    private readonly audit: AuditApi,
  ) {}

  /** Throws AiPurgeRefusedError (nothing was written) for an apply with no operator, or with no organization to record it under. */
  async purge(command: AiPurgeCommand): Promise<AiPurgeResult> {
    // Created on or before the end of the day: before the start of the next one.
    const before = toDateColumn(addDays(command.through, 1));
    if (!command.apply) {
      const pending = await this.outbox.countPendingPurges();

      return {
        mode: 'DRY_RUN',
        through: command.through,
        contentCount: await this.history.countPurgeable(before),
        confirmedCount: 0,
        pendingCount: pending.waiting,
        parkedCount: pending.parked,
      };
    }
    const operator = command.operator;
    if (operator === null) throw new AiPurgeRefusedError('OPERATOR_REQUIRED');

    const purged = await this.runner.run(async (tx) => {
      const organization = await this.organizations.getOrganization(tx);
      if (organization === null) throw new AiPurgeRefusedError('NOT_INSTALLED');
      const count = await this.history.purge(tx, before);
      if (count === 0) return 0;
      await this.audit.record(
        tx,
        contentsPurgedEvent(organization.id, { deletedCount: count, through: command.through }, operator, randomUUID()),
      );

      return count;
    });
    const confirmed = await this.delivery.drainPurges();
    const pending = await this.outbox.countPendingPurges();

    return {
      mode: 'APPLIED',
      through: command.through,
      contentCount: purged,
      confirmedCount: confirmed,
      pendingCount: pending.waiting,
      parkedCount: pending.parked,
    };
  }
}
