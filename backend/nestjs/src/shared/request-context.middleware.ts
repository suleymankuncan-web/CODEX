import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { RequestContextStore } from "./request-context";

const CORRELATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function resolveCorrelationId(headerValue: string | string[] | undefined): string {
  const candidate = (Array.isArray(headerValue) ? headerValue[0] : headerValue)?.trim();

  if (!candidate || !CORRELATION_ID_PATTERN.test(candidate)) {
    return randomUUID();
  }

  return candidate;
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger("HttpRequest");

  use(
    req: {
      method: string;
      originalUrl?: string;
      url?: string;
      headers: Record<string, string | string[] | undefined>;
      user?: { userId?: string };
      correlationId?: string;
    },
    res: {
      setHeader(name: string, value: string): void;
      statusCode: number;
      on(event: "finish", listener: () => void): void;
    },
    next: () => void,
  ) {
    const correlationId = resolveCorrelationId(req.headers["x-correlation-id"]);
    const requestContext = { correlationId, actorUserId: req.user?.userId ?? null };

    RequestContextStore.run(requestContext, () => {
      req.correlationId = correlationId;
      res.setHeader("x-correlation-id", correlationId);

      const startedAt = Date.now();
      res.on("finish", () => {
        this.logger.log(
          JSON.stringify({
            event: "http.request.completed",
            correlationId,
            method: req.method,
            path: req.originalUrl ?? req.url ?? "",
            statusCode: res.statusCode,
            durationMs: Date.now() - startedAt,
            actorUserId: requestContext.actorUserId ?? req.user?.userId ?? null,
          }),
        );
      });

      next();
    });
  }
}
