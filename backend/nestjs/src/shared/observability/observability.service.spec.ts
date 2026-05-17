import { Logger } from "@nestjs/common";
import { AppConfigService } from "../app-config.service";
import { RequestContextStore } from "../request-context";
import {
  ObservabilityService,
  resolveNestLogLevels,
} from "./observability.service";

function createConfig(values: Record<string, string | undefined>) {
  return new AppConfigService({
    get: (key: string) => values[key],
  } as never);
}

describe("ObservabilityService", () => {
  let errorSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    logSpy = jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("maps LOG_LEVEL values to Nest logger levels", () => {
    expect(resolveNestLogLevels(undefined)).toEqual([
      "fatal",
      "error",
      "warn",
      "log",
    ]);
    expect(resolveNestLogLevels("debug")).toEqual([
      "fatal",
      "error",
      "warn",
      "log",
      "debug",
    ]);
    expect(resolveNestLogLevels("verbose")).toContain("verbose");
  });

  it("captures exceptions with request context and redacts secret-like values", () => {
    const service = new ObservabilityService(
      createConfig({
        ERROR_TRACKING_DSN: "https://example.invalid/123",
        ERROR_TRACKING_ENVIRONMENT: "staging",
        ERROR_TRACKING_RELEASE: "abc123",
        NODE_ENV: "development",
      }),
    );

    RequestContextStore.run(
      { actorUserId: "user-123", correlationId: "corr-123" },
      () => {
        service.captureException(
          new Error(
            "failed postgres://user:secret@db.example.com:5432/app Authorization=Bearer abc",
          ),
          {
            path: "/api/health",
            source: "standard-error-filter",
            statusCode: 500,
          },
        );
      },
    );

    const payload = JSON.parse(errorSpy.mock.calls[0][0] as string) as Record<
      string,
      unknown
    >;

    expect(payload).toMatchObject({
      actorUserId: "user-123",
      correlationId: "corr-123",
      environment: "staging",
      event: "observability.exception.captured",
      path: "/api/health",
      release: "abc123",
      source: "standard-error-filter",
      statusCode: 500,
    });
    expect(JSON.stringify(payload)).toContain("[redacted-url]");
    expect(JSON.stringify(payload)).not.toContain("secret");
    expect(JSON.stringify(payload)).not.toContain("Bearer abc");
  });

  it("marks broad production without a DSN as degraded and logs a startup warning", () => {
    const service = new ObservabilityService(
      createConfig({
        LOG_LEVEL: "warn",
        NODE_ENV: "production",
        READINESS_PROFILE: "broad-production",
      }),
    );

    expect(service.getStatus()).toMatchObject({
      status: "degraded",
      errorTracking: {
        dsnConfigured: false,
        environment: "production",
        externalDelivery: "not-enabled",
        mode: "log-only",
      },
      logLevel: "warn",
      readinessProfile: "broad-production",
    });

    service.logStartupState("api");

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain(
      "ERROR_TRACKING_DSN is not configured",
    );
  });
});
