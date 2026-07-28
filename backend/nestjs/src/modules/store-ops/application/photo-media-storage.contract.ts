import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { isPostgresUuidString } from "../../../shared/validation/postgres-uuid";

export type PhotoMediaStorageProvider = "r2";
export type PhotoMediaStorageJurisdiction = "eu";

export type PhotoMediaStorageConfiguration = {
  enabled: boolean;
  syntheticOnly: boolean;
  provider: PhotoMediaStorageProvider;
  jurisdiction: PhotoMediaStorageJurisdiction;
  primaryBucket: string;
  recoveryBucket: string;
  primaryEndpoint: string;
  recoveryEndpoint: string;
  publicDeliveryEnabled: boolean;
  aggregateBytesHardLimit: number;
  monthlyClassAHardLimit: number;
  monthlyClassBHardLimit: number;
  signedReadTtlSeconds: number;
  lockSafetyDays: number;
  perUserDailyBytesHardLimit: number;
  perStoreDailyBytesHardLimit: number;
  concurrentProcessingHardLimit: number;
  scheduledRetentionCleanupEnabled?: boolean;
  retentionManifestTtlMinutes?: number;
  retentionWarningPercent?: number;
  retentionCriticalPercent?: number;
  syntheticFixtureSha256Allowlist?: string[];
  safetyAssurance: "fixture_identity_only" | "malware_scan";
};

const BUCKET_PATTERN = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive safe integer`);
  }
}

function assertR2EuEndpoint(name: string, value: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid R2 EU jurisdiction endpoint`);
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash ||
    !/^[a-z0-9]+\.eu\.r2\.cloudflarestorage\.com$/i.test(parsed.hostname)
  ) {
    throw new Error(`${name} must be a private R2 EU jurisdiction endpoint`);
  }
}

export function assertPhotoMediaStorageConfiguration(
  configuration: PhotoMediaStorageConfiguration,
): void {
  if (!configuration.enabled) {
    return;
  }
  if (configuration.provider !== "r2") {
    throw new Error("Photo media storage provider must be r2");
  }
  if (configuration.jurisdiction !== "eu") {
    throw new Error("Photo media storage requires the approved EU jurisdiction");
  }
  if (!configuration.syntheticOnly) {
    throw new Error("PR-3 photo media storage must remain synthetic-only");
  }
  if (configuration.safetyAssurance !== "fixture_identity_only") {
    throw new Error("Synthetic photo media storage requires fixture identity assurance");
  }
  const fixtureDigests = configuration.syntheticFixtureSha256Allowlist ?? [];
  if (
    fixtureDigests.length !== 1 ||
    !/^[a-f0-9]{64}$/.test(fixtureDigests[0])
  ) {
    throw new Error("Synthetic photo media storage requires exactly one approved synthetic fixture digest");
  }
  if (configuration.publicDeliveryEnabled) {
    throw new Error("Photo media storage public delivery must remain disabled");
  }
  if (
    !BUCKET_PATTERN.test(configuration.primaryBucket) ||
    !BUCKET_PATTERN.test(configuration.recoveryBucket)
  ) {
    throw new Error("Photo media storage bucket names are invalid");
  }
  if (configuration.primaryBucket === configuration.recoveryBucket) {
    throw new Error("Primary and recovery buckets must be distinct");
  }

  assertR2EuEndpoint("PHOTO_MEDIA_PRIMARY_ENDPOINT", configuration.primaryEndpoint);
  assertR2EuEndpoint("PHOTO_MEDIA_RECOVERY_ENDPOINT", configuration.recoveryEndpoint);
  assertPositiveInteger("PHOTO_MEDIA_AGGREGATE_BYTES_HARD_LIMIT", configuration.aggregateBytesHardLimit);
  assertPositiveInteger("PHOTO_MEDIA_MONTHLY_CLASS_A_HARD_LIMIT", configuration.monthlyClassAHardLimit);
  assertPositiveInteger("PHOTO_MEDIA_MONTHLY_CLASS_B_HARD_LIMIT", configuration.monthlyClassBHardLimit);
  assertPositiveInteger("PHOTO_MEDIA_SIGNED_READ_TTL_SECONDS", configuration.signedReadTtlSeconds);
  assertPositiveInteger("PHOTO_MEDIA_LOCK_SAFETY_DAYS", configuration.lockSafetyDays);
  assertPositiveInteger("PHOTO_MEDIA_PER_USER_DAILY_BYTES_HARD_LIMIT", configuration.perUserDailyBytesHardLimit);
  assertPositiveInteger("PHOTO_MEDIA_PER_STORE_DAILY_BYTES_HARD_LIMIT", configuration.perStoreDailyBytesHardLimit);
  assertPositiveInteger("PHOTO_MEDIA_CONCURRENT_PROCESSING_HARD_LIMIT", configuration.concurrentProcessingHardLimit);
  assertPositiveInteger(
    "PHOTO_MEDIA_RETENTION_MANIFEST_TTL_MINUTES",
    configuration.retentionManifestTtlMinutes ?? 60,
  );
  const warningPercent = configuration.retentionWarningPercent ?? 70;
  const criticalPercent = configuration.retentionCriticalPercent ?? 85;
  assertPositiveInteger("PHOTO_MEDIA_RETENTION_WARNING_PERCENT", warningPercent);
  assertPositiveInteger("PHOTO_MEDIA_RETENTION_CRITICAL_PERCENT", criticalPercent);
  if (warningPercent >= criticalPercent || criticalPercent > 100) {
    throw new Error("Photo media retention alert thresholds must increase and end at or below 100");
  }

  if (configuration.aggregateBytesHardLimit > 8 * 1024 * 1024 * 1024) {
    throw new Error("Photo media storage hard limit cannot exceed the approved 8 GiB ceiling");
  }
  if (configuration.monthlyClassAHardLimit > 750_000) {
    throw new Error("Photo media Class A hard limit cannot exceed 750000");
  }
  if (configuration.monthlyClassBHardLimit > 7_500_000) {
    throw new Error("Photo media Class B hard limit cannot exceed 7500000");
  }
  if (configuration.signedReadTtlSeconds > 300) {
    throw new Error("Photo media signed read TTL cannot exceed 300 seconds");
  }
  if (configuration.lockSafetyDays !== 30) {
    throw new Error("PR-3 photo media lock safety window must be 30 days");
  }
  if (configuration.concurrentProcessingHardLimit > 4) {
    throw new Error("Photo media concurrent processing hard limit cannot exceed 4 in synthetic staging");
  }
}

export function buildPhotoMediaObjectKeys(input: {
  companyId: string;
  mediaAssetId: string;
  storageAttemptId?: string;
}) {
  if (
    !isPostgresUuidString(input.companyId) ||
    !isPostgresUuidString(input.mediaAssetId) ||
    (input.storageAttemptId !== undefined && !isPostgresUuidString(input.storageAttemptId))
  ) {
    throw new BadRequestException("Photo media object scope is invalid");
  }

  const scope = `companies/${input.companyId}/media/${input.mediaAssetId}`;
  const immutableScope = input.storageAttemptId
    ? `${scope}/attempts/${input.storageAttemptId}`
    : scope;
  return {
    raw: `transient/${scope}/raw`,
    canonical: `locked/${immutableScope}/canonical.webp`,
    thumbnail: `derived/${immutableScope}/thumbnail.webp`,
    recovery: `locked/${immutableScope}/canonical.webp`,
  } as const;
}

export function assertPhotoMediaUploadQuota(input: {
  aggregateStoredBytes: number;
  requestedBytes: number;
  monthlyClassAOperations: number;
  monthlyClassBOperations: number;
  configuration: PhotoMediaStorageConfiguration;
}): void {
  const values = [
    input.aggregateStoredBytes,
    input.requestedBytes,
    input.monthlyClassAOperations,
    input.monthlyClassBOperations,
  ];
  if (values.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    throw new BadRequestException("Photo media usage counters are invalid");
  }
  if (
    input.aggregateStoredBytes + input.requestedBytes >
    input.configuration.aggregateBytesHardLimit
  ) {
    throw new ServiceUnavailableException("Photo media storage hard limit reached");
  }
  if (input.monthlyClassAOperations + 1 > input.configuration.monthlyClassAHardLimit) {
    throw new ServiceUnavailableException("Photo media Class A hard limit reached");
  }
  if (input.monthlyClassBOperations > input.configuration.monthlyClassBHardLimit) {
    throw new ServiceUnavailableException("Photo media Class B hard limit reached");
  }
}

export type PhotoMediaAssetState =
  | "initiated"
  | "uploaded"
  | "quarantined"
  | "accepted"
  | "canonicalized"
  | "ready"
  | "rejected"
  | "expired"
  | "purge_pending"
  | "deleted_tombstone";

export type PhotoMediaAssetRecord = {
  mediaAssetId: string;
  companyId: string;
  regionId: string | null;
  storeId: string | null;
  classification?: "checklist_evidence" | "action_evidence" | "vm_reference" | "vm_campaign_evidence" | "derived_artifact";
  state: PhotoMediaAssetState;
  rawObjectKey?: string;
  canonicalObjectKey?: string | null;
  thumbnailObjectKey?: string | null;
  canonicalSha256?: string | null;
  canonicalByteCount?: number | null;
  storageAttemptId?: string | null;
  rawDisposedAt?: Date | null;
};

export type PhotoMediaActorScope = {
  companyIds: string[];
  regionIds: string[];
  storeIds: string[];
};
