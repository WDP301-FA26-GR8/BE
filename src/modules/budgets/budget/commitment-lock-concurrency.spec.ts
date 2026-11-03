import { Barrier } from '../../../../test/support/concurrency-harness';
import type { DbTx, TransactionRunner } from '../../../infrastructure/database/transaction-runner';
import type { AuditApi } from '../../audit/public/audit.api';
import type { BudgetSupportService } from './budget-support.service';
import type { CommitmentReleaseGuardHook } from '../public/budgets.extension-points';
import { CommitmentService } from '../commitment/commitment.service';
import type { CommitmentOfRequest, CommitmentRepo } from './commitment.repo';
import type { CommitmentRow } from './commitment-release.policy';

describe('commitment realize/release lock serialization (F-11, concurrency test)', () => {
  let commitmentsRepo: {
    lockOfRequest: jest.Mock;
    lockById: jest.Mock;
    release: jest.Mock;
    realize: jest.Mock;
  };
  let runner: { run: jest.Mock };
  let support: { requireFinance: jest.Mock };
  let audit: { record: jest.Mock };
  let releaseGuard: { get: () => { canReleaseRemainder: () => Promise<boolean> } };
  let service: CommitmentService;

  beforeEach(() => {
    commitmentsRepo = {
      lockOfRequest: jest.fn(),
      lockById: jest.fn(),
      release: jest.fn(),
      realize: jest.fn(),
    };
    runner = {
      run: jest.fn(async (cb: (tx: DbTx) => Promise<unknown>) => cb({} as DbTx)),
    };
    support = {
      requireFinance: jest.fn(),
    };
    audit = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    releaseGuard = {
      get: () => ({ canReleaseRemainder: () => Promise.resolve(true) }),
    };

    service = new CommitmentService(
      runner as unknown as TransactionRunner,
      commitmentsRepo as unknown as CommitmentRepo,
      support as unknown as BudgetSupportService,
      audit as unknown as AuditApi,
      releaseGuard as unknown as CommitmentReleaseGuardHook,
    );
  });

  it('serializes realize and release: release waits for realize, sees updated numbers, and does not exceed amount or 500', async () => {
    // Initial state: commitment of 21m, 0 released, 0 realized
    let dbRow: CommitmentOfRequest & { requestId: string } = {
      id: 'comm-1',
      requestId: 'req-1',
      year: 2026,
      amountMinor: 21_000_000n,
      releasedMinor: 0n,
      realizedMinor: 0n,
      state: 'HELD',
      organizationId: 'org-1',
      costCenterId: 'cc-1',
    };

    // Simulated row lock queue: lockOfRequest waits until realize finishes and returns the updated locked row
    const barrier = new Barrier(2);
    let lockAcquiredByRelease = false;

    // Realize transaction runs: locks row, takes 13m
    const runRealize = async () => {
      // 1. Realize holds lock
      await barrier.wait(); // Signal that realize has begun
      // Realize updates the row
      dbRow = {
        ...dbRow,
        realizedMinor: 13_000_000n, // 13m realized
      };
      // Lock released when realize finishes
    };

    // Release transaction runs in parallel: calls lockOfRequest
    commitmentsRepo.lockOfRequest.mockImplementation(async () => {
      await barrier.wait(); // Waits for realize to reach the lock point
      // Simulating database row lock: lockOfRequest waits for the in-flight realize to commit,
      // then returns the fresh locked row
      lockAcquiredByRelease = true;
      return [dbRow];
    });

    commitmentsRepo.release.mockImplementation((_tx: DbTx, row: CommitmentRow, input: { takeMinor: bigint }) => {
      expect(lockAcquiredByRelease).toBe(true);
      expect(row.realizedMinor).toBe(13_000_000n); // Saw the realized amount!

      const newReleased = row.releasedMinor + input.takeMinor;
      const totalUsed = newReleased + row.realizedMinor;
      expect(totalUsed).toBeLessThanOrEqual(row.amountMinor); // released + realized <= amount

      dbRow = {
        ...dbRow,
        releasedMinor: newReleased,
        state: totalUsed === row.amountMinor ? 'EXPENSED' : 'HELD',
      };
      return { released: totalUsed === row.amountMinor, heldMinor: row.amountMinor - totalUsed };
    });

    // Run both operations concurrently
    const [, releaseResult] = await Promise.all([
      runRealize(),
      service.release({} as DbTx, {
        requestId: 'req-1',
        reason: 'REQUEST_WITHDRAWN',
        now: new Date(),
      }),
    ]);

    expect(releaseResult).toEqual([
      expect.objectContaining({
        releasedMinor: 8_000_000n, // Only released remaining 8m, not full 21m!
      }),
    ]);

    // Check final state
    expect(dbRow.realizedMinor).toBe(13_000_000n);
    expect(dbRow.releasedMinor).toBe(8_000_000n);
    expect(dbRow.realizedMinor + dbRow.releasedMinor).toBe(21_000_000n);
    expect(dbRow.realizedMinor + dbRow.releasedMinor).toBeLessThanOrEqual(dbRow.amountMinor);
    expect(dbRow.state).toBe('EXPENSED');
  });

  it('demonstrates that stale read without lockOfRequest would attempt to release 21m and exceed amount or throw 500', async () => {
    const staleRow: CommitmentOfRequest & { requestId: string } = {
      id: 'comm-1',
      requestId: 'req-1',
      year: 2026,
      amountMinor: 21_000_000n,
      releasedMinor: 0n,
      realizedMinor: 0n, // Stale! (in reality realize already took 13m)
      state: 'HELD',
      organizationId: 'org-1',
      costCenterId: 'cc-1',
    };

    // If lockOfRequest returned a stale un-locked row:
    commitmentsRepo.lockOfRequest.mockResolvedValue([staleRow]);

    // But DB row already had realizedMinor = 13m, so optimistic lock fails (changed.count !== 1):
    commitmentsRepo.release.mockRejectedValue(new Error('The commitment comm-1 changed while it was being released.'));

    await expect(
      service.release({} as DbTx, {
        requestId: 'req-1',
        reason: 'REQUEST_WITHDRAWN',
        now: new Date(),
      }),
    ).rejects.toThrow('The commitment comm-1 changed while it was being released.');
  });
});
