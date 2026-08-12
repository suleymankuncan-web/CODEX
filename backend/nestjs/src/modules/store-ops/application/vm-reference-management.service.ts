import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { AppConfigService } from "../../../shared/app-config.service";
import type { AuthReadScope } from "../../auth/auth-context.service";
import { PhotoMediaStorageService } from "./photo-media-storage.service";
import { VmReferenceManagementRepository } from "../infrastructure/vm-reference-management.repository";
import { VmCampaignLifecycleRepository } from "../infrastructure/vm-campaign-lifecycle.repository";

type Actor = {
  actorUserId: string;
  actorRoleCodes: readonly string[];
  actorScope: AuthReadScope;
  actorActionScope: { assignedStoreIds: string[] };
  actorPermissionScopes?: Record<string, AuthReadScope>;
};

@Injectable()
export class VmReferenceManagementService {
  constructor(
    private readonly repository: VmReferenceManagementRepository,
    private readonly lifecycleRepository: VmCampaignLifecycleRepository,
    private readonly media: PhotoMediaStorageService,
    private readonly config: AppConfigService,
  ) {}

  async createDraft(input: Actor & {
    companyId: string;
    referenceCode: string;
    referenceName: string;
    instructions: string;
  }) {
    this.assertPublishing(input, input.companyId);
    return this.repository.createDraft(input);
  }

  async listPublisherReferences(input: Actor & { companyId: string; limit: number; offset: number }) {
    this.assertVmPermission(input, "VM_REFERENCE_PUBLISHER", input.companyId);
    return this.repository.listPublisherReferences(input);
  }

  async listPublisherOptions(input: Actor & { companyId: string }) {
    this.assertVmPermission(input, "VM_REFERENCE_PUBLISHER", input.companyId);
    return this.repository.listPublisherOptions(input);
  }

  async listReviewerCampaigns(input: Actor & { companyId: string; limit: number; offset: number }) {
    this.assertVmPermission(input, "VM_VISUAL_REVIEWER", input.companyId);
    return this.repository.listReviewerCampaigns(input);
  }

  async listPublisherCampaigns(input: Actor & { companyId: string; limit: number; offset: number }) {
    this.assertVmPermission(input, "VM_REFERENCE_PUBLISHER", input.companyId);
    return this.repository.listReviewerCampaigns(input);
  }

  async upsertDraftItem(input: Actor & {
    companyId: string; referenceSetId: string; templateId: string;
    templateItemId: string; itemOrder: number; expectedVisualIntent: string;
    reviewInstructions: string; rubricVersion: string; expectedRevision: number;
  }) {
    this.assertPublishing(input, input.companyId);
    return this.repository.upsertDraftItem({ ...input, requiredEvidenceCount: 1, allowedVariants: [] });
  }

  async uploadReference(input: Actor & {
    companyId: string;
    referenceSetId: string;
    draftItemId: string;
    contentType: string;
    contentLength: number;
    contentBody: Buffer;
  }) {
    this.assertPublishing(input, input.companyId);
    const result = await this.media.initiateApprovedSyntheticFixtureUpload({
      actorUserId: input.actorUserId,
      actorScope: input.actorScope,
      companyId: input.companyId,
      contentType: input.contentType,
      contentLength: input.contentLength,
      contentBody: input.contentBody,
      classification: "vm_reference",
    });
    await this.repository.createReferenceUploadIntent({
      ...input,
      mediaAssetId: result.mediaAssetId,
    });
    return result;
  }

  async finalizeReference(input: Actor & {
    companyId: string;
    referenceSetId: string;
    draftItemId: string;
    mediaAssetId: string;
  }) {
    this.assertPublishing(input, input.companyId);
    if (!await this.repository.hasReferenceUploadIntent(input)) {
      throw new ForbiddenException("VM reference upload is not bound to this draft and actor");
    }
    const result = await this.media.finalizeSyntheticUpload({
      mediaAssetId: input.mediaAssetId,
      actorUserId: input.actorUserId,
      actorActionScope: input.actorActionScope,
      actorScope: input.actorScope,
      allowCompanyScopedVmReference: true,
    });
    await this.repository.linkFinalizedReferenceAsset(input);
    return result;
  }

  async publish(input: Actor & {
    companyId: string;
    referenceSetId: string;
    expectedRevision: number;
    idempotencyKey: string;
    startsOn: string;
    endsOn: string;
    storeIds: string[];
    reason: string;
  }) {
    this.assertPublishing(input, input.companyId);
    return this.repository.publish({
      ...input,
      timezone: "Europe/Istanbul" as const,
      requiredEvidenceCount: 1 as const,
      allowedVariants: [] as const,
    });
  }

  async listStoreAssignments(input: Actor & { limit: number; offset: number }) {
    this.assertStoreManager(input);
    return this.repository.listStoreAssignments({
      ...input,
      storeIds: input.actorActionScope.assignedStoreIds,
    });
  }

  async uploadCampaignEvidence(input: Actor & {
    assignmentId: string;
    referenceItemId: string;
    contentType: string;
    contentLength: number;
    contentBody: Buffer;
    captureSource?: "camera" | "gallery";
    contentPolicyAttestation?: boolean;
  }) {
    this.assertSubmissionEnabled();
    this.assertStoreManager(input);
    const assignment = await this.repository.getSubmissionUploadScope({
      assignmentId: input.assignmentId,
      referenceItemId: input.referenceItemId,
      actorUserId: input.actorUserId,
      storeIds: input.actorActionScope.assignedStoreIds,
    });
    if (!assignment) throw new ForbiddenException("VM campaign assignment is outside actor scope");
    const realPilot = this.realVmPilotMatches(assignment);
    const result = realPilot
      ? await this.media.initiateRealVmCampaignUpload({
          actorUserId: input.actorUserId,
          actorRoleCodes: input.actorRoleCodes,
          actorScope: input.actorScope,
          actorActionScope: input.actorActionScope,
          storeId: assignment.storeId,
          companyId: assignment.companyId,
          contentType: input.contentType,
          contentLength: input.contentLength,
          contentBody: input.contentBody,
          captureSource: input.captureSource ?? "gallery",
          contentPolicyAttestation: input.contentPolicyAttestation === true,
          cohortAuthorized: true,
          bindInitiatedAsset: (mediaAssetId) => this.repository.createSubmissionUploadIntent({
            assignmentId: input.assignmentId,
            referenceItemId: input.referenceItemId,
            mediaAssetId,
            actorUserId: input.actorUserId,
            storeIds: input.actorActionScope.assignedStoreIds,
          }).then(() => undefined),
        })
      : await this.media.initiateApprovedSyntheticFixtureUpload({
      actorUserId: input.actorUserId,
      actorScope: input.actorScope,
      storeId: assignment.storeId,
      contentType: input.contentType,
      contentLength: input.contentLength,
      contentBody: input.contentBody,
      classification: "vm_campaign_evidence",
    });
    if (!realPilot) {
      await this.repository.createSubmissionUploadIntent({
        ...input,
        mediaAssetId: result.mediaAssetId,
        storeIds: input.actorActionScope.assignedStoreIds,
      });
    }
    return result;
  }

  async finalizeCampaignEvidence(input: Actor & {
    assignmentId: string;
    referenceItemId: string;
    mediaAssetId: string;
  }) {
    this.assertSubmissionEnabled();
    this.assertStoreManager(input);
    if (!await this.repository.hasSubmissionUploadIntent({
      ...input,
      storeIds: input.actorActionScope.assignedStoreIds,
    })) {
      throw new ForbiddenException("VM campaign upload is not bound to this assignment and actor");
    }
    const assignment = await this.repository.getSubmissionUploadScope({
      assignmentId: input.assignmentId,
      referenceItemId: input.referenceItemId,
      actorUserId: input.actorUserId,
      storeIds: input.actorActionScope.assignedStoreIds,
    });
    if (!assignment) throw new ForbiddenException("VM campaign assignment is outside actor scope");
    const common = {
      mediaAssetId: input.mediaAssetId,
      actorUserId: input.actorUserId,
      actorActionScope: input.actorActionScope,
      actorRoleCodes: [...input.actorRoleCodes],
      actorScope: input.actorScope,
    };
    return this.realVmPilotMatches(assignment)
      ? this.media.finalizeRealVmCampaignUpload({ ...common, cohortAuthorized: true })
      : this.media.finalizeSyntheticUpload(common);
  }

  async readStoreReference(input: Actor & {
    assignmentId: string;
    referenceItemId: string;
    variant: "canonical" | "thumbnail";
  }) {
    this.assertStoreManager(input);
    const asset = await this.repository.getAssignmentReferenceAsset({
      assignmentId: input.assignmentId,
      referenceItemId: input.referenceItemId,
      actorUserId: input.actorUserId,
      storeIds: input.actorActionScope.assignedStoreIds,
    });
    if (!asset) throw new ForbiddenException("VM reference is outside actor assignment scope");
    return this.media.createSignedRead({ mediaAssetId: asset.mediaAssetId,
      actorUserId: input.actorUserId, actorScope: input.actorScope, variant: input.variant,
      contentPath: `/api/mobile/visual-campaigns/${input.assignmentId}/items/${input.referenceItemId}/reference-content/${input.variant}` });
  }

  async readStoreReferenceContent(input: Actor & {
    assignmentId: string;
    referenceItemId: string;
    variant: "canonical" | "thumbnail";
  }) {
    this.assertStoreManager(input);
    const asset = await this.repository.getAssignmentReferenceAsset({
      assignmentId: input.assignmentId, referenceItemId: input.referenceItemId,
      actorUserId: input.actorUserId, storeIds: input.actorActionScope.assignedStoreIds,
    });
    if (!asset) throw new ForbiddenException("VM reference is outside actor assignment scope");
    return this.media.readContent({ mediaAssetId: asset.mediaAssetId,
      actorUserId: input.actorUserId, actorScope: input.actorScope, variant: input.variant });
  }

  async submit(input: Actor & {
    assignmentId: string;
    expectedVersion: number;
    idempotencyKey: string;
    items: Array<{ referenceItemId: string; mediaAssetId: string }>;
  }) {
    this.assertSubmissionEnabled();
    this.assertStoreManager(input);
    return this.repository.submit({
      ...input,
      storeIds: input.actorActionScope.assignedStoreIds,
    });
  }

  async reviseCampaign(input: Actor & {
    companyId: string;
    referenceSetId: string;
    command: "extend" | "reopen" | "scope_add";
    expectedRevision: number;
    idempotencyKey: string;
    reason: string;
    startsOn: string;
    endsOn: string;
    storeIds: string[];
  }) {
    this.assertPublishing(input, input.companyId);
    this.assertVmPermission(input, input.command === "scope_add"
      ? "VM_CAMPAIGN_SCOPE_AUTHORITY" : "VM_CAMPAIGN_WINDOW_AUTHORITY", input.companyId);
    return this.lifecycleRepository.reviseCampaign({ ...input, timezone: "Europe/Istanbul" as const });
  }

  async changeAssignmentState(input: Actor & {
    companyId: string;
    referenceSetId: string;
    assignmentId: string;
    command: "withdraw" | "exempt" | "hold" | "reconcile";
    expectedVersion: number;
    idempotencyKey: string;
    reason: string;
  }) {
    this.assertPublishing(input, input.companyId);
    this.assertVmPermission(input, ["withdraw", "exempt"].includes(input.command)
      ? "VM_CAMPAIGN_SCOPE_AUTHORITY" : "VM_CAMPAIGN_EMERGENCY_AUTHORITY", input.companyId);
    return this.lifecycleRepository.changeAssignmentState(input);
  }

  async retireReference(input: Actor & {
    companyId: string;
    referenceSetId: string;
    expectedRevision: number;
    idempotencyKey: string;
    reason: string;
  }) {
    this.assertPublishing(input, input.companyId);
    this.assertVmPermission(input, "VM_CAMPAIGN_EMERGENCY_AUTHORITY", input.companyId);
    return this.lifecycleRepository.retireReference(input);
  }

  async settle(limit = 100) {
    if (!this.config.vmCampaignDeadlineSettlementEnabled) {
      throw new ServiceUnavailableException("VM campaign settlement is disabled");
    }
    return this.repository.settleDueAssignments(Math.min(Math.max(limit, 1), 500));
  }

  private assertPublishing(input: Actor, companyId: string) {
    if (!this.config.vmReferencePublishingEnabled ||
        !this.config.photoMediaStorageEnabled ||
        !this.config.checklistEvidenceStorageHealthy) {
      throw new ServiceUnavailableException("VM reference publishing is disabled");
    }
    this.assertVmPermission(input, "VM_REFERENCE_PUBLISHER", companyId);
  }

  private assertSubmissionEnabled() {
    if (!this.config.vmCampaignSubmissionEnabled ||
        !this.config.photoMediaStorageEnabled ||
        !this.config.checklistEvidenceStorageHealthy) {
      throw new ServiceUnavailableException("VM campaign submission is disabled");
    }
  }

  private assertVmPermission(input: Actor, permission: string, companyId: string) {
    const scope = input.actorPermissionScopes?.[permission];
    if (!input.actorRoleCodes.includes("VISUAL_MERCHANDISER") ||
        !scope?.companyIds.includes(companyId)) {
      throw new ForbiddenException("VM capability is outside actor permission scope");
    }
  }

  private assertStoreManager(input: Actor) {
    if (!input.actorRoleCodes.includes("STORE_MANAGER") ||
        input.actorActionScope.assignedStoreIds.length === 0) {
      throw new ForbiddenException("VM campaign submission requires Store Manager action scope");
    }
  }

  private realVmPilotMatches(assignment: { companyId: string; referenceSetId: string }): boolean {
    const pilot = this.config.photoMediaRealVmPilotConfiguration;
    return pilot.enabled &&
      pilot.companyId === assignment.companyId &&
      pilot.referenceSetId === assignment.referenceSetId &&
      Boolean(pilot.notBefore && Date.now() >= pilot.notBefore.getTime());
  }
}
