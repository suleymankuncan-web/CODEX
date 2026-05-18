const redisConnectMock = jest.fn();
const redisPingMock = jest.fn();
const redisQuitMock = jest.fn();
const redisConstructorMock = jest.fn(() => ({
  connect: redisConnectMock,
  ping: redisPingMock,
  quit: redisQuitMock,
  status: "ready",
}));

jest.mock("ioredis", () => ({
  __esModule: true,
  default: redisConstructorMock,
}));

import { HealthService } from "./health.service";

function createService(input: {
  databaseQuery?: jest.Mock;
  queueBackend?: "in-memory" | "bullmq";
  redisUrl?: string;
}) {
  return new HealthService(
    {
      appName: "store-ops-backend",
      queueBackend: input.queueBackend ?? "in-memory",
      redisUrl: input.redisUrl ?? "redis://localhost:6379",
    } as never,
    {
      query: input.databaseQuery ?? jest.fn().mockResolvedValue({ rows: [{ "?column?": 1 }] }),
    } as never,
    {
      getStatus: jest.fn().mockReturnValue({
        status: "ok",
      }),
    } as never,
  );
}

describe("HealthService", () => {
  beforeEach(() => {
    redisConnectMock.mockReset();
    redisPingMock.mockReset();
    redisQuitMock.mockReset();
    redisConstructorMock.mockClear();
  });

  it("reports process-local queue mode and skips Redis when using in-memory queue", async () => {
    const service = createService({
      queueBackend: "in-memory",
    });

    const result = await service.getHealth();

    expect(result.status).toBe("ok");
    expect(result.queueBackend).toBe("in-memory");
    expect(result.queue).toEqual({
      backend: "in-memory",
      durable: false,
      redisRequired: false,
      status: "process-local",
      message:
        "In-memory queue is process-local; acceptable for local or controlled pilot only.",
    });
    expect(result.checks.redis).toMatchObject({
      status: "skipped",
      message: "Redis health check skipped because queue backend is not bullmq",
    });
    expect(redisConstructorMock).not.toHaveBeenCalled();
  });

  it("reports durable queue mode when BullMQ Redis health is ok", async () => {
    redisConnectMock.mockResolvedValue(undefined);
    redisPingMock.mockResolvedValue("PONG");
    redisQuitMock.mockResolvedValue("OK");
    const service = createService({
      queueBackend: "bullmq",
      redisUrl: "redis://cache.example.internal:6379",
    });

    const result = await service.getHealth();

    expect(result.status).toBe("ok");
    expect(result.queueBackend).toBe("bullmq");
    expect(result.queue).toEqual({
      backend: "bullmq",
      durable: true,
      redisRequired: true,
      status: "durable",
      message: "BullMQ queue is using Redis-backed durable dispatch.",
    });
    expect(result.checks.redis.status).toBe("ok");
    expect(redisConstructorMock).toHaveBeenCalledWith("redis://cache.example.internal:6379", {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
    });
    expect(redisQuitMock).toHaveBeenCalledTimes(1);
  });

  it("reports sanitized Redis dependency failures for BullMQ queue mode", async () => {
    redisConnectMock.mockRejectedValue(
      new Error(
        "connect ECONNREFUSED redis://:secret-pass@redis.example.com:6379 password=secret-pass",
      ),
    );
    redisQuitMock.mockResolvedValue("OK");
    const service = createService({
      queueBackend: "bullmq",
      redisUrl: "redis://:secret-pass@redis.example.com:6379",
    });

    const result = await service.getHealth();

    expect(result.status).toBe("error");
    expect(result.queue).toMatchObject({
      backend: "bullmq",
      status: "error",
      message: "BullMQ queue requires Redis health to be ok.",
    });
    expect(result.checks.redis.status).toBe("error");
    expect(result.checks.redis.message).toContain("[redacted-url]");
    expect(JSON.stringify(result)).not.toContain("secret-pass");
    expect(JSON.stringify(result)).not.toContain("redis.example.com");
  });
});
