import { Prisma } from '../../../generated/prisma/client';
import type { DbTx, TransactionRunner } from '../../../infrastructure/database/transaction-runner';
import type { AuthenticatedPrincipal } from '../../../infrastructure/security/tokens/access-token-verifier.port';
import type { AuditApi } from '../../audit/public/audit.api';
import type { CatalogApi } from '../../catalog/public/catalog.api';
import type { FinanceApi } from '../../finance/public/finance.api';
import type { OrganizationApi } from '../../organization/public/organization.api';
import type { BudgetSupportService } from '../budget/budget-support.service';
import { InternalCostService } from './internal-cost.service';
import type { CreateInternalCostRecord, InternalCostRepo, InternalCostRow } from './internal-cost.repo';

describe('InternalCostService.record amountRate persistence', () => {
  const actor: AuthenticatedPrincipal = {
    subject: 'sub-1',
    appUserId: 'user-1',
    sessionId: 'session-1',
    employeeId: 'emp-1',
    directRoles: ['FINANCE'],
    derivedRoles: [],
    roles: ['FINANCE'],
  };

  const createMockRow = (data: CreateInternalCostRecord): InternalCostRow => ({
    id: 'row-1',
    organizationId: data.organizationId,
    applicationId: data.applicationId,
    costCenterId: data.costCenterId,
    amountCurrency: data.amountCurrency,
    periodStart: new Date(`${data.periodStart}T00:00:00.000Z`),
    periodEnd: new Date(`${data.periodEnd}T00:00:00.000Z`),
    amountMinor: data.amountMinor,
    amountRate: new Prisma.Decimal(data.amountRate.toString()),
    amountRateDate: new Date(`${data.amountRateDate}T00:00:00.000Z`),
    amountRateSource: data.amountRateSource,
    amountReportingMinor: data.amountReportingMinor,
    note: data.note,
    cancelReason: null,
    recordedAt: new Date('2026-10-01T00:00:00.000Z'),
    cancelledAt: null,
    recordedByEmployeeId: data.recordedByEmployeeId,
    application: { id: data.applicationId, name: 'Internal Tool' },
    costCenter: { id: data.costCenterId, code: 'CC01', name: 'Engineering' },
  });

  it.each([
    ['manual exchange rate for USD', 25_000_0000000000n, 'MANUAL', '25000'],
    ['same currency rate for VND', 10_000_000000n, 'SAME_CURRENCY', '1'],
  ] as const)(
    'formats scaled rate to decimal string %s before passing to repo.insert',
    async (_label, scaledRate, rateSource, expectedRateString) => {
      let insertedData: CreateInternalCostRecord | null = null;
      const repo = {
        insert: jest.fn((_tx: DbTx, data: CreateInternalCostRecord) => {
          insertedData = data;
          return Promise.resolve(createMockRow(data));
        }),
      } as unknown as InternalCostRepo;

      const support = {
        requireFinance: jest.fn(),
        organizationId: jest.fn(() => Promise.resolve('org-1')),
      } as unknown as BudgetSupportService;

      const finance = {
        parseMoney: jest.fn(({ amount, currency }: { amount: string; currency: string }) =>
          Promise.resolve({
            amountMinor: BigInt(amount) * 100n,
            currency,
          }),
        ),
        snapshotMoney: jest.fn((_tx: DbTx, money: { amountMinor: bigint; currency: string }, date: string) =>
          Promise.resolve({
            status: 'OK',
            snapshot: {
              rate: scaledRate,
              rateDate: date,
              rateSource,
              reportingAmountMinor: money.amountMinor * 25000n,
              reportingCurrency: 'VND',
              exchangeRateId: null,
            },
          }),
        ),
        findCurrency: jest.fn((code: string) => Promise.resolve({ code, name: code, minorUnit: 2 })),
      } as unknown as FinanceApi;

      const organization = {
        lockCostCentersShared: jest.fn(() =>
          Promise.resolve([{ id: 'cc-1', kind: 'UNIT', code: 'CC01', status: 'ACTIVE' }]),
        ),
      } as unknown as OrganizationApi;

      const catalog = {
        lockApplicationShared: jest.fn(() => Promise.resolve({ id: 'app-1', kind: 'INTERNAL' })),
      } as unknown as CatalogApi;

      const audit = {
        record: jest.fn(),
      } as unknown as AuditApi;

      const txRunner = {
        run: jest.fn(async (callback: (tx: DbTx) => Promise<unknown>) => callback({} as DbTx)),
      } as unknown as TransactionRunner;

      const service = new InternalCostService(repo, support, finance, organization, catalog, audit, txRunner);

      await service.record(actor, {
        applicationId: 'app-1',
        costCenterId: 'cc-1',
        amount: '1000',
        currency: 'USD',
        periodStart: '2026-10-01',
        periodEnd: '2026-10-31',
      });

      expect(insertedData).not.toBeNull();
      expect(typeof (insertedData as unknown as CreateInternalCostRecord).amountRate).toBe('string');
      expect((insertedData as unknown as CreateInternalCostRecord).amountRate).toBe(expectedRateString);
    },
  );
});
