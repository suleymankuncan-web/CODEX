import { ForbiddenException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { AppConfigService } from "../../../shared/app-config.service";
import type { AuthenticatedUser } from "../../auth/auth-context.service";
import { PhotoMediaStorageService } from "./photo-media-storage.service";
import { VisualComparisonAdvisoryRepository } from "../infrastructure/visual-comparison-advisory.repository";
import {
  QWEN_VISUAL_COMPARISON_MODEL,
  VISUAL_COMPARISON_PROMPT_POLICY_VERSION,
  VISUAL_COMPARISON_RESULT_SCHEMA_VERSION,
  VISUAL_COMPARISON_RUBRIC_VERSION,
} from "./visual-comparison.contract";

@Injectable()
export class VisualComparisonAdvisoryService {
  constructor(
    private readonly repository: VisualComparisonAdvisoryRepository,
    private readonly media: PhotoMediaStorageService,
    private readonly config: AppConfigService,
  ) {}

  async list(user: AuthenticatedUser, page: { limit: number; offset: number }) {
    const result = await this.repository.list({ ...this.scope(user), ...page });
    return { ...result, items: result.items.map((item) => this.withReviewPolicy(item)) };
  }

  async detail(user: AuthenticatedUser, comparisonRunId: string) {
    const item = await this.repository.detail({ ...this.scope(user), comparisonRunId });
    return this.withReviewPolicy(item);
  }

  async mediaContent(user: AuthenticatedUser, comparisonRunId: string, kind: "reference" | "evidence") {
    const asset = await this.repository.resolveMedia({ ...this.scope(user), comparisonRunId, kind });
    return this.media.readContent({
      mediaAssetId: asset.media_asset_id,
      actorUserId: user.userId,
      actorScope: {
        companyIds: [asset.company_id], regionIds: [asset.region_id], storeIds: [asset.store_id],
      },
      variant: "thumbnail",
    });
  }

  review(user: AuthenticatedUser, comparisonRunId: string, input: {
    decision: "accept" | "override" | "reject" | "recapture";
    reason: string;
    finalDecision?: "pass" | "partial" | "fail";
  }) {
    const reason = input.reason.trim();
    if (!reason || reason.length > 500) throw new ForbiddenException("A bounded review reason is required");
    if (input.decision === "override" && !input.finalDecision) {
      throw new ForbiddenException("Override requires a final decision");
    }
    if (input.decision !== "override" && input.finalDecision) {
      throw new ForbiddenException("Final decision is valid only for an override");
    }
    return this.repository.review({
      ...this.scope(user),
      comparisonRunId,
      ...input,
      reason,
      minimumConfidence: this.config.qwenVisualComparisonRuntimeConfiguration.minimumAdvisoryConfidence,
    });
  }

  private scope(user: AuthenticatedUser) {
    if (!this.config.visualComparisonAdvisoryReviewEnabled) {
      throw new ServiceUnavailableException("Visual advisory review is disabled");
    }
    const roleScope = user.roleScopes?.REGION_MANAGER;
    if (!user.roleCodes.includes("REGION_MANAGER") || !roleScope) {
      throw new ForbiddenException("Visual advisory review requires Region Manager scope");
    }
    const actionStoreIds = new Set(user.actionScope.assignedStoreIds);
    const storeIds = [...new Set(roleScope.storeIds.filter((storeId) => actionStoreIds.has(storeId)))];
    if (storeIds.length === 0) {
      throw new ForbiddenException("Visual advisory review requires assigned stores");
    }
    return {
      actorUserId: user.userId,
      storeIds,
      companyId: this.config.visualComparisonCompanyId,
      referenceSetId: this.config.visualComparisonReferenceSetId,
      notBefore: this.config.visualComparisonNotBefore,
      modelId: QWEN_VISUAL_COMPARISON_MODEL,
      promptVersion: VISUAL_COMPARISON_PROMPT_POLICY_VERSION,
      rubricVersion: VISUAL_COMPARISON_RUBRIC_VERSION,
      policyVersion: VISUAL_COMPARISON_RESULT_SCHEMA_VERSION,
    };
  }

  private withReviewPolicy<T extends { status: string; suggestion: string | null; confidence: number | null }>(item: T) {
    const minimum = this.config.qwenVisualComparisonRuntimeConfiguration.minimumAdvisoryConfidence;
    return {
      ...item,
      acceptAllowed: item.status === "completed" && item.confidence !== null &&
        item.confidence >= minimum && ["pass", "partial", "fail"].includes(item.suggestion ?? ""),
    };
  }
}
