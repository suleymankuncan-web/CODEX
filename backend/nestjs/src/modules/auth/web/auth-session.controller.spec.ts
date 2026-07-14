import { AuthSessionController } from "./auth-session.controller";

describe("AuthSessionController", () => {
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
});
