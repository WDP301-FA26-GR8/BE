import { Injectable } from '@nestjs/common';
import { DbTx } from '../../../infrastructure/database/transaction-runner';
import type { AuthenticatedPrincipal } from '../../../infrastructure/security/tokens/access-token-verifier.port';
import type {
  AttachedDocument,
  CatalogOnboardingFacts,
  PlanRevocationInfo,
  PlanSummary,
  WorkspaceDuty,
  SeatTarget,
  SeatTargetRef,
  SubscriptionSummary,
} from './catalog.types';
import { OnboardingFactsService } from '../subscription/onboarding-facts.service';
import { ApplicationLookupService } from '../catalog-entry/application-lookup.service';
import { DocumentService } from '../contract/document.service';
import { PlanLookupService } from '../plan/plan-lookup.service';
import { SubscriptionLookupService } from '../subscription/subscription-lookup.service';
import { SeatTargetService } from '../subscription/seat-target.service';
import { VendorLookupService } from '../vendor/vendor-lookup.service';
import {
  InternalSoftwareRegistrationService,
  type InternalRegistration,
} from '../internal-software-registration/internal-software-registration.service';

/**
 * The catalog facade other modules call (ADR-0013: `licensing → catalog`). It exposes what the assignments of seats
 * need to know about a subscription or an internal plan and nothing of how the catalog keeps it.
 */
@Injectable()
export class CatalogApi {
  constructor(
    private readonly seatTargets: SeatTargetService,
    private readonly onboarding: OnboardingFactsService,
    private readonly plans: PlanLookupService,
    private readonly subscriptions: SubscriptionLookupService,
    private readonly vendors: VendorLookupService,
    private readonly internalRegistration: InternalSoftwareRegistrationService,
    private readonly applicationLookup: ApplicationLookupService,
    private readonly documents: DocumentService,
  ) {}

  /**
   * The first `limit` applications in use whose Business Owner is this employee, and how many there are (a read, `US-03-01`
   * AC-13): a person who moves to another department or leaves needs someone to take them over (`US-04-06`).
   */
  getApplicationsOwnedBy(employeeId: string, limit: number, tx?: DbTx) {
    return this.applicationLookup.ownedBy(employeeId, limit, tx);
  }

  /**
   * The workspaces of K2 plans these employees own (the primary owner) or administer (an owner or administrator on the profile), one
   * row for each person and plan, in one read (`US-03-04` AC-28): what a person who leaves must hand over. No secret is held.
   */
  getWorkspaceDutiesOf(employeeIds: readonly string[], tx?: DbTx): Promise<WorkspaceDuty[]> {
    return this.plans.workspaceDutiesOf(employeeIds, tx);
  }

  /** The plans with these ids by name, with their application, as far as they exist. */
  getPlanSummaries(ids: readonly string[]): Promise<PlanSummary[]> {
    return this.onboarding.planSummaries(ids);
  }

  /**
   * What a plan is bought at for a department (unit price and billing cycle), from the newest priced active subscription that
   * department owns; null when it has none. The price of another department's subscription is never used.
   */
  getPlanPrice(planId: string, ownerDepartmentId: string, tx?: DbTx) {
    return this.subscriptions.priceOfPlan(planId, ownerDepartmentId, tx);
  }

  /** The ids of every subscription and purchase a department owns, by id: for a module that finds what belongs to the department through them. */
  getSubscriptionIdsOwnedBy(departmentId: string, tx?: DbTx): Promise<string[]> {
    return this.subscriptions.idsOwnedBy(departmentId, tx);
  }

  /** The vendor and owning department of these subscriptions in one read; unknown ids are absent. */
  getSubscriptionSummaries(ids: readonly string[], tx?: DbTx): Promise<SubscriptionSummary[]> {
    return this.subscriptions.summaries(ids, tx);
  }

  /** Vendors have no retirement state: an existing vendor is usable for invoice recording. */
  isVendorUsable(id: string, tx?: DbTx): Promise<boolean> {
    return this.vendors.isUsable(id, tx);
  }

  /** The vendor of the application of the plan, null for internal software: whose tax profile estimates its price. */
  getPlanVendorId(planId: string, tx?: DbTx): Promise<string | null> {
    return this.plans.vendorIdOf(planId, tx);
  }

  /** The Business Owner of the application of the plan now, or null when the plan does not exist. */
  getPlanBusinessOwnerId(planId: string, tx?: DbTx): Promise<string | null> {
    return this.plans.businessOwnerIdOf(planId, tx);
  }

  /**
   * Registers software the company built itself, with its Business Owner and one plan granted by hand, in the transaction
   * of the caller (`US-05-20`). A Business Owner who has left, or a name already taken, is a `REFUSED` answer.
   */
  registerInternalSoftware(
    tx: DbTx,
    actor: AuthenticatedPrincipal,
    input: { name: string; businessOwnerEmployeeId: string; dataSensitivity: 'LOW' | 'MEDIUM' | 'HIGH' },
  ): Promise<InternalRegistration> {
    return this.internalRegistration.register(tx, actor, input);
  }

  /** The name of the vendor, or null when there is none: for the assessment of software that is not in the catalog. */
  async getVendorName(id: string): Promise<string | null> {
    return this.vendors.nameOf(id);
  }

  /** How the seats of these plans are taken away, in one read: the kind of provisioning, the note and the loss of data on removal. */
  getPlanRevocationInfo(planIds: readonly string[], tx?: DbTx): Promise<PlanRevocationInfo[]> {
    return this.plans.revocationInfos(planIds, tx);
  }

  /** The plans of the other applications in the functional group of the plan's application (at most `limit`, by id). */
  getSimilarPlanIds(planId: string, limit: number, tx?: DbTx): Promise<string[]> {
    return this.plans.similarIds(planId, limit, tx);
  }

  /** How many applications, plans and subscriptions exist, for the onboarding checklist. */
  getOnboardingFacts(): Promise<CatalogOnboardingFacts> {
    return this.onboarding.read();
  }

  /** The seat target without a lock, or null when the subscription or the plan does not exist. */
  findSeatTarget(ref: SeatTargetRef, tx?: DbTx): Promise<SeatTarget | null> {
    return this.seatTargets.find(ref, tx);
  }

  /** The seat targets of many plans in one read, without a lock; a plan that does not exist is absent. */
  findPlanSeatTargets(planIds: readonly string[], tx?: DbTx): Promise<SeatTarget[]> {
    return this.seatTargets.findPlans(planIds, tx);
  }

  /**
   * The seat target, locked until the caller's transaction ends: the subscription `FOR UPDATE`, so writers of its seats
   * queue and a change of its quantity waits; an internal plan `FOR SHARE`. Null when it does not exist.
   */
  lockSeatTarget(tx: DbTx, ref: SeatTargetRef): Promise<SeatTarget | null> {
    return this.seatTargets.lock(tx, ref);
  }
  /**
   * Attaches an uploaded file to an invoice (`US-12-10` AC-5, `US-04-04` AC-4): only by the person who uploaded it,
   * who holds the FINANCE role, and only once.
   */
  attachDocumentToInvoice(
    tx: DbTx,
    actor: AuthenticatedPrincipal,
    documentId: string,
    invoiceId: string,
  ): Promise<AttachedDocument> {
    return this.documents.attachToInvoice(tx, actor, documentId, invoiceId);
  }

  /** The files attached to an invoice, in the order they were declared. */
  getInvoiceDocuments(invoiceId: string, tx?: DbTx): Promise<AttachedDocument[]> {
    return this.documents.listForInvoice(invoiceId, tx);
  }
}
