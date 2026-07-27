import { CallHandler, ExecutionContext, ServiceUnavailableException } from "@nestjs/common";
import { Subject } from "rxjs";
import { PhotoMediaUploadBufferGuardInterceptor } from "./photo-media-upload-buffer-guard.interceptor";

describe("PhotoMediaUploadBufferGuardInterceptor", () => {
  it("bounds concurrent multipart buffers and releases capacity on completion", () => {
    const interceptor = new PhotoMediaUploadBufferGuardInterceptor(1);
    const first = new Subject<unknown>();
    const nextBuffer = new Subject<unknown>();
    const firstHandler = { handle: jest.fn(() => first.asObservable()) } as CallHandler;
    const secondHandler = { handle: jest.fn(() => nextBuffer.asObservable()) } as CallHandler;

    interceptor.intercept({} as ExecutionContext, firstHandler).subscribe();
    expect(() => interceptor.intercept({} as ExecutionContext, secondHandler))
      .toThrow(ServiceUnavailableException);
    first.complete();
    interceptor.intercept({} as ExecutionContext, secondHandler).subscribe();
    nextBuffer.complete();
  });
});
