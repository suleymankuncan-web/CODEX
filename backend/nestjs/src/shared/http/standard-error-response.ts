import { HttpStatus } from "@nestjs/common";
import { sanitizeRequestPath } from "./sanitize-request-path";

export type StandardErrorResponse = {
  correlationId: string;
  statusCode: number;
  errorCode: string;
  message: string | string[];
  path: string;
  timestamp: string;
};

export type ErrorRequestLike = {
  correlationId?: string;
  headers?: Record<string, string | string[] | undefined>;
  originalUrl?: string;
  url?: string;
};

const HTTP_ERROR_CODES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: "BAD_REQUEST",
  [HttpStatus.UNAUTHORIZED]: "UNAUTHORIZED",
  [HttpStatus.FORBIDDEN]: "FORBIDDEN",
  [HttpStatus.NOT_FOUND]: "NOT_FOUND",
  [HttpStatus.CONFLICT]: "CONFLICT",
  [HttpStatus.UNPROCESSABLE_ENTITY]: "UNPROCESSABLE_ENTITY",
  [HttpStatus.TOO_MANY_REQUESTS]: "RATE_LIMIT_EXCEEDED",
  [HttpStatus.INTERNAL_SERVER_ERROR]: "INTERNAL_SERVER_ERROR",
  [HttpStatus.SERVICE_UNAVAILABLE]: "SERVICE_UNAVAILABLE",
};
const CORRELATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function resolveRequestPath(request: ErrorRequestLike): string {
  return sanitizeRequestPath(request.originalUrl ?? request.url ?? "");
}

export function resolveRequestCorrelationId(request: ErrorRequestLike): string {
  const headerValue = request.headers?.["x-correlation-id"];
  const headerCorrelationId = Array.isArray(headerValue) ? headerValue[0] : headerValue;

  const requestCandidate = request.correlationId?.trim();
  if (requestCandidate && CORRELATION_ID_PATTERN.test(requestCandidate)) {
    return requestCandidate;
  }

  const candidate = headerCorrelationId?.trim();
  return candidate && CORRELATION_ID_PATTERN.test(candidate) ? candidate : "unknown";
}

export function buildStandardErrorResponse(input: {
  request: ErrorRequestLike;
  statusCode: number;
  errorCode: string;
  message: string | string[];
}): StandardErrorResponse {
  return {
    correlationId: resolveRequestCorrelationId(input.request),
    errorCode: input.errorCode,
    message: input.message,
    path: resolveRequestPath(input.request),
    statusCode: input.statusCode,
    timestamp: new Date().toISOString(),
  };
}

export function defaultErrorCode(statusCode: number): string {
  return HTTP_ERROR_CODES[statusCode] ?? `HTTP_${statusCode}`;
}
