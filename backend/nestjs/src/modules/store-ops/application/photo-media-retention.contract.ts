import { BadRequestException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { PhotoMediaObjectReference } from "./photo-media-storage.ports";

export type PhotoMediaPurgeManifestSource = "manual" | "scheduled";
export type PhotoMediaPurgeReason =
  | "manual_retention_cleanup"
  | "scheduled_retention_cleanup";
export type PhotoMediaPurgeManifestStatus =
  | "previewed"
  | "executing"
  | "completed"
  | "retryable_failure"
  | "expired";

export type PhotoMediaPurgeSnapshot = {
  mediaAssetId: string;
  companyId: string;
  assetState: "ready";
  canonicalSha256: string;
  accountedProviderBytes: number;
  expiresAt: Date;
  retentionPolicyId: string;
  retentionPolicyVersion: number;
};

export type PhotoMediaPurgeManifestReceipt = {
  manifestId: string;
  manifestDigest: string;
  candidateCount: number;
  candidateBytes: number;
  expiresAt: Date;
  status: "previewed";
};

export type PhotoMediaPurgeClaim = {
  manifestId: string;
  manifestDigest: string;
  manifestLeaseToken: string;
  candidates: Array<{
    mediaAssetId: string;
    cleanupLeaseToken: string;
    canonicalSha256: string;
    thumbnailObject: PhotoMediaObjectReference;
    primaryObjects: PhotoMediaObjectReference[];
    recoveryObjects: PhotoMediaObjectReference[];
  }>;
};

export type PhotoMediaLifecycleReconciliationSummary = {
  danglingLinkCount: number;
  stuckUploadCount: number;
  stuckPurgeCount: number;
  protectedExpiryCount: number;
  tombstoneResidueCount: number;
  findingEvents: Array<{ mediaAssetId: string; reasonCode: string }>;
};

export type PhotoMediaUsageForecast = {
  currentBytes: number;
  classAOperations: number;
  classBOperations: number;
  recentGrowthBytes: number;
  projectedThirtyDayBytes: number;
  classifications: Array<{ classification: string; assetCount: number; bytes: number }>;
  purgeEligibleCount: number;
  protectedExpiredCount: number;
  stuckUploadCount: number;
  stuckPurgeCount: number;
  cleanupFailureCount: number;
};

function assertNonNegativeSafeInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new BadRequestException(`${name} must be a non-negative safe integer`);
  }
}

export function buildPurgeEligibilityDigest(input: PhotoMediaPurgeSnapshot): string {
  assertNonNegativeSafeInteger("accountedProviderBytes", input.accountedProviderBytes);
  if (!Number.isSafeInteger(input.retentionPolicyVersion) || input.retentionPolicyVersion < 1) {
    throw new BadRequestException("retentionPolicyVersion must be a positive safe integer");
  }
  if (!/^[a-f0-9]{64}$/.test(input.canonicalSha256)) {
    throw new BadRequestException("canonicalSha256 must be a lowercase SHA-256 digest");
  }
  if (Number.isNaN(input.expiresAt.getTime())) {
    throw new BadRequestException("expiresAt must be a valid instant");
  }
  const canonical = [
    "photo-media-purge-item-v1",
    input.mediaAssetId,
    input.companyId,
    input.assetState,
    input.canonicalSha256,
    String(input.accountedProviderBytes),
    input.expiresAt.toISOString(),
    input.retentionPolicyId,
    String(input.retentionPolicyVersion),
  ].join("\n");
  return createHash("sha256").update(canonical).digest("hex");
}

export function buildPurgeManifestDigest(
  snapshots: Array<PhotoMediaPurgeSnapshot & { eligibilityDigest: string }>,
): string {
  const canonical = snapshots
    .slice()
    .sort((left, right) => left.mediaAssetId.localeCompare(right.mediaAssetId))
    .map((item, index) => `${index + 1}:${item.eligibilityDigest}`)
    .join("\n");
  return createHash("sha256")
    .update(`photo-media-purge-manifest-v1\n${canonical}`)
    .digest("hex");
}

export type RetentionUsageState = "normal" | "warning" | "critical" | "limit_reached";

export function classifyRetentionUsage(input: {
  used: number;
  limit: number;
  warningPercent: number;
  criticalPercent: number;
}): RetentionUsageState {
  for (const [name, value] of Object.entries(input)) {
    assertNonNegativeSafeInteger(name, value);
  }
  if (
    input.limit < 1 ||
    input.warningPercent < 1 ||
    input.criticalPercent <= input.warningPercent ||
    input.criticalPercent > 100
  ) {
    throw new BadRequestException("Retention usage thresholds are invalid");
  }
  const percent = (input.used / input.limit) * 100;
  if (percent >= 100) return "limit_reached";
  if (percent >= input.criticalPercent) return "critical";
  if (percent >= input.warningPercent) return "warning";
  return "normal";
}
