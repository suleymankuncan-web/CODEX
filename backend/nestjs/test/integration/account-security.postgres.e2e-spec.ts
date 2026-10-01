import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { INestApplication } from "@nestjs/common";
import { Pool } from "pg";
import * as request from "supertest";
import { DatabaseService } from "../../src/shared/database/database.service";
import { AccountSecurityRepository } from "../../src/modules/auth/account-security.repository";
import { IdentityLifecycleRepository } from "../../src/modules/auth/identity-lifecycle.repository";
import { createIntegrationApp } from "./test-app";

const fixtureUrl = process.env.MANAGED_SESSION_POSTGRES_URL;
const postgres = fixtureUrl ? describe : describe.skip;

postgres("account security with canonical PostgreSQL", () => {
  const name = `security_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const userId = randomUUID();
  const email = "synthetic-security@example.invalid", subject = "synthetic-security-subject";
  let admin: Pool, pool: Pool, database: DatabaseService, repository: AccountSecurityRepository;
  let app: INestApplication, created = false;
  let roles: string[] | null = ["SUPER_ADMIN"];
  const enqueue = () => repository.enqueue({ userId, requestId: randomUUID(), kind: "reset", actorUserId: userId });
  const result = () => pool.query("SELECT * FROM ops.password_link_request ORDER BY request_sequence DESC LIMIT 1");
  const observation = async () => (await repository.claimObservations())[0];
  const ready = async (baseline = { state: "absent" as "absent" | "present" | "unknown", setAt: null as number | null }) => {
    const link = await enqueue();
    const stored = await pool.query("SELECT job_id FROM ops.password_link_request WHERE request_id=$1", [link.request_id]);
    const jobId = stored.rows[0].job_id;
    await repository.beginSend(jobId, baseline); await repository.outcome(jobId, "sent", null);
    await pool.query("UPDATE ops.password_link_request SET send_started_at=NOW()-INTERVAL '5 seconds'");
    return { link, jobId };
  };

  beforeAll(async () => {
    const target = new URL(fixtureUrl!);
    if (target.hostname !== "127.0.0.1" || target.port !== "55437" || target.pathname !== "/postgres") throw new Error("isolated security fixture required");
    admin = new Pool({ connectionString: fixtureUrl });
    await admin.query(`CREATE DATABASE ${name}`); created = true;
    target.pathname = `/${name}`; pool = new Pool({ connectionString: target.toString() });
    await pool.query(readFileSync(resolve(process.cwd(), "../../db/schema.sql"), "utf8"));
    await pool.query(`INSERT INTO ops.user_account(user_id,username,email,auth_provider,provider_subject,is_active)
      VALUES($1,'synthetic-security',$2,'oidc',$3,TRUE)`, [userId, email, subject]);
    database = new DatabaseService(pool); repository = new AccountSecurityRepository(database);
    app = await createIntegrationApp({ databaseService: database, standardErrorFilter: true,
      authContextService: { resolveUser: async () => roles ? { userId, roleCodes: roles,
        scope: { companyIds: [], regionIds: [], storeIds: [] }, readScope: { companyIds: [], regionIds: [], storeIds: [] },
        actionScope: { assignedStoreIds: [] }, assignedStoreIds: [] } : null } });
  });
  afterAll(async () => {
    if (app) await app.close(); else if (pool) await pool.end();
    if (created) await admin.query(`DROP DATABASE ${name}`);
    if (admin) await admin.end();
  });
  beforeEach(async () => {
    roles = ["SUPER_ADMIN"];
    await pool.query("TRUNCATE ops.password_link_request,ops.account_security_snapshot,ops.identity_lifecycle_job CASCADE");
    await pool.query("UPDATE ops.user_account SET provider_subject=$2,email=$3,is_active=TRUE,last_active_at=NULL WHERE user_id=$1", [userId, subject, email]);
  });

  it("reapplies the additive migration and audits an idempotent request exactly once", async () => {
    const migration = readFileSync(resolve(process.cwd(), "../../db/migrations/099_auth_account_security.sql"), "utf8");
    await pool.query(migration); await pool.query(migration);
    const requestId = randomUUID(), input = { userId, requestId, kind: "setup" as const, actorUserId: userId };
    await repository.enqueue(input); await repository.enqueue(input);
    const count = await pool.query("SELECT COUNT(*)::int AS count FROM ops.password_link_request");
    expect(count.rows[0].count).toBe(1);
    const audit = await pool.query("SELECT metadata_json FROM audit.event_log WHERE metadata_json->>'requestId'=$1", [requestId]);
    expect(audit.rows).toEqual([{ metadata_json: { requestId, kind: "setup" } }]);
    await expect(repository.enqueue({ ...input, kind: "reset" })).rejects.toThrow("Request already used");
  });
  it("tracks automatic initial setup atomically with identity provisioning", async () => {
    const identity = new IdentityLifecycleRepository(database);
    const jobId = randomUUID();
    await pool.query(`INSERT INTO ops.identity_lifecycle_job(identity_lifecycle_job_id,user_id,operation,status,idempotency_key)
      VALUES($1,$2,'provision','processing',$3)`, [jobId, userId, randomUUID()]);
    expect(await identity.completeProvision(jobId, userId, subject)).toBe(true);
    expect(await identity.completeProvision(jobId, userId, subject)).toBe(false);
    const link = await result();
    expect(link.rows[0]).toMatchObject({ kind: "setup", state: "queued", request_id: jobId });
    const jobs = await pool.query("SELECT operation,status FROM ops.identity_lifecycle_job ORDER BY created_at");
    expect(jobs.rows).toEqual([{ operation: "provision", status: "completed" }, { operation: "password_link", status: "pending" }]);
  });
  it("shows a preexisting password and sent reset together without claiming completion", async () => {
    const date = Date.now() - 60_000;
    await ready({ state: "present", setAt: date });
    await repository.observe(await observation(), { state: "present", setAt: date });
    const read = await repository.read(userId);
    expect(read.account.password_state).toBe("present"); expect(read.links[0].state).toBe("sent");
    expect(read.links[0].completed_observed_at).toBeNull();
  });
  it("completes only a verified newer password in the tracking window", async () => {
    await ready();
    const date = Date.now() - 1000;
    await repository.observe(await observation(), { state: "present", setAt: date });
    expect((await result()).rows[0]).toMatchObject({ state: "completed", verified_password_set_at: new Date(date) });
  });
  it.each([{ state: "unknown", setAt: null }, { state: "present", setAt: null }, { state: "absent", setAt: null }] as const)(
    "does not complete from absent/missing-date/unknown metadata: %s", async metadata => {
      await ready(); await repository.observe(await observation(), metadata);
      expect((await result()).rows[0].state).toBe("sent");
    });
  it("does not infer completion when the existing password baseline date is missing", async () => {
    await ready({ state: "present", setAt: null });
    await repository.observe(await observation(), { state: "present", setAt: Date.now() - 1000 });
    expect((await result()).rows[0].state).toBe("sent");
  });
  it("ignores superseded observations and preserves monotonic verified dates", async () => {
    const old = await observation();
    await pool.query("UPDATE ops.account_security_snapshot SET lease_until=NOW()-INTERVAL '1 minute'");
    const latest = await observation(), date = Date.now() - 1000;
    await repository.observe(latest, { state: "present", setAt: date });
    await repository.observe(latest, { state: "absent", setAt: null });
    await repository.observe(old, { state: "absent", setAt: null });
    expect((await repository.read(userId)).account.password_state).toBe("present");
    await pool.query("UPDATE ops.account_security_snapshot SET next_observation_at=NOW()");
    await repository.observe(await observation(), { state: "present", setAt: date - 100_000 });
    expect((await repository.read(userId)).account.password_set_at).toEqual(new Date(date));
  });
  it.each(["subject", "email"])("discards old metadata and denies a stale send after %s rebinding", async binding => {
    const link = await enqueue(), claim = await observation();
    await repository.observe(claim, { state: "present", setAt: Date.now() - 1000 });
    const job = await pool.query("SELECT job_id FROM ops.password_link_request WHERE request_id=$1", [link.request_id]);
    await pool.query(binding === "subject"
      ? "UPDATE ops.user_account SET provider_subject='replacement-subject' WHERE user_id=$1"
      : "UPDATE ops.user_account SET email='replacement@example.invalid' WHERE user_id=$1", [userId]);
    expect((await repository.read(userId)).account.password_state).toBeNull();
    expect(await repository.beginSend(job.rows[0].job_id, { state: "absent", setAt: null })).toBeUndefined();
    await repository.observe(claim, { state: "present", setAt: Date.now() });
    expect((await repository.read(userId)).account.password_state).toBeNull();
  });
  it("completes only the latest resend while preserving earlier immutable history", async () => {
    const first = await ready({ state: "present", setAt: Date.now() - 60_000 });
    await pool.query("UPDATE ops.identity_lifecycle_job SET status='completed'");
    await pool.query("UPDATE ops.password_link_request SET requested_at=NOW()-INTERVAL '2 minutes'");
    const second = await ready({ state: "present", setAt: Date.now() - 60_000 });
    await repository.observe(await observation(), { state: "present", setAt: Date.now() - 1000 });
    const history = (await repository.read(userId)).links;
    expect(history.map(link => [link.request_id, link.state])).toEqual([
      [second.link.request_id, "completed"], [first.link.request_id, "sent"],
    ]);
    expect(history[1].completed_observed_at).toBeNull();
  });
  it("marks interrupted sends unconfirmed and never restarts the same send boundary", async () => {
    const link = await enqueue();
    const job = await pool.query("SELECT job_id FROM ops.password_link_request WHERE request_id=$1", [link.request_id]);
    await repository.beginSend(job.rows[0].job_id, { state: "absent", setAt: null });
    await pool.query("UPDATE ops.password_link_request SET send_started_at=NOW()-INTERVAL '3 minutes'");
    await observation();
    expect((await result()).rows[0].state).toBe("unconfirmed");
    expect(await repository.beginSend(job.rows[0].job_id, { state: "absent", setAt: null })).toBeUndefined();
  });
  it("does not complete a change outside the tracking window", async () => {
    await ready();
    await pool.query("UPDATE ops.password_link_request SET tracking_expires_at=NOW()-INTERVAL '1 minute'");
    await repository.observe(await observation(), { state: "present", setAt: Date.now() - 1000 });
    expect((await result()).rows[0].state).toBe("sent");
    expect((await request(app.getHttpServer()).get(`/api/auth/users/${userId}/security`).expect(200)).body.requests[0].state).toBe("expired");
  });
  it("throttles server activity and rejects unauthenticated or unauthorized commands", async () => {
    await request(app.getHttpServer()).post("/api/auth/activity").send({ userId: randomUUID(), at: "1900" }).expect(204);
    const first = (await pool.query("SELECT last_active_at FROM ops.user_account WHERE user_id=$1", [userId])).rows[0].last_active_at;
    await request(app.getHttpServer()).post("/api/auth/activity").expect(204);
    expect((await pool.query("SELECT last_active_at FROM ops.user_account WHERE user_id=$1", [userId])).rows[0].last_active_at).toEqual(first);
    roles = ["REPORT_VIEWER"];
    await request(app.getHttpServer()).get(`/api/auth/users/${userId}/security`).expect(403);
    await request(app.getHttpServer()).post(`/api/auth/users/${userId}/password-links`).send({ requestId: randomUUID(), kind: "reset" }).expect(403);
    roles = null;
    await request(app.getHttpServer()).post("/api/auth/activity").expect(403);
    expect((await pool.query("SELECT last_active_at FROM ops.user_account WHERE user_id=$1", [userId])).rows[0].last_active_at).toEqual(first);
  });
});
