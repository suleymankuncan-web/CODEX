import { createRateLimitMiddleware } from "./rate-limit.middleware";

class FakeResponse {
  readonly headers: Record<string, string> = {};
  readonly json = jest.fn();
  readonly status = jest.fn().mockReturnValue({ json: this.json });

  setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }
}

function createRequest(overrides: Record<string, unknown> = {}) {
  return {
    headers: {},
    ip: "198.51.100.10",
    method: "GET",
    originalUrl: "/api/security-test/ok",
    ...overrides,
  } as never;
}

describe("createRateLimitMiddleware", () => {
  it("awaits the configured store and preserves rate limit headers", async () => {
    const middleware = createRateLimitMiddleware({
      max: 5,
      store: {
        increment: jest.fn().mockResolvedValue({
          count: 3,
          resetAt: new Date("2026-05-18T00:00:00.000Z").getTime(),
        }),
      },
      windowMs: 60000,
    });
    const response = new FakeResponse();
    const next = jest.fn();

    await middleware(createRequest(), response as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.headers).toMatchObject({
      "X-RateLimit-Limit": "5",
      "X-RateLimit-Remaining": "2",
      "X-RateLimit-Reset": "2026-05-18T00:00:00.000Z",
    });
  });

  it("fails closed when the configured store is unavailable", async () => {
    const middleware = createRateLimitMiddleware({
      max: 5,
      store: {
        increment: jest.fn().mockRejectedValue(new Error("redis unavailable")),
      },
      windowMs: 60000,
    });
    const response = new FakeResponse();
    const next = jest.fn();

    await middleware(
      createRequest({
        headers: {
          "x-correlation-id": "corr-rate-store",
        },
      }),
      response as never,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: "corr-rate-store",
        errorCode: "RATE_LIMIT_STORE_UNAVAILABLE",
        message: "Rate limit store unavailable",
        path: "/api/security-test/ok",
        statusCode: 503,
      }),
    );
    expect(JSON.stringify(response.json.mock.calls[0][0])).not.toContain("redis unavailable");
  });

  it("does not count CORS preflight requests", async () => {
    const store = {
      increment: jest.fn(),
    };
    const middleware = createRateLimitMiddleware({
      max: 5,
      store,
      windowMs: 60000,
    });
    const response = new FakeResponse();
    const next = jest.fn();

    await middleware(createRequest({ method: "OPTIONS" }), response as never, next);

    expect(store.increment).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
