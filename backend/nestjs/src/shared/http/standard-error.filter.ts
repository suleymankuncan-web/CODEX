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
} from "./standard-error-response";

type HttpResponseLike = {
  status(statusCode: number): { json(body: unknown): void };
};

type HttpExceptionBody = {
  error?: string;
  message?: string | string[];
  statusCode?: number;
};

@Catch()
export class StandardErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<ErrorRequestLike>();
    const response = http.getResponse<HttpResponseLike>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionBody = this.resolveExceptionBody(exception);

    response.status(statusCode).json(
      buildStandardErrorResponse({
        errorCode: this.resolveErrorCode(statusCode, exceptionBody),
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
}
