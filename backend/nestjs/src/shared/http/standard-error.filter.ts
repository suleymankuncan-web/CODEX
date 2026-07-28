import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import {
  buildStandardErrorResponse,
  defaultErrorCode,
  ErrorRequestLike,
  resolveRequestCorrelationId,
  resolveRequestPath,
} from "./standard-error-response";
import { ObservabilityService } from "../observability/observability.service";

type HttpResponseLike = {
  setHeader?(name: string, value: string): void;
  status(statusCode: number): { json(body: unknown): void };
};

type HttpExceptionBody = {
  code?: string;
  error?: string;
  message?: string | string[];
  retryAfterSeconds?: number | string;
  statusCode?: number;
};

const TARGET_REVISION_ERROR_CODES = new Set([
  "target_revision_period_closed",
  "target_revision_stale_base",
  "target_revision_incomplete",
  "target_revision_chain_conflict",
  "target_revision_active_conflict",
  "target_revision_import_replacement_forbidden",
]);

const PHOTO_MEDIA_RETENTION_ERROR_CODES = new Set([
  "cleanup_disabled",
  "manifest_not_found",
  "manifest_digest_mismatch",
  "manifest_expired",
  "manifest_not_executable",
  "manifest_stale",
  "asset_held",
  "manifest_reason_invalid",
  "provider_delete_failed",
]);

@Catch()
export class StandardErrorFilter implements ExceptionFilter {
  constructor(private readonly observabilityService?: ObservabilityService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<ErrorRequestLike>();
    const response = http.getResponse<HttpResponseLike>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionBody = this.resolveExceptionBody(exception);
    const errorCode = this.resolveErrorCode(statusCode, exceptionBody);

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.observabilityService?.captureException(exception, {
        correlationId: resolveRequestCorrelationId(request),
        errorCode,
        event: "http.exception",
        path: resolveRequestPath(request),
        source: "standard-error-filter",
        statusCode,
      });
    }

    const retryAfter = this.resolveRetryAfter(exceptionBody);
    if (retryAfter) {
      response.setHeader?.("Retry-After", retryAfter);
    }

    response.status(statusCode).json(
      buildStandardErrorResponse({
        errorCode,
        message: this.resolveMessage(statusCode, exceptionBody),
        request,
        statusCode,
      }),
    );
  }

  private resolveExceptionBody(exception: unknown): HttpExceptionBody | null {
    if (!(exception instanceof HttpException)) {
      return null;
    }

    const response = exception.getResponse();

    if (typeof response === "string") {
      return { message: response };
    }

    if (response && typeof response === "object") {
      return response as HttpExceptionBody;
    }

    return null;
  }

  private resolveErrorCode(
    statusCode: number,
    exceptionBody: HttpExceptionBody | null,
  ): string {
    if (statusCode === HttpStatus.BAD_REQUEST && Array.isArray(exceptionBody?.message)) {
      return "VALIDATION_ERROR";
    }

    if (
      exceptionBody?.code &&
      PHOTO_MEDIA_RETENTION_ERROR_CODES.has(exceptionBody.code)
    ) {
      return exceptionBody.code;
    }

    if (
      (statusCode === HttpStatus.BAD_REQUEST || statusCode === HttpStatus.CONFLICT) &&
      exceptionBody?.code &&
      TARGET_REVISION_ERROR_CODES.has(exceptionBody.code)
    ) {
      return exceptionBody.code;
    }

    return defaultErrorCode(statusCode);
  }

  private resolveMessage(
    statusCode: number,
    exceptionBody: HttpExceptionBody | null,
  ): string | string[] {
    if (statusCode === HttpStatus.INTERNAL_SERVER_ERROR) {
      return "Internal server error";
    }

    return exceptionBody?.message ?? exceptionBody?.error ?? defaultErrorCode(statusCode);
  }

  private resolveRetryAfter(exceptionBody: HttpExceptionBody | null): string | undefined {
    const value = exceptionBody?.retryAfterSeconds;
    if (typeof value === "number" && Number.isInteger(value) && value > 0) {
      return String(value);
    }

    if (typeof value === "string" && /^[1-9]\d*$/.test(value)) {
      return value;
    }

    return undefined;
  }
}
