import { InternalCostsController } from './internal-cost/internal-costs.controller';
import { InternalCostService } from './internal-cost/internal-cost.service';
import { InternalCostQueryService } from './internal-cost/internal-cost-query.service';
import { InternalCostRepo } from './internal-cost/internal-cost.repo';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { AuditModule } from '../audit/audit.module';
import { CatalogModule } from '../catalog/catalog.module';
import { FinanceModule } from '../finance/finance.module';
import { IdentityAccessFacadeModule } from '../identity-access/identity-access-facade.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OperatingParametersModule } from '../operating-parameters/operating-parameters.module';
import { OrganizationModule } from '../organization/organization.module';
import { BudgetCostCenterUseReader } from './commitment/budget-cost-center-use.listener';
import { BudgetHeadChangeListener } from './proposal/budget-head-change.listener';
import { BudgetFactsRepo } from './budget/budget-facts.repo';
import { BudgetNotifierService } from './budget/budget-notifier.service';
import { BudgetProposalsController } from './proposal/budget-proposals.controller';
import { BudgetSupportService } from './budget/budget-support.service';
import { BudgetYearLockRepo } from './budget/budget-year-lock.repo';
import { BudgetVersionLinesController } from './version/budget-version-lines.controller';
import { BudgetVersionsController } from './version/budget-versions.controller';
import { BudgetViewService } from './budget-view/budget-view.service';
import { BudgetsController } from './budget-view/budgets.controller';
import { BudgetsApi } from './public/budgets.api';
import {
  BudgetChangeListeners,
  CommitmentReleaseGuardHook,
  CommitmentVendorHook,
} from './public/budgets.extension-points';
import { BudgetCommitmentsController } from './commitment/budget-commitments.controller';
import { CommitmentRepo } from './budget/commitment.repo';
import { InvoiceSpendRepo } from './budget/invoice-spend.repo';
import { InternalCostSpendRepo } from './budget/internal-cost-spend.repo';
import { CommitmentService } from './commitment/commitment.service';
import { DecisionRepo } from './budget/decision.repo';
import { LineImportService } from './version/line-import.service';
import { ProposalRepo } from './budget/proposal.repo';
import { ProposalService } from './proposal/proposal.service';
import { ProposalViewService } from './proposal/proposal-view.service';
import { VersionAccessService } from './version/version-access.service';
import { VersionHistoryRepo } from './version/version-history.repo';
import { VersionHistoryService } from './version/version-history.service';
import { VersionHistoryViewService } from './version/version-history-view.service';
import { VersionLineRepo } from './budget/version-line.repo';
import { VersionDecisionJudge } from './version/version-decision-judge.service';
import { VersionDecisionWriter } from './version/version-decision-writer.service';
import { VersionDecisionService } from './version/version-decision.service';
import { VersionLineMovedNotifier } from './version/version-line-moved.service';
import { VersionLineService } from './version/version-line.service';
import { VersionWindowService } from './version/version-window.service';
import { VersionRepo } from './budget/version.repo';
import { VersionCreationService } from './version/version-creation.service';
import { VersionFigures } from './version/version-figures.service';
import { VersionRevisionService } from './version/version-revision.service';
import { VersionTrail } from './version/version-trail.service';
import { VersionService } from './version/version.service';
import { VersionViewService } from './budget/version-view.service';
import { BudgetYearEndService } from './year-end/year-end.service';
import { BudgetYearEndSweeper } from './year-end/year-end.job';
import { InvoiceRepo } from './invoice/invoice.repo';
import { CreditedInvoiceRepo } from './invoice/credited-invoice.repo';
import { InvoiceService } from './invoice/invoice.service';
import { InvoiceDocumentService } from './invoice/invoice-document.service';
import { InvoiceMatchService } from './invoice/invoice-match.service';
import { InvoiceQueryService } from './invoice/invoice-query.service';
import { InvoiceTaxLineService } from './invoice/invoice-tax-line.service';
import { InvoicesController } from './invoice/invoices.controller';

/**
 * The budgets context (C5, ADR-0016): the proposals the heads of department send for a Cost Center and a fiscal year, and
 * the versions of the budget Finance builds from them. It reads the organization (Cost Centers, heads, the day), the
 * finance context (currencies, money), the catalog (that a plan a line names exists), the operating parameters and the notices
 * of the inbox through their facades, and writes nothing of theirs. The controllers live in the module because no other graph needs
 * them yet. The closure of the fiscal year (`BudgetYearEndSweeper`) runs in the API process like the other sweepers. It
 * exports one facade (`BudgetsApi`), what the check of a request reads, and the extension points the requests context binds
 * (`public/budgets.extension-points.ts`: who hears when a budget changes, who says a remainder may go); it never imports them back.
 */
@Module({
  imports: [
    DatabaseModule,
    AuditModule,
    OrganizationModule,
    IdentityAccessFacadeModule,
    FinanceModule,
    CatalogModule,
    NotificationsModule,
    OperatingParametersModule,
  ],
  controllers: [
    InternalCostsController,
    InvoicesController,
    BudgetProposalsController,
    BudgetVersionsController,
    BudgetVersionLinesController,
    BudgetsController,
    BudgetCommitmentsController,
  ],
  providers: [
    InternalCostService,
    InternalCostQueryService,
    InternalCostRepo,
    InvoiceRepo,
    CreditedInvoiceRepo,
    InvoiceService,
    InvoiceDocumentService,
    InvoiceMatchService,
    InvoiceTaxLineService,
    InvoiceQueryService,
    ProposalRepo,
    VersionRepo,
    VersionLineRepo,
    VersionHistoryRepo,
    DecisionRepo,
    InvoiceSpendRepo,
    InternalCostSpendRepo,
    CommitmentRepo,
    BudgetYearLockRepo,
    BudgetSupportService,
    BudgetNotifierService,
    ProposalViewService,
    ProposalService,
    VersionViewService,
    VersionAccessService,
    VersionHistoryService,
    VersionHistoryViewService,
    VersionFigures,
    VersionTrail,
    VersionCreationService,
    VersionRevisionService,
    VersionService,
    VersionLineMovedNotifier,
    VersionLineService,
    VersionWindowService,
    VersionDecisionJudge,
    VersionDecisionWriter,
    VersionDecisionService,
    LineImportService,
    BudgetYearEndService,
    BudgetYearEndSweeper,
    BudgetViewService,
    BudgetFactsRepo,
    BudgetChangeListeners,
    CommitmentReleaseGuardHook,
    CommitmentVendorHook,
    BudgetCostCenterUseReader,
    BudgetHeadChangeListener,
    CommitmentService,
    BudgetsApi,
  ],
  exports: [BudgetsApi, BudgetChangeListeners, CommitmentReleaseGuardHook, CommitmentVendorHook],
})
export class BudgetsModule {}
