const mockInit = jest.fn();
const mockCaptureException = jest.fn();
const mockFlush = jest.fn().mockResolvedValue(true);
const mockWithScope = jest.fn((callback: (scope: unknown) => void) => {
  callback({
    setLevel: jest.fn(),
    setTag: jest.fn(),
  });
});

jest.mock("@sentry/nestjs", () => ({
  init: mockInit,
  captureException: mockCaptureException,
  flush: mockFlush,
  withScope: mockWithScope,
}));

import { AppConfigService } from "../app-config.service";
import { Logger } from "@nestjs/common";
import {
  sanitizeSentryEvent,
  SentryErrorDelivery,
} from "./sentry-error-delivery";

function createConfig(values: Record<string, string | undefined>) {
  return new AppConfigService({
    get: (key: string) => values[key],
  } as never);
}

describe("SentryErrorDelivery", () => {
  beforeEach(() => {
    mockInit.mockClear();
    mockCaptureException.mockClear();
    mockFlush.mockClear();
    mockWithScope.mockClear();
    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("stays disabled when the explicit enable flag is absent", () => {
    const delivery = new SentryErrorDelivery(
      createConfig({ ERROR_TRACKING_DSN: "https://sentry.example/123" }),
    );

    expect(delivery.isEnabled()).toBe(false);
    expect(delivery.captureException(new Error("failed"), {
      event: "test",
      source: "unit",
      severity: "error",
      runtime: "api",
    })).toBe(false);
    expect(mockInit).not.toHaveBeenCalled();
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it("records a safe warning when enablement is requested without a DSN", () => {
    const delivery = new SentryErrorDelivery(
      createConfig({ ERROR_TRACKING_ENABLED: "true" }),
    );

    expect(delivery.isEnabled()).toBe(false);
    expect(Logger.prototype.warn).toHaveBeenCalledWith(
      expect.stringContaining("ERROR_TRACKING_ENABLED=true requires ERROR_TRACKING_DSN"),
    );
    expect(mockInit).not.toHaveBeenCalled();
  });

  it("initializes the zero-tracing, no-PII transport and captures safe errors", () => {
    const delivery = new SentryErrorDelivery(
      createConfig({
        ERROR_TRACKING_DSN: "https://sentry.example/123",
        ERROR_TRACKING_ENABLED: "true",
        ERROR_TRACKING_ENVIRONMENT: "staging",
        ERROR_TRACKING_RELEASE: "abc123",
      }),
    );

    expect(delivery.isEnabled()).toBe(true);
    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: "https://sentry.example/123",
        environment: "staging",
        release: "abc123",
        sendDefaultPii: false,
        defaultIntegrations: [],
        maxBreadcrumbs: 0,
        tracesSampleRate: 0,
        profilesSampleRate: 0,
      }),
    );

    expect(
      delivery.captureException(
        new Error(
          "failed for person@example.com postgres://user:secret@db.example.com token=abc",
        ),
        {
          event: "http.exception",
          source: "standard-error-filter",
          severity: "error",
          runtime: "api",
          correlationId: "corr-123",
          normalizedPath: "/api/admin/stores/:id",
          statusCode: 500,
        },
      ),
    ).toBe(true);

    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const captured = mockCaptureException.mock.calls[0][0] as Error;
    expect(captured.message).toContain("[redacted-email]");
    expect(captured.message).toContain("[redacted-url]");
    expect(captured.message).not.toContain("secret");
    expect(captured.message).not.toContain("person@example.com");
  });

  it("removes request, user, breadcrumb, extra, and stack-frame locals", () => {
    const sanitized = sanitizeSentryEvent({
      request: {
        headers: { authorization: "Bearer secret" },
        url: "https://example.test/api?token=secret",
      },
      user: { email: "person@example.com" },
      breadcrumbs: [{ message: "password=secret" }],
      extra: { token: "secret" },
      exception: {
        values: [
          {
            type: "Error",
            value: "password=secret",
            stacktrace: {
              frames: [
                {
                  filename: "app.js",
                  function: "run",
                  vars: { password: "secret" },
                },
              ],
            },
          },
        ],
      },
    } as never);

    const serialized = JSON.stringify(sanitized);
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("person@example.com");
    expect(sanitized.request).toBeUndefined();
    expect(sanitized.user).toBeUndefined();
    expect(sanitized.breadcrumbs).toBeUndefined();
    expect(sanitized.extra).toBeUndefined();
  });

  it("flushes with a bounded timeout for fatal shutdown", async () => {
    const delivery = new SentryErrorDelivery(
      createConfig({
        ERROR_TRACKING_DSN: "https://sentry.example/123",
        ERROR_TRACKING_ENABLED: "true",
      }),
    );

    await expect(delivery.flush(2000)).resolves.toBe(true);
    expect(mockFlush).toHaveBeenCalledWith(2000);
  });
});
