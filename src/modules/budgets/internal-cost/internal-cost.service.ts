import { Injectable } from '@nestjs/common';
import { fromDateColumn } from '../../../core/business-date';
import { formatAmount } from '../../../core/money/money';
import { formatRate } from '../../../core/money/rate';
import { TransactionRunner } from '../../../infrastructure/database/transaction-runner';
import type { AuthenticatedPrincipal } from '../../../infrastructure/security/tokens/access-token-verifier.port';
import { AuditApi } from '../../audit/public/audit.api';
import { CatalogApi } from '../../catalog/public/catalog.api';
import { FinanceApi } from '../../finance/public/finance.api';
import { OrganizationApi } from '../../organization/public/organization.api';
import { budgetAuditEvent, BudgetSupportService } from '../budget/budget-support.service';
import type { CancelInternalCostDto, InternalCostDetail, RecordInternalCostDto } from './internal-cost.dto';
import {
  InternalCostAlreadyCancelledError,
  InternalCostApplicationNotFoundError,
  InternalCostApplicationNotInternalError,
  InternalCostCostCenterInactiveError,
  InternalCostCostCenterInvalidError,
  InternalCostCostCenterNotFoundError,
  InternalCostNotFoundError,
  InternalCostPeriodInvalidError,
  InternalCostRateMissingError,
  InternalCostReasonRequiredError,
} from './internal-cost.errors';
import { InternalCostRepo, type InternalCostRow } from './internal-cost.repo';

@Injectable()
export class InternalCostService {
  constructor(
    private readonly repo: InternalCostRepo,
    private readonly support: BudgetSupportService,
    private readonly finance: FinanceApi,
    private readonly organization: OrganizationApi,
    private readonly catalog: CatalogApi,
    private readonly audit: AuditApi,
    private readonly txRunner: TransactionRunner,
  ) {}

  async record(actor: AuthenticatedPrincipal, input: RecordInternalCostDto): Promise<InternalCostDetail> {
    this.support.requireFinance(actor);

    if (input.periodEnd < input.periodStart) {
      throw new InternalCostPeriodInvalidError();
    }

    return this.txRunner.run(async (tx) => {
      // 1. Lock Cost Center shared
      const costCenters = await this.organization.lockCostCentersShared(tx, [input.costCenterId]);
      const costCenter = costCenters[0];
      if (!costCenter) {
        throw new InternalCostCostCenterNotFoundError();
      }
      if (costCenter.kind !== 'UNIT' || costCenter.code.toUpperCase() === 'COMPANY') {
        throw new InternalCostCostCenterInvalidError();
      }
      if (costCenter.status !== 'ACTIVE') {
        throw new InternalCostCostCenterInactiveError();
      }

      // 2. Lock Application shared
      const application = await this.catalog.lockApplicationShared(tx, input.applicationId);
      if (!application) {
        throw new InternalCostApplicationNotFoundError();
      }
      if (application.kind !== 'INTERNAL') {
        throw new InternalCostApplicationNotInternalError();
      }

      // 3. Snapshot money
      const money = await this.finance.parseMoney({ amount: input.amount, currency: input.currency }, tx);
      const snapshot = await this.finance.snapshotMoney(tx, money, input.periodStart);
      if (snapshot.status === 'MISSING_RATE') {
        throw new InternalCostRateMissingError();
      }

      const orgId = await this.support.organizationId(tx);

      // 4. Insert row
      const row = await this.repo.insert(tx, {
        organizationId: orgId,
        applicationId: input.applicationId,
        costCenterId: input.costCenterId,
        amountCurrency: input.currency,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        amountMinor: money.amountMinor,
        amountRate: formatRate(snapshot.snapshot.rate),
        amountRateDate: snapshot.snapshot.rateDate,
        amountRateSource: snapshot.snapshot.rateSource,
        amountReportingMinor: snapshot.snapshot.reportingAmountMinor,
        note: input.note ? input.note.trim() : null,
        recordedByEmployeeId: actor.employeeId,
      });

      // 5. Audit event
      await this.audit.record(
        tx,
        budgetAuditEvent(actor, orgId, 'INTERNAL_COST.RECORDED', 'INTERNAL_COST_ENTRY', row.id, {
          applicationId: input.applicationId,
          costCenterId: input.costCenterId,
          amountMinor: money.amountMinor.toString(),
          amountCurrency: input.currency,
          amountReportingMinor: snapshot.snapshot.reportingAmountMinor.toString(),
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
        }),
      );

      return this.formatRow(row, snapshot.snapshot.reportingCurrency);
    });
  }

  async cancel(actor: AuthenticatedPrincipal, id: string, input: CancelInternalCostDto): Promise<InternalCostDetail> {
    this.support.requireFinance(actor);

    const reason = input.reason?.trim();
    if (!reason) {
      throw new InternalCostReasonRequiredError();
    }

    return this.txRunner.run(async (tx) => {
      const locked = await this.repo.lockById(tx, id);
      if (!locked) {
        throw new InternalCostNotFoundError();
      }
      if (locked.cancelledAt !== null) {
        throw new InternalCostAlreadyCancelledError();
      }

      const orgId = await this.support.organizationId(tx);
      const now = new Date();
      const updated = await this.repo.cancel(tx, id, reason, now);

      await this.audit.record(
        tx,
        budgetAuditEvent(actor, orgId, 'INTERNAL_COST.CANCELLED', 'INTERNAL_COST_ENTRY', id, {
          cancelReason: reason,
          cancelledAt: now.toISOString(),
        }),
      );

      const reportingCurrency = await this.support.reportingCurrency(tx);
      return this.formatRow(updated, reportingCurrency);
    });
  }

  async formatRow(row: InternalCostRow, reportingCurrency: string): Promise<InternalCostDetail> {
    const currencyInfo = await this.finance.findCurrency(row.amountCurrency);
    const reportingInfo = await this.finance.findCurrency(reportingCurrency);
    const minorUnit = currencyInfo?.minorUnit ?? 2;
    const reportingMinorUnit = reportingInfo?.minorUnit ?? 2;

    return {
      id: row.id,
      applicationId: row.applicationId,
      applicationName: row.application.name,
      costCenterId: row.costCenterId,
      costCenterCode: row.costCenter.code,
      costCenterName: row.costCenter.name,
      amount: formatAmount(row.amountMinor, minorUnit),
      currency: row.amountCurrency,
      amountReporting: formatAmount(row.amountReportingMinor, reportingMinorUnit),
      reportingCurrency,
      amountRate: row.amountRate.toString(),
      amountRateDate: fromDateColumn(row.amountRateDate),
      amountRateSource: row.amountRateSource,
      periodStart: fromDateColumn(row.periodStart),
      periodEnd: fromDateColumn(row.periodEnd),
      note: row.note,
      cancelReason: row.cancelReason,
      recordedAt: row.recordedAt.toISOString(),
      cancelledAt: row.cancelledAt ? row.cancelledAt.toISOString() : null,
      recordedByEmployeeId: row.recordedByEmployeeId,
    };
  }
}
