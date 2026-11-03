import { Injectable } from '@nestjs/common';
import { fromDateColumn } from '../../../core/business-date';
import { formatAmount } from '../../../core/money/money';
import type { AuthenticatedPrincipal } from '../../../infrastructure/security/tokens/access-token-verifier.port';
import { FinanceApi } from '../../finance/public/finance.api';
import { BudgetNotAReaderError, BudgetNotYourCostCenterError } from '../budget/budget.errors';
import { BudgetSupportService } from '../budget/budget-support.service';
import type { InternalCostDetail, InternalCostFilterDto, InternalCostSummary } from './internal-cost.dto';
import { InternalCostNotFoundError } from './internal-cost.errors';
import { InternalCostRepo, type InternalCostRow } from './internal-cost.repo';

@Injectable()
export class InternalCostQueryService {
  constructor(
    private readonly repo: InternalCostRepo,
    private readonly support: BudgetSupportService,
    private readonly finance: FinanceApi,
  ) {}

  async list(
    actor: AuthenticatedPrincipal,
    filter: InternalCostFilterDto,
  ): Promise<{
    items: InternalCostSummary[];
    pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
  }> {
    const isFinance = actor.roles.includes('FINANCE');
    const isHead = actor.roles.includes('DEPARTMENT_HEAD');

    if (!isFinance && !isHead) {
      throw new BudgetNotAReaderError();
    }

    const today = await this.support.today(new Date());
    let allowedCostCenterIds: string[] | undefined = undefined;

    if (!isFinance && isHead) {
      const headed = await this.support.headedCostCenter(actor.employeeId, today);
      if (!headed) {
        return {
          items: [],
          pagination: { page: filter.page, pageSize: filter.pageSize, totalItems: 0, totalPages: 0 },
        };
      }
      allowedCostCenterIds = [headed];
    }

    let queryCostCenterIds: string[] | undefined = undefined;
    if (filter.costCenterId) {
      if (allowedCostCenterIds && !allowedCostCenterIds.includes(filter.costCenterId)) {
        return {
          items: [],
          pagination: { page: filter.page, pageSize: filter.pageSize, totalItems: 0, totalPages: 0 },
        };
      }
      queryCostCenterIds = [filter.costCenterId];
    } else if (allowedCostCenterIds) {
      queryCostCenterIds = allowedCostCenterIds;
    }

    const skip = (filter.page - 1) * filter.pageSize;
    const { items, total } = await this.repo.findList({
      costCenterIds: queryCostCenterIds,
      applicationId: filter.applicationId,
      periodFrom: filter.periodFrom,
      periodTo: filter.periodTo,
      status: filter.status,
      skip,
      take: filter.pageSize,
    });

    const reportingCurrency = await this.support.reportingCurrency();
    const formatted = await Promise.all(items.map((i) => this.formatSummaryRow(i, reportingCurrency)));

    return {
      items: formatted,
      pagination: {
        page: filter.page,
        pageSize: filter.pageSize,
        totalItems: total,
        totalPages: Math.ceil(total / filter.pageSize),
      },
    };
  }

  async getById(actor: AuthenticatedPrincipal, id: string): Promise<InternalCostDetail> {
    const isFinance = actor.roles.includes('FINANCE');
    const isHead = actor.roles.includes('DEPARTMENT_HEAD');

    if (!isFinance && !isHead) {
      throw new BudgetNotAReaderError();
    }

    const row = await this.repo.findById(id);
    if (!row) {
      throw new InternalCostNotFoundError();
    }

    if (!isFinance && isHead) {
      const today = await this.support.today(new Date());
      const headed = await this.support.headedCostCenter(actor.employeeId, today);
      if (!headed || headed !== row.costCenterId) {
        throw new BudgetNotYourCostCenterError();
      }
    }

    const reportingCurrency = await this.support.reportingCurrency();
    return this.formatDetailRow(row, reportingCurrency);
  }

  private async formatSummaryRow(row: InternalCostRow, reportingCurrency: string): Promise<InternalCostSummary> {
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
      amount: formatAmount(row.amountMinor, minorUnit),
      currency: row.amountCurrency,
      amountReporting: formatAmount(row.amountReportingMinor, reportingMinorUnit),
      reportingCurrency,
      periodStart: fromDateColumn(row.periodStart),
      periodEnd: fromDateColumn(row.periodEnd),
      recordedAt: row.recordedAt.toISOString(),
      cancelledAt: row.cancelledAt ? row.cancelledAt.toISOString() : null,
    };
  }

  private async formatDetailRow(row: InternalCostRow, reportingCurrency: string): Promise<InternalCostDetail> {
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
