import { Injectable, Logger } from "@nestjs/common";
import type { LogLevel } from "@nestjs/common";
import { AppConfigService } from "../app-config.service";
import { RequestContextStore } from "../request-context";
import { redactSensitiveLogValue } from "../structured-log";

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
};

type ObservabilityStatus = {
  status: "ok" | "degraded";
  errorTracking: {
    dsnConfigured: boolean;
    environment: string;
    externalDelivery: "not-enabled";
    mode: "log-only";
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

  constructor(private readonly config: AppConfigService) {}

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
          errorName: errorShape.name,
          errorMessage: errorShape.message,
          errorTracking: {
            dsnConfigured: Boolean(this.config.errorTrackingDsn),
            externalDelivery: "not-enabled",
            mode: "log-only",
          },
          environment: this.resolveEnvironment(),
          release: this.config.errorTrackingRelease,
        }),
      ),
    );
  }

  getStatus(): ObservabilityStatus {
    const dsnConfigured = Boolean(this.config.errorTrackingDsn);
    const readinessProfile = this.config.readinessProfile ?? "controlled-pilot";
    const broadProductionMissingDsn =
      this.config.isProduction &&
      readinessProfile === "broad-production" &&
      !dsnConfigured;

    return {
      status: broadProductionMissingDsn ? "degraded" : "ok",
      errorTracking: {
        dsnConfigured,
        environment: this.resolveEnvironment(),
        externalDelivery: "not-enabled",
        mode: "log-only",
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
      process.exit(1);
    });
  }

  logStartupState(runtime: "api" | "worker"): void {
    const status = this.getStatus();

    this.logger.log(
      JSON.stringify({
        event: "observability.startup",
        runtime,
        ...status,
      }),
    );

    if (status.status === "degraded") {
      this.logger.error(
        JSON.stringify({
          event: "observability.error_tracking.missing",
          runtime,
          environment: status.errorTracking.environment,
          readinessProfile: status.readinessProfile,
          reason:
            "ERROR_TRACKING_DSN is not configured while broad production readiness was requested",
        }),
      );
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
