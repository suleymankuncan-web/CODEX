import { ConfigService } from "@nestjs/config";
import { readFileBackedSetting } from "./secret-file-config";

export function readPhotoMediaCredentials(
  configService: ConfigService,
  enabled: boolean,
  role: "PRIMARY" | "RECOVERY",
) {
  const normalize = (value: string | undefined) =>
    !value || value === "undefined" || value === "null" ? undefined : value;
  const accessKeyId = normalize(
    readFileBackedSetting(configService, `PHOTO_MEDIA_${role}_ACCESS_KEY_ID`),
  );
  const secretAccessKey = normalize(
    readFileBackedSetting(configService, `PHOTO_MEDIA_${role}_SECRET_ACCESS_KEY`),
  );
  if (enabled && !accessKeyId) {
    throw new Error(
      `PHOTO_MEDIA_${role}_ACCESS_KEY_ID must be configured when photo media storage is enabled`,
    );
  }
  if (enabled && !secretAccessKey) {
    throw new Error(
      `PHOTO_MEDIA_${role}_SECRET_ACCESS_KEY must be configured when photo media storage is enabled`,
    );
  }
  return { accessKeyId: accessKeyId ?? "", secretAccessKey: secretAccessKey ?? "" };
}

export function readPhotoMediaRuntimeConfiguration(
  configService: ConfigService,
  enabled: boolean,
) {
  const optional = (key: string): string | undefined => {
    const value = configService.get<string>(key);
    return !value || value === "undefined" || value === "null" ? undefined : value;
  };
  const string = (key: string, fallback: string): string => optional(key) ?? fallback;
  const boolean = (key: string, fallback: boolean): boolean => {
    const value = optional(key);
    if (!value) return fallback;
    if (value === "true") return true;
    if (value === "false") return false;
    throw new Error(`${key} must be true or false`);
  };
  const positiveInteger = (key: string, fallback: string): number => {
    const value = Number(string(key, fallback));
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`${key} must be a positive integer`);
    }
    return value;
  };
  const required = (key: string): string => {
    const value = optional(key);
    if (enabled && !value) {
      throw new Error(`${key} must be configured when photo media storage is enabled`);
    }
    return value ?? "";
  };
  const syntheticOnly = boolean("PHOTO_MEDIA_SYNTHETIC_ONLY", true);
  if (enabled && !syntheticOnly) {
    throw new Error("PR-3 photo media storage must remain synthetic-only");
  }
  const rawAllowlist = optional("PHOTO_MEDIA_SYNTHETIC_FIXTURE_SHA256_ALLOWLIST") ?? "";
  const provider = string("PHOTO_MEDIA_PROVIDER", "r2");
  if (provider !== "r2" && provider !== "seaweedfs") {
    throw new Error("PHOTO_MEDIA_PROVIDER must be r2 or seaweedfs");
  }

  const realVmPilotEnabled = boolean("PHOTO_MEDIA_REAL_VM_PILOT_ENABLED", false);
  if (realVmPilotEnabled && !enabled) {
    throw new Error("PHOTO_MEDIA_REAL_VM_PILOT_ENABLED requires PHOTO_MEDIA_STORAGE_ENABLED=true");
  }
  const realVmPilotCompanyId = optional("PHOTO_MEDIA_REAL_VM_PILOT_COMPANY_ID") ?? "";
  const realVmPilotReferenceSetId = optional("PHOTO_MEDIA_REAL_VM_PILOT_REFERENCE_SET_ID") ?? "";
  const realVmPilotNotBeforeRaw = optional("PHOTO_MEDIA_REAL_VM_PILOT_NOT_BEFORE") ?? "";
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (realVmPilotEnabled && !uuidPattern.test(realVmPilotCompanyId)) {
    throw new Error("PHOTO_MEDIA_REAL_VM_PILOT_COMPANY_ID must be an exact UUID when enabled");
  }
  if (realVmPilotEnabled && !uuidPattern.test(realVmPilotReferenceSetId)) {
    throw new Error("PHOTO_MEDIA_REAL_VM_PILOT_REFERENCE_SET_ID must be an exact UUID when enabled");
  }
  const exactIsoTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/;
  const realVmPilotNotBefore = realVmPilotNotBeforeRaw ? new Date(realVmPilotNotBeforeRaw) : null;
  if (realVmPilotEnabled && (!exactIsoTimestamp.test(realVmPilotNotBeforeRaw) ||
      !realVmPilotNotBefore || Number.isNaN(realVmPilotNotBefore.getTime()))) {
    throw new Error("PHOTO_MEDIA_REAL_VM_PILOT_NOT_BEFORE must be an exact ISO timestamp when enabled");
  }
  const syntheticFixtureSha256Allowlist = [
    ...new Set(rawAllowlist.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean)),
  ];
  if (
    syntheticFixtureSha256Allowlist.length > 20 ||
    syntheticFixtureSha256Allowlist.some((value) => !/^[a-f0-9]{64}$/.test(value))
  ) {
    throw new Error(
      "PHOTO_MEDIA_SYNTHETIC_FIXTURE_SHA256_ALLOWLIST must contain at most 20 comma-separated SHA-256 digests",
    );
  }

  const storage = {
    enabled,
    syntheticOnly,
    provider,
    jurisdiction: provider === "r2" ? "eu" as const : "onprem" as const,
    region: provider === "r2" ? "auto" as const : "us-east-1" as const,
    forcePathStyle: true as const,
    primaryBucket: required("PHOTO_MEDIA_PRIMARY_BUCKET"),
    recoveryBucket: required("PHOTO_MEDIA_RECOVERY_BUCKET"),
    primaryEndpoint: required("PHOTO_MEDIA_PRIMARY_ENDPOINT"),
    recoveryEndpoint: required("PHOTO_MEDIA_RECOVERY_ENDPOINT"),
    publicDeliveryEnabled: false,
    aggregateBytesHardLimit: positiveInteger(
      "PHOTO_MEDIA_AGGREGATE_BYTES_HARD_LIMIT",
      String(8 * 1024 * 1024 * 1024),
    ),
    monthlyClassAHardLimit: positiveInteger("PHOTO_MEDIA_MONTHLY_CLASS_A_HARD_LIMIT", "750000"),
    monthlyClassBHardLimit: positiveInteger("PHOTO_MEDIA_MONTHLY_CLASS_B_HARD_LIMIT", "7500000"),
    signedReadTtlSeconds: positiveInteger("PHOTO_MEDIA_SIGNED_READ_TTL_SECONDS", "120"),
    lockSafetyDays: positiveInteger("PHOTO_MEDIA_LOCK_SAFETY_DAYS", "30"),
    perUserDailyBytesHardLimit: positiveInteger(
      "PHOTO_MEDIA_PER_USER_DAILY_BYTES_HARD_LIMIT",
      String(100 * 1024 * 1024),
    ),
    perStoreDailyBytesHardLimit: positiveInteger(
      "PHOTO_MEDIA_PER_STORE_DAILY_BYTES_HARD_LIMIT",
      String(250 * 1024 * 1024),
    ),
    concurrentProcessingHardLimit: positiveInteger("PHOTO_MEDIA_CONCURRENT_PROCESSING_HARD_LIMIT", "2"),
    scheduledRetentionCleanupEnabled: boolean(
      "PHOTO_MEDIA_SCHEDULED_RETENTION_CLEANUP_ENABLED",
      false,
    ),
    retentionManifestTtlMinutes: positiveInteger("PHOTO_MEDIA_RETENTION_MANIFEST_TTL_MINUTES", "60"),
    retentionWarningPercent: positiveInteger("PHOTO_MEDIA_RETENTION_WARNING_PERCENT", "70"),
    retentionCriticalPercent: positiveInteger("PHOTO_MEDIA_RETENTION_CRITICAL_PERCENT", "85"),
    syntheticFixtureSha256Allowlist,
    safetyAssurance: "fixture_identity_only" as const,
  };
  if (
    !(
      storage.retentionWarningPercent >= 1 &&
      storage.retentionWarningPercent < storage.retentionCriticalPercent &&
      storage.retentionCriticalPercent <= 100
    )
  ) {
    throw new Error("PHOTO_MEDIA_RETENTION thresholds must satisfy 1 <= warning < critical <= 100");
  }
  if (enabled && syntheticFixtureSha256Allowlist.length !== 1) {
    throw new Error(
      "PHOTO_MEDIA_SYNTHETIC_FIXTURE_SHA256_ALLOWLIST must contain exactly one approved synthetic fixture digest when storage is enabled",
    );
  }
  const primaryCredentials = readPhotoMediaCredentials(configService, enabled, "PRIMARY");
  const recoveryCredentials = readPhotoMediaCredentials(configService, enabled, "RECOVERY");
  if (enabled && recoveryCredentials.accessKeyId === primaryCredentials.accessKeyId) {
    throw new Error("Photo media primary and recovery require separate bucket-scoped credentials");
  }

  return {
    syntheticOnly,
    syntheticFixtureSha256Allowlist,
    primaryCredentials,
    recoveryCredentials,
    storage,
    realVmPilot: {
      enabled: realVmPilotEnabled,
      companyId: realVmPilotCompanyId,
      referenceSetId: realVmPilotReferenceSetId,
      notBefore: realVmPilotNotBefore,
    },
  };
}
