import { lstatSync, readFileSync } from "node:fs";

export type ConfigReader = {
  get(key: string): string | undefined;
};

const STRICT_LOCAL_PLAINTEXT_SETTINGS = [
  "BROWSER_SESSION_PREVIOUS_SECRET",
  "BROWSER_SESSION_SECRET",
  "DATABASE_URL",
  "DB_SSL_CA",
  "JWT_SECRET",
  "REDIS_URL",
] as const;

const STRICT_LOCAL_EXTERNAL_CONFIGURATION = [
  "AUTH_AUTHORIZATION_URL",
  "AUTH_CLIENT_ID",
  "AUTH_LOGOUT_URL",
  "AUTH_TOKEN_URL",
  "ERROR_TRACKING_DSN",
  "ERROR_TRACKING_DSN_FILE",
  "JWT_JWKS_URL",
  "PHOTO_MEDIA_PRIMARY_ACCESS_KEY_ID",
  "PHOTO_MEDIA_PRIMARY_ACCESS_KEY_ID_FILE",
  "PHOTO_MEDIA_PRIMARY_BUCKET",
  "PHOTO_MEDIA_PRIMARY_ENDPOINT",
  "PHOTO_MEDIA_PRIMARY_SECRET_ACCESS_KEY",
  "PHOTO_MEDIA_PRIMARY_SECRET_ACCESS_KEY_FILE",
  "PHOTO_MEDIA_RECOVERY_ACCESS_KEY_ID",
  "PHOTO_MEDIA_RECOVERY_ACCESS_KEY_ID_FILE",
  "PHOTO_MEDIA_RECOVERY_BUCKET",
  "PHOTO_MEDIA_RECOVERY_ENDPOINT",
  "PHOTO_MEDIA_RECOVERY_SECRET_ACCESS_KEY",
  "PHOTO_MEDIA_RECOVERY_SECRET_ACCESS_KEY_FILE",
] as const;

const STRICT_LOCAL_DISABLED_ACTIVATIONS = [
  "BROWSER_SESSION_COOKIE_ENABLED",
  "CHECKLIST_EVIDENCE_CAPTURE_ENABLED",
  "ERROR_TRACKING_ENABLED",
  "ERROR_TRACKING_SMOKE",
  "PHOTO_MEDIA_REAL_VM_PILOT_ENABLED",
  "PHOTO_MEDIA_STORAGE_ENABLED",
  "REGION_MANAGER_SOLUTION_REVIEW_ENABLED",
  "STORE_ACTION_PHOTO_RESOLUTION_ENABLED",
  "VISUAL_COMPARISON_ADVISORY_ENQUEUE_ENABLED",
  "VISUAL_COMPARISON_ADVISORY_REVIEW_ENABLED",
  "VISUAL_COMPARISON_ENQUEUE_ENABLED",
  "VISUAL_COMPARISON_WORKER_ENABLED",
  "VM_CAMPAIGN_DEADLINE_SETTLEMENT_ENABLED",
  "VM_CAMPAIGN_SUBMISSION_ENABLED",
  "VM_REFERENCE_PUBLISHING_ENABLED",
] as const;

const QWEN_CONFIGURATION = [
  "QWEN_ALLOWED_HOST_SHA256",
  "QWEN_API_KEY",
  "QWEN_API_KEY_FILE",
  "QWEN_BASE_URL",
  "QWEN_INPUT_USD_MICROS_PER_MILLION_TOKENS",
  "QWEN_MAX_OUTPUT_TOKENS",
  "QWEN_MAX_RESPONSE_BYTES",
  "QWEN_MAX_TOKENS_PER_REQUEST",
  "QWEN_MIN_ADVISORY_CONFIDENCE",
  "QWEN_MODEL",
  "QWEN_OUTPUT_USD_MICROS_PER_MILLION_TOKENS",
  "QWEN_SHADOW_MAX_REQUESTS",
  "QWEN_SHADOW_MAX_SPEND_USD_MICROS",
  "QWEN_SHADOW_MAX_TOTAL_TOKENS",
  "QWEN_TIMEOUT_MS",
] as const;

function normalize(value: string | undefined): string | undefined {
  if (!value || value === "undefined" || value === "null") {
    return undefined;
  }

  return value;
}

export function assertSecretFilePermissions(key: string, mode: number): void {
  if ((mode & 0o077) !== 0) {
    throw new Error(`${key} permissions are too permissive`);
  }
}

export function assertPublicTrustFilePermissions(key: string, mode: number): void {
  if ((mode & 0o022) !== 0) {
    throw new Error(`${key} permissions allow untrusted modification`);
  }
}

export function assertSecretFileOwnership(
  key: string,
  ownerUid: number,
  effectiveUid: number,
): void {
  if (ownerUid !== effectiveUid) {
    throw new Error(`${key} owner does not match the runtime user`);
  }
}

export function assertSecretFileMetadata(
  key: string,
  metadata: {
    isFile(): boolean;
    isSymbolicLink(): boolean;
  },
): void {
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw new Error(`${key} must reference a regular non-symlink file`);
  }
}

export function readFileBackedSetting(
  config: ConfigReader,
  key: string,
): string | undefined {
  const fileKey = `${key}_FILE`;
  const plaintext = normalize(config.get(key));
  const filePath = normalize(config.get(fileKey));

  if (plaintext && filePath) {
    throw new Error(`${key} and ${fileKey} cannot both be configured`);
  }

  if (!filePath) {
    return plaintext;
  }

  let metadata: ReturnType<typeof lstatSync>;
  try {
    metadata = lstatSync(filePath);
  } catch {
    throw new Error(`${fileKey} must reference a non-empty readable file`);
  }

  assertSecretFileMetadata(fileKey, metadata);
  if (process.platform !== "win32") {
    if (key === "DB_SSL_CA") {
      assertPublicTrustFilePermissions(fileKey, metadata.mode);
    } else {
      assertSecretFilePermissions(fileKey, metadata.mode);
      const effectiveUid = process.geteuid?.();
      if (effectiveUid !== undefined) {
        assertSecretFileOwnership(fileKey, metadata.uid, effectiveUid);
      }
    }
  }

  try {
    const value = readFileSync(filePath, "utf8").trim();
    if (!value) {
      throw new Error("empty");
    }
    return value;
  } catch {
    throw new Error(`${fileKey} must reference a non-empty readable file`);
  }
}

export function assertStrictLocalConfiguration(
  config: ConfigReader,
  input: {
    dataClass: string;
    isStrictLocal: boolean;
    processRole?: "runtime" | "migrator" | "synthetic-seed";
  },
): void {
  if (!input.isStrictLocal) {
    return;
  }
  if (input.dataClass !== "synthetic") {
    throw new Error(
      "HR_AXIS_DATA_CLASS=synthetic is required when HR_AXIS_STRICT_LOCAL=true",
    );
  }
  if (
    STRICT_LOCAL_PLAINTEXT_SETTINGS.some((key) =>
      Boolean(config.get(key)?.trim()),
    )
  ) {
    throw new Error(
      "Plaintext sensitive settings are not allowed when HR_AXIS_STRICT_LOCAL=true",
    );
  }
  const externalConfiguration = [
    ...STRICT_LOCAL_EXTERNAL_CONFIGURATION,
    ...QWEN_CONFIGURATION,
  ].some((key) => Boolean(config.get(key)?.trim()));
  const activated = STRICT_LOCAL_DISABLED_ACTIVATIONS.some(
    (key) => config.get(key) === "true",
  );
  if (
    externalConfiguration ||
    activated ||
    (config.get("AUTH_PROVIDER_KEY") ?? "oidc") !== "oidc" ||
    (config.get("JWT_ISSUER") ?? "store-ops-auth") !== "store-ops-auth"
  ) {
    throw new Error(
      "External provider configuration is not allowed when HR_AXIS_STRICT_LOCAL=true",
    );
  }

  const processRole = input.processRole ?? "runtime";
  const requiredFileBackedSettings =
    processRole === "runtime"
      ? ["DATABASE_URL", "DB_SSL_CA", "JWT_SECRET", "REDIS_URL"]
      : ["DATABASE_URL", "DB_SSL_CA"];
  for (const key of requiredFileBackedSettings) {
    if (!config.get(`${key}_FILE`)) {
      throw new Error(`${key}_FILE is required when HR_AXIS_STRICT_LOCAL=true`);
    }
    readFileBackedSetting(config, key);
  }
  if (config.get("DB_SSL_MODE") !== "verify-full") {
    throw new Error("DB_SSL_MODE=verify-full is required when HR_AXIS_STRICT_LOCAL=true");
  }
  if (processRole === "runtime" && config.get("QUEUE_BACKEND") !== "bullmq") {
    throw new Error("QUEUE_BACKEND=bullmq is required when HR_AXIS_STRICT_LOCAL=true");
  }
}
