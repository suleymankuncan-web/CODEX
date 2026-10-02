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
  it("announces bounded cooldown without admitting a rate-limited request", async () => {
    const now = Date.now();
    jest.spyOn(Date, "now").mockReturnValue(now);
    try {
      const increment = jest.fn().mockResolvedValue({ count: 6, resetAt: now + 5501 });
      const middleware = createRateLimitMiddleware({ max: 5, windowMs: 60_000, store: { increment } });
      const response = new FakeResponse(); const next = jest.fn();
      await middleware(createRequest(), response as never, next);
      expect(response.headers["Retry-After"]).toBe("6");
      expect(response.headers["X-RateLimit-Remaining"]).toBe("0");
      expect(response.status).toHaveBeenCalledWith(429);
      expect(next).not.toHaveBeenCalled();
      expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ errorCode: "RATE_LIMIT_EXCEEDED" }));
    } finally { jest.restoreAllMocks(); }
  });

  it("recovers on the next fixed window and isolates client IPs without trusting a spoofed header", async () => {
    const now = Date.now(); const clock = jest.spyOn(Date, "now").mockReturnValue(now);
    try {
      const middleware = createRateLimitMiddleware({ max: 1, windowMs: 1000 });
      const next = jest.fn();
      await middleware(createRequest(), new FakeResponse() as never, next);
      const rejected = new FakeResponse();
      await middleware(createRequest({ headers: { "x-forwarded-for": "203.0.113.8" } }), rejected as never, next);
      expect(rejected.status).toHaveBeenCalledWith(429); expect(next).toHaveBeenCalledTimes(1);
      await middleware(createRequest({ ip: "198.51.100.11" }), new FakeResponse() as never, next);
      expect(next).toHaveBeenCalledTimes(2);
      clock.mockReturnValue(now + 1001);
      await middleware(createRequest(), new FakeResponse() as never, next);
      expect(next).toHaveBeenCalledTimes(3);
    } finally { jest.restoreAllMocks(); }
  });

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
