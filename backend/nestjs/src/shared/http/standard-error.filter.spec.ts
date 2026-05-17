import {
  ArgumentsHost,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { StandardErrorFilter } from "./standard-error.filter";

function createHost(input: {
  correlationId?: string;
  originalUrl?: string;
  url?: string;
}) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const request = {
    headers: input.correlationId
      ? { "x-correlation-id": input.correlationId }
      : {},
    originalUrl: input.originalUrl,
    url: input.url,
  };
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost;

  return { host, json, status };
}

describe("StandardErrorFilter", () => {
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
});
