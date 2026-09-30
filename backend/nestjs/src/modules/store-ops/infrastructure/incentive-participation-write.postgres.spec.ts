import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { resolve } from "path";
import { Pool } from "pg";
import { SalesTargetIncentiveParticipationRepository } from "./sales-target-incentive-participation.repository";

const url = process.env.INCENTIVE_PARTICIPATION_POSTGRES_URL;
const describePostgres = url ? describe : describe.skip;
const id = (suffix: string) => `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;
const input = { period: "2026-05", storeId: id("201"), employeeId: id("801"), included: false,
  reasonNote: "Approved exclusion", expectedRevision: 0, expectedSnapshotId: id("401"), actorUserId: id("901") };

describePostgres("participation append/freeze PostgreSQL proof", () => {
  const name = `incentive_choice_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  let admin: Pool;
  let pool: Pool;
  let created = false;
  let repository: SalesTargetIncentiveParticipationRepository;
  beforeAll(async () => {
    admin = new Pool({ connectionString: url });
    await admin.query(`CREATE DATABASE ${name}`);
    created = true;
    const connection = new URL(url!); connection.pathname = `/${name}`;
    pool = new Pool({ connectionString: connection.toString() });
    repository = new SalesTargetIncentiveParticipationRepository({ withTransaction: async (work: (client: unknown) => Promise<unknown>) => {
      const client = await pool.connect();
      try { await client.query("BEGIN"); const value = await work(client); await client.query("COMMIT"); return value; }
      catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
    } } as never);
    await pool.query(`
      CREATE SCHEMA ops; CREATE SCHEMA rpt; CREATE SCHEMA audit;
      CREATE TABLE ops.company (company_id uuid PRIMARY KEY,status text);
      CREATE TABLE ops.store (store_id uuid PRIMARY KEY,company_id uuid,status text,store_type text);
      CREATE TABLE ops.user_account (user_id uuid PRIMARY KEY,is_active boolean);
      CREATE TABLE ops.role (role_id uuid PRIMARY KEY,role_code text);
      CREATE TABLE ops.user_role_assignment (user_id uuid,role_id uuid,start_at timestamptz,end_at timestamptz);
      CREATE TABLE ops.user_action_store_assignment (user_id uuid,store_id uuid,start_at timestamptz,end_at timestamptz);
      CREATE TABLE ops.employee (employee_id uuid PRIMARY KEY,first_name text,last_name text,external_employee_ref text);
      CREATE TABLE ops.position (position_id uuid PRIMARY KEY,position_code text);
      CREATE TABLE ops.employee_assignment_history (employee_id uuid,store_id uuid,position_id uuid,is_primary_assignment boolean,start_date date,end_date date,created_at timestamptz,assignment_id uuid);
      CREATE TABLE rpt.sales_target_incentive_final_snapshot (sales_target_incentive_final_snapshot_id uuid PRIMARY KEY,company_id uuid,store_id uuid,period_key char(7),close_cutoff_at timestamptz);
      CREATE TABLE rpt.sales_target_incentive_final_row (final_snapshot_id uuid,employee_id uuid,position_code text,final_amount numeric(18,2));
      CREATE TABLE ops.sales_target_incentive_store_review (store_id uuid,period_key char(7),review_status text,reviewed_by_user_id uuid,reviewed_at timestamptz,updated_at timestamptz);
      CREATE TABLE ops.sales_target_incentive_region_package (sales_target_incentive_region_package_id uuid PRIMARY KEY,period_key char(7),package_status text);
      CREATE TABLE ops.sales_target_incentive_region_package_store (region_package_id uuid REFERENCES ops.sales_target_incentive_region_package(sales_target_incentive_region_package_id) ON DELETE CASCADE,company_id uuid,region_id uuid,store_id uuid,final_snapshot_id uuid,period_key char(7));
      CREATE TABLE audit.event_log (actor_user_id uuid,event_type text,entity_name text,entity_id uuid,scope_type text,company_id uuid,store_id uuid,metadata_json jsonb);
      CREATE FUNCTION ops.store_was_company_during(uuid,date,date) RETURNS boolean LANGUAGE sql AS $$SELECT TRUE$$;
      INSERT INTO ops.company VALUES ('${id("1")}','active');
      INSERT INTO ops.store VALUES ('${id("201")}','${id("1")}','active','company');
      INSERT INTO ops.user_account VALUES ('${id("901")}',TRUE);
      INSERT INTO ops.role VALUES ('${id("301")}','REGION_MANAGER');
      INSERT INTO ops.user_role_assignment VALUES ('${id("901")}','${id("301")}',NOW()-INTERVAL '1 day',NULL);
      INSERT INTO ops.user_action_store_assignment VALUES ('${id("901")}','${id("201")}',NOW()-INTERVAL '1 day',NULL);
      INSERT INTO ops.position VALUES ('${id("501")}','CASHIER');
      INSERT INTO ops.employee VALUES ('${id("801")}','Assigned','Cashier','staff-a'),('${id("802")}','Foreign','Person','staff-b');
      INSERT INTO ops.employee_assignment_history VALUES ('${id("801")}','${id("201")}','${id("501")}',TRUE,'2026-01-01',NULL,NOW(),'${id("701")}');
    `);
    await pool.query(readFileSync(resolve(process.cwd(), "../../db/migrations/094_incentive_participation_revision_v1.sql"), "utf8"));
  });
  beforeEach(async () => {
    await pool.query(`TRUNCATE ops.sales_target_incentive_participation_revision,audit.event_log,ops.sales_target_incentive_region_package_store,ops.sales_target_incentive_region_package,
      ops.sales_target_incentive_store_review,rpt.sales_target_incentive_final_row,rpt.sales_target_incentive_final_snapshot;
      UPDATE ops.user_action_store_assignment SET end_at=NULL;
      UPDATE ops.user_role_assignment SET end_at=NULL;
      UPDATE ops.employee_assignment_history SET end_date=NULL;
      INSERT INTO rpt.sales_target_incentive_final_snapshot VALUES ('${id("401")}','${id("1")}','${id("201")}','2026-05','2026-06-01');
      INSERT INTO ops.sales_target_incentive_store_review VALUES ('${id("201")}','2026-05','reviewed','${id("901")}',NOW(),NOW());`);
  });
  afterAll(async () => { if (pool) await pool.end(); if (created) await admin.query(`DROP DATABASE ${name}`); if (admin) await admin.end(); });

  it("records a targetless person's reason/revision and reopens review without inventing financial rows", async () => {
    await expect(repository.setParticipation(input)).resolves.toMatchObject({ revision: 1, included: false });
    expect((await pool.query("SELECT exclusions_json FROM ops.sales_target_incentive_participation_revision")).rows[0].exclusions_json).toEqual([{ employeeId: id("801"), displayName: "Assigned Cashier", positionCode: "CASHIER", reasonNote: "Approved exclusion" }]);
    expect((await pool.query("SELECT review_status,reviewed_by_user_id FROM ops.sales_target_incentive_store_review")).rows[0]).toEqual({ review_status: "pending_review", reviewed_by_user_id: null });
    expect((await pool.query("SELECT COUNT(*) FROM rpt.sales_target_incentive_final_row")).rows[0].count).toBe("0");
    expect((await pool.query("SELECT COUNT(*) FROM audit.event_log")).rows[0].count).toBe("1");
  });
  it("allows one of two concurrent same-version writers and rejects the stale request", async () => {
    const results = await Promise.allSettled([repository.setParticipation(input), repository.setParticipation(input)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect((await pool.query("SELECT COUNT(*) FROM ops.sales_target_incentive_participation_revision")).rows[0].count).toBe("1");
  });
  it("reincludes by appending, while preserving the original reason and raw amount", async () => {
    await pool.query(`INSERT INTO rpt.sales_target_incentive_final_row VALUES ('${id("401")}','${id("801")}','CASHIER',20)`);
    await repository.setParticipation(input);
    await repository.setParticipation({ ...input, included: true, expectedRevision: 1 });
    const rows = (await pool.query("SELECT revision_no,exclusions_json FROM ops.sales_target_incentive_participation_revision ORDER BY revision_no")).rows;
    expect(rows[0].exclusions_json).toHaveLength(1); expect(rows[1].exclusions_json).toEqual([]);
    expect((await pool.query("SELECT final_amount::text FROM rpt.sales_target_incentive_final_row")).rows[0].final_amount).toBe("20.00");
  });
  it.each(["submitted","admin_approved"])("rejects writes to %s frozen packages at API and database boundaries", async (status) => {
    await repository.setParticipation(input);
    await pool.query(`INSERT INTO ops.sales_target_incentive_region_package VALUES ($1,'2026-05',$2);
    `, [id("601"),status]);
    await pool.query(`INSERT INTO ops.sales_target_incentive_region_package_store (region_package_id,store_id,period_key) VALUES ($1,$2,'2026-05')`, [id("601"),id("201")]);
    await expect(repository.setParticipation({ ...input, included: true, expectedRevision: 1 })).rejects.toThrow("locked");
    await expect(pool.query(`INSERT INTO ops.sales_target_incentive_participation_revision(company_id,store_id,period_key,final_snapshot_id,revision_no,created_by_user_id) VALUES ($1,$2,'2026-05',$3,2,$4)`, [id("1"),id("201"),id("401"),id("901")])).rejects.toThrow("frozen");
  });
  it("requires fresh live role and action-store permissions", async () => {
    await pool.query("UPDATE ops.user_action_store_assignment SET end_at=NOW()-INTERVAL '1 second'");
    await expect(repository.setParticipation(input)).rejects.toThrow("no longer active");
    await pool.query("UPDATE ops.user_action_store_assignment SET end_at=NULL; UPDATE ops.user_role_assignment SET end_at=NOW()-INTERVAL '1 second'");
    await expect(repository.setParticipation(input)).rejects.toThrow("no longer active");
    expect((await pool.query("SELECT COUNT(*) FROM ops.sales_target_incentive_participation_revision")).rows[0].count).toBe("0");
  });
  it("rejects personnel outside the period roster and stale source IDs", async () => {
    await expect(repository.setParticipation({ ...input, employeeId: id("802") })).rejects.toThrow("not part");
    await expect(repository.setParticipation({ ...input, expectedSnapshotId: id("402") })).rejects.toThrow("source changed");
  });
  it("resets exclusions on a new source but retains a globally increasing revision audit", async () => {
    await repository.setParticipation(input);
    await pool.query(`INSERT INTO rpt.sales_target_incentive_final_snapshot VALUES ('${id("402")}','${id("1")}','${id("201")}','2026-05','2026-06-02')`);
    await expect(repository.setParticipation({ ...input, included: true, expectedSnapshotId: id("402"), expectedRevision: 0 })).resolves.toMatchObject({ revision: 2 });
    expect((await pool.query("SELECT exclusions_json FROM ops.sales_target_incentive_participation_revision WHERE revision_no=2")).rows[0].exclusions_json).toEqual([]);
  });
  it("retains an archived decision's identity after master roster edits", async () => {
    await repository.setParticipation(input);
    await pool.query("UPDATE ops.employee_assignment_history SET end_date='2026-05-15'");
    await expect(repository.setParticipation({ ...input, included: true, expectedRevision: 1 })).resolves.toMatchObject({ revision: 2 });
  });
  it("makes existing revisions immutable and rejects blank direct-SQL reasons", async () => {
    await repository.setParticipation(input);
    await expect(pool.query("UPDATE ops.sales_target_incentive_participation_revision SET exclusions_json='[]'")).rejects.toThrow("immutable");
    await expect(pool.query("DELETE FROM ops.sales_target_incentive_participation_revision")).rejects.toThrow("immutable");
    await expect(pool.query(`INSERT INTO ops.sales_target_incentive_participation_revision(company_id,store_id,period_key,final_snapshot_id,revision_no,exclusions_json,created_by_user_id) VALUES ($1,$2,'2026-05',$3,2,$4,$5)`, [id("1"),id("201"),id("401"),JSON.stringify([{employeeId:id("801"),reasonNote:"   "}]),id("901")])).rejects.toThrow("nonblank");
  });

  it.each(["submitted","admin_approved"])("guards copied revision and source metadata for %s packages while returned copies can rebuild", async (status) => {
    await repository.setParticipation(input);
    await pool.query("INSERT INTO ops.sales_target_incentive_region_package VALUES ($1,'2026-05',$2)",[id("601"),status]);
    await pool.query(`INSERT INTO ops.sales_target_incentive_region_package_store
      (region_package_id,company_id,region_id,store_id,final_snapshot_id,period_key,participation_revision_no,participation_exclusions_json)
      SELECT $1,company_id,$2,store_id,final_snapshot_id,period_key,revision_no,exclusions_json FROM ops.sales_target_incentive_participation_revision`,[id("601"),id("101")]);
    await expect(pool.query("UPDATE ops.sales_target_incentive_region_package_store SET participation_revision_no=0,participation_exclusions_json='[]'")).rejects.toThrow("immutable");
    await expect(pool.query("UPDATE ops.sales_target_incentive_region_package_store SET final_snapshot_id=$1",[id("402")])).rejects.toThrow("immutable");
    await expect(pool.query("DELETE FROM ops.sales_target_incentive_region_package_store")).rejects.toThrow("immutable");
    await expect(pool.query("DELETE FROM ops.sales_target_incentive_region_package")).rejects.toThrow("immutable");
    expect((await pool.query("SELECT participation_revision_no FROM ops.sales_target_incentive_region_package_store")).rows[0].participation_revision_no).toBe(1);
    await pool.query("UPDATE ops.sales_target_incentive_region_package SET package_status='admin_returned'");
    await expect(pool.query("DELETE FROM ops.sales_target_incentive_region_package_store")).resolves.toMatchObject({ rowCount: 1 });
    expect((await pool.query("SELECT COUNT(*) FROM ops.sales_target_incentive_participation_revision")).rows[0].count).toBe("1");
  });

  it("read-only invariant overlay accepts exact copies and diagnoses sanitized mismatches", async () => {
    await repository.setParticipation(input);
    await pool.query("INSERT INTO ops.sales_target_incentive_region_package VALUES ($1,'2026-05','submitted')",[id("601")]);
    await pool.query(`INSERT INTO ops.sales_target_incentive_region_package_store
      (region_package_id,company_id,region_id,store_id,final_snapshot_id,period_key,participation_revision_no,participation_exclusions_json)
      SELECT $1,company_id,$2,store_id,final_snapshot_id,period_key,revision_no,exclusions_json FROM ops.sales_target_incentive_participation_revision`,[id("601"),id("101")]);
    const sql = readFileSync(resolve(process.cwd(),"../../db/preflight/incentive-participation-invariants-v1.sql"),"utf8");
    expect((await pool.query(sql)).rows.map(row => row.violation_count)).toEqual(["0","0"]);
    await pool.query("ALTER TABLE ops.sales_target_incentive_region_package_store DISABLE TRIGGER guard_incentive_package_participation_copy");
    try {
      await pool.query("UPDATE ops.sales_target_incentive_region_package_store SET participation_exclusions_json='[]'");
      const rows = (await pool.query(sql)).rows;
      expect(rows[1].violation_count).toBe("1");
      expect(rows[1].sample_refs).toHaveLength(1);
      expect(rows[1].sample_refs[0]).toMatch(/^[0-9a-f]{12}$/);
    } finally {
      await pool.query("ALTER TABLE ops.sales_target_incentive_region_package_store ENABLE TRIGGER guard_incentive_package_participation_copy");
    }
  });
});
