import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { RequestContextStore } from "./request-context";

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
    const requestCorrelationId = req.headers["x-correlation-id"];
    const correlationId =
      (Array.isArray(requestCorrelationId) ? requestCorrelationId[0] : requestCorrelationId) ??
      randomUUID();

    RequestContextStore.run({ correlationId, actorUserId: req.user?.userId ?? null }, () => {
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
            actorUserId: req.user?.userId ?? null,
          }),
        );
      });

      next();
    });
  }
}
