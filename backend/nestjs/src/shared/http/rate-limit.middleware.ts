import { HttpStatus } from "@nestjs/common";
import {
  buildStandardErrorResponse,
  ErrorRequestLike,
} from "./standard-error-response";
import { InMemoryRateLimitStore, RateLimitStore } from "./rate-limit-store";

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

export function createRateLimitMiddleware(input: {
  max: number;
  windowMs: number;
  store?: RateLimitStore;
}) {
  const store = input.store ?? new InMemoryRateLimitStore();

  return async (
    req: RateLimitRequest,
    res: RateLimitResponse,
    next: () => void,
  ): Promise<void> => {
    if (req.method === "OPTIONS") {
      next();
      return;
    }

    const now = Date.now();
    let state;

    try {
      state = await store.increment(resolveClientKey(req), now, input.windowMs);
    } catch {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json(
        buildStandardErrorResponse({
          errorCode: "RATE_LIMIT_STORE_UNAVAILABLE",
          message: "Rate limit store unavailable",
          request: req,
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        }),
      );
      return;
    }

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
  return req.ip || req.socket?.remoteAddress || "unknown";
}
