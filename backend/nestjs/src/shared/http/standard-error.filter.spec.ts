import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
} from "@nestjs/common";
import { StandardErrorFilter } from "./standard-error.filter";

function createHost(input: {
  correlationId?: string;
  originalUrl?: string;
  requestCorrelationId?: string;
  url?: string;
}) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const setHeader = jest.fn();
  const request = {
    headers: input.correlationId
      ? { "x-correlation-id": input.correlationId }
      : {},
    correlationId: input.requestCorrelationId,
    originalUrl: input.originalUrl,
    url: input.url,
  };
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({ setHeader, status }),
    }),
  } as unknown as ArgumentsHost;

  return { host, json, setHeader, status };
}

describe("StandardErrorFilter", () => {
  it("exposes only allowlisted target revision domain codes", () => {
    const { host, json } = createHost({ url: "/api/target-distributions/requests/1/approve" });
    const filter = new StandardErrorFilter();

    filter.catch(
      new ConflictException({
        code: "target_revision_stale_base",
        message: "Target revision base is stale",
      }),
      host,
    );

    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      errorCode: "target_revision_stale_base",
      statusCode: 409,
    }));
  });

  it("does not expose arbitrary exception codes", () => {
    const { host, json } = createHost({ url: "/api/target-distributions/requests/1/approve" });
    const filter = new StandardErrorFilter();

    filter.catch(
      new ConflictException({ code: "leak_me", message: "Conflict" }),
      host,
    );

    expect(json).toHaveBeenCalledWith(expect.objectContaining({ errorCode: "CONFLICT" }));
  });
  it("keeps 500 responses generic and captures observability context", () => {
    const observabilityService = {
      captureException: jest.fn(),
    };
    const filter = new StandardErrorFilter(observabilityService as never);
    const { host, json, status } = createHost({
      correlationId: "corr-500",
      originalUrl: "/api/admin/broken",
    });
    const exception = new InternalServerErrorException("database password=secret");

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: "corr-500",
        errorCode: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
        path: "/api/admin/broken",
        statusCode: 500,
      }),
    );
    expect(JSON.stringify(json.mock.calls[0][0])).not.toContain("secret");
    expect(observabilityService.captureException).toHaveBeenCalledWith(
      exception,
      expect.objectContaining({
        correlationId: "corr-500",
        errorCode: "INTERNAL_SERVER_ERROR",
        event: "http.exception",
        path: "/api/admin/broken",
        source: "standard-error-filter",
        statusCode: 500,
      }),
    );
  });

  it("does not send client validation errors to exception observability", () => {
    const observabilityService = {
      captureException: jest.fn(),
    };
    const filter = new StandardErrorFilter(observabilityService as never);
    const { host, json, status } = createHost({
      correlationId: "corr-400",
      url: "/api/imports",
    });

    filter.catch(new BadRequestException(["name must be a string"]), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: "corr-400",
        errorCode: "VALIDATION_ERROR",
        message: ["name must be a string"],
        path: "/api/imports",
        statusCode: 400,
      }),
    );
    expect(observabilityService.captureException).not.toHaveBeenCalled();
  });

  it("redacts query values from error responses and observability context", () => {
    const observabilityService = {
      captureException: jest.fn(),
    };
    const filter = new StandardErrorFilter(observabilityService as never);
    const { host, json } = createHost({
      correlationId: "corr-error-query-redaction",
      originalUrl:
        "/api/admin/broken/123e4567-e89b-12d3-a456-426614174000?storeId=00000000-0000-0000-0000-000000000100&token=secret-token&email=person@example.com",
    });
    const exception = new InternalServerErrorException("failed");

    filter.catch(exception, host);

    const responseBody = json.mock.calls[0][0];
    expect(responseBody).toEqual(
      expect.objectContaining({
        path: "/api/admin/broken/:id?storeId=:value&token=[redacted]&email=:value",
      }),
    );
    expect(JSON.stringify(responseBody)).not.toContain("secret-token");
    expect(JSON.stringify(responseBody)).not.toContain("person@example.com");
    expect(JSON.stringify(responseBody)).not.toContain(
      "00000000-0000-0000-0000-000000000100",
    );
    expect(observabilityService.captureException).toHaveBeenCalledWith(
      exception,
      expect.objectContaining({
        path: "/api/admin/broken/:id?storeId=:value&token=[redacted]&email=:value",
      }),
    );
  });

  it("does not echo unsafe fallback correlation id headers", () => {
    const filter = new StandardErrorFilter();
    const { host, json } = createHost({
      correlationId: "bad id\r\nx-extra: injected",
      requestCorrelationId: "bad request id\r\nx-extra: injected",
      originalUrl: "/api/admin/broken",
    });

    filter.catch(new BadRequestException("invalid request"), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: "unknown",
      }),
    );
  });

  it("forwards retry-after metadata from retryable capacity exceptions", () => {
    const filter = new StandardErrorFilter();
    const { host, json, setHeader, status } = createHost({
      correlationId: "corr-retry",
      url: "/api/integration/power-bi-export-upload",
    });

    filter.catch(
      new HttpException(
        {
          message: "Power BI export isleme kapasitesi dolu",
          retryAfterSeconds: 5,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      ),
      host,
    );

    expect(setHeader).toHaveBeenCalledWith("Retry-After", "5");
    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: "corr-retry",
        errorCode: "SERVICE_UNAVAILABLE",
        message: "Power BI export isleme kapasitesi dolu",
        path: "/api/integration/power-bi-export-upload",
        statusCode: 503,
      }),
    );
  });

  it("preserves allowlisted retention codes across non-400 HTTP statuses", () => {
    const filter = new StandardErrorFilter();
    const { host, json } = createHost({
      correlationId: "corr-retention",
      url: "/api/internal/photo-media/maintenance/retention/execute",
    });
    filter.catch(new HttpException({
      code: "provider_delete_failed",
      message: "Photo media provider deletion failed",
    }, HttpStatus.SERVICE_UNAVAILABLE), host);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      errorCode: "provider_delete_failed",
      statusCode: 503,
    }));
  });
});
