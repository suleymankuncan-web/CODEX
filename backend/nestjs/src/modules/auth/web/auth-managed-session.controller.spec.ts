import { validate } from "class-validator";
import { AuthSessionController } from "./auth-session.controller";
import { CreateOidcBrowserSessionDto } from "./dto/create-oidc-browser-session.dto";
import { buildAuthenticatedUser } from "../authenticated-user";

describe("managed session establishment boundary", () => {
  const origin = "https://synthetic.invalid";
  const input = { code: "synthetic-code", codeVerifier: "v".repeat(43), state: "s".repeat(32), redirectUri: `${origin}/auth/callback` };
  const user = buildAuthenticatedUser({ userId: "80000000-0000-0000-0000-000000000001", roleCodes: ["HR_ADMIN"] });
  const setup = () => {
    const resolveJwtBearerToken = jest.fn(async () => user);
    const create = jest.fn(async (_input: CreateOidcBrowserSessionDto, resolveUser: (token: string) => Promise<typeof user>) => ({ user: await resolveUser("verified-private-access"),
      cookieValue: "opaque-cookie", csrfNonce: "stable-csrf", sessionId: "opaque-sid", expiresAt: new Date(Date.now()+60_000).toISOString() }));
    const setHeader = jest.fn();
    const controller = new AuthSessionController({ managedBrowserSessionEnabled: true, corsAllowedOrigins: [origin],
      authCallbackPath: "/auth/callback", browserSessionCookieName: "session", browserSessionSameSite: "lax",
      browserSessionCookieSecure: true, authMode: "jwt" } as never,
    { resolveJwtBearerToken } as never, {} as never, { create } as never);
    return { controller, create, setHeader, resolveJwtBearerToken };
  };
  it("requires strict internal mapping and emits only an HttpOnly cookie and neutral session fields", async () => {
    const { controller, setHeader, resolveJwtBearerToken } = setup();
    const body = await controller.createOidcBrowserSession(input, { headers: { origin } }, { setHeader });
    expect(resolveJwtBearerToken).toHaveBeenCalledWith("verified-private-access", true);
    expect(JSON.stringify(body)).not.toContain("verified-private-access");
    expect(setHeader).toHaveBeenCalledWith("Set-Cookie", expect.stringContaining("HttpOnly"));
    expect(setHeader).toHaveBeenCalledWith("Set-Cookie", expect.stringContaining("Secure"));
    expect(setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
  });
  it.each([{}, { origin: "https://evil.invalid" }, { origin, "sec-fetch-site": "same-site" },
    { origin, "sec-fetch-site": "cross-site" }, { origin: [origin, origin] }])("rejects bad origins before any exchange %#", async (headers) => {
    const { controller, create, setHeader } = setup();
    await expect(controller.createOidcBrowserSession(input, { headers }, { setHeader })).rejects.toThrow("metadata is invalid");
    expect(create).not.toHaveBeenCalled();
  });
  it("rejects an unconfigured callback before exchange", async () => {
    const { controller, create, setHeader } = setup();
    await expect(controller.createOidcBrowserSession({ ...input, redirectUri: "https://evil.invalid/auth/callback" }, { headers: { origin } }, { setHeader })).rejects.toThrow("Invalid login callback");
    expect(create).not.toHaveBeenCalled();
  });
  it("validates bounded PKCE inputs without exposing their values", async () => {
    const valid = Object.assign(new CreateOidcBrowserSessionDto(), input);
    expect(await validate(valid)).toEqual([]);
    for (const invalid of [{ codeVerifier: "short" }, { codeVerifier: "x".repeat(129) }, { state: "../cross-site" }, { code: "x".repeat(4097) }]) {
      expect((await validate(Object.assign(new CreateOidcBrowserSessionDto(), input, invalid))).length).toBeGreaterThan(0);
    }
  });
});
