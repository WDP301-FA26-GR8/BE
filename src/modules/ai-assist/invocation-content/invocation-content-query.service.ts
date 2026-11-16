import { Injectable } from '@nestjs/common';
import { TransactionRunner } from '../../../infrastructure/database/transaction-runner';
import { MongoUnavailableError } from '../../../infrastructure/mongodb/mongodb.errors';
import type { AuthenticatedPrincipal } from '../../../infrastructure/security/tokens/access-token-verifier.port';
import { AuditApi } from '../../audit/public/audit.api';
import { InvocationHistoryOutboxRepo } from '../invocation-history/invocation-history-outbox.repo';
import { InvocationHistoryStoreRepo } from '../invocation-history/invocation-history-store.repo';
import { HistoryDocumentShapeError } from '../invocation-history/invocation-history.errors';
import type { HistoryDocument, HistoryStanding } from '../invocation-history/invocation-history.types';
import { contentReadEvent } from '../invocation/invocation-audit-event.mapper';
import type { InvocationResult } from '../invocation/invocation-result.json';
import { AiInvocationRepo } from '../invocation/invocation.repo';
import {
  InvocationContentNotFoundError,
  InvocationContentPendingError,
  InvocationContentUnavailableError,
} from './invocation-content.errors';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The content of a call as the Super Admin reads it: what was sent, what came back and what the checks kept. */
export interface InvocationContentView {
  invocationId: string;
  context: NonNullable<HistoryDocument['context']>;
  promptText: string | null;
  rawResponse: string | null;
  parsed: HistoryDocument['parsed'];
  result: InvocationResult | null;
}

/** Whether PostgreSQL lets the history be read now; throws the refusal the state stands for. */
function assertReadable(standing: HistoryStanding | null): asserts standing is HistoryStanding {
  if (standing === null || standing.state === 'PURGING' || standing.state === 'PURGED') {
    throw new InvocationContentNotFoundError();
  }
  if (standing.state === 'ERROR') throw new InvocationContentUnavailableError();
  if (standing.state !== 'AVAILABLE' || standing.storedVersion < standing.version)
    throw new InvocationContentPendingError();
}

type LiveDocument = HistoryDocument & { context: NonNullable<HistoryDocument['context']> };

/** The document, when it is the one PostgreSQL confirmed: the same purge generation and the last version, with content. */
function currentDocument(document: HistoryDocument | null, standing: HistoryStanding): LiveDocument {
  if (document === null || document.version < standing.version) throw new InvocationContentPendingError();
  if (document.purged || document.generation !== standing.generation) throw new InvocationContentNotFoundError();
  const { context } = document;
  if (context === null) throw new InvocationContentUnavailableError();

  return { ...document, context };
}

/**
 * The content of one call of the AI for the Super Admin (`OQ-G-06`): the only way to read what was said to the model and what it
 * answered. The raw history is in MongoDB and the result in PostgreSQL (ADR-0020). PostgreSQL decides first whether the history may
 * be read (purged reads as not found, not delivered yet as pending); MongoDB is read outside any transaction; then a short
 * transaction locks the call, checks that nothing changed meanwhile (a purge, a newer snapshot), reads the result and writes
 * `AI_INVOCATION.CONTENT_READ`. The content is returned only after that commit: never without its event, never older than the state
 * the event was written in.
 */
@Injectable()
export class InvocationContentQueryService {
  constructor(
    private readonly runner: TransactionRunner,
    private readonly invocations: AiInvocationRepo,
    private readonly outbox: InvocationHistoryOutboxRepo,
    private readonly store: InvocationHistoryStoreRepo,
    private readonly audit: AuditApi,
  ) {}

  /**
   * Throws InvocationContentNotFoundError (never made, or purged), InvocationContentPendingError (not in MongoDB yet) or
   * InvocationContentUnavailableError (MongoDB down or refusing); nothing is recorded then.
   */
  async read(actor: AuthenticatedPrincipal, invocationId: string): Promise<InvocationContentView> {
    if (!UUID.test(invocationId)) throw new InvocationContentNotFoundError();
    const standing = await this.outbox.standingOf(invocationId);
    assertReadable(standing);
    const document = currentDocument(await this.documentOf(invocationId, standing.organizationId), standing);

    return this.runner.run(async (tx) => {
      const now = await this.outbox.standingOf(invocationId, tx, true);
      assertReadable(now);
      if (now.generation !== document.generation || now.version !== document.version) {
        throw new InvocationContentPendingError();
      }
      const result = await this.invocations.resultOf(tx, invocationId);
      await this.audit.record(
        tx,
        contentReadEvent(
          { appUserId: actor.appUserId, roles: actor.roles, sessionId: actor.sessionId },
          now.organizationId,
          invocationId,
        ),
      );

      return {
        invocationId,
        context: document.context,
        promptText: document.promptText,
        rawResponse: document.rawResponse,
        parsed: document.parsed,
        result,
      };
    });
  }

  private async documentOf(invocationId: string, organizationId: string): Promise<HistoryDocument | null> {
    try {
      return await this.store.find(invocationId, organizationId);
    } catch (error) {
      if (error instanceof MongoUnavailableError || error instanceof HistoryDocumentShapeError) {
        throw new InvocationContentUnavailableError({ cause: error });
      }
      throw error;
    }
  }
}
