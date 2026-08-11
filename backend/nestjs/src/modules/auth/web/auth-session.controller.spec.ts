import { AuthSessionController } from "./auth-session.controller";
import { BrowserSessionService } from "../browser-session.service";
import { buildAuthenticatedUser } from "../auth-context.service";
import { UnauthorizedException } from "@nestjs/common";
import { HTTP_CODE_METADATA } from "@nestjs/common/constants";

describe("AuthSessionController", () => {
  it("returns CSRF recovery with HTTP 200 rather than POST's default 201", () => {
    expect(
      Reflect.getMetadata(
        HTTP_CODE_METADATA,
        AuthSessionController.prototype.recoverBrowserSessionCsrf,
      ),
    ).toBe(200);
  });

  it("returns PKCE token endpoint metadata in auth bootstrap", () => {
    const controller = new AuthSessionController({
      authMode: "jwt",
      authAuthorizationUrl: "https://idp.example.com/oauth/authorize",
      authClientId: "store-ops-admin-web",
      authScope: "openid profile email",
      authResponseType: "code",
      authAudienceOverride: "store-ops-api",
      authCallbackPath: "/auth/callback",
      authLogoutUrl: "https://idp.example.com/logout",
      authPostLogoutRedirectPath: "/auth/login",
      authTokenUrl: "https://idp.example.com/oauth/token",
    } as never, {} as never, {} as never);

    expect(controller.getBootstrap()).toEqual({
      authMode: "jwt",
      provider: {
        configured: true,
        authorizationUrl: "https://idp.example.com/oauth/authorize",
        clientId: "store-ops-admin-web",
        scope: "openid profile email",
        responseType: "code",
        audience: "store-ops-api",
        callbackPath: "/auth/callback",
        tokenUrl: "https://idp.example.com/oauth/token",
        logoutUrl: "https://idp.example.com/logout",
        postLogoutRedirectPath: "/auth/login",
      },
    });
  });

  it("does not mark code flow provider as configured without a token endpoint", () => {
    const controller = new AuthSessionController({
      authMode: "jwt",
      authAuthorizationUrl: "https://idp.example.com/oauth/authorize",
      authClientId: "store-ops-admin-web",
      authScope: "openid profile email",
      authResponseType: "code",
      authAudienceOverride: undefined,
      authCallbackPath: "/auth/callback",
      authLogoutUrl: undefined,
      authPostLogoutRedirectPath: "/auth/login",
      authTokenUrl: undefined,
    } as never, {} as never, {} as never);

    expect(controller.getBootstrap().provider.configured).toBe(false);
  });

  it("returns user display fields in the session response", () => {
    const controller = new AuthSessionController(
      { authMode: "jwt" } as never,
      {} as never,
      {} as never,
    );

    expect(
      controller.getSession({
        user: {
          userId: "90000000-0000-4000-8000-000000000010",
          employeeId: "70000000-0000-4000-8000-000000000010",
          displayName: "Mert Kaya",
          username: "store.manager",
          email: "store.manager@example.com",
          roleCodes: ["STORE_MANAGER"],
          roleScopes: {
            STORE_MANAGER: { companyIds: [], regionIds: [], storeIds: ["store-1"] },
          },
          scope: { companyIds: [], regionIds: [], storeIds: ["store-1"] },
          readScope: { companyIds: [], regionIds: [], storeIds: ["store-1"] },
          actionScope: { assignedStoreIds: ["store-1"] },
          assignedStoreIds: ["store-1"],
        },
      }),
    ).toMatchObject({
      user: {
        displayName: "Mert Kaya",
        username: "store.manager",
        email: "store.manager@example.com",
        authorizationContextVersion: expect.stringMatching(/^v1:[a-f0-9]{64}$/),
      },
    });
  });

  it("recovers a verified browser-session CSRF nonce without mutating its cookie", () => {
    const now = Date.UTC(2026, 0, 1, 0, 0, 30);
    const browserSessionService = new BrowserSessionService({
      browserSessionSecret: "0123456789abcdef0123456789ABCDEF",
      browserSessionPreviousSecret: undefined,
      browserSessionTtlSeconds: 120,
    } as never);
    const issued = browserSessionService.issueSession(
      buildAuthenticatedUser({
        userId: "app-user-1",
        roleCodes: ["REPORT_VIEWER"],
        readScope: { companyIds: [], regionIds: [], storeIds: [] },
        actionScope: { assignedStoreIds: [] },
      }),
      Date.UTC(2026, 0, 1, 0, 0, 0),
    );
    const controller = new AuthSessionController(
      {
        browserSessionCookieEnabled: true,
        browserSessionCookieName: "hr_axis_browser_session",
        browserSessionCookieSecure: true,
        browserSessionSameSite: "lax",
      } as never,
      {} as never,
      browserSessionService,
    );
    const dateNow = jest.spyOn(Date, "now").mockReturnValue(now);

    try {
      const result = controller.recoverBrowserSessionCsrf(
        {
          headers: {
            cookie: `hr_axis_browser_session=${encodeURIComponent(issued.cookieValue)}`,
          },
          user: browserSessionService.verifySession(issued.cookieValue, now).user,
        },
      );

      expect(result).toMatchObject({
        expiresAt: issued.expiresAt,
        sessionId: issued.sessionId,
        csrfToken: expect.any(String),
      });
      expect(result.csrfToken).toBe(issued.csrfNonce);
    } finally {
      dateNow.mockRestore();
    }
  });

  it.each([
    { headers: {}, label: "missing cookie" },
    {
      headers: { cookie: "hr_axis_browser_session=tampered" },
      label: "tampered cookie",
    },
  ])("rejects browser-session CSRF recovery with a $label", ({ headers }) => {
    const browserSessionService = new BrowserSessionService({
      browserSessionSecret: "0123456789abcdef0123456789ABCDEF",
      browserSessionPreviousSecret: undefined,
      browserSessionTtlSeconds: 120,
    } as never);
    const controller = new AuthSessionController(
      {
        browserSessionCookieEnabled: true,
        browserSessionCookieName: "hr_axis_browser_session",
      } as never,
      {} as never,
      browserSessionService,
    );

    expect(() =>
      controller.recoverBrowserSessionCsrf(
        { headers, user: { userId: "app-user-1" } as never },
      ),
    ).toThrow(UnauthorizedException);
  });
});
