/* Run after build with ALLOW_OFFBOARDING_FIXTURE=1 and a local DATABASE_URL.
 * Repository SQL runs in an isolated, uniquely named schema, removed in finally.
 * The access adapter writes a fixture flag in the same transaction; this is not
 * a production identity-provider or full access-lifecycle proof.
 */
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { Pool } = require("pg");
const { DatabaseService } = require("../dist/src/shared/database/database.service");
const { WorkforceRequestRepository } = require("../dist/src/modules/store-ops/infrastructure/workforce-request.repository");

async function main() {
  assert.equal(process.env.ALLOW_OFFBOARDING_FIXTURE, "1", "Explicit local fixture opt-in required");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  const schema = `offboarding_fixture_${randomUUID().replaceAll("-", "")}`;
  assert.match(schema, /^offboarding_fixture_[a-f0-9]{32}$/);
  const rewrite = (sql) => sql.replaceAll("ops.", `${schema}.`).replaceAll("audit.event_log", `${schema}.event_log`);
  let failAudit = false;
  let onLock;
  const wrapQuery = (client) => async (sql, params) => {
    if (failAudit && sql.includes("INSERT INTO audit.event_log")) throw new Error("fixture audit failure");
    const result = await client.query(rewrite(sql), params);
    if (sql.includes("FOR UPDATE") && onLock) await onLock();
    return result;
  };
  const database = new DatabaseService({
    query: wrapQuery(pool),
    connect: async () => {
      const client = await pool.connect();
      return { query: wrapQuery(client), release: () => client.release() };
    },
  });
  const repository = new WorkforceRequestRepository(database, {
    deactivateUserAccessInTransaction: async (client, input) => {
      const result = await client.query("UPDATE ops.user_account SET is_active = false WHERE user_id = $1::uuid RETURNING user_id", [input.userId]);
      return { user: result.rows[0], closedRoleAssignments: 0, closedActionStoreAssignments: 0, revokedMobileSessions: 0 };
    },
  });
  const id = Object.fromEntries(["employee", "store", "region", "company", "request", "actor", "user", "assignment", "position"].map((key) => [key, randomUUID()]));
  let created = false;
  try {
    await pool.query(`CREATE SCHEMA ${schema}`);
    created = true;
    await database.query(`
      CREATE TABLE ops.employee (employee_id uuid PRIMARY KEY, first_name text, last_name text, external_employee_ref text, employment_status text, termination_date date);
      CREATE TABLE ops.store (store_id uuid PRIMARY KEY, store_code text, store_name text);
      CREATE TABLE ops.position (position_id uuid PRIMARY KEY, position_code text, position_name text);
      CREATE TABLE ops.employee_assignment_history (assignment_id uuid PRIMARY KEY, employee_id uuid, store_id uuid, position_id uuid, start_date date, end_date date, assignment_status text);
      CREATE TABLE ops.user_account (user_id uuid PRIMARY KEY, employee_id uuid, created_at timestamptz DEFAULT NOW(), is_active boolean);
      CREATE TABLE ops.turnover_event (employee_id uuid, store_id uuid, region_id uuid, company_id uuid, event_date date, event_type text, termination_reason_code text, source_assignment_id uuid);
      CREATE TABLE ops.employee_offboarding_request (offboarding_request_id uuid PRIMARY KEY, company_id uuid, region_id uuid, store_id uuid, employee_id uuid, request_status text, requested_termination_date date, termination_reason text, request_reason text, submitted_by_user_id uuid, reviewed_by_user_id uuid, reviewed_at timestamptz, review_note text, created_at timestamptz DEFAULT NOW(), updated_at timestamptz DEFAULT NOW());
      CREATE TABLE audit.event_log (actor_user_id uuid, event_type text, entity_name text, entity_id uuid, scope_type text, company_id uuid, region_id uuid, store_id uuid, metadata_json jsonb);
    `);
    await database.query("INSERT INTO ops.employee VALUES ($1, 'Fixture', 'Employee', 'fixture', 'active', NULL)", [id.employee]);
    await database.query("INSERT INTO ops.store VALUES ($1, 'fixture', 'Fixture Store')", [id.store]);
    await database.query("INSERT INTO ops.position VALUES ($1, 'fixture', 'Fixture Role')", [id.position]);
    await database.query("INSERT INTO ops.employee_assignment_history VALUES ($1,$2,$3,$4,'2026-01-01',NULL,'active')", [id.assignment, id.employee, id.store, id.position]);
    await database.query("INSERT INTO ops.user_account (user_id,employee_id,is_active) VALUES ($1,$2,true)", [id.user, id.employee]);
    await database.query("INSERT INTO ops.employee_offboarding_request (offboarding_request_id, company_id, region_id, store_id, employee_id, request_status, requested_termination_date, termination_reason, submitted_by_user_id) VALUES ($1,$2,$3,$4,$5,'pending_hr_approval','2026-09-10','resignation',$6)", [id.request, id.company, id.region, id.store, id.employee, id.actor]);

    const snapshot = () => repository.getOffboardingRequestById(id.request);
    const reset = async () => {
      await database.query("UPDATE ops.employee SET employment_status='active', termination_date=NULL; UPDATE ops.user_account SET is_active=true; UPDATE ops.employee_assignment_history SET end_date=NULL, assignment_status='active'; DELETE FROM ops.turnover_event; DELETE FROM audit.event_log; UPDATE ops.employee_offboarding_request SET request_status='pending_hr_approval', requested_termination_date='2026-09-10', updated_at=clock_timestamp()");
    };
    const invoke = (action, request) => repository[`${action}OffboardingRequest`]({ request, actorUserId: id.actor, reviewNote: "Fixture review" });
    const state = async () => (await database.query(`SELECT e.employment_status, u.is_active, r.request_status,
      (SELECT COUNT(*)::int FROM ops.turnover_event) AS events,
      (SELECT COUNT(*)::int FROM audit.event_log) AS audits
      FROM ops.employee e CROSS JOIN ops.user_account u CROSS JOIN ops.employee_offboarding_request r`)).rows[0];

    for (const [winner, loser] of [["approve", "reject"], ["reject", "approve"], ["approve", "approve"]]) {
      await reset();
      const request = await snapshot();
      // Hold the first transaction after locking while the second starts.
      let locked;
      const acquired = new Promise((resolve) => { locked = resolve; });
      let release;
      const gate = new Promise((resolve) => { release = resolve; });
      onLock = async () => { onLock = undefined; locked(); await gate; };
      const first = invoke(winner, request);
      await acquired;
      const second = invoke(loser, request);
      release();
      const results = await Promise.allSettled([first, second]);
      assert.equal(results[0].status, "fulfilled");
      assert.equal(results[1].status, "rejected");
      assert.equal(results[1].reason.getStatus(), 409);
      assert.deepEqual(await state(), {
        employment_status: winner === "approve" ? "terminated" : "active",
        is_active: winner !== "approve", request_status: winner === "approve" ? "approved" : "rejected",
        events: winner === "approve" ? 1 : 0, audits: 1,
      });
      console.log(`PASS: ${winner} wins against concurrent ${loser}, loser gets 409`);
    }

    await reset();
    const old = await snapshot();
    await invoke("reject", old);
    const resubmit = (request) => repository.resubmitOffboardingRequest({ request, actorUserId: id.actor,
      companyId: id.company, regionId: id.region, storeId: id.store, employeeId: id.employee,
      terminationDate: "2026-09-11", terminationReason: "resignation", requestReason: "Corrected date" });
    const rejected = await snapshot();
    const resubmits = await Promise.allSettled([resubmit(rejected), resubmit(rejected)]);
    assert.equal(resubmits.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(resubmits.find((result) => result.status === "rejected").reason.getStatus(), 409);
    await assert.rejects(invoke("approve", old), (error) => error.getStatus() === 409);
    assert.deepEqual(await state(), { employment_status: "active", is_active: true, request_status: "pending_hr_approval", events: 0, audits: 2 });
    console.log("PASS: concurrent resubmits have one winner; old approval cannot approve the revised pending request");

    await reset();
    failAudit = true;
    await assert.rejects(invoke("approve", await snapshot()), /fixture audit failure/);
    failAudit = false;
    assert.deepEqual(await state(), { employment_status: "active", is_active: true, request_status: "pending_hr_approval", events: 0, audits: 0 });
    console.log("PASS: audit failure rolls back employee, access fixture, request and turnover together");
  } finally {
    if (created) await pool.query(`DROP SCHEMA ${schema} CASCADE`);
    await pool.end();
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
