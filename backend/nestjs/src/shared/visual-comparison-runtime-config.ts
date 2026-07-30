import { ConfigService } from "@nestjs/config";

const APPROVED_QWEN_MODEL = "qwen3.7-plus-2026-05-26";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type VisualComparisonRuntimeContext = {
  queueBackend: "in-memory" | "bullmq";
  photoMediaStorageEnabled: boolean;
  checklistEvidenceStorageHealthy: boolean;
};

export type QwenVisualComparisonRuntimeConfiguration = {
  enabled: boolean;
  baseUrl: string;
  allowedHostSha256: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxResponseBytes: number;
  maxOutputTokens: number;
  maxRequests: number;
  maxTokensPerRequest: number;
  maxTotalTokens: number;
  maxSpendUsdMicros: number;
  inputUsdMicrosPerMillionTokens: number;
  outputUsdMicrosPerMillionTokens: number;
  minimumAdvisoryConfidence: number;
};

export type VisualComparisonRuntimeConfiguration = {
  enqueueEnabled: boolean;
  workerEnabled: boolean;
  companyId: string;
  referenceSetId: string;
  notBefore: Date;
  reconcileLimit: number;
  reconcilePollSeconds: number;
  maxAttempts: number;
  processingLeaseSeconds: number;
  queueName: string;
  qwen: QwenVisualComparisonRuntimeConfiguration;
};

export function readVisualComparisonRuntimeConfiguration(
  configService: ConfigService,
  context: VisualComparisonRuntimeContext,
): VisualComparisonRuntimeConfiguration {
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
  const nonNegativeInteger = (key: string, fallback: string): number => {
    const value = Number(string(key, fallback));
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`${key} must be a non-negative integer`);
    }
    return value;
  };

  const enqueueEnabled = boolean("VISUAL_COMPARISON_ENQUEUE_ENABLED", false);
  const workerEnabled = boolean("VISUAL_COMPARISON_WORKER_ENABLED", false);
  if (workerEnabled && context.queueBackend !== "bullmq") {
    throw new Error("VISUAL_COMPARISON_WORKER_ENABLED=true requires QUEUE_BACKEND=bullmq");
  }
  if (workerEnabled && !context.photoMediaStorageEnabled) {
    throw new Error(
      "VISUAL_COMPARISON_WORKER_ENABLED=true requires PHOTO_MEDIA_STORAGE_ENABLED=true",
    );
  }
  if (workerEnabled && !context.checklistEvidenceStorageHealthy) {
    throw new Error(
      "VISUAL_COMPARISON_WORKER_ENABLED=true requires CHECKLIST_EVIDENCE_STORAGE_HEALTHY=true",
    );
  }

  const required = (key: string): string => {
    const value = optional(key);
    if ((enqueueEnabled || workerEnabled) && !value) {
      throw new Error(`${key} is required when visual comparison shadow processing is enabled`);
    }
    return value ?? "";
  };
  const workerRequired = (key: string): string => {
    const value = optional(key);
    if (workerEnabled && !value) {
      throw new Error(`${key} is required when the visual comparison worker is enabled`);
    }
    return value ?? "";
  };
  const companyId = required("VISUAL_COMPARISON_COMPANY_ID");
  const referenceSetId = required("VISUAL_COMPARISON_REFERENCE_SET_ID");
  if (companyId && !UUID_PATTERN.test(companyId)) {
    throw new Error("VISUAL_COMPARISON_COMPANY_ID must be a UUID");
  }
  if (referenceSetId && !UUID_PATTERN.test(referenceSetId)) {
    throw new Error("VISUAL_COMPARISON_REFERENCE_SET_ID must be a UUID");
  }
  const notBeforeRaw = required("VISUAL_COMPARISON_NOT_BEFORE");
  const notBefore = notBeforeRaw ? new Date(notBeforeRaw) : new Date(0);
  if (Number.isNaN(notBefore.getTime())) {
    throw new Error("VISUAL_COMPARISON_NOT_BEFORE must be an ISO timestamp");
  }

  const model = workerRequired("QWEN_MODEL") || APPROVED_QWEN_MODEL;
  if (workerEnabled && model !== APPROVED_QWEN_MODEL) {
    throw new Error("QWEN_MODEL must use the approved exact snapshot");
  }
  const minimumAdvisoryConfidence = Number(string("QWEN_MIN_ADVISORY_CONFIDENCE", "0.6"));
  if (!Number.isFinite(minimumAdvisoryConfidence) || minimumAdvisoryConfidence < 0 || minimumAdvisoryConfidence > 1) {
    throw new Error("QWEN_MIN_ADVISORY_CONFIDENCE must be between 0 and 1");
  }
  const inputUsdMicrosPerMillionTokens = nonNegativeInteger(
    "QWEN_INPUT_USD_MICROS_PER_MILLION_TOKENS",
    "0",
  );
  const outputUsdMicrosPerMillionTokens = nonNegativeInteger(
    "QWEN_OUTPUT_USD_MICROS_PER_MILLION_TOKENS",
    "0",
  );
  if (workerEnabled && (inputUsdMicrosPerMillionTokens <= 0 || outputUsdMicrosPerMillionTokens <= 0)) {
    throw new Error(
      "Qwen input and output price ceilings must be positive when the visual comparison worker is enabled",
    );
  }

  return {
    enqueueEnabled,
    workerEnabled,
    companyId,
    referenceSetId,
    notBefore,
    reconcileLimit: positiveInteger("VISUAL_COMPARISON_RECONCILE_LIMIT", "20"),
    reconcilePollSeconds: positiveInteger("VISUAL_COMPARISON_RECONCILE_POLL_SECONDS", "60"),
    maxAttempts: positiveInteger("VISUAL_COMPARISON_MAX_ATTEMPTS", "3"),
    processingLeaseSeconds: positiveInteger("VISUAL_COMPARISON_PROCESSING_LEASE_SECONDS", "300"),
    queueName: string("QUEUE_VISUAL_COMPARISON_NAME", "store-ops-visual-comparison-shadow"),
    qwen: {
      enabled: workerEnabled,
      baseUrl: workerRequired("QWEN_BASE_URL"),
      allowedHostSha256: workerRequired("QWEN_ALLOWED_HOST_SHA256"),
      apiKey: workerRequired("QWEN_API_KEY"),
      model,
      timeoutMs: positiveInteger("QWEN_TIMEOUT_MS", "30000"),
      maxResponseBytes: positiveInteger("QWEN_MAX_RESPONSE_BYTES", "65536"),
      maxOutputTokens: positiveInteger("QWEN_MAX_OUTPUT_TOKENS", "1024"),
      maxRequests: positiveInteger("QWEN_SHADOW_MAX_REQUESTS", "20"),
      maxTokensPerRequest: positiveInteger("QWEN_MAX_TOKENS_PER_REQUEST", "20000"),
      maxTotalTokens: positiveInteger("QWEN_SHADOW_MAX_TOTAL_TOKENS", "400000"),
      maxSpendUsdMicros: positiveInteger("QWEN_SHADOW_MAX_SPEND_USD_MICROS", "1000000"),
      inputUsdMicrosPerMillionTokens,
      outputUsdMicrosPerMillionTokens,
      minimumAdvisoryConfidence,
    },
  };
}
