import { createSecurityHeadersMiddleware } from "./security-headers.middleware";

describe("createSecurityHeadersMiddleware", () => {
  it("sets browser security headers before continuing", () => {
    const headers: Record<string, string> = {};
    const next = jest.fn();
    const middleware = createSecurityHeadersMiddleware();

    middleware(
      {},
      {
        setHeader(name: string, value: string) {
          headers[name] = value;
        },
      },
      next,
    );

    expect(headers).toMatchObject({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    });
    expect(next).toHaveBeenCalledTimes(1);
  });
});
