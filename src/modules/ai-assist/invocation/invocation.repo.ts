import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { DbTx } from '../../../infrastructure/database/transaction-runner';
import { type InvocationResult, aiInvocationResultJson } from './invocation-result.json';
import type {
  InvocationKey,
  InvocationMetadata,
  InvocationOutcome,
  InvocationRecord,
  LiveInvocation,
  NewInvocation,
} from './invocation.types';

/** The statuses that hold the place of a queue revision: the partial unique index of the migration. */
const KEPT_STATUSES = ['PENDING', 'RUNNING', 'COMPLETED'] as const;
const LIVE_STATUSES = ['PENDING', 'RUNNING'] as const;
/** A history the purge took: what is left of the call is metadata that shows no summary. */
const PURGED_STATES = ['PURGING', 'PURGED'] as const;
const isKept = (status: string): status is LiveInvocation['status'] =>
  (KEPT_STATUSES as readonly string[]).includes(status);
/** The code of a run taken for stuck. */
const STUCK_CODE = 'AI.PROVIDER_TIMEOUT';

const NO_METADATA = {
  modelId: null,
  modelRevision: null,
  promptVersion: null,
  schemaVersion: null,
  configHash: null,
  latencyMs: null,
  promptTokens: null,
  completionTokens: null,
};

/** The columns of what the AI service said about itself; all NULL for a call it never answered. */
function metadataColumns(metadata: InvocationMetadata | null) {
  if (metadata === null) return NO_METADATA;
  const { configFingerprint, ...columns } = metadata;

  return { ...columns, configHash: configFingerprint };
}

/** The calls of one person and feature, whatever else the key object carries. */
const whose = (key: InvocationKey) => ({
  organizationId: key.organizationId,
  actorAppUserId: key.actorAppUserId,
  feature: key.feature,
});

/** A live call that started (or, never started, was made) before `startedBefore`. */
const stuckSince = (startedBefore: Date) => ({
  status: { in: [...LIVE_STATUSES] },
  OR: [{ startedAt: { lt: startedBefore } }, { startedAt: null, createdAt: { lt: startedBefore } }],
});

/**
 * The calls of the AI and the result their checks kept (`ai_invocations`, `ai_invocation_results`); what was said to the model is the
 * raw history in MongoDB, queued by `invocation-history/` in the same transactions. Every change of status is conditional
 * on the status it leaves, so a run that finishes late never overwrites a call that was taken for stuck, and the other way round.
 */
@Injectable()
export class AiInvocationRepo {
  constructor(private readonly prisma: PrismaService) {}

  /** A new call. A second call kept for the same revision is refused by the unique index (P2002). */
  async insert(tx: DbTx, input: NewInvocation): Promise<{ id: string }> {
    const row = await tx.aiInvocation.create({
      data: {
        organizationId: input.organizationId,
        feature: input.feature,
        actorAppUserId: input.actorAppUserId,
        actorEmployeeId: input.actorEmployeeId,
        status: input.status,
        sourceRevision: input.sourceRevision,
        errorCode: input.errorCode,
        createdAt: input.at,
        finishedAt: input.status === 'FAILED' ? input.at : null,
      },
      select: { id: true },
    });

    return { id: row.id };
  }

  /** The call kept for this queue revision of the person, if any. */
  async findLive(key: InvocationKey & { sourceRevision: string }, tx?: DbTx): Promise<LiveInvocation | null> {
    const row = await (tx ?? this.prisma).aiInvocation.findFirst({
      where: { ...whose(key), sourceRevision: key.sourceRevision, status: { in: [...KEPT_STATUSES] } },
      select: { id: true, status: true },
    });

    return row && isKept(row.status) ? { id: row.id, status: row.status } : null;
  }

  /** The live calls of the person that started before `startedBefore`. */
  async stuckOf(tx: DbTx, key: InvocationKey, startedBefore: Date): Promise<string[]> {
    const rows = await tx.aiInvocation.findMany({
      where: { ...whose(key), ...stuckSince(startedBefore) },
      select: { id: true },
      orderBy: { id: 'asc' },
    });

    return rows.map((row) => row.id);
  }

  /** Takes the call for stuck: FAILED with `AI.PROVIDER_TIMEOUT`, when it is still live and started before `startedBefore`. */
  async expire(tx: DbTx, id: string, startedBefore: Date, at: Date): Promise<boolean> {
    const { count } = await tx.aiInvocation.updateMany({
      where: { id, ...stuckSince(startedBefore) },
      data: { status: 'FAILED', errorCode: STUCK_CODE, finishedAt: at },
    });

    return count === 1;
  }

  /** PENDING → RUNNING; false when the call is no longer pending. */
  async markRunning(id: string, at: Date): Promise<boolean> {
    const { count } = await this.prisma.aiInvocation.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'RUNNING', startedAt: at },
    });

    return count === 1;
  }

  /** RUNNING → the outcome, with the result of the checks when they ran; false (and nothing written) when the call is no longer running. */
  async finish(tx: DbTx, id: string, outcome: InvocationOutcome, at: Date): Promise<boolean> {
    const { count } = await tx.aiInvocation.updateMany({
      where: { id, status: 'RUNNING' },
      data: {
        status: outcome.status,
        errorCode: outcome.errorCode,
        finishedAt: at,
        ...metadataColumns(outcome.metadata),
      },
    });
    if (count !== 1) return false;
    const result = outcome.content?.result ?? null;
    if (result !== null) {
      await tx.aiInvocationResult.create({
        data: { invocationId: id, result: aiInvocationResultJson.encode(result), createdAt: at },
      });
    }

    return true;
  }

  /**
   * The call if this account made it, with the result of its checks; null for a call of anybody else, and for a call whose history
   * was purged (`ops:ai-purge`): what is left of it is metadata that shows no summary.
   */
  async findOwned(id: string, actorAppUserId: string, tx?: DbTx): Promise<InvocationRecord | null> {
    const row = await (tx ?? this.prisma).aiInvocation.findFirst({
      where: { id, actorAppUserId, historyState: { notIn: [...PURGED_STATES] } },
      select: {
        id: true,
        organizationId: true,
        feature: true,
        actorAppUserId: true,
        actorEmployeeId: true,
        status: true,
        sourceRevision: true,
        errorCode: true,
        createdAt: true,
        startedAt: true,
        result: { select: { result: true } },
      },
    });
    if (!row) return null;
    const { result, ...invocation } = row;

    return { ...invocation, result: result === null ? null : aiInvocationResultJson.decode(result.result) };
  }

  /** The result the checks kept for the call, or null when they never ran (or a purge deleted it). */
  async resultOf(tx: DbTx, id: string): Promise<InvocationResult | null> {
    const row = await tx.aiInvocationResult.findUnique({ where: { invocationId: id }, select: { result: true } });

    return row === null ? null : aiInvocationResultJson.decode(row.result);
  }

  /**
   * The part of a purge that is the call's own: the result the summary of the owner was built from is deleted, and a COMPLETED call
   * becomes STALE in the same transaction, so it no longer holds the place of its queue revision (the partial unique index keeps
   * PENDING, RUNNING, COMPLETED) and asking again for an unchanged queue makes a new call. The caller locked the calls. The ids go
   * as one array parameter, never one bind parameter each: a purge can hold more calls than PostgreSQL takes parameters.
   */
  async dropResults(tx: DbTx, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await tx.$executeRaw`UPDATE ai_invocations SET status = 'STALE' WHERE id = ANY(${ids}::uuid[]) AND status = 'COMPLETED'`;
    await tx.$executeRaw`DELETE FROM ai_invocation_results WHERE invocation_id = ANY(${ids}::uuid[])`;
  }
}
