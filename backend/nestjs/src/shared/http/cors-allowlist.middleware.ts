import { HttpStatus } from "@nestjs/common";
import {
  buildStandardErrorResponse,
  ErrorRequestLike,
} from "./standard-error-response";

type CorsRequest = ErrorRequestLike & {
  method: string;
  headers: Record<string, string | string[] | undefined>;
};

type CorsResponse = {
  setHeader(name: string, value: string): void;
  status(statusCode: number): {
    end(): void;
    json(body: unknown): void;
  };
};

const DEFAULT_ALLOWED_HEADERS = "authorization,content-type,x-correlation-id";
const ALLOWED_METHODS = "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS";

export function createCorsAllowlistMiddleware(allowedOrigins: string[]) {
  const allowedOriginSet = new Set(allowedOrigins);

  return (req: CorsRequest, res: CorsResponse, next: () => void): void => {
    const origin = resolveHeader(req.headers.origin);

    if (!origin) {
      next();
      return;
    }

    res.setHeader("Vary", "Origin");

    if (!allowedOriginSet.has(origin)) {
      res.status(HttpStatus.FORBIDDEN).json(
        buildStandardErrorResponse({
          errorCode: "CORS_ORIGIN_DENIED",
          message: "CORS origin is not allowed",
          request: req,
          statusCode: HttpStatus.FORBIDDEN,
        }),
      );
      return;
    }

    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", ALLOWED_METHODS);
    res.setHeader(
      "Access-Control-Allow-Headers",
      resolveHeader(req.headers["access-control-request-headers"]) ??
        DEFAULT_ALLOWED_HEADERS,
    );

    if (req.method === "OPTIONS") {
      res.status(HttpStatus.NO_CONTENT).end();
      return;
    }

    next();
  };
}

function resolveHeader(value: string | string[] | undefined): string | undefined {
  return (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
}
