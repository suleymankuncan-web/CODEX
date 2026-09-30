import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { INestApplication } from "@nestjs/common";
import { SignJWT } from "jose";
import { Pool } from "pg";
import * as request from "supertest";
import { DatabaseService } from "../../src/shared/database/database.service";
import { createIntegrationApp } from "./test-app";

const fixtureUrl = process.env.MANAGED_SESSION_POSTGRES_URL;
const postgres = fixtureUrl ? describe : describe.skip;
const origin = "https://synthetic.invalid";
const issuer = `${origin}/realms/store-ops`;
const secret = "synthetic-managed-http-signing";

postgres("managed browser session HTTP with canonical PostgreSQL", () => {
  const databaseName = `managed_http_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const userId = randomUUID(), companyId = randomUUID(), roleId = randomUUID();
  const previousAuthMode = process.env.AUTH_MODE, previousJwtSecret = process.env.JWT_SECRET;
  let app: INestApplication, admin: Pool, pool: Pool, created = false;
  let fetchSpy: jest.SpyInstance, accessToken: string;
  const input = () => ({ code: randomUUID(), codeVerifier: "a".repeat(43), state: "b".repeat(32),
    redirectUri: `${origin}/auth/callback` });
  const grant = () => new Response(JSON.stringify({ access_token: accessToken,
    refresh_token: "synthetic-private-refresh" }), { status: 200 });
  const establish = (body = input()) => request(app.getHttpServer())
    .post("/api/auth/browser-session/oidc").set("Origin", origin).send(body);
  const cookie = (response: request.Response) => (response.headers["set-cookie"] as unknown as string[])
    .find(value => value.startsWith("hr_axis_browser_session="))!.split(";")[0];

  beforeAll(async () => {
    const target = new URL(fixtureUrl!);
    if (target.hostname !== "127.0.0.1" || target.port !== "55437" || target.pathname !== "/postgres") {
      throw new Error("isolated managed-session fixture required");
    }
    admin = new Pool({ connectionString: fixtureUrl });
    await admin.query(`CREATE DATABASE ${databaseName}`); created = true;
    target.pathname = `/${databaseName}`; pool = new Pool({ connectionString: target.toString() });
    await pool.query(readFileSync(resolve(process.cwd(), "../../db/schema.sql"), "utf8"));
    await pool.query("INSERT INTO ops.company(company_id,company_code,company_name) VALUES($1,'HTTP_SYNTHETIC','Synthetic')", [companyId]);
    await pool.query("INSERT INTO ops.role(role_id,role_code,role_name,role_scope_type) VALUES($1,'REPORT_VIEWER','Synthetic','company')", [roleId]);
    await pool.query(`INSERT INTO ops.user_account(user_id,username,email,auth_provider,provider_subject)
      VALUES($1,'synthetic-http','synthetic-http@example.invalid','oidc','synthetic-subject')`, [userId]);
    await pool.query(`INSERT INTO ops.user_role_assignment(user_id,role_id,scope_type,company_id)
      VALUES($1,$2,'company',$3)`, [userId, roleId, companyId]);
    accessToken = await new SignJWT({ roles: ["SUPER_ADMIN"], preferred_username: "synthetic-http" })
      .setProtectedHeader({ alg: "HS256" }).setSubject("synthetic-subject").setIssuer(issuer)
      .setAudience("store-ops-api").setExpirationTime("5m").sign(new TextEncoder().encode(secret));
    process.env.AUTH_MODE = "jwt"; process.env.JWT_SECRET = secret;
    fetchSpy = jest.spyOn(global, "fetch").mockImplementation(async () => grant());
    app = await createIntegrationApp({ databaseService: new DatabaseService(pool), standardErrorFilter: true,
      appConfigService: { authMode: "jwt", authProviderKey: "oidc", isProduction: true, allowMockAuth: false,
        jwtIssuer: issuer, jwtAudience: "store-ops-api", jwtSecret: secret,
        authClientId: "store-ops-admin-web", authResponseType: "code", authCallbackPath: "/auth/callback",
        authSessionTokenUrl: `${origin}/token`, managedBrowserSessionEnabled: true,
        managedBrowserSessionMaxSeconds: 604800, browserSessionCookieEnabled: true,
        browserSessionSecret: "synthetic-browser-secret-0123456789", browserSessionTtlSeconds: 900,
        browserSessionCookieName: "hr_axis_browser_session", browserSessionCsrfCookieName: "hr_axis_csrf_nonce",
        browserSessionCookieSecure: true, browserSessionSameSite: "lax", corsAllowedOrigins: [origin] } });
  });

  afterAll(async () => {
    fetchSpy?.mockRestore();
    if (app) await app.close(); else if (pool) await pool.end();
    if (created) await admin.query(`DROP DATABASE ${databaseName}`);
    if (admin) await admin.end();
    if (previousAuthMode === undefined) delete process.env.AUTH_MODE; else process.env.AUTH_MODE = previousAuthMode;
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousJwtSecret;
  });
  beforeEach(() => fetchSpy.mockClear());

  it("establishes and confirms one PKCE login with fresh internal scope and no provider credentials", async () => {
    const body = input();
    const first = await establish(body).expect(200);
    const replay = await establish({ ...body }).expect(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(replay.body.sessionId).toBe(first.body.sessionId);
    expect(replay.body.csrfToken).toBe(first.body.csrfToken);
    expect(replay.body.session.user).toMatchObject({ userId, roleCodes: ["REPORT_VIEWER"],
      readScope: { companyIds: [companyId], storeIds: [] } });
    expect(JSON.stringify(replay.body)).not.toMatch(/synthetic-private-refresh|access_token|refresh_token|id_token/);
    const session = await request(app.getHttpServer()).get("/api/auth/session").set("Cookie", cookie(first)).expect(200);
    expect(session.body.user).toEqual(replay.body.session.user);
  });

  it("denies invalid origin, callback and PKCE before any provider grant", async () => {
    await request(app.getHttpServer()).post("/api/auth/browser-session/oidc")
      .set("Origin", "https://outside.invalid").send(input()).expect(403);
    await establish({ ...input(), redirectUri: `${origin}/outside` }).expect(400);
    await establish({ ...input(), codeVerifier: "short" }).expect(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("recovers temporary refresh failure with the same nonce and denies the captured cookie after logout", async () => {
    const first = await establish().expect(200), sessionCookie = cookie(first);
    await pool.query("UPDATE ops.managed_browser_session SET refreshed_at=NOW()-INTERVAL '1 minute' WHERE session_id=$1", [first.body.sessionId]);
    fetchSpy.mockResolvedValueOnce(new Response("synthetic-provider-private-detail", { status: 503 }));
    const recover = () => request(app.getHttpServer()).post("/api/auth/browser-session/csrf")
      .set("Origin", origin).set("Cookie", sessionCookie);
    await recover().expect(503);
    const recovered = await recover().expect(200);
    expect(recovered.body.csrfToken).toBe(first.body.csrfToken);
    await request(app.getHttpServer()).delete("/api/auth/browser-session")
      .set("Origin", origin).set("Cookie", sessionCookie).expect(200);
    await request(app.getHttpServer()).get("/api/auth/session").set("Cookie", sessionCookie).expect(401);
  });
});
