import {
  ConflictException, ForbiddenException, Injectable, ServiceUnavailableException,
} from "@nestjs/common";
import { AppConfigService } from "../../../shared/app-config.service";
import type { AuthReadScope } from "../../auth/auth-context.service";
import { PhotoMediaStorageService } from "./photo-media-storage.service";
import { StoreActionPlanRepository } from "../infrastructure/store-action-plan.repository";
import { StoreActionPhotoReviewRepository } from "../infrastructure/store-action-photo-review.repository";

type UserInput = {
  actorUserId: string;
  actorRoleCodes: readonly string[];
  actorScope: { companyIds: string[]; regionIds: string[]; storeIds: string[] };
  actorActionScope: { assignedStoreIds: string[] };
  actorRoleScopes?: Record<string, AuthReadScope>;
  actorDisplayName?: string;
  actorRoleLabel?: string;
};

@Injectable()
export class StoreActionPhotoReviewService {
  constructor(
    private readonly repository: StoreActionPhotoReviewRepository,
    private readonly plans: StoreActionPlanRepository,
    private readonly media: PhotoMediaStorageService,
    private readonly config: AppConfigService,
  ) {}

  async upload(input: UserInput & {
    actionPlanId: string; contentType: string; contentLength: number; contentBody: Buffer;
  }) {
    this.assertSubmissionEnabled();
    const plan = await this.getOwnedPlan(input);
    const result = await this.media.initiateApprovedSyntheticFixtureUpload({
      actorUserId: input.actorUserId, actorScope: input.actorScope, storeId: plan.storeId,
      contentType: input.contentType, contentLength: input.contentLength,
      contentBody: input.contentBody, classification: "action_evidence",
    });
    await this.repository.createUploadIntent({
      actionPlanId: plan.actionPlanId, mediaAssetId: result.mediaAssetId,
      actorUserId: input.actorUserId,
    });
    return result;
  }

  async finalize(input: UserInput & { actionPlanId: string; mediaAssetId: string }) {
    this.assertSubmissionEnabled();
    await this.getOwnedPlan(input);
    if (!await this.repository.hasUploadIntent(input)) {
      throw new ForbiddenException("Store action upload is not bound to this plan and actor");
    }
    return this.media.finalizeSyntheticUpload({
      mediaAssetId: input.mediaAssetId, actorUserId: input.actorUserId,
      actorActionScope: input.actorActionScope,
      actorRoleCodes: [...input.actorRoleCodes], actorScope: input.actorScope,
    });
  }

  async submit(input: UserInput & {
    actionPlanId: string; resolutionNote: string; mediaAssetId: string;
    expectedVersion: number; idempotencyKey: string;
  }) {
    this.assertSubmissionEnabled();
    await this.getOwnedPlan(input);
    const note = input.resolutionNote.trim();
    if (!note) throw new ConflictException("Resolution note is required");
    return this.repository.submit({
      ...input, resolutionNote: note,
      actor: { displayName: input.actorDisplayName, roleLabel: input.actorRoleLabel },
    });
  }

  async review(input: UserInput & {
    actionPlanId: string; solutionAttemptId: string; decision: "approve" | "reject";
    reason?: string; expectedVersion: number; idempotencyKey: string;
  }) {
    if (!this.config.regionManagerSolutionReviewEnabled) {
      throw new ServiceUnavailableException("Region Manager solution review is disabled");
    }
    if (!input.actorRoleCodes.includes("REGION_MANAGER")) {
      throw new ForbiddenException("Only Region Managers can review Store Action solutions");
    }
    const regionScope = input.actorRoleScopes?.REGION_MANAGER;
    return this.repository.review({
      ...input, reason: input.reason?.trim(),
      actorRegionIds: regionScope?.regionIds ?? [],
      actorStoreIds: constrainActionStores(regionScope?.storeIds ?? [], input.actorActionScope.assignedStoreIds),
      actor: { displayName: input.actorDisplayName, roleLabel: input.actorRoleLabel },
    });
  }

  async get(input: UserInput & { actionPlanId: string }) {
    const plan = await this.plans.getPlanById(input.actionPlanId);
    if (!plan) throw new ForbiddenException("Store action plan is unavailable");
    const canRead = this.canReadPlan(input, plan);
    if (!canRead) throw new ForbiddenException("Store action photo review is outside actor scope");
    return this.repository.getProjection(input.actionPlanId);
  }

  async readContent(input: UserInput & {
    actionPlanId: string; mediaAssetId: string; variant: "canonical" | "thumbnail";
  }) {
    const plan = await this.plans.getPlanById(input.actionPlanId);
    if (!plan || !this.canReadPlan(input, plan)) {
      throw new ForbiddenException("Store action evidence is outside actor scope");
    }
    const allowed = await this.repository.isAssetLinkedToPlan({
      actionPlanId: input.actionPlanId, mediaAssetId: input.mediaAssetId,
    });
    if (!allowed) throw new ForbiddenException("Store action evidence is outside actor scope");
    return this.media.readContent({
      mediaAssetId: input.mediaAssetId, actorUserId: input.actorUserId,
      actorScope: input.actorScope, variant: input.variant,
    });
  }

  private assertSubmissionEnabled() {
    if (!this.config.storeActionPhotoResolutionEnabled ||
        !this.config.photoMediaStorageEnabled ||
        !this.config.checklistEvidenceStorageHealthy) {
      throw new ServiceUnavailableException("Store Action photo resolution is disabled");
    }
  }

  private async getOwnedPlan(input: UserInput & { actionPlanId: string }) {
    const plan = await this.plans.getPlanById(input.actionPlanId);
    const storeManagerScope = input.actorRoleScopes?.STORE_MANAGER;
    if (!plan || plan.resolutionWorkflowVersion !== 2 ||
        !input.actorRoleCodes.includes("STORE_MANAGER") ||
        plan.ownerUserId !== input.actorUserId ||
        !storeManagerScope?.storeIds.includes(plan.storeId) ||
        !input.actorActionScope.assignedStoreIds.includes(plan.storeId)) {
      throw new ForbiddenException("Store action solution requires current Store Manager ownership");
    }
    return plan;
  }

  private canReadPlan(input: UserInput, plan: {
    ownerUserId: string; storeId: string; regionId: string;
  }) {
    const storeManagerScope = input.actorRoleScopes?.STORE_MANAGER;
    const regionManagerScope = input.actorRoleScopes?.REGION_MANAGER;
    const actionStoreAllowed = input.actorActionScope.assignedStoreIds.includes(plan.storeId);
    const canReadAsStoreManager = input.actorRoleCodes.includes("STORE_MANAGER") &&
      plan.ownerUserId === input.actorUserId &&
      Boolean(storeManagerScope?.storeIds.includes(plan.storeId)) && actionStoreAllowed;
    const canReadAsRegionManager = input.actorRoleCodes.includes("REGION_MANAGER") &&
      Boolean(regionManagerScope?.regionIds.includes(plan.regionId)) &&
      (regionManagerScope?.storeIds.length === 0 || Boolean(regionManagerScope?.storeIds.includes(plan.storeId))) &&
      actionStoreAllowed;
    return canReadAsStoreManager || canReadAsRegionManager;
  }
}

function constrainActionStores(roleStores: readonly string[], actionStores: readonly string[]) {
  if (roleStores.length === 0) return [...new Set(actionStores)];
  const allowed = new Set(roleStores);
  return [...new Set(actionStores.filter((value) => allowed.has(value)))];
}
