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

  it("skips browser-session create and clear endpoint rules", () => {
    const guard = new BrowserSessionCsrfGuard(config as never, {
      verifyCsrfToken: jest.fn(),
    } as never);

    expect(
      guard.canActivate(
        createContext({
          headers: { cookie: "hr_axis_browser_session=signed" },
          method: "POST",
          originalUrl: "/api/auth/browser-session",
        }),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        createContext({
          headers: { cookie: "hr_axis_browser_session=signed" },
          method: "DELETE",
          originalUrl: "/api/auth/browser-session",
        }),
      ),
    ).toBe(true);
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
