import { Inject, Injectable } from "@nestjs/common";
import { VisualComparisonPort } from "./visual-comparison.port";
import {
  VISUAL_COMPARISON_SHADOW_ADAPTER_ID,
  VisualComparisonShadowBusyError,
  VisualComparisonShadowDisabledError,
  VisualComparisonShadowRepositoryPort,
  VisualComparisonShadowRuntime,
  buildShadowCriteria,
  isRetryableVisualComparisonFailure,
} from "./visual-comparison-shadow.contract";
import { VisualComparisonFailure } from "./visual-comparison.contract";
import { PhotoMediaStorageService } from "./photo-media-storage.service";

export const VISUAL_COMPARISON_SHADOW_REPOSITORY = Symbol(
  "VISUAL_COMPARISON_SHADOW_REPOSITORY",
);
export const VISUAL_COMPARISON_SHADOW_RUNTIME = Symbol(
  "VISUAL_COMPARISON_SHADOW_RUNTIME",
);
export const VISUAL_COMPARISON_PROVIDER = Symbol("VISUAL_COMPARISON_PROVIDER");

@Injectable()
export class VisualComparisonShadowService {
  constructor(
    @Inject(VISUAL_COMPARISON_SHADOW_REPOSITORY)
    private readonly repository: VisualComparisonShadowRepositoryPort,
    private readonly media: PhotoMediaStorageService,
    @Inject(VISUAL_COMPARISON_PROVIDER)
    private readonly provider: VisualComparisonPort,
    @Inject(VISUAL_COMPARISON_SHADOW_RUNTIME)
    private readonly runtime: VisualComparisonShadowRuntime,
  ) {}

  async process(input: { comparisonRunId: string }) {
    if (!this.runtime.workerEnabled) {
      return { status: "disabled" as const };
    }
    if (!this.runtime.enqueueEnabled) {
      throw new VisualComparisonShadowDisabledError();
    }
    const claimResult = await this.repository.claim({
      comparisonRunId: input.comparisonRunId,
      maxAttempts: this.runtime.maxAttempts,
      processingLeaseSeconds: this.runtime.processingLeaseSeconds,
      companyId: this.runtime.scope.companyId,
      referenceSetId: this.runtime.scope.referenceSetId,
      notBefore: this.runtime.scope.notBefore,
      budget: this.runtime.budget,
    });
    if (claimResult.status === "busy") {
      throw new VisualComparisonShadowBusyError();
    }
    if (claimResult.status === "budget_exhausted") {
      return { status: "failed_terminal" as const, code: "budget_exhausted" as const };
    }
    if (claimResult.status === "idempotent") {
      return { status: "idempotent" as const };
    }
    const claim = claimResult.claim;

    try {
      const actorScope = {
        companyIds: [claim.companyId],
        regionIds: [claim.regionId],
        storeIds: [claim.storeId],
      };
      const [reference, evidence] = await Promise.all([
        this.media.readContent({
          mediaAssetId: claim.referenceMediaAssetId,
          actorUserId: claim.actorUserId,
          actorScope,
          variant: "canonical",
        }),
        this.media.readContent({
          mediaAssetId: claim.evidenceMediaAssetId,
          actorUserId: claim.actorUserId,
          actorScope,
          variant: "canonical",
        }),
      ]);
      const invocation = await this.provider.compare({
        comparisonId: claim.comparisonRunId,
        referenceImage: reference.body,
        evidenceImage: evidence.body,
        referenceMimeType: "image/webp",
        evidenceMimeType: "image/webp",
        referenceSha256: claim.referenceSha256,
        evidenceSha256: claim.evidenceSha256,
        referenceWidthPx: claim.referenceWidthPx,
        referenceHeightPx: claim.referenceHeightPx,
        evidenceWidthPx: claim.evidenceWidthPx,
        evidenceHeightPx: claim.evidenceHeightPx,
        criteria: buildShadowCriteria(claim),
        locale: "tr",
      });
      const applied = await this.repository.complete({
        comparisonRunId: claim.comparisonRunId,
        invocation,
        attemptNumber: claim.attemptNumber,
      });
      if (!applied) {
        return { status: "superseded" as const };
      }
      return {
        status: invocation.result.decision === "abstain" ||
          invocation.result.decision === "recapture_required"
          ? "abstained" as const
          : "completed" as const,
        adapterId: VISUAL_COMPARISON_SHADOW_ADAPTER_ID,
      };
    } catch (error) {
      if (error instanceof VisualComparisonFailure) {
        const retryable = isRetryableVisualComparisonFailure(error.code) &&
          claim.attemptNumber < this.runtime.maxAttempts;
        const applied = await this.repository.fail({
          comparisonRunId: claim.comparisonRunId,
          code: error.code,
          retryable,
          attemptNumber: claim.attemptNumber,
        });
        if (!applied) {
          return { status: "superseded" as const };
        }
        if (retryable) throw error;
        return { status: "failed_terminal" as const, code: error.code };
      }
      const applied = await this.repository.fail({
        comparisonRunId: claim.comparisonRunId,
        code: "unexpected_failure",
        retryable: false,
        attemptNumber: claim.attemptNumber,
      });
      if (!applied) {
        return { status: "superseded" as const };
      }
      return { status: "failed_terminal" as const, code: "unexpected_failure" as const };
    }
  }
}
