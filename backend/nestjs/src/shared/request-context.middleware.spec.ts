import { Logger } from "@nestjs/common";
import { EventEmitter } from "node:events";
import { RequestContextMiddleware } from "./request-context.middleware";
import { RequestContextStore } from "./request-context";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type MiddlewareRequest = Parameters<RequestContextMiddleware["use"]>[0];

class FakeResponse extends EventEmitter {
  readonly headers: Record<string, string> = {};
  statusCode = 200;

  setHeader(name: string, value: string): void {
    this.headers[name.toLowerCase()] = value;
  }
}

describe("RequestContextMiddleware", () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("replaces unsafe inbound correlation IDs before echoing them", () => {
    const middleware = new RequestContextMiddleware();
    const response = new FakeResponse();
    const request: MiddlewareRequest = {
      method: "GET",
      originalUrl: "/api/health",
      headers: {
        "x-correlation-id": "bad id\r\nx-extra: injected",
      },
    };

    middleware.use(request, response, jest.fn());

    expect(request.correlationId).toMatch(UUID_PATTERN);
    expect(response.headers["x-correlation-id"]).toBe(request.correlationId);
  });

  it("logs completed requests with the actor resolved later in the request", () => {
    const middleware = new RequestContextMiddleware();
    const response = new FakeResponse();
    response.statusCode = 201;
    const request: MiddlewareRequest = {
      method: "POST",
      originalUrl: "/api/admin/role-assignments",
      headers: {
        "x-correlation-id": "corr-role-update",
      },
    };

    middleware.use(request, response, () => {
      RequestContextStore.setActorUserId("user-123");
    });
    response.emit("finish");

    const payload = JSON.parse(logSpy.mock.calls.at(-1)?.[0] as string) as Record<string, unknown>;
    expect(payload).toMatchObject({
      event: "http.request.completed",
      correlationId: "corr-role-update",
      method: "POST",
      path: "/api/admin/role-assignments",
      statusCode: 201,
      actorUserId: "user-123",
    });
    expect(typeof payload.durationMs).toBe("number");
  });
});
