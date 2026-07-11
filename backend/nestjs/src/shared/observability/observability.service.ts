import { Injectable, Logger, Optional } from "@nestjs/common";
import type { LogLevel } from "@nestjs/common";
import { AppConfigService } from "../app-config.service";
import { RequestContextStore } from "../request-context";
import { redactSensitiveLogValue } from "../structured-log";
import {
  SentryErrorDelivery,
  type SentryRuntime,
} from "./sentry-error-delivery";

type ObservabilitySeverity = "error" | "fatal" | "warning";

type CaptureExceptionInput = {
  actorUserId?: string | null;
  correlationId?: string | null;
  errorCode?: string;
  event?: string;
  method?: string;
  path?: string;
  severity?: ObservabilitySeverity;
  source: string;
  statusCode?: number;
  metadata?: Record<string, string | number | null>;
};

type ObservabilityStatus = {
  status: "ok" | "degraded";
  errorTracking: {
    dsnConfigured: boolean;
    enabled: boolean;
    environment: string;
    externalDelivery: "not-enabled" | "enabled";
    mode: "log-only" | "log+external";
    release?: string;
  };
  logLevel: string;
  readinessProfile: string;
};

const NEST_LOG_LEVELS: Record<string, LogLevel[]> = {
  error: ["fatal", "error"],
  warn: ["fatal", "error", "warn"],
  info: ["fatal", "error", "warn", "log"],
  debug: ["fatal", "error", "warn", "log", "debug"],
  verbose: ["fatal", "error", "warn", "log", "debug", "verbose"],
};

export function resolveNestLogLevels(value: string | undefined): LogLevel[] {
  return NEST_LOG_LEVELS[value ?? "info"] ?? NEST_LOG_LEVELS.info;
}

@Injectable()
export class ObservabilityService {
  private static processHandlersInstalled = false;
  private readonly logger = new Logger("Observability");
  private runtime: SentryRuntime = "unknown";

  constructor(
    private readonly config: AppConfigService,
    @Optional() private readonly sentryDelivery?: SentryErrorDelivery,
  ) {}

  captureException(error: unknown, input: CaptureExceptionInput): void {
    const context = RequestContextStore.get();
    const event = input.event ?? "observability.exception.captured";
    const errorShape = this.serializeError(error);

    this.logger.error(
      JSON.stringify(
        redactSensitiveLogValue({
          event,
          source: input.source,
          severity: input.severity ?? "error",
          correlationId:
            input.correlationId ?? context?.correlationId ?? "unknown",
          actorUserId: input.actorUserId ?? context?.actorUserId ?? null,
          method: input.method,
          path: input.path,
          statusCode: input.statusCode,
          errorCode: input.errorCode,
          metadata: input.metadata,
          errorName: errorShape.name,
          errorMessage: errorShape.message,
          errorTracking: {
            dsnConfigured: Boolean(this.config.errorTrackingDsn),
            enabled: this.sentryDelivery?.isEnabled() ?? false,
            externalDelivery: this.sentryDelivery?.isEnabled()
              ? "enabled"
              : "not-enabled",
            mode: this.sentryDelivery?.isEnabled()
              ? "log+external"
              : "log-only",
          },
          environment: this.resolveEnvironment(),
          release: this.config.errorTrackingRelease,
        }),
      ),
    );

    this.sentryDelivery?.captureException(error, {
      event,
      source: input.source,
      severity: input.severity ?? "error",
      runtime: this.runtime,
      correlationId: input.correlationId ?? context?.correlationId ?? null,
      errorCode: input.errorCode,
      method: input.method,
      normalizedPath: normalizeSafePath(input.path),
      statusCode: input.statusCode,
      metadata: input.metadata,
    });
  }

  getStatus(): ObservabilityStatus {
    const dsnConfigured = Boolean(this.config.errorTrackingDsn);
    const enabled = this.sentryDelivery?.isEnabled() ?? false;
    const readinessProfile = this.config.readinessProfile ?? "controlled-pilot";
    const broadProductionMissingExternalDelivery =
      this.config.isProduction &&
      readinessProfile === "broad-production" &&
      !enabled;

    return {
      status: broadProductionMissingExternalDelivery ? "degraded" : "ok",
      errorTracking: {
        dsnConfigured,
        enabled,
        environment: this.resolveEnvironment(),
        externalDelivery: enabled ? "enabled" : "not-enabled",
        mode: enabled ? "log+external" : "log-only",
        release: this.config.errorTrackingRelease,
      },
      logLevel: this.config.logLevel ?? "info",
      readinessProfile,
    };
  }

  installProcessHandlers(): void {
    if (ObservabilityService.processHandlersInstalled) {
      return;
    }

    ObservabilityService.processHandlersInstalled = true;

    process.on("unhandledRejection", (reason) => {
      this.captureException(reason, {
        event: "process.unhandled_rejection",
        severity: "error",
        source: "process.unhandledRejection",
      });
    });

    process.on("uncaughtException", (error) => {
      this.captureException(error, {
        event: "process.uncaught_exception",
        severity: "fatal",
        source: "process.uncaughtException",
      });
      void this.flushBeforeExit();
    });
  }

  logStartupState(runtime: "api" | "worker"): void {
    this.runtime = runtime;
    const status = this.getStatus();

    this.logger.log(
      JSON.stringify({
        event: "observability.startup",
        runtime,
        ...status,
      }),
    );

    if (this.config.errorTrackingSmokeEnabled && this.sentryDelivery?.isEnabled()) {
      this.sentryDelivery.captureException(new Error("DG4 staging Sentry smoke"), {
        event: "observability.staging_smoke",
        source: "observability.startup",
        severity: "error",
        runtime: this.runtime,
        metadata: { smoke: "staging" },
      });
    }

    if (status.status === "degraded") {
      this.logger.error(
        JSON.stringify({
          event: "observability.error_tracking.missing",
          runtime,
          environment: status.errorTracking.environment,
          readinessProfile: status.readinessProfile,
          reason:
            "External error delivery is not enabled while broad production readiness was requested",
        }),
      );
    }
  }

  private async flushBeforeExit(): Promise<void> {
    try {
      await this.sentryDelivery?.flush(2000);
    } finally {
      process.exit(1);
    }
  }

  private serializeError(error: unknown): { message: string; name: string } {
    if (error instanceof Error) {
      return {
        message: error.message,
        name: error.name,
      };
    }

    return {
      message: String(error),
      name: typeof error,
    };
  }

  private resolveEnvironment(): string {
    return (
      this.config.errorTrackingEnvironment ??
      (this.config.isProduction ? "production" : "development")
    );
  }
}

export function normalizeSafePath(path: string | undefined): string | undefined {
  if (!path) {
    return undefined;
  }

  const pathname = path.split(/[?#]/, 1)[0] || "/";

  return pathname
    .split("/")
    .map((segment) => {
      if (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          segment,
        ) ||
        /^\d+$/.test(segment)
      ) {
        return ":id";
      }

      return segment;
    })
    .join("/");
}
