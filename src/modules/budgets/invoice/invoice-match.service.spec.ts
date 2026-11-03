import type { DbTx, TransactionRunner } from '../../../infrastructure/database/transaction-runner';
import type { AuthenticatedPrincipal } from '../../../infrastructure/security/tokens/access-token-verifier.port';
import type { AuditApi } from '../../audit/public/audit.api';
import type { BudgetSupportService } from '../budget/budget-support.service';
import { BudgetCommitmentNotFoundError, BudgetNotFinanceError } from '../budget/budget.errors';
import type { CommitmentRepo } from '../budget/commitment.repo';
import { CommitmentVendorHook } from '../public/budgets.extension-points';
import { InvoiceLineNotFoundError, InvoiceMatchRefusedError, InvoiceNotFoundError } from './invoice.errors';
import { InvoiceMatchService } from './invoice-match.service';
import type { InvoiceRepo } from './invoice.repo';

describe('InvoiceMatchService (B07-8 Step 5)', () => {
  const anyDate: unknown = expect.any(Date);
  let runner: { run: jest.Mock };
  let invoiceRepo: {
    lockInvoice: jest.Mock;
    findLine: jest.Mock;
    findInvoice: jest.Mock;
    findMatches: jest.Mock;
    setLineCostCenterIfNull: jest.Mock;
  };
  let commitments: {
    findScope: jest.Mock;
    lockById: jest.Mock;
    realize: jest.Mock;
  };
  let yearLock: { lock: jest.Mock };
  let support: { requireFinance: jest.Mock; reportingCurrency: jest.Mock; formatter: jest.Mock };
  let audit: { record: jest.Mock };
  let vendorHook: CommitmentVendorHook;
  let vendorReader: { getVendorId: jest.Mock };
  let service: InvoiceMatchService;

  const financeActor: AuthenticatedPrincipal = {
    subject: 'sub-1',
    appUserId: 'user-1',
    sessionId: 'session-1',
    employeeId: 'emp-1',
    directRoles: ['FINANCE'],
    derivedRoles: [],
    roles: ['FINANCE'],
  };

  const nonFinanceActor: AuthenticatedPrincipal = {
    ...financeActor,
    roles: ['IT_ADMIN'],
  };

  const invoice = {
    id: 'inv-1',
    organizationId: 'org-1',
    vendorId: 'vendor-1',
    kind: 'INVOICE',
  };

  const line = {
    id: 'line-1',
    position: 1,
    costCenterId: null as string | null,
    fiscalYear: 2026,
    costReportingMinor: 20_000_000n,
    realizationId: null as string | null,
  };

  const commitment = {
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

  beforeEach(() => {
    runner = {
      run: jest.fn(async (cb: (tx: DbTx) => Promise<unknown>) => cb({} as DbTx)),
    };
    invoiceRepo = {
      lockInvoice: jest.fn().mockResolvedValue(invoice),
      findLine: jest.fn().mockResolvedValue(line),
      findInvoice: jest.fn().mockResolvedValue(invoice),
      findMatches: jest.fn().mockResolvedValue([]),
      setLineCostCenterIfNull: jest.fn().mockResolvedValue(true),
    };
    commitments = {
      findScope: jest.fn().mockResolvedValue({ costCenterId: 'cc-1', year: 2026 }),
      lockById: jest.fn().mockResolvedValue(commitment),
      realize: jest.fn().mockResolvedValue({ expensed: false, heldMinor: 1_000_000n }),
    };
    yearLock = {
      lock: jest.fn().mockResolvedValue(undefined),
    };
    support = {
      reportingCurrency: jest.fn().mockResolvedValue('VND'),
      formatter: jest.fn().mockResolvedValue((minor: bigint) => ({ amount: minor.toString(), currency: 'VND' })),
      requireFinance: jest.fn((actor: AuthenticatedPrincipal) => {
        if (!actor.roles.includes('FINANCE')) throw new BudgetNotFinanceError();
      }),
    };
    audit = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    vendorReader = {
      getVendorId: jest.fn().mockResolvedValue('vendor-1'),
    };
    vendorHook = new CommitmentVendorHook();
    vendorHook.bind(vendorReader);

    service = new InvoiceMatchService(
      runner as unknown as TransactionRunner,
      invoiceRepo as unknown as InvoiceRepo,
      commitments as unknown as CommitmentRepo,
      yearLock,
      support as unknown as BudgetSupportService,
      audit as unknown as AuditApi,
      vendorHook,
    );
  });

  describe('match', () => {
    it('rejects caller without FINANCE role', async () => {
      await expect(service.match(nonFinanceActor, 'inv-1', 1, 'comm-1')).rejects.toThrow(BudgetNotFinanceError);
      expect(runner.run).not.toHaveBeenCalled();
    });

    it('throws InvoiceNotFoundError when invoice is not found', async () => {
      invoiceRepo.lockInvoice.mockResolvedValue(null);

      await expect(service.match(financeActor, 'inv-1', 1, 'comm-1')).rejects.toThrow(InvoiceNotFoundError);
      expect(commitments.findScope).not.toHaveBeenCalled();
    });

    it('throws InvoiceLineNotFoundError when line position is not found on invoice', async () => {
      invoiceRepo.findLine.mockResolvedValue(null);

      await expect(service.match(financeActor, 'inv-1', 99, 'comm-1')).rejects.toThrow(InvoiceLineNotFoundError);
      expect(commitments.findScope).not.toHaveBeenCalled();
    });

    it('throws BudgetCommitmentNotFoundError when commitment scope is not found', async () => {
      commitments.findScope.mockResolvedValue(null);

      await expect(service.match(financeActor, 'inv-1', 1, 'comm-not-found')).rejects.toThrow(
        BudgetCommitmentNotFoundError,
      );
      expect(yearLock.lock).not.toHaveBeenCalled();
      expect(commitments.lockById).not.toHaveBeenCalled();
    });

    it('throws BudgetCommitmentNotFoundError when commitment is not found in lockById', async () => {
      commitments.lockById.mockResolvedValue(null);

      await expect(service.match(financeActor, 'inv-1', 1, 'comm-not-found')).rejects.toThrow(
        BudgetCommitmentNotFoundError,
      );
      expect(yearLock.lock).toHaveBeenCalledWith(expect.anything(), 'cc-1', [2026]);
      expect(commitments.realize).not.toHaveBeenCalled();
    });

    it('enforces strict lock order: 1. invoice -> 2. yearLock -> 3. commitment', async () => {
      const callOrder: string[] = [];
      invoiceRepo.lockInvoice.mockImplementation(() => {
        callOrder.push('lockInvoice');
        return Promise.resolve(invoice);
      });
      commitments.findScope.mockImplementation(() => {
        callOrder.push('findScope');
        return Promise.resolve({ costCenterId: 'cc-1', year: 2026 });
      });
      yearLock.lock.mockImplementation(() => {
        callOrder.push('yearLock');
        return Promise.resolve();
      });
      commitments.lockById.mockImplementation(() => {
        callOrder.push('lockById');
        return Promise.resolve(commitment);
      });

      await service.match(financeActor, 'inv-1', 1, 'comm-1');

      expect(callOrder).toEqual(['lockInvoice', 'findScope', 'yearLock', 'lockById']);
    });

    it('rejects match and throws InvoiceMatchRefusedError when policy refuses', async () => {
      vendorReader.getVendorId.mockResolvedValue('other-vendor'); // VENDOR_MISMATCH

      await expect(service.match(financeActor, 'inv-1', 1, 'comm-1')).rejects.toThrow(InvoiceMatchRefusedError);
      expect(commitments.realize).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('matches line, realizes commitment, updates line cost center when null, and writes audit', async () => {
      const result = await service.match(financeActor, 'inv-1', 1, 'comm-1');

      expect(result).toEqual({
        commitmentId: 'comm-1',
        invoiceId: 'inv-1',
        invoiceLineId: 'line-1',
        position: 1,
        matched: { amount: '20000000', currency: 'VND' },
        held: { amount: '1000000', currency: 'VND' },
        expensed: false,
      });

      expect(commitments.realize).toHaveBeenCalledWith(expect.anything(), commitment, {
        takeMinor: 20_000_000n,
        invoiceLineId: 'line-1',
        employeeId: 'emp-1',
        now: anyDate,
      });

      // Line had null costCenterId, inherits commitment's costCenterId
      expect(invoiceRepo.setLineCostCenterIfNull).toHaveBeenCalledWith(expect.anything(), 'line-1', 'cc-1');

      // Audit recorded
      expect(audit.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          organizationId: 'org-1',
          action: 'BUDGET_COMMITMENT.REALIZED',
          resourceType: 'BUDGET_COMMITMENT',
          resourceId: 'comm-1',
          after: {
            requestId: 'req-1',
            year: 2026,
            invoiceId: 'inv-1',
            position: 1,
            amountMinor: '20000000',
            heldMinor: '1000000',
            costCenterId: 'cc-1',
          },
        }),
      );
    });

    it('preserves existing different costCenterId on line and records both in audit (F-21)', async () => {
      invoiceRepo.findLine.mockResolvedValue({
        ...line,
        costCenterId: 'cc-other',
      });

      const result = await service.match(financeActor, 'inv-1', 1, 'comm-1');

      expect(result.matched).toEqual({ amount: '20000000', currency: 'VND' });
      expect(invoiceRepo.setLineCostCenterIfNull).not.toHaveBeenCalled();

      expect(audit.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          after: {
            requestId: 'req-1',
            year: 2026,
            invoiceId: 'inv-1',
            position: 1,
            amountMinor: '20000000',
            heldMinor: '1000000',
            costCenterId: 'cc-1',
            lineCostCenterId: 'cc-other',
          },
        }),
      );
    });
  });

  describe('listMatches', () => {
    it('rejects caller without FINANCE role', async () => {
      await expect(service.listMatches(nonFinanceActor, 'inv-1', { page: 1, pageSize: 20 })).rejects.toThrow(
        BudgetNotFinanceError,
      );
    });

    it('throws InvoiceNotFoundError when invoice is not found', async () => {
      invoiceRepo.findInvoice.mockResolvedValue(null);

      await expect(service.listMatches(financeActor, 'inv-not-found', { page: 1, pageSize: 20 })).rejects.toThrow(
        InvoiceNotFoundError,
      );
    });

    it('returns match records for the invoice with pagination', async () => {
      const matchRecords = [
        {
          id: 'real-1',
          commitmentId: 'comm-1',
          invoiceLineId: 'line-1',
          position: 1,
          amountMinor: 20_000_000n,
          recordedAt: new Date(),
          recordedByEmployeeId: 'emp-1',
        },
      ];
      invoiceRepo.findMatches.mockResolvedValue({ items: matchRecords, total: 1 });

      const result = await service.listMatches(financeActor, 'inv-1', { page: 1, pageSize: 20 });

      const { amountMinor, recordedAt, ...record } = matchRecords[0];
      expect(result.items).toEqual([
        {
          ...record,
          amount: { amount: amountMinor.toString(), currency: 'VND' },
          recordedAt: recordedAt.toISOString(),
        },
      ]);
      expect(result.pagination).toEqual({ page: 1, pageSize: 20, totalItems: 1, totalPages: 1 });
      expect(invoiceRepo.findMatches).toHaveBeenCalledWith('inv-1', { skip: 0, take: 20 });
    });
  });
});
