import { Injectable } from '@nestjs/common';
import { TransactionRunner } from '../../../infrastructure/database/transaction-runner';
import type { AuthenticatedPrincipal } from '../../../infrastructure/security/tokens/access-token-verifier.port';
import { AuditApi } from '../../audit/public/audit.api';
import { MongoInvocationHistoryRepo } from '../invocation-history/invocation-history-mongo.repo';
import { contentReadEvent } from '../invocation/invocation-audit-event.mapper';
import type { InvocationContentRecord } from '../invocation/invocation.types';
import { InvocationContentNotFoundError } from './invocation-content.errors';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The content of a call as the Super Admin reads it: what was sent, what came back and what the checks kept. */
export type InvocationContentView = Omit<InvocationContentRecord, 'organizationId'>;

/**
 * The content of one call of the AI for the Super Admin (`OQ-G-06`): the only way to read what was said to the model and what it
 * answered. Who may call is decided by the route (`SUPER_ADMIN`). Three phases (ADR-0020, and the rule of `TransactionRunner` that a
 * network call does not belong inside a transaction): PostgreSQL decides whether the history may be read and MongoDB is read, both
 * before any transaction; then one short transaction locks the call, checks it again and writes `AI_INVOCATION.CONTENT_READ`. The
 * content is returned only after that commit, so it is never given without its event, and the event names the call only.
 * The WDP adapter is used directly, not through the port `find`, because the port reads in the transaction of its caller.
 */
@Injectable()
export class InvocationContentQueryService {
  constructor(
    private readonly runner: TransactionRunner,
    private readonly history: MongoInvocationHistoryRepo,
    private readonly audit: AuditApi,
  ) {}

  /**
   * Throws InvocationContentNotFoundError for an id that has no content (never made, or purged), InvocationContentPendingError
   * (not in MongoDB yet) or InvocationContentUnavailableError (MongoDB down or refusing); nothing is recorded then.
   */
  async read(actor: AuthenticatedPrincipal, invocationId: string): Promise<InvocationContentView> {
    if (!UUID.test(invocationId)) throw new InvocationContentNotFoundError();
    const prepared = await this.history.prepareRead(invocationId);
    if (prepared === null) throw new InvocationContentNotFoundError();

    return this.runner.run(async (tx) => {
      const found = await this.history.confirmRead(tx, prepared);
      if (found === null) throw new InvocationContentNotFoundError();
      const { organizationId, ...content } = found;
      await this.audit.record(
        tx,
        contentReadEvent(
          { appUserId: actor.appUserId, roles: actor.roles, sessionId: actor.sessionId },
          organizationId,
          invocationId,
        ),
      );

      return content;
    });
  }
}
