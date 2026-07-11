import { Injectable, Logger } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";
import type {
  ErrorEvent,
  Exception,
  StackFrame,
  Stacktrace,
} from "@sentry/nestjs";
import { AppConfigService } from "../app-config.service";
import { redactSensitiveLogValue } from "../structured-log";

export type SentryRuntime = "api" | "worker" | "unknown";

export type SentryCaptureContext = {
  event: string;
  source: string;
  severity: "error" | "fatal" | "warning";
  runtime: SentryRuntime;
  correlationId?: string | null;
  errorCode?: string;
  method?: string;
  normalizedPath?: string;
  statusCode?: number;
  metadata?: Record<string, string | number | null>;
};

const MAX_TEXT_LENGTH = 1000;
const MAX_TAG_LENGTH = 200;

@Injectable()
export class SentryErrorDelivery {
  private readonly logger = new Logger(SentryErrorDelivery.name);
  private enabled = false;

  constructor(private readonly config: AppConfigService) {
    this.initialize();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  captureException(error: unknown, context: SentryCaptureContext): boolean {
    if (!this.enabled) {
      return false;
    }

    try {
      const safeError = createSafeError(error);

      Sentry.withScope((scope) => {
        scope.setLevel(context.severity);
        scope.setTag("event", safeTag(context.event));
        scope.setTag("source", safeTag(context.source));
        scope.setTag("runtime", context.runtime);

        if (context.correlationId) {
          scope.setTag("correlation_id", safeTag(context.correlationId));
        }
        if (context.errorCode) {
          scope.setTag("error_code", safeTag(context.errorCode));
        }
        if (context.method) {
          scope.setTag("method", safeTag(context.method));
        }
        if (context.normalizedPath) {
          scope.setTag("path", safeTag(context.normalizedPath));
        }
        if (typeof context.statusCode === "number") {
          scope.setTag("status_code", String(context.statusCode));
        }

        for (const [key, value] of Object.entries(context.metadata ?? {})) {
          if (value !== null && value !== undefined) {
            scope.setTag(`meta_${key}`, safeTag(String(value)));
          }
        }

        Sentry.captureException(safeError);
      });

      return true;
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: "observability.external_delivery.failed",
          reason: sanitizeText(error),
        }),
      );
      return false;
    }
  }

  async flush(timeoutMs = 2000): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      return await Sentry.flush(timeoutMs);
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: "observability.external_delivery.flush_failed",
          reason: sanitizeText(error),
        }),
      );
      return false;
    }
  }

  private initialize(): void {
    if (!this.config.errorTrackingEnableRequested) {
      return;
    }

    const dsn = this.config.errorTrackingDsn;
    if (!dsn) {
      this.logger.warn(
        JSON.stringify({
          event: "observability.external_delivery.not_configured",
          reason: "ERROR_TRACKING_ENABLED=true requires ERROR_TRACKING_DSN",
        }),
      );
      return;
    }

    try {
      Sentry.init({
        dsn,
        enabled: true,
        environment: this.config.errorTrackingEnvironment,
        release: this.config.errorTrackingRelease,
        sendDefaultPii: false,
        sendClientReports: false,
        includeServerName: false,
        defaultIntegrations: [],
        maxBreadcrumbs: 0,
        tracesSampleRate: 0,
        profilesSampleRate: 0,
        shutdownTimeout: 2000,
        beforeSend: sanitizeSentryEvent,
      });
      this.enabled = true;
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: "observability.external_delivery.initialization_failed",
          reason: sanitizeText(error),
        }),
      );
    }
  }
}

export function sanitizeSentryEvent(event: ErrorEvent): ErrorEvent {
  const safe = { ...event } as ErrorEvent & Record<string, unknown>;

  delete safe.request;
  delete safe.user;
  delete safe.breadcrumbs;
  delete safe.extra;
  delete safe.contexts;

  if (typeof safe.message === "string") {
    safe.message = sanitizeText(safe.message);
  }

  const exception = safe.exception as
    | { values?: Array<Record<string, unknown>> }
    | undefined;
  if (exception?.values) {
    safe.exception = {
      values: exception.values.map<Exception>((value) => ({
        type: sanitizeText(value.type),
        value: sanitizeText(value.value),
        stacktrace: sanitizeStacktrace(value.stacktrace),
      })),
    };
  }

  if (safe.tags && typeof safe.tags === "object") {
    safe.tags = Object.fromEntries(
      Object.entries(safe.tags as Record<string, unknown>).map(([key, value]) => [
        key,
        safeTag(value),
      ]),
    );
  }

  return safe;
}

function createSafeError(error: unknown): Error {
  const originalMessage = error instanceof Error ? error.message : String(error);
  const safeError = new Error(sanitizeText(originalMessage));

  if (error instanceof Error) {
    safeError.name = sanitizeText(error.name);
    if (error.stack) {
      safeError.stack = sanitizeText(error.stack);
    }
  }

  return safeError;
}

function sanitizeStacktrace(value: unknown): Stacktrace | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const frames = (value as { frames?: unknown }).frames;
  if (!Array.isArray(frames)) {
    return undefined;
  }

  return {
    frames: frames.map<StackFrame>((frame) => {
      if (!frame || typeof frame !== "object") {
        return {};
      }

      const source = frame as Record<string, unknown>;
      return {
        filename: sanitizeText(source.filename),
        function: sanitizeText(source.function),
        module: sanitizeText(source.module),
        lineno: typeof source.lineno === "number" ? source.lineno : undefined,
        colno: typeof source.colno === "number" ? source.colno : undefined,
      };
    }),
  };
}

function sanitizeText(value: unknown): string {
  const text = typeof value === "string" ? value : String(value ?? "unknown");
  const redacted = redactSensitiveLogValue(text) as string;

  return redacted
    .replace(
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
      "[redacted-email]",
    )
    .replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, "[redacted-phone]")
    .slice(0, MAX_TEXT_LENGTH);
}

function safeTag(value: unknown): string {
  return sanitizeText(value).slice(0, MAX_TAG_LENGTH);
}
