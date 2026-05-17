import { Logger } from "@nestjs/common";
import {
  logStructuredError,
  logStructuredMessage,
  redactSensitiveLogValue,
} from "./structured-log";

describe("structured-log", () => {
  let errorSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    logSpy = jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("redacts secret-like values from structured fields", () => {
    expect(
      redactSensitiveLogValue({
        authorization: "Bearer secret-token",
        databaseUrl: "postgres://user:secret@db.example.com:5432/app",
        nested: {
          refreshToken: "refresh-secret",
        },
      }),
    ).toEqual({
      authorization: "[redacted]",
      databaseUrl: "[redacted-url]",
      nested: {
        refreshToken: "[redacted]",
      },
    });
  });

  it("keeps structured message logs queryable without leaking secrets", () => {
    const logger = new Logger("TestLogger");

    logStructuredMessage(logger, "test.event", {
      authorization: "Bearer abc",
      databaseUrl: "redis://:secret@redis.example.com:6379",
      storeId: "store-1",
    });

    const payload = JSON.parse(logSpy.mock.calls[0][0] as string) as Record<
      string,
      unknown
    >;

    expect(payload).toMatchObject({
      authorization: "[redacted]",
      databaseUrl: "[redacted-url]",
      event: "test.event",
      storeId: "store-1",
    });
    expect(JSON.stringify(payload)).not.toContain("Bearer abc");
    expect(JSON.stringify(payload)).not.toContain("secret");
  });

  it("redacts exception messages in structured error logs", () => {
    const logger = new Logger("TestLogger");

    logStructuredError(
      logger,
      "test.error",
      new Error("failed with token=abc and postgres://u:p@db.example.com/app"),
    );

    const payload = JSON.parse(errorSpy.mock.calls[0][0] as string) as Record<
      string,
      unknown
    >;

    expect(payload.errorMessage).toBe(
      "failed with token=[redacted] and [redacted-url]",
    );
  });
});
