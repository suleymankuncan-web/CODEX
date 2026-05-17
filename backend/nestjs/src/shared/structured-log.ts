import { Logger } from "@nestjs/common";
import { RequestContextStore } from "./request-context";

type StructuredLogFields = {
  actorUserId?: string | null;
  batchId?: string | null;
  jobId?: string | null;
  snapshotRunId?: string | null;
  [key: string]: unknown;
};

const SENSITIVE_FIELD_PATTERN =
  /authorization|bearer|client_secret|password|private_key|refresh_token|secret|token/i;

export function redactSensitiveLogValue(value: unknown, depth = 0): unknown {
  if (typeof value === "string") {
    return redactSensitiveString(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactSensitiveLogValue(entry, depth + 1));
  }

  if (!value || typeof value !== "object" || depth > 4) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      SENSITIVE_FIELD_PATTERN.test(key)
        ? "[redacted]"
        : redactSensitiveLogValue(entry, depth + 1),
    ]),
  );
}

function redactSensitiveString(value: string): string {
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/\b(?:postgres(?:ql)?|redis):\/\/[^\s"'<>]+/gi, "[redacted-url]")
    .replace(
      /\b(authorization|client_secret|password|pwd|refresh_token|secret|token)=([^;\s&,]+)/gi,
      "$1=[redacted]",
    );
}

export function logStructuredMessage(
  logger: Logger,
  event: string,
  fields: StructuredLogFields = {},
): void {
  const safeFields = redactSensitiveLogValue(fields) as StructuredLogFields;

  logger.log(
    JSON.stringify({
      event,
      correlationId: RequestContextStore.getCorrelationId(),
      actorUserId: RequestContextStore.get()?.actorUserId ?? null,
      batchId: null,
      jobId: null,
      snapshotRunId: null,
      ...safeFields,
    }),
  );
}

export function logStructuredError(
  logger: Logger,
  event: string,
  error: unknown,
  fields: StructuredLogFields = {},
): void {
  const message = error instanceof Error ? error.message : String(error);
  const safeFields = redactSensitiveLogValue(fields) as StructuredLogFields;

  logger.error(
    JSON.stringify({
      event,
      correlationId: RequestContextStore.getCorrelationId(),
      actorUserId: RequestContextStore.get()?.actorUserId ?? null,
      batchId: null,
      jobId: null,
      snapshotRunId: null,
      errorMessage: redactSensitiveLogValue(message),
      ...safeFields,
    }),
  );
}
