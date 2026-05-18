export type RateLimitState = {
  count: number;
  resetAt: number;
};

export interface RateLimitStore {
  increment(key: string, now: number, windowMs: number): Promise<RateLimitState>;
}

export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, RateLimitState>();

  async increment(
    key: string,
    now: number,
    windowMs: number,
  ): Promise<RateLimitState> {
    const existing = this.buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      const state = { count: 1, resetAt: now + windowMs };
      this.buckets.set(key, state);
      return state;
    }

    existing.count += 1;
    return existing;
  }
}
