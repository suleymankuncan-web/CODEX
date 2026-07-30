import { createHash } from "node:crypto";
import {
  VISUAL_COMPARISON_DIMENSION_KEYS,
  VisualComparisonCriteria,
  VisualComparisonFailureCode,
  VisualComparisonInvocation,
} from "./visual-comparison.contract";

export const VISUAL_COMPARISON_SHADOW_JOB_TYPE = "visual-comparison-shadow" as const;
export const VISUAL_COMPARISON_SHADOW_ADAPTER_ID = "qwen-compatible-v1" as const;

export type VisualComparisonShadowScope = {
  isolationClass: "shadow" | "advisory";
  companyId: string;
  referenceSetId: string;
  notBefore: Date;
  limit: number;
};

export type VisualComparisonShadowClaim = {
  comparisonRunId: string;
  companyId: string;
  regionId: string;
  storeId: string;
  actorUserId: string;
  referenceMediaAssetId: string;
  evidenceMediaAssetId: string;
  referenceSha256: string;
  evidenceSha256: string;
  referenceWidthPx: number;
  referenceHeightPx: number;
  evidenceWidthPx: number;
  evidenceHeightPx: number;
  expectedVisualIntent: string;
  reviewInstructions: string;
  attemptNumber: number;
};

export type VisualComparisonShadowBudget = {
  maxRequests: number;
  maxTotalTokens: number;
  maxSpendUsdMicros: number;
  reservedTokensPerAttempt: number;
  reservedSpendUsdMicrosPerAttempt: number;
};

export type VisualComparisonShadowClaimResult =
  | { status: "claimed"; claim: VisualComparisonShadowClaim }
  | { status: "busy" }
  | { status: "idempotent" }
  | { status: "budget_exhausted" };

export class VisualComparisonShadowBusyError extends Error {
  constructor() {
    super("Visual comparison shadow claim is still processing");
    this.name = "VisualComparisonShadowBusyError";
  }
}

export class VisualComparisonShadowDisabledError extends Error {
  constructor() {
    super("Visual comparison shadow enqueue is disabled");
    this.name = "VisualComparisonShadowDisabledError";
  }
}

export type VisualComparisonShadowRuntime = {
  enqueueEnabled: boolean;
  isolationClass: "shadow" | "advisory";
  workerEnabled: boolean;
  maxAttempts: number;
  processingLeaseSeconds: number;
  budget: VisualComparisonShadowBudget;
  scope: Omit<VisualComparisonShadowScope, "isolationClass">;
};

export interface VisualComparisonShadowRepositoryPort {
  reconcile(input: VisualComparisonShadowScope & {
    promptVersion: string;
    policyVersion: string;
    maxAttempts: number;
    processingLeaseSeconds: number;
  }): Promise<string[]>;
  claim(input: {
    comparisonRunId: string;
    isolationClass: "shadow" | "advisory";
    maxAttempts: number;
    processingLeaseSeconds: number;
    companyId: string;
    referenceSetId: string;
    notBefore: Date;
    budget: VisualComparisonShadowBudget;
  }): Promise<VisualComparisonShadowClaimResult>;
  complete(input: {
    comparisonRunId: string;
    invocation: VisualComparisonInvocation;
    attemptNumber: number;
  }): Promise<boolean>;
  fail(input: {
    comparisonRunId: string;
    code: VisualComparisonFailureCode | "unexpected_failure";
    retryable: boolean;
    attemptNumber: number;
  }): Promise<boolean>;
}

export function buildShadowCriteria(input: {
  expectedVisualIntent: string;
  reviewInstructions: string;
}): VisualComparisonCriteria[] {
  const requirement = `${input.expectedVisualIntent.trim()} ${input.reviewInstructions.trim()}`
    .replace(/\s+/g, " ")
    .slice(0, 400);
  if (!requirement) {
    throw new Error("Shadow comparison requires a frozen VM criterion");
  }
  return VISUAL_COMPARISON_DIMENSION_KEYS.map((dimension) => ({
    dimension,
    requirement,
  }));
}

export function buildShadowIdempotencyKey(input: {
  isolationClass: "shadow" | "advisory";
  companyId: string;
  assignmentId: string;
  visualReferenceItemId: string;
  evidenceSha256: string;
  referenceSha256: string;
  rubricVersion: string;
  promptVersion: string;
  policyVersion: string;
}): string {
  return createHash("sha256")
    .update([
      input.companyId,
      input.isolationClass,
      input.assignmentId,
      input.visualReferenceItemId,
      input.evidenceSha256,
      input.referenceSha256,
      input.rubricVersion,
      input.promptVersion,
      input.policyVersion,
    ].join("|"))
    .digest("hex");
}

export function isRetryableVisualComparisonFailure(code: VisualComparisonFailureCode): boolean {
  return code === "provider_timeout" || code === "provider_unavailable";
}
