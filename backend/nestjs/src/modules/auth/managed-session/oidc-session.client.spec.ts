import { SignJWT } from "jose";
import { ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { JwtAuthProvider } from "../providers/jwt-auth.provider";
import { OidcSessionClient } from "./oidc-session.client";

describe("managed OIDC provider boundary", () => {
  const config = { authSessionTokenUrl: "https://synthetic.invalid/token", authClientId: "app",
    jwtAudience: "api", jwtIssuer: "https://synthetic.invalid/realm", jwtSecret: "synthetic-signing-secret", jwtJwksUrl: undefined };
  let fetchSpy: jest.SpyInstance;
  beforeEach(() => { fetchSpy = jest.spyOn(global, "fetch"); });
  afterEach(() => fetchSpy.mockRestore());
  const client = () => new OidcSessionClient(config as never, new JwtAuthProvider(config as never));
  const jwt = (claims: { subject?: string; issuer?: string; audience?: string; expired?: boolean } = {}) => {
    let builder = new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setIssuer(claims.issuer ?? config.jwtIssuer)
      .setExpirationTime(Math.floor(Date.now()/1000)+(claims.expired ? -30 : 300));
    if (claims.subject !== "missing") builder = builder.setSubject(claims.subject ?? "provider-subject");
    if (claims.audience !== "missing") builder = builder.setAudience(claims.audience ?? "app");
    return builder.sign(new TextEncoder().encode(config.jwtSecret));
  };

  it("uses only configured server endpoint/client and returns a verified binding internally", async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ access_token: await jwt(), refresh_token: "private-refresh" }), { status: 200 }));
    const grant = await client().grant({ grant_type: "refresh_token", refresh_token: "old-private-refresh", client_id: "untrusted-client" });
    expect(grant).toMatchObject({ issuer: config.jwtIssuer, subject: "provider-subject" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe(config.authSessionTokenUrl); expect(options.redirect).toBe("error");
    expect(options.body.get("client_id")).toBe("app");
  });

  it.each([{ subject: "missing" }, { audience: "missing" }, { audience: "other" },
    { issuer: "https://other.invalid/realm" }, { expired: true }])("rejects unverifiable identity %# even outside production", async (claims) => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ access_token: await jwt(claims), refresh_token: "private-refresh" }), { status: 200 }));
    await expect(client().grant({ grant_type: "refresh_token" })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it.each([400, 401, 429, 500, 503])("maps provider status %s without leaking its body", async (status) => {
    fetchSpy.mockResolvedValue(new Response("sensitive-provider-error", { status }));
    const result = client().grant({ grant_type: "refresh_token" });
    await expect(result).rejects.toBeInstanceOf(status < 429 ? UnauthorizedException : ServiceUnavailableException);
    await expect(result).rejects.not.toThrow("sensitive-provider-error");
  });

  it.each([null, {}, { access_token: "unusable" }])("keeps malformed success responses recoverable %#", async (payload) => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    await expect(client().grant({ grant_type: "refresh_token" })).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("keeps transport failures recoverable and sanitized", async () => {
    fetchSpy.mockRejectedValue(new Error("sensitive-network-detail"));
    await expect(client().grant({ grant_type: "refresh_token" })).rejects.toThrow("temporarily unavailable");
  });
});
