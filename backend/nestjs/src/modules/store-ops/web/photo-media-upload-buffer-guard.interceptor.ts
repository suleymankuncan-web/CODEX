import { CallHandler, ExecutionContext, NestInterceptor, ServiceUnavailableException } from "@nestjs/common";
import { Observable, finalize } from "rxjs";

export class PhotoMediaUploadBufferGuardInterceptor implements NestInterceptor {
  private static activeBuffers = 0;

  constructor(private readonly limitOverride?: number) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const limit = this.limitOverride ?? this.configuredLimit();
    if (PhotoMediaUploadBufferGuardInterceptor.activeBuffers >= limit) {
      throw new ServiceUnavailableException("Photo media concurrent upload buffer limit reached");
    }
    PhotoMediaUploadBufferGuardInterceptor.activeBuffers += 1;
    return next.handle().pipe(finalize(() => {
      PhotoMediaUploadBufferGuardInterceptor.activeBuffers = Math.max(
        0, PhotoMediaUploadBufferGuardInterceptor.activeBuffers - 1,
      );
    }));
  }

  private configuredLimit(): number {
    const parsed = Number(process.env.PHOTO_MEDIA_CONCURRENT_PROCESSING_HARD_LIMIT ?? "2");
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
  }
}
