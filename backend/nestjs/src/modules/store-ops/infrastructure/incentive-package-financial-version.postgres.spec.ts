import { ConflictException, ForbiddenException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool, type PoolClient } from "pg";
import { SalesTargetIncentiveManagerPackageRepository } from "./sales-target-incentive-manager-package.repository";
import { SalesTargetIncentiveManagerPackageReadRepository } from "./sales-target-incentive-manager-package-read.repository";
import { SalesTargetIncentiveCorrectionRepository } from "./sales-target-incentive-correction.repository";

const postgresUrl = process.env.INCENTIVE_PARTICIPATION_POSTGRES_URL;
const describePostgres = postgresUrl ? describe : describe.skip;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const exclusions = [{ employeeId: id(11), displayName: "Norm-only person", positionCode: "CASHIER", reasonNote: "Frozen norm-only reason" }];
const moneyKey = `sales_target_incentive_adjustment:2026-05:${id(2)}:${id(10)}:personnel:final_snapshot`;
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; };

describePostgres("package financial version transaction boundary", () => {
  const name = `incentive_version_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  let admin: Pool;
  let pool: Pool;
  let created = false;
  const transactionDatabase = (hooks?: { beforeQuery?: (sql: string, parameters: unknown[] | undefined, client: PoolClient) => Promise<void>; afterWork?: () => Promise<void> }) => ({
    withTransaction: async (work: (client: unknown) => Promise<unknown>) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await work({ query: async (sql: string, parameters?: unknown[]) => {
          await hooks?.beforeQuery?.(sql, parameters, client);
          return client.query(sql, parameters);
        } });
        await hooks?.afterWork?.();
        await client.query("COMMIT");
        return result;
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
    },
  });
  const repository = () => new SalesTargetIncentiveManagerPackageRepository(transactionDatabase() as never);
  const summary = async () => (await new SalesTargetIncentiveManagerPackageReadRepository(pool as never).list({ periodKey: "2026-05", companyIds: [id(1)] }))[0];
  const review = async (decision: "admin_approved" | "admin_returned", version?: string, repo = repository()) => repo.review({
    periodKey: "2026-05", packageId: id(40), submittedAt: "2026-06-03T00:00:00Z", actorUserId: id(4), companyIds: [id(1)],
    decision, reviewNote: decision === "admin_returned" ? "Please correct" : null, ...(version !== undefined ? { expectedFinancialVersion: version } : {}),
  });
  const correct = (repo = new SalesTargetIncentiveCorrectionRepository(transactionDatabase() as never)) => repo.applyAdminFinalRowCorrection({
    periodKey: "2026-05", storeId: id(2), employeeId: id(10), participantType: "personnel", adjustmentAmount: "50.00",
    reasonCode: "synthetic_proof", reasonNote: "Permitted amount-only change", actorUserId: id(5),
    readScope: { companyIds: [id(1)], regionIds: [], storeIds: [], allowGlobalScope: false },
  });

  beforeAll(async () => {
    admin = new Pool({ connectionString: postgresUrl });
    await admin.query(`CREATE DATABASE ${name}`); created = true;
    const url = new URL(postgresUrl!); url.pathname = `/${name}`;
    pool = new Pool({ connectionString: url.toString() });
    await pool.query(`
      CREATE SCHEMA ops; CREATE SCHEMA rpt; CREATE SCHEMA audit;
      CREATE FUNCTION ops.store_was_company_during(uuid,date,date) RETURNS boolean LANGUAGE sql AS 'SELECT TRUE';
      CREATE TABLE ops.company (company_id uuid PRIMARY KEY,company_name text,status text);
      CREATE TABLE ops.store (store_id uuid PRIMARY KEY,company_id uuid,region_id uuid,status text);
      CREATE TABLE ops.employee (employee_id uuid PRIMARY KEY,first_name text,last_name text);
      CREATE TABLE ops.user_account (user_id uuid PRIMARY KEY,employee_id uuid,username text,email text,is_active boolean);
      CREATE TABLE ops.role (role_id uuid PRIMARY KEY,role_code text,role_scope_type text);
      CREATE TABLE ops.user_role_assignment (user_role_assignment_id uuid DEFAULT gen_random_uuid(),user_id uuid,role_id uuid,company_id uuid,
        scope_type text,incentive_approval boolean,start_at timestamptz,end_at timestamptz);
      CREATE TABLE ops.user_action_store_assignment (user_id uuid,store_id uuid,start_at timestamptz,end_at timestamptz);
      CREATE TABLE rpt.sales_target_incentive_final_snapshot (sales_target_incentive_final_snapshot_id uuid PRIMARY KEY,
        company_id uuid,region_id uuid,store_id uuid,period_key char(7),close_cutoff_at timestamptz,rule_version_id uuid);
      CREATE TABLE rpt.sales_target_incentive_final_row (sales_target_incentive_final_row_id uuid PRIMARY KEY,
        final_snapshot_id uuid,employee_id uuid,participant_type text,final_amount numeric(18,2),created_at timestamptz);
      CREATE TABLE ops.sales_target_incentive_store_review (sales_target_incentive_store_review_id uuid PRIMARY KEY,
        company_id uuid,region_id uuid,store_id uuid,period_key char(7),final_snapshot_id uuid,review_status text,
        reviewed_by_user_id uuid,reviewed_at timestamptz,updated_at timestamptz);
      CREATE TABLE ops.sales_target_incentive_region_package (sales_target_incentive_region_package_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid,region_id uuid,package_scope text,manager_user_id uuid,period_key char(7),period_timezone text,package_status text,
        submitted_by_user_id uuid,submitted_at timestamptz,submission_note text,reviewed_by_user_id uuid,reviewed_at timestamptz,review_note text,updated_at timestamptz);
      CREATE UNIQUE INDEX manager_package_unique ON ops.sales_target_incentive_region_package(company_id,period_key,manager_user_id) WHERE package_scope='manager_assignment';
      CREATE TABLE ops.sales_target_incentive_region_package_store (region_package_id uuid,store_review_id uuid,company_id uuid,region_id uuid,
        store_id uuid,final_snapshot_id uuid,period_key char(7),reviewed_by_user_id uuid,reviewed_at timestamptz);
      CREATE TABLE ops.sales_target_incentive_projection_row (sales_target_incentive_projection_row_id uuid,participant_type text);
      CREATE TABLE ops.sales_target_incentive_adjustment (sales_target_incentive_adjustment_id uuid DEFAULT gen_random_uuid(),
        company_id uuid,region_id uuid,store_id uuid,employee_id uuid,projection_row_id uuid,final_row_id uuid,rule_version_id uuid,
        period_key char(7),period_timezone text,adjustment_scope text,adjustment_type text,adjustment_amount numeric(18,2),
        before_amount numeric(18,2),after_amount numeric(18,2),reason_code text,reason_note text,status text,
        created_by_user_id uuid,approved_by_user_id uuid,approved_at timestamptz,evidence jsonb,updated_at timestamptz);
      CREATE TABLE ops.sales_target_incentive_region_correction (sales_target_incentive_region_correction_id uuid DEFAULT gen_random_uuid(),
        company_id uuid,region_id uuid,store_id uuid,employee_id uuid,participant_type text,final_row_id uuid,region_package_id uuid,
        period_key char(7),period_timezone text,target_scope text,correction_status text,final_amount numeric(18,2),reason_note text,
        created_by_user_id uuid,submitted_by_user_id uuid,submitted_at timestamptz,reviewed_by_user_id uuid,reviewed_at timestamptz,
        review_note text,approved_adjustment_id uuid,updated_at timestamptz);
      CREATE TABLE audit.event_log (actor_user_id uuid,event_type text,entity_name text,entity_id uuid,scope_type text,
        company_id uuid,region_id uuid,store_id uuid,metadata_json jsonb);
      INSERT INTO ops.company VALUES ('${id(1)}','Synthetic','active');
      INSERT INTO ops.store VALUES ('${id(2)}','${id(1)}','${id(6)}','active');
      INSERT INTO ops.employee VALUES ('${id(10)}','Included','Person'),('${id(11)}','Norm-only','Person');
      INSERT INTO ops.user_account VALUES ('${id(3)}',NULL,'manager','manager@example.test',TRUE),
        ('${id(4)}',NULL,'viewer','viewer@example.test',TRUE),('${id(5)}',NULL,'admin','admin@example.test',TRUE);
      INSERT INTO ops.role VALUES ('${id(70)}','REGION_MANAGER','region'),('${id(71)}','REPORT_VIEWER','company');
      INSERT INTO ops.user_role_assignment(user_id,role_id,company_id,scope_type,incentive_approval,start_at)
        VALUES ('${id(3)}','${id(70)}','${id(1)}','company',FALSE,'2020-01-01'),('${id(4)}','${id(71)}','${id(1)}','company',TRUE,'2020-01-01');
      INSERT INTO ops.user_action_store_assignment VALUES ('${id(3)}','${id(2)}','2020-01-01',NULL);
      INSERT INTO rpt.sales_target_incentive_final_snapshot VALUES ('${id(20)}','${id(1)}','${id(6)}','${id(2)}','2026-05','2026-06-01','${id(60)}');
      INSERT INTO rpt.sales_target_incentive_final_row VALUES ('${id(30)}','${id(20)}','${id(10)}','personnel',100,NOW());
    `);
    await pool.query(readFileSync(resolve(process.cwd(), "../../db/migrations/094_incentive_participation_revision_v1.sql"), "utf8"));
  });
  beforeEach(async () => {
    await pool.query(`TRUNCATE ops.sales_target_incentive_participation_revision,ops.sales_target_incentive_region_package_store,
      ops.sales_target_incentive_region_package,ops.sales_target_incentive_store_review,ops.sales_target_incentive_adjustment,
      ops.sales_target_incentive_region_correction,audit.event_log;
      UPDATE ops.user_role_assignment SET end_at=NULL,incentive_approval=(user_id='${id(4)}');
      UPDATE ops.user_action_store_assignment SET end_at=NULL;
      INSERT INTO ops.sales_target_incentive_store_review VALUES ('${id(50)}','${id(1)}','${id(6)}','${id(2)}','2026-05','${id(20)}','reviewed','${id(3)}',NOW(),NOW());
      INSERT INTO ops.sales_target_incentive_participation_revision(company_id,store_id,period_key,final_snapshot_id,revision_no,exclusions_json,created_by_user_id)
        VALUES ('${id(1)}','${id(2)}','2026-05','${id(20)}',1,$json$${JSON.stringify(exclusions)}$json$,'${id(3)}');
      UPDATE ops.sales_target_incentive_store_review SET review_status='reviewed',reviewed_by_user_id='${id(3)}',reviewed_at=NOW();
      INSERT INTO ops.sales_target_incentive_region_package
        (sales_target_incentive_region_package_id,company_id,manager_user_id,package_scope,period_key,package_status,submitted_by_user_id,submitted_at)
        VALUES ('${id(40)}','${id(1)}','${id(3)}','manager_assignment','2026-05','submitted','${id(3)}','2026-06-03');
      INSERT INTO ops.sales_target_incentive_region_package_store(region_package_id,store_review_id,company_id,region_id,store_id,final_snapshot_id,
        period_key,reviewed_by_user_id,reviewed_at,participation_revision_no,participation_exclusions_json)
        VALUES ('${id(40)}','${id(50)}','${id(1)}','${id(6)}','${id(2)}','${id(20)}','2026-05','${id(3)}',NOW(),1,$json$${JSON.stringify(exclusions)}$json$);`);
  });
  afterAll(async () => { if (pool) await pool.end(); if (created) await admin.query(`DROP DATABASE ${name}`); if (admin) await admin.end(); });

  it.each(["admin_approved", "admin_returned"] as const)("rejects amount-only changes for %s with unchanged package/source/choice identity", async decision => {
    const before = await summary();
    expect(before.frozen_total_amount).toBe("100.00");
    await expect(correct()).resolves.toMatchObject({ afterAmount: "150.00" });
    const after = await summary();
    expect(after.submitted_at).toBe(before.submitted_at);
    expect(after.store_snapshots).toEqual(before.store_snapshots);
    expect(after.frozen_total_amount).toBe("150.00");
    await expect(review(decision, before.financial_version!)).rejects.toThrow(ConflictException);
    expect((await pool.query("SELECT package_status FROM ops.sales_target_incentive_region_package")).rows[0].package_status).toBe("submitted");
  });

  it("waits for an actual in-flight correction writer then rejects the stale confirmation", async () => {
    const before = await summary();
    const writerReady = deferred(), releaseWriter = deferred(), reviewerWaiting = deferred();
    let reviewerPid = 0;
    const writerRepo = new SalesTargetIncentiveCorrectionRepository(transactionDatabase({ afterWork: async () => { writerReady.resolve(); await releaseWriter.promise; } }) as never);
    const reviewerRepo = new SalesTargetIncentiveManagerPackageRepository(transactionDatabase({ beforeQuery: async (sql, parameters, client) => {
      if (sql.includes("pg_advisory_xact_lock") && parameters?.[0] === moneyKey) {
        reviewerPid = (await client.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
        reviewerWaiting.resolve();
      }
    } }) as never);
    const writing = correct(writerRepo);
    await Promise.race([writerReady.promise, writing.then(() => { throw new Error("Writer completed before the lock barrier"); })]);
    const reviewing = review("admin_approved", before.financial_version!, reviewerRepo);
    const outcome = reviewing.then(() => "approved", error => error);
    try {
      await Promise.race([reviewerWaiting.promise, reviewing.then(() => { throw new Error("Review completed before the lock barrier"); })]);
      let blockers: number[] = [];
      for (let attempt = 0; attempt < 30 && !blockers.length; attempt++) {
        blockers = (await pool.query("SELECT pg_blocking_pids($1) AS blockers", [reviewerPid])).rows[0].blockers;
        if (!blockers.length) await new Promise(done => setTimeout(done, 10));
      }
      expect(blockers.length).toBeGreaterThan(0);
      releaseWriter.resolve();
      await writing;
      expect(await outcome).toBeInstanceOf(ConflictException);
      expect((await summary()).frozen_total_amount).toBe("150.00");
    } finally { releaseWriter.resolve(); await Promise.allSettled([writing, reviewing]); }
  });

  it.each(["admin_approved", "admin_returned"] as const)("requires a version for recorded participation on %s", async decision => {
    await expect(review(decision)).rejects.toThrow(ConflictException);
    await expect(review(decision, (await summary()).financial_version!)).resolves.toMatchObject({ package_status: decision });
  });

  it("retains optional-version compatibility only for legacy zero/empty packages and checks supplied versions", async () => {
    await pool.query(`UPDATE ops.sales_target_incentive_region_package SET package_status='admin_returned';
      UPDATE ops.sales_target_incentive_region_package_store SET participation_revision_no=0,participation_exclusions_json='[]';
      UPDATE ops.sales_target_incentive_region_package SET package_status='submitted'`);
    await expect(review("admin_returned", "0".repeat(64))).rejects.toThrow(ConflictException);
    await expect(review("admin_returned")).resolves.toMatchObject({ package_status: "admin_returned" });
  });

  it("rebuilds a returned package before resubmission without deleting submitted frozen copies", async () => {
    await review("admin_returned", (await summary()).financial_version!);
    await expect(repository().submit({ companyId: id(1), periodKey: "2026-05", managerUserId: id(3), storeIds: [id(2)], submissionNote: "Resubmit" }))
      .resolves.toMatchObject({ package_status: "submitted" });
    expect((await summary()).store_snapshots).toEqual([{ storeId: id(2), finalSnapshotId: id(20), participationRevisionNo: 1, exclusions }]);
    await expect(pool.query("DELETE FROM ops.sales_target_incentive_region_package_store WHERE region_package_id=$1", [id(40)]))
      .rejects.toThrow("immutable");
  });

  it("still denies expired grants and submission self-approval", async () => {
    const version = (await summary()).financial_version!;
    await pool.query("UPDATE ops.user_role_assignment SET end_at=NOW()-INTERVAL '1 second' WHERE user_id=$1", [id(4)]);
    await expect(review("admin_approved", version)).rejects.toThrow(ForbiddenException);
    await expect(repository().review({ periodKey: "2026-05", packageId: id(40), submittedAt: null, actorUserId: id(3),
      companyIds: [id(1)], decision: "admin_approved", reviewNote: null, expectedFinancialVersion: version })).rejects.toThrow(ForbiddenException);
  });
});
