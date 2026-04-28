import { HttpStatus } from "@nestjs/common";
import {
  buildStandardErrorResponse,
  ErrorRequestLike,
} from "./standard-error-response";

type RateLimitRequest = ErrorRequestLike & {
  method: string;
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
};

type RateLimitResponse = {
  setHeader(name: string, value: string): void;
  status(statusCode: number): {
    json(body: unknown): void;
  };
};

type RateLimitState = {
  count: number;
  resetAt: number;
};

export interface RateLimitStore {
  increment(key: string, now: number, windowMs: number): RateLimitState;
}

export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, RateLimitState>();

  increment(key: string, now: number, windowMs: number): RateLimitState {
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

export function createRateLimitMiddleware(input: {
  max: number;
  windowMs: number;
  store?: RateLimitStore;
}) {
  const store = input.store ?? new InMemoryRateLimitStore();

  return (req: RateLimitRequest, res: RateLimitResponse, next: () => void): void => {
    if (req.method === "OPTIONS") {
      next();
      return;
    }

    const now = Date.now();
    const state = store.increment(resolveClientKey(req), now, input.windowMs);
    const remaining = Math.max(input.max - state.count, 0);

    res.setHeader("X-RateLimit-Limit", String(input.max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", new Date(state.resetAt).toISOString());

    if (state.count > input.max) {
      res.status(HttpStatus.TOO_MANY_REQUESTS).json(
        buildStandardErrorResponse({
          errorCode: "RATE_LIMIT_EXCEEDED",
          message: "Rate limit exceeded",
          request: req,
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
        }),
      );
      return;
    }

    next();
  };
}

function resolveClientKey(req: RateLimitRequest): string {
  const forwardedFor = resolveHeader(req.headers["x-forwarded-for"]);
  return forwardedFor?.split(",")[0]?.trim() || req.ip || req.socket?.remoteAddress || "unknown";
}

function resolveHeader(value: string | string[] | undefined): string | undefined {
  return (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
}
