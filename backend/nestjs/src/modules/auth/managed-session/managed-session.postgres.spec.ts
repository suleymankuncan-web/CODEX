import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";
import { ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import { buildAuthenticatedUser } from "../authenticated-user";
import { BrowserSessionService } from "../browser-session.service";
import { ManagedSessionRepository } from "./managed-session.repository";
import { ManagedSessionService } from "./managed-session.service";

const url = process.env.MANAGED_SESSION_POSTGRES_URL;
const postgres = url ? describe : describe.skip;
postgres("managed browser sessions: real PostgreSQL locking and migration", () => {
  const name = `managed_session_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const userId = randomUUID();
  let admin: Pool, pool: Pool, created = false;
  let repository: ManagedSessionRepository, browser: BrowserSessionService, service: ManagedSessionService;
  const grant = jest.fn();
  const config = { managedBrowserSessionEnabled: true, managedBrowserSessionMaxSeconds: 604800,
    browserSessionSecret: "managed-synthetic-secret-0123456789", browserSessionPreviousSecret: undefined,
    browserSessionTtlSeconds: 900, jwtIssuer: "https://synthetic.invalid/realm" };
  const user = buildAuthenticatedUser({ userId, roleCodes: ["REPORT_VIEWER"] });
  const token = () => ({ accessToken: "synthetic-access", refreshToken: "synthetic-refresh",
    issuer: "https://synthetic.invalid/realm", subject: "provider-subject", expiresAt: Math.floor(Date.now()/1000)+300 });
  const create = (code = randomUUID()) => service.create({ code, codeVerifier: "a".repeat(43),
    state: "b".repeat(32), redirectUri: "https://synthetic.invalid/auth/callback" },
  async () => user, async (cookie) => { await service.verify(browser.verifySession(cookie).envelope); return user; });
  const migrate = async () => {
    const client = await pool.connect();
    try { await client.query("BEGIN"); await client.query(readFileSync(resolve(process.cwd(), "../../db/migrations/098_managed_browser_session_v2.sql"), "utf8")); await client.query("COMMIT"); }
    catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  };
  beforeAll(async () => {
    const target = new URL(url!);
    if (target.hostname !== "127.0.0.1" || target.port !== "55437" || target.pathname !== "/postgres") throw new Error("isolated managed-session fixture required");
    admin = new Pool({ connectionString: url }); await admin.query(`CREATE DATABASE ${name}`); created = true;
    target.pathname = `/${name}`; pool = new Pool({ connectionString: target.toString() });
    await pool.query("CREATE SCHEMA ops; CREATE TABLE ops.user_account(user_id UUID PRIMARY KEY,is_active BOOLEAN NOT NULL DEFAULT TRUE,auth_provider TEXT NOT NULL DEFAULT 'oidc',provider_subject TEXT NOT NULL DEFAULT 'provider-subject')");
    await pool.query("INSERT INTO ops.user_account(user_id) VALUES($1)", [userId]);
    await migrate(); await migrate();
    repository = new ManagedSessionRepository(new DatabaseService(pool));
    browser = new BrowserSessionService(config as never);
    service = new ManagedSessionService(config as never, repository, { grant } as never, browser);
  });
  beforeEach(() => { grant.mockReset(); grant.mockImplementation(async () => token()); });
  afterAll(async () => { if (pool) await pool.end(); if (created) await admin.query(`DROP DATABASE ${name}`); if (admin) await admin.end(); });

  it("establishes a fixed V2 envelope, encrypts provider tokens, and replays one login without a second exchange", async () => {
    const code = randomUUID();
    const first = await create(code); const replay = await create(code);
    expect(grant).toHaveBeenCalledTimes(1);
    expect(replay.sessionId).toBe(first.sessionId); expect(replay.expiresAt).toBe(first.expiresAt);
    expect(replay.csrfNonce).toBe(first.csrfNonce); expect(replay.created).toBe(false);
    const parsed = browser.verifySession(first.cookieValue);
    expect(parsed.envelope.v).toBe(2);
    expect(JSON.stringify(parsed.envelope)).not.toContain("synthetic-refresh");
    const rows = await pool.query("SELECT * FROM ops.managed_browser_session WHERE session_id=$1", [first.sessionId]);
    expect(JSON.stringify(rows.rows)).not.toContain("synthetic-refresh");
    expect(JSON.stringify(rows.rows)).not.toContain(code);
  });

  it("serializes twenty expired-lease requests across distinct services into one rotating grant", async () => {
    const session = await create(); const envelope = browser.verifySession(session.cookieValue).envelope;
    await pool.query("UPDATE ops.managed_browser_session SET access_expires_at=NOW()-INTERVAL '1 minute' WHERE session_id=$1", [session.sessionId]);
    grant.mockClear(); grant.mockImplementation(async () => { await new Promise(resolve => setTimeout(resolve, 60)); return { ...token(), refreshToken: "rotated-refresh" }; });
    const second = new ManagedSessionService(config as never, repository, { grant } as never, browser);
    await Promise.all(Array.from({ length: 20 }, (_, index) => (index % 2 ? service : second).verify(envelope)));
    expect(grant).toHaveBeenCalledTimes(1);
    expect(grant.mock.calls[0][0]).toEqual({ grant_type: "refresh_token", refresh_token: "synthetic-refresh" });
    expect(browser.recoverCsrfNonce(session.cookieValue).csrfNonce).toBe(session.csrfNonce);
    expect(browser.verifySession(session.cookieValue).envelope.exp).toBe(envelope.exp);
  });

  it("forces provider validation on reload and coalesces simultaneous recovery calls", async () => {
    const session = await create(); const envelope = browser.verifySession(session.cookieValue).envelope;
    await pool.query("UPDATE ops.managed_browser_session SET refreshed_at=NOW()-INTERVAL '1 minute' WHERE session_id=$1", [session.sessionId]);
    grant.mockClear();
    await Promise.all(Array.from({ length: 8 }, () => service.verify(envelope, true)));
    expect(grant).toHaveBeenCalledTimes(1);
  });

  it("retains a session on temporary provider failure, then recovers without changing identity", async () => {
    const session = await create(); const envelope = browser.verifySession(session.cookieValue).envelope;
    await pool.query("UPDATE ops.managed_browser_session SET access_expires_at=NOW() WHERE session_id=$1", [session.sessionId]);
    grant.mockRejectedValueOnce(new ServiceUnavailableException("temporary"));
    await expect(service.verify(envelope)).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(service.verify(envelope)).resolves.toBeUndefined();
    expect(browser.recoverCsrfNonce(session.cookieValue).csrfNonce).toBe(session.csrfNonce);
  });

  it.each(["invalid-grant", "different-subject"])("commits revocation for %s and never falls back to the signed cookie", async (reason) => {
    const session = await create(); const envelope = browser.verifySession(session.cookieValue).envelope;
    await pool.query("UPDATE ops.managed_browser_session SET access_expires_at=NOW() WHERE session_id=$1", [session.sessionId]);
    if (reason === "invalid-grant") grant.mockRejectedValue(new UnauthorizedException("ended"));
    else grant.mockResolvedValue({ ...token(), subject: "other-subject" });
    await expect(service.verify(envelope)).rejects.toBeInstanceOf(UnauthorizedException);
    const state = await pool.query("SELECT status,refresh_ciphertext FROM ops.managed_browser_session WHERE session_id=$1", [session.sessionId]);
    expect(state.rows[0]).toEqual({ status: "revoked", refresh_ciphertext: null });
    grant.mockClear(); await expect(service.verify(envelope)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(grant).not.toHaveBeenCalled();
  });

  it("denies deleted, logged-out and mismatched cookies and prevents a logged-out login replay", async () => {
    const code = randomUUID(); const session = await create(code); const envelope = browser.verifySession(session.cookieValue).envelope;
    await expect(service.verify({ ...envelope, exp: envelope.exp + 60 })).rejects.toBeInstanceOf(UnauthorizedException);
    await service.revoke(envelope);
    await expect(service.verify(envelope)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(create(code)).rejects.toBeInstanceOf(UnauthorizedException);
    await pool.query("DELETE FROM ops.managed_browser_session WHERE session_id=$1", [session.sessionId]);
    await expect(service.verify(envelope)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("immediately denies disabled or rebound internal accounts even with a valid access lease", async () => {
    const session = await create(); const envelope = browser.verifySession(session.cookieValue).envelope;
    grant.mockClear();
    await pool.query("UPDATE ops.user_account SET is_active=FALSE WHERE user_id=$1", [userId]);
    await expect(service.verify(envelope)).rejects.toBeInstanceOf(UnauthorizedException);
    await pool.query("UPDATE ops.user_account SET is_active=TRUE,provider_subject='replacement-subject' WHERE user_id=$1", [userId]);
    await expect(service.verify(envelope)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(grant).not.toHaveBeenCalled();
    await pool.query("UPDATE ops.user_account SET provider_subject='provider-subject' WHERE user_id=$1", [userId]);
  });

  it("never blindly re-exchanges an indeterminate consumed login code", async () => {
    const code = randomUUID(); grant.mockRejectedValueOnce(new ServiceUnavailableException("outcome unknown"));
    await expect(create(code)).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(create(code)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(grant).toHaveBeenCalledTimes(1);
  });
});
