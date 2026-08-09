import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { BrowserSessionCsrfGuard } from "./browser-session-csrf.guard";

function createContext(request: {
  headers?: Record<string, string | string[] | undefined>;
  method?: string;
  originalUrl?: string;
}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: request.headers ?? {},
        method: request.method ?? "GET",
        originalUrl: request.originalUrl ?? "/api/reports/snapshot-runs",
      }),
    }),
  } as ExecutionContext;
}

describe("BrowserSessionCsrfGuard", () => {
  const config = {
    browserSessionCookieEnabled: true,
    browserSessionCookieName: "hr_axis_browser_session",
    corsAllowedOrigins: ["https://app.example.invalid"],
  };

  it("skips safe methods and bearer-authenticated unsafe requests", () => {
    const guard = new BrowserSessionCsrfGuard(config as never, {
      verifyCsrfToken: jest.fn(),
    } as never);

    expect(guard.canActivate(createContext({ method: "GET" }))).toBe(true);
    expect(
      guard.canActivate(
        createContext({
          headers: {
            authorization: "Bearer synthetic-token",
            cookie: "hr_axis_browser_session=signed",
          },
          method: "POST",
        }),
      ),
    ).toBe(true);
  });

  it("exempts only the exact nonce-recovery path with same-origin metadata", () => {
    const guard = new BrowserSessionCsrfGuard(config as never, {
      verifyCsrfToken: jest.fn(),
    } as never);

    expect(
      guard.canActivate(
        createContext({
          headers: {
            cookie: "hr_axis_browser_session=signed",
            origin: "https://app.example.invalid",
            "sec-fetch-site": "same-origin",
          },
          method: "POST",
          originalUrl: "/api/auth/browser-session/csrf",
        }),
      ),
    ).toBe(true);
    expect(
      () =>
        guard.canActivate(
          createContext({
            headers: {
              cookie: "hr_axis_browser_session=signed",
              origin: "https://app.example.invalid",
              "sec-fetch-site": "same-origin",
            },
            method: "POST",
            originalUrl: "/api/auth/browser-session/csrf/near-match",
          }),
        ),
    ).toThrow(ForbiddenException);
  });

  it("preserves the existing browser-session create and clear endpoint exemptions", () => {
    const guard = new BrowserSessionCsrfGuard(config as never, {
      verifyCsrfToken: jest.fn(),
    } as never);

    for (const method of ["POST", "DELETE"]) {
      expect(
        guard.canActivate(
          createContext({
            headers: { cookie: "hr_axis_browser_session=signed" },
            method,
            originalUrl: "/api/auth/browser-session",
          }),
        ),
      ).toBe(true);
    }
  });

  it.each([
    {},
    { origin: "https://evil.example.invalid", "sec-fetch-site": "same-origin" },
    { origin: "https://app.example.invalid", "sec-fetch-site": "cross-site" },
    { origin: ["https://app.example.invalid", "https://evil.example.invalid"], "sec-fetch-site": "same-origin" },
    { origin: "https://app.example.invalid", "sec-fetch-site": ["same-origin", "same-origin"] },
    { origin: " https://app.example.invalid", "sec-fetch-site": "same-origin" },
  ])("fails closed for invalid nonce-recovery metadata %#", (headers) => {
    const guard = new BrowserSessionCsrfGuard(config as never, {
      verifyCsrfToken: jest.fn(),
    } as never);

    expect(() =>
      guard.canActivate(
        createContext({
          headers: { cookie: "hr_axis_browser_session=signed", ...headers },
          method: "POST",
          originalUrl: "/api/auth/browser-session/csrf",
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it("requires a matching CSRF token for unsafe cookie-authenticated requests", () => {
    const guard = new BrowserSessionCsrfGuard(config as never, {
      verifyCsrfToken: jest.fn((cookie, token) => cookie === "signed" && token === "nonce"),
    } as never);

    expect(() =>
      guard.canActivate(
        createContext({
          headers: { cookie: "hr_axis_browser_session=signed" },
          method: "POST",
        }),
      ),
    ).toThrow(ForbiddenException);

    expect(
      guard.canActivate(
        createContext({
          headers: {
            cookie: "hr_axis_browser_session=signed",
            "x-csrf-token": "nonce",
          },
          method: "POST",
        }),
      ),
    ).toBe(true);
  });
});
