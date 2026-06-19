import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/auth-context.service";
import {
  SalesTargetIncentiveApprovalRepository,
  type SalesTargetIncentiveParticipantType,
  type SalesTargetIncentiveRegionCorrectionRow,
  type SalesTargetIncentiveRegionPackageRow,
  type SalesTargetIncentiveStoreReviewRow,
  type SalesTargetIncentiveStoreReviewStatus,
} from "../infrastructure/sales-target-incentive-approval.repository";
import {
  SalesTargetIncentiveReadModelService,
  type SalesTargetIncentiveProjectionStore,
} from "./sales-target-incentive-read-model.service";

export type SalesTargetIncentiveRegionWorkflowStatus =
  | "not_submitted"
  | "submitted"
  | "admin_approved"
  | "admin_returned";

export type SalesTargetIncentiveRegionWorkflowApiState = {
  regionId: string;
  regionPackageStatus: SalesTargetIncentiveRegionWorkflowStatus;
  regionPackageId: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  workflowLockedReason: string | null;
};

export type SalesTargetIncentiveStoreReviewApiState = {
  storeReviewStatus: SalesTargetIncentiveStoreReviewStatus;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  periodCloseStatus: "projection_only" | "closed";
  workflowLockedReason: string | null;
};

export type SalesTargetIncentiveRegionCorrectionApiState = {
  correctionId: string;
  status: SalesTargetIncentiveRegionCorrectionRow["correction_status"];
  targetScope: "final_snapshot";
  beforeAmount: string;
  adjustmentAmount: string;
  finalAmount: string;
  reasonNote: string;
  createdByUserId: string;
  createdAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
};

export type SalesTargetIncentiveRegionWorkflowContext = {
  regionWorkflow: SalesTargetIncentiveRegionWorkflowApiState | null;
  reviewsByStoreId: Map<string, SalesTargetIncentiveStoreReviewApiState>;
  correctionsByRowKey: Map<string, SalesTargetIncentiveRegionCorrectionApiState>;
};

@Injectable()
export class SalesTargetIncentiveRegionWorkflowService {
  constructor(
    private readonly readModelService: SalesTargetIncentiveReadModelService,
    private readonly approvalRepository: SalesTargetIncentiveApprovalRepository,
  ) {}

  async getWorkflowContext(input: {
    periodKey: string;
    stores: SalesTargetIncentiveProjectionStore[];
    roleScope: "own" | "store" | "region" | "admin";
  }): Promise<SalesTargetIncentiveRegionWorkflowContext> {
    if (input.roleScope !== "region" || input.stores.length === 0) {
      return this.emptyContext();
    }

    const storeIds = input.stores.map((store) => store.storeId);
    const [workflow, closedStores] = await Promise.all([
      this.approvalRepository.listWorkflowState({
        periodKey: input.periodKey,
        storeIds,
      }),
      this.approvalRepository.listClosedFinalSnapshotStores({
        periodKey: input.periodKey,
        storeIds,
      }),
    ]);
    const regionIds = unique(input.stores.map((store) => store.regionId));
    const packageRow = regionIds.length === 1
      ? workflow.packages.find((candidate) => candidate.region_id === regionIds[0]) ?? null
      : null;
    const regionWorkflow = regionIds.length === 1
      ? this.toRegionWorkflow(regionIds[0], packageRow)
      : null;
    const lockedReason = regionWorkflow?.workflowLockedReason ?? null;
    const closedSnapshotsByStoreId = new Map(
      closedStores.map((store) => [store.store_id, store.final_snapshot_id]),
    );

    return {
      regionWorkflow,
      reviewsByStoreId: new Map(
        input.stores.map((store) => [
          store.storeId,
          this.toStoreReviewState(
            workflow.reviews.find((review) => review.store_id === store.storeId) ?? null,
            closedSnapshotsByStoreId.get(store.storeId) ?? null,
            lockedReason,
          ),
        ]),
      ),
      correctionsByRowKey: this.buildCurrentCorrectionMap(workflow.corrections),
    };
  }

  async markStoreReview(input: {
    actor: AuthenticatedUser;
    periodKey: string;
    storeId: string;
    reviewStatus: SalesTargetIncentiveStoreReviewStatus;
  }) {
    const store = await this.resolveAssignedStore(input);
    await this.ensureClosedStores({
      periodKey: input.periodKey,
      stores: [store],
      missingMessage: "Closed final snapshot is required",
    });
    const review = await this.approvalRepository.markStoreReview({
      periodKey: input.periodKey,
      store,
      actorUserId: input.actor.userId,
      reviewStatus: input.reviewStatus,
    });
    return { data: this.toStoreReviewCommand(review) };
  }

  async createRegionCorrection(input: {
    actor: AuthenticatedUser;
    periodKey: string;
    storeId: string;
    employeeId: string;
    participantType: SalesTargetIncentiveParticipantType;
    finalAmount: string;
    reasonNote: string;
  }) {
    const store = await this.resolveAssignedStore(input);
    const correction = await this.approvalRepository.createOrReplaceDraftCorrection({
      periodKey: input.periodKey,
      store,
      employeeId: input.employeeId,
      participantType: input.participantType,
      finalAmount: input.finalAmount,
      reasonNote: input.reasonNote.trim(),
      actorUserId: input.actor.userId,
    });
    return { data: this.toRegionCorrection(correction) };
  }

  async voidRegionCorrection(input: {
    actor: AuthenticatedUser;
    periodKey: string;
    correctionId: string;
  }) {
    this.assertRegionManager(input.actor);
    const stores = await this.resolveAssignedStores({
      actor: input.actor,
      periodKey: input.periodKey,
    });
    const workflow = await this.approvalRepository.listWorkflowState({
      periodKey: input.periodKey,
      storeIds: stores.map((store) => store.storeId),
    });
    const correction = workflow.corrections.find(
      (candidate) =>
        candidate.sales_target_incentive_region_correction_id === input.correctionId,
    );

    if (!correction) {
      throw new NotFoundException("Incentive correction was not found");
    }

    const voidedCorrection = await this.approvalRepository.voidDraftCorrection({
      periodKey: input.periodKey,
      storeId: correction.store_id,
      employeeId: correction.employee_id,
      participantType: correction.participant_type,
      actorUserId: input.actor.userId,
    });
    return { data: this.toRegionCorrection(voidedCorrection) };
  }

  async submitRegionPackage(input: {
    actor: AuthenticatedUser;
    periodKey: string;
    regionId: string;
    submissionNote?: string | null;
  }) {
    this.assertRegionManager(input.actor);
    const stores = await this.resolveAssignedStores({
      actor: input.actor,
      periodKey: input.periodKey,
      regionId: input.regionId,
    });
    if (stores.length === 0) {
      throw new BadRequestException("No company stores are available for submission");
    }

    const companyIds = unique(stores.map((store) => store.companyId));
    if (companyIds.length !== 1) {
      throw new BadRequestException("A package can include one company only");
    }

    const existingPackage = (
      await this.approvalRepository.listRegionPackagesForAdmin({
        periodKey: input.periodKey,
        companyIds,
        regionIds: [input.regionId],
      })
    )[0] ?? null;
    if (existingPackage?.package_status === "submitted") {
      return { data: this.toPackageCommand(existingPackage) };
    }
    if (existingPackage?.package_status === "admin_approved") {
      throw new ConflictException("Approved packages cannot be changed");
    }

    await this.ensureSubmitReady({
      periodKey: input.periodKey,
      stores,
    });
    const packageRow = await this.approvalRepository.submitRegionPackage({
      companyId: companyIds[0],
      regionId: input.regionId,
      periodKey: input.periodKey,
      storeIds: stores.map((store) => store.storeId),
      actorUserId: input.actor.userId,
      submissionNote: input.submissionNote?.trim() || null,
    });
    return { data: this.toPackageCommand(packageRow) };
  }

  private async resolveAssignedStore(input: {
    actor: AuthenticatedUser;
    periodKey: string;
    storeId: string;
  }) {
    this.assertRegionManager(input.actor);
    const store = (await this.resolveAssignedStores(input)).find(
      (candidate) => candidate.storeId === input.storeId,
    );

    if (!store) {
      throw new ForbiddenException("Incentive store is not available");
    }

    return store;
  }

  private async resolveAssignedStores(input: {
    actor: AuthenticatedUser;
    periodKey: string;
    regionId?: string;
  }) {
    if (input.actor.assignedStoreIds.length === 0) {
      return [];
    }

    const projection = await this.readModelService.buildCurrentProjection({
      periodKey: input.periodKey,
      companyIds: [],
      regionIds: [],
      storeIds: input.actor.assignedStoreIds,
    });
    return projection.stores.filter(
      (store) => !input.regionId || store.regionId === input.regionId,
    );
  }

  private async ensureSubmitReady(input: {
    periodKey: string;
    stores: SalesTargetIncentiveProjectionStore[];
  }) {
    await this.ensureClosedStores({
      periodKey: input.periodKey,
      stores: input.stores,
      missingMessage: "All package stores must have a closed final snapshot",
    });
    const workflow = await this.approvalRepository.listWorkflowState({
      periodKey: input.periodKey,
      storeIds: input.stores.map((store) => store.storeId),
    });
    const reviewedStoreIds = new Set(
      workflow.reviews
        .filter((review) => review.review_status === "reviewed")
        .map((review) => review.store_id),
    );
    const missingStoreIds = input.stores
      .map((store) => store.storeId)
      .filter((storeId) => !reviewedStoreIds.has(storeId));

    if (missingStoreIds.length > 0) {
      throw new BadRequestException({
        message: "All package stores must be reviewed before submit",
        missingStoreCount: missingStoreIds.length,
        missingStoreIds,
      });
    }
  }

  private async ensureClosedStores(input: {
    periodKey: string;
    stores: SalesTargetIncentiveProjectionStore[];
    missingMessage: string;
  }) {
    const closedStores = await this.approvalRepository.listClosedFinalSnapshotStores({
      periodKey: input.periodKey,
      storeIds: input.stores.map((store) => store.storeId),
    });
    const closedStoreIds = new Set(closedStores.map((store) => store.store_id));
    const missingStoreIds = input.stores
      .map((store) => store.storeId)
      .filter((storeId) => !closedStoreIds.has(storeId));

    if (missingStoreIds.length > 0) {
      throw new BadRequestException({
        message: input.missingMessage,
        missingStoreCount: missingStoreIds.length,
        missingStoreIds,
      });
    }
  }

  private assertRegionManager(actor: AuthenticatedUser) {
    if (!actor.roleCodes.includes("REGION_MANAGER")) {
      throw new ForbiddenException("Region manager incentive workflow is not available");
    }
  }

  private emptyContext(): SalesTargetIncentiveRegionWorkflowContext {
    return {
      regionWorkflow: null,
      reviewsByStoreId: new Map(),
      correctionsByRowKey: new Map(),
    };
  }

  private toRegionWorkflow(
    regionId: string,
    row: SalesTargetIncentiveRegionPackageRow | null,
  ): SalesTargetIncentiveRegionWorkflowApiState {
    const status = row?.package_status ?? "not_submitted";
    return {
      regionId,
      regionPackageStatus: status,
      regionPackageId: row?.sales_target_incentive_region_package_id ?? null,
      submittedAt: row?.submitted_at ?? null,
      reviewedAt: row?.reviewed_at ?? null,
      workflowLockedReason: workflowLockedReason(status),
    };
  }

  private toStoreReviewState(
    row: SalesTargetIncentiveStoreReviewRow | null,
    latestFinalSnapshotId: string | null,
    lockedReason: string | null,
  ): SalesTargetIncentiveStoreReviewApiState {
    const currentReview =
      row && latestFinalSnapshotId && row.final_snapshot_id === latestFinalSnapshotId
        ? row
        : null;

    return {
      storeReviewStatus: currentReview?.review_status ?? "pending_review",
      reviewedByUserId: currentReview?.reviewed_by_user_id ?? null,
      reviewedAt: currentReview?.reviewed_at ?? null,
      periodCloseStatus: latestFinalSnapshotId ? "closed" : "projection_only",
      workflowLockedReason: latestFinalSnapshotId ? lockedReason : "period_not_closed",
    };
  }

  private toRegionCorrection(
    row: SalesTargetIncentiveRegionCorrectionRow,
  ): SalesTargetIncentiveRegionCorrectionApiState {
    return {
      correctionId: row.sales_target_incentive_region_correction_id,
      status: row.correction_status,
      targetScope: "final_snapshot",
      beforeAmount: row.before_amount,
      adjustmentAmount: row.adjustment_amount,
      finalAmount: row.final_amount,
      reasonNote: row.reason_note,
      createdByUserId: row.created_by_user_id,
      createdAt: row.created_at,
      submittedAt: row.submitted_at,
      reviewedAt: row.reviewed_at,
      reviewNote: row.review_note,
    };
  }

  private buildCurrentCorrectionMap(rows: SalesTargetIncentiveRegionCorrectionRow[]) {
    const selectedRows = new Map<string, SalesTargetIncentiveRegionCorrectionRow>();

    for (const row of rows) {
      const key = correctionKey(row.store_id, row.employee_id, row.participant_type);
      const current = selectedRows.get(key);
      if (!current || compareCorrectionRows(row, current) > 0) {
        selectedRows.set(key, row);
      }
    }

    return new Map(
      Array.from(selectedRows, ([key, row]) => [key, this.toRegionCorrection(row)]),
    );
  }

  private toStoreReviewCommand(row: SalesTargetIncentiveStoreReviewRow) {
    return {
      period: row.period_key,
      storeId: row.store_id,
      reviewStatus: row.review_status,
      reviewedByUserId: row.reviewed_by_user_id,
      reviewedAt: row.reviewed_at,
    };
  }

  private toPackageCommand(row: SalesTargetIncentiveRegionPackageRow) {
    return {
      period: row.period_key,
      regionId: row.region_id,
      regionPackageId: row.sales_target_incentive_region_package_id,
      regionPackageStatus: row.package_status,
      submittedAt: row.submitted_at,
      reviewedAt: row.reviewed_at,
      reviewNote: row.review_note,
    };
  }
}

function compareCorrectionRows(
  candidate: SalesTargetIncentiveRegionCorrectionRow,
  current: SalesTargetIncentiveRegionCorrectionRow,
) {
  const priorityDelta =
    correctionStatusPriority(candidate.correction_status) -
    correctionStatusPriority(current.correction_status);

  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  return Date.parse(candidate.created_at) - Date.parse(current.created_at);
}

function correctionStatusPriority(status: SalesTargetIncentiveRegionCorrectionRow["correction_status"]) {
  if (status === "draft" || status === "submitted" || status === "admin_returned") {
    return 2;
  }

  if (status === "admin_approved") {
    return 1;
  }

  return 0;
}

export function correctionKey(
  storeId: string,
  employeeId: string,
  participantType: SalesTargetIncentiveParticipantType,
) {
  return `${storeId}:${employeeId}:${participantType}`;
}

function workflowLockedReason(status: SalesTargetIncentiveRegionWorkflowStatus) {
  if (status === "submitted") {
    return "package_submitted";
  }

  if (status === "admin_approved") {
    return "package_approved";
  }

  return null;
}

function unique(values: string[]) {
  return [...new Set(values)];
}
