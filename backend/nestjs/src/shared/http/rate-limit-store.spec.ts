import { InMemoryRateLimitStore } from "./rate-limit-store";

describe("InMemoryRateLimitStore", () => {
  it("increments within the same window and preserves reset time", async () => {
    const store = new InMemoryRateLimitStore();

    await expect(store.increment("client-1", 1000, 60000)).resolves.toEqual({
      count: 1,
      resetAt: 61000,
    });
    await expect(store.increment("client-1", 2000, 60000)).resolves.toEqual({
      count: 2,
      resetAt: 61000,
    });
  });

  it("starts a new bucket after the window expires", async () => {
    const store = new InMemoryRateLimitStore();

    await store.increment("client-1", 1000, 60000);

    await expect(store.increment("client-1", 61000, 60000)).resolves.toEqual({
      count: 1,
      resetAt: 121000,
    });
  });
});
