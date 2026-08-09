import { RedisRateLimitStore } from "./redis-rate-limit-store";

describe("RedisRateLimitStore", () => {
  it("increments through Redis using a prefixed atomic key", async () => {
    const client = {
      eval: jest.fn().mockResolvedValue(["3", "45000"]),
    };
    const store = new RedisRateLimitStore(client, "hr-axis:rate-limit");

    await expect(store.increment("198.51.100.7", 1000, 60000)).resolves.toEqual({
      count: 3,
      resetAt: 46000,
    });

    expect(client.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call(\"INCR\""),
      1,
      "hr-axis:rate-limit:198.51.100.7",
      "60000",
    );
  });

  it("fails loudly when Redis returns an unexpected response", async () => {
    const client = {
      eval: jest.fn().mockResolvedValue(["not-a-count"]),
    };
    const store = new RedisRateLimitStore(client, "hr-axis:rate-limit");

    await expect(store.increment("client-1", 1000, 60000)).rejects.toThrow(
      "Redis rate limit response was invalid",
    );
  });

  it("closes an owned Redis connection", async () => {
    const client = {
      eval: jest.fn(),
      quit: jest.fn().mockResolvedValue(undefined),
    };
    const store = new RedisRateLimitStore(client, "hr-axis:rate-limit");

    await store.close();

    expect(client.quit).toHaveBeenCalledTimes(1);
  });
});
