import IORedis from "ioredis";
import { RateLimitState, RateLimitStore } from "./rate-limit-store";

type RedisRateLimitClient = {
  eval(
    script: string,
    numberOfKeys: number,
    key: string,
    windowMs: string,
  ): Promise<unknown>;
  disconnect?(reconnect?: boolean): void;
  quit?(): Promise<unknown>;
};

const INCREMENT_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
if ttl < 0 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { current, ttl }
`;

export class RedisRateLimitStore implements RateLimitStore {
  constructor(
    private readonly client: RedisRateLimitClient,
    private readonly prefix: string,
  ) {}

  async increment(
    key: string,
    now: number,
    windowMs: number,
  ): Promise<RateLimitState> {
    const result = await this.client.eval(
      INCREMENT_SCRIPT,
      1,
      this.buildKey(key),
      String(windowMs),
    );
    const [count, ttlMs] = this.parseEvalResult(result);

    return {
      count,
      resetAt: now + ttlMs,
    };
  }

  async close(): Promise<void> {
    if (!this.client.quit) {
      return;
    }
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect?.(false);
    }
  }

  private buildKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  private parseEvalResult(result: unknown): [number, number] {
    if (!Array.isArray(result) || result.length !== 2) {
      throw new Error("Redis rate limit response was invalid");
    }

    const count = Number(result[0]);
    const ttlMs = Number(result[1]);

    if (!Number.isFinite(count) || count < 1 || !Number.isFinite(ttlMs) || ttlMs < 0) {
      throw new Error("Redis rate limit response was invalid");
    }

    return [count, ttlMs];
  }
}

export function createRedisRateLimitStore(input: {
  prefix: string;
  redisUrl: string;
}): RedisRateLimitStore {
  return new RedisRateLimitStore(
    new IORedis(input.redisUrl, {
      enableReadyCheck: false,
      maxRetriesPerRequest: 1,
    }),
    input.prefix,
  );
}
