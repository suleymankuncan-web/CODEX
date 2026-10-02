import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { SalesTargetIncentiveCorrectionRepository } from "./sales-target-incentive-correction.repository";
import { SalesTargetIncentiveManagerPackageReadRepository } from "./sales-target-incentive-manager-package-read.repository";
import { StoreMonthlyReportPackageRepository } from "./store-monthly-report-package.repository";
import { hrPackagesSql, hrRowsSql } from "./incentive-hr-handoff.sql";
import { hrSnapshotVersion, type HrPackageRow, type HrExportRow } from "./incentive-hr-handoff.repository";
import { SalesTargetIncentiveApiService } from "../application/sales-target-incentive-api.service";
import type { SalesTargetIncentiveParticipantProjection } from "../application/sales-target-incentive-read-model.service";
import { packageFinancialReadSql, packageFinancialVersion, type PackageFinancialRow } from "./incentive-package-financial-version";

const postgresUrl = process.env.INCENTIVE_PARTICIPATION_POSTGRES_URL;
const describePostgres = postgresUrl ? describe : describe.skip;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const exclusion = (n: number, reasonNote = "Frozen reason") => ({ employeeId: id(n), displayName: "Synthetic person", positionCode: "CASHIER", reasonNote });

describePostgres("financial participation PostgreSQL boundaries", () => {
  const databaseName = `incentive_finance_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  let admin: Pool;
  let pool: Pool;
  let created = false;
  let corrections: SalesTargetIncentiveCorrectionRepository;
  let packages: SalesTargetIncentiveManagerPackageReadRepository;
  let monthlySql: string;

  beforeAll(async () => {
    admin = new Pool({ connectionString: postgresUrl });
    await admin.query(`CREATE DATABASE ${databaseName}`);
    created = true;
    const url = new URL(postgresUrl!);
    url.pathname = `/${databaseName}`;
    pool = new Pool({ connectionString: url.toString() });
    corrections = new SalesTargetIncentiveCorrectionRepository(pool as never);
    packages = new SalesTargetIncentiveManagerPackageReadRepository(pool as never);
    const capture = jest.fn(async (sql: string) => { monthlySql = sql; return { rows: [] }; });
    await new StoreMonthlyReportPackageRepository({ query: capture } as never).getStoreMonthlyReportPackageRows({
      periodStart: "2026-05-01", periodEnd: "2026-05-31", companyIds: [id(1)], regionIds: [], storeIds: [],
    });
    await pool.query(`
      CREATE SCHEMA ops; CREATE SCHEMA rpt;
      CREATE FUNCTION ops.store_was_company_during(uuid,date,date) RETURNS boolean LANGUAGE sql AS 'SELECT TRUE';
      CREATE TABLE ops.company (company_id uuid PRIMARY KEY, company_name text, status text);
      CREATE TABLE ops.store (store_id uuid PRIMARY KEY, company_id uuid, store_code text, store_name text, status text);
      CREATE TABLE ops.employee (employee_id uuid PRIMARY KEY, first_name text, last_name text, employment_status text, termination_date date);
      CREATE TABLE ops.user_account (user_id uuid PRIMARY KEY, employee_id uuid, username text, email text, is_active boolean, first_name text, last_name text);
      CREATE TABLE ops.role (role_id uuid PRIMARY KEY, role_code text);
      CREATE TABLE ops.user_role_assignment (user_id uuid, role_id uuid, start_at timestamptz, end_at timestamptz);
      CREATE TABLE ops.user_action_store_assignment (user_id uuid, store_id uuid, start_at timestamptz, end_at timestamptz);
      CREATE TABLE ops.sales_target_incentive_store_review (store_id uuid, period_key text, review_status text);
      CREATE TABLE ops.sales_target_incentive_region_package (sales_target_incentive_region_package_id uuid PRIMARY KEY,
        company_id uuid, period_key text, manager_user_id uuid, submitted_by_user_id uuid, package_scope text,
        package_status text, submitted_at timestamptz, reviewed_at timestamptz, reviewed_by_user_id uuid, review_note text);
      CREATE TABLE ops.sales_target_incentive_region_package_store (region_package_id uuid, store_id uuid, final_snapshot_id uuid,
        participation_revision_no integer NOT NULL DEFAULT 0, participation_exclusions_json jsonb NOT NULL DEFAULT '[]');
      CREATE TABLE ops.sales_target_incentive_participation_revision (company_id uuid DEFAULT '${id(1)}', store_id uuid, period_key text, final_snapshot_id uuid,
        revision_no integer, exclusions_json jsonb);
      CREATE TABLE ops.sales_target_incentive_close_run (sales_target_incentive_close_run_id uuid PRIMARY KEY, status text);
      CREATE TABLE rpt.sales_target_incentive_final_snapshot (sales_target_incentive_final_snapshot_id uuid PRIMARY KEY,
        company_id uuid, store_id uuid, period_key text, close_cutoff_at timestamptz, close_run_id uuid);
      CREATE TABLE rpt.sales_target_incentive_final_row (sales_target_incentive_final_row_id uuid PRIMARY KEY,
        final_snapshot_id uuid, employee_id uuid, participant_type text, position_code text, normalized_from_position_code text,
        rate_table_version text, target_amount numeric(18,2), actual_sales_amount numeric(18,2), achievement_pct numeric(18,4),
        applied_rate numeric(18,4), raw_earned_amount numeric(18,6), payable_amount numeric(18,2), final_amount numeric(18,2),
        correction_amount numeric(18,2), calculation_status text);
      CREATE TABLE ops.sales_target_incentive_projection_row (sales_target_incentive_projection_row_id uuid, participant_type text);
      CREATE TABLE ops.sales_target_incentive_adjustment (store_id uuid, employee_id uuid, period_key text, projection_row_id uuid,
        final_row_id uuid, adjustment_scope text, adjustment_type text, adjustment_amount numeric(18,2), status text, approved_at timestamptz);
      CREATE TABLE ops.sales_target_incentive_region_correction (sales_target_incentive_region_correction_id uuid PRIMARY KEY,
        region_package_id uuid, store_id uuid, final_row_id uuid, correction_status text, final_amount numeric(18,2), reason_note text);
      INSERT INTO ops.company VALUES ('${id(1)}','Synthetic company','active');
      INSERT INTO ops.store VALUES ('${id(2)}','${id(1)}','S1','Synthetic store','active');
      INSERT INTO ops.employee VALUES ('${id(10)}','First','Person','active',NULL), ('${id(11)}','Second','Person','active',NULL);
      INSERT INTO ops.user_account VALUES ('${id(3)}',NULL,'manager','manager@example.test',TRUE,'Fixture','Manager');
      INSERT INTO ops.role VALUES ('${id(4)}','REGION_MANAGER');
      INSERT INTO ops.user_role_assignment VALUES ('${id(3)}','${id(4)}','2020-01-01',NULL);
      INSERT INTO ops.user_action_store_assignment VALUES ('${id(3)}','${id(2)}','2020-01-01',NULL);
      INSERT INTO ops.sales_target_incentive_close_run VALUES ('${id(5)}','completed');
      INSERT INTO rpt.sales_target_incentive_final_snapshot VALUES
        ('${id(20)}','${id(1)}','${id(2)}','2026-05','2026-06-01','${id(5)}'),
        ('${id(21)}','${id(1)}','${id(2)}','2026-05','2026-06-02','${id(5)}');
      INSERT INTO rpt.sales_target_incentive_final_row VALUES
        ('${id(30)}','${id(20)}','${id(10)}','personnel','SALES_ASSOCIATE',NULL,'v1',1000,1000,100,.01,999,999,999,0,'projected'),
        ('${id(31)}','${id(21)}','${id(10)}','personnel','SALES_ASSOCIATE',NULL,'v1',1000,1000,100,.01,100,100,100,0,'projected'),
        ('${id(32)}','${id(21)}','${id(11)}','personnel','SALES_ASSOCIATE',NULL,'v1',1000,1000,100,.01,200,200,200,0,'projected');
      INSERT INTO ops.sales_target_incentive_adjustment VALUES
        ('${id(2)}','${id(10)}','2026-05',NULL,'${id(31)}','final_snapshot','manual_adjustment',20,'approved','2026-06-03'),
        ('${id(2)}','${id(10)}','2026-05',NULL,'${id(31)}','final_snapshot','manual_adjustment',-5,'approved','2026-06-04'),
        ('${id(2)}','${id(10)}','2026-05',NULL,'${id(30)}','final_snapshot','manual_adjustment',500,'approved','2026-06-04');
      ALTER TABLE rpt.sales_target_incentive_final_snapshot ADD COLUMN rule_version_code text DEFAULT 'synthetic-v1';
      ALTER TABLE ops.sales_target_incentive_adjustment ADD COLUMN rule_version_id uuid DEFAULT '${id(60)}';
      CREATE TABLE ops.sales_target_incentive_rule_version(sales_target_incentive_rule_version_id uuid,rule_version_code text);
      INSERT INTO ops.sales_target_incentive_rule_version VALUES('${id(60)}','sales-target-incentive-v2.0.0');
    `);
  });

  beforeEach(async () => {
    await pool.query(`TRUNCATE ops.sales_target_incentive_region_package, ops.sales_target_incentive_region_package_store,
      ops.sales_target_incentive_participation_revision, ops.sales_target_incentive_region_correction;
      INSERT INTO ops.sales_target_incentive_region_package VALUES
        ('${id(40)}','${id(1)}','2026-05',NULL,'${id(3)}','legacy_region','admin_approved','2026-06-03','2026-06-04','${id(3)}',NULL);
      INSERT INTO ops.sales_target_incentive_region_package_store VALUES ('${id(40)}','${id(2)}','${id(21)}',1,$json$${JSON.stringify([exclusion(11), exclusion(12)])}$json$);
      INSERT INTO ops.sales_target_incentive_participation_revision (store_id,period_key,final_snapshot_id,revision_no,exclusions_json) VALUES
        ('${id(2)}','2026-05','${id(21)}',2,$json$${JSON.stringify([exclusion(10, "Opposing draft")])}$json$);
    `);
  });

  afterAll(async () => {
    if (pool) await pool.end();
    if (created) await admin.query(`DROP DATABASE ${databaseName}`);
    if (admin) await admin.end();
  });

  const summaries = (mode: "draft" | "approved") => corrections.listApprovedAdjustmentSummaries({
    periodKey: "2026-05", storeIds: [id(2)], includeFinalRows: mode === "draft", participationMode: mode,
  });
  const hr = () => pool.query<HrExportRow>(hrRowsSql, ["2026-05", [id(1)]]);
  const report = async () => {
    const fragment = monthlySql.slice(monthlySql.indexOf("incentive_state AS ("), monthlySql.indexOf("workforce_norm_state AS ("));
    return (await pool.query(`WITH scoped_stores AS (SELECT '${id(2)}'::uuid store_id, '${id(1)}'::uuid company_id),
      ${fragment} financial AS (SELECT * FROM incentive_state) SELECT * FROM financial`, ["2026-05-01"])).rows[0];
  };

  it("keeps raw latest-final amounts intact while selecting the actor's exact source choices", async () => {
    const draft = await summaries("draft");
    const approved = await summaries("approved");
    expect(draft).toHaveLength(2);
    expect(draft.find(row => row.employee_id === id(10))).toMatchObject({ final_amount: "100.00", adjustment_amount: "15.00",
      final_snapshot_id: id(21), participation: { included: false, revisionNo: 2, source: "draft" } });
    expect(approved.find(row => row.employee_id === id(10))?.participation?.included).toBe(true);
    expect(approved.find(row => row.employee_id === id(11))).toMatchObject({ participation_only: true,
      participation: { included: false, revisionNo: 1, source: "approved" } });
  });

  it("never revives older matching-source draft decisions after a later global revision on another source", async () => {
    await pool.query(`INSERT INTO ops.sales_target_incentive_participation_revision (store_id,period_key,final_snapshot_id,revision_no,exclusions_json)
      VALUES ($1,'2026-05',$2,3,$3)`, [id(2), id(20), JSON.stringify([exclusion(11)])]);
    const rows = await summaries("draft");
    expect(rows.every(row => row.participation?.included && row.participation.revisionNo === 0)).toBe(true);
  });

  it("preserves own/store projection-only approved correction money despite a different final snapshot", async () => {
    await pool.query(`INSERT INTO ops.sales_target_incentive_projection_row VALUES ('${id(90)}','personnel');
      INSERT INTO ops.sales_target_incentive_adjustment VALUES
        ('${id(2)}','${id(11)}','2026-05','${id(90)}',NULL,'projection','correction',20,'approved','2026-05-31');
      UPDATE rpt.sales_target_incentive_final_row SET final_amount=220 WHERE sales_target_incentive_final_row_id='${id(32)}';
      UPDATE ops.sales_target_incentive_region_package_store SET participation_revision_no=0,participation_exclusions_json='[]';`);
    try {
      const summary = (await summaries("approved")).find(row => row.employee_id === id(11))!;
      expect(summary).toMatchObject({ correction_amount: "20.00", final_amount: null, participation_only: false,
        participation: { included: true, finalSnapshotId: id(21) } });
      const participant: SalesTargetIncentiveParticipantProjection = {
        participantType: "personnel", employeeId: id(11), displayName: "Second Person", positionCode: "SALES_ASSOCIATE",
        userId: null, assignmentId: null, assignmentStartedOn: null, assignmentEndedOn: null, positionId: null,
        normalizedFromPositionCode: null, targetReferenceId: null, targetAmount: "1000", actualAmount: "1000",
        source: { storeTargetRequestId: null, storeNetSalesSourceBatchId: null, storeNetSalesImportBatchId: null, personnelSalesSourceBatchId: null, personnelSalesImportBatchId: null },
        calculation: { status: "projected", blockedReason: null, excludedReason: null, ruleVersionCode: "sales-target-incentive-v2.0.0",
          rateTableVersion: "personnel-sales-target-v1.0.0", positionCode: "SALES_ASSOCIATE", normalizedFromPositionCode: null,
          storeAchievementPct: "100", storeGatePassed: true, achievementPct: "100", personalRateBeforeGate: "0.01", rate: "0.01", rawEarnedAmount: "100.000000", payableAmount: "100.00" },
      };
      const api = new SalesTargetIncentiveApiService({} as never, {} as never, {} as never, {} as never, {} as never);
      expect(api["toApiRow"](id(2), participant, summary, { regionWorkflow: null, reviewsByStoreId: new Map(), correctionsByRowKey: new Map() }))
        .toMatchObject({ payableAmount: "100.00", correctionAmount: "20.00", finalAmount: "120.00", calculatedFinalAmount: "120.00" });
    } finally {
      await pool.query(`DELETE FROM ops.sales_target_incentive_adjustment WHERE projection_row_id='${id(90)}';
        DELETE FROM ops.sales_target_incentive_projection_row WHERE sales_target_incentive_projection_row_id='${id(90)}';
        UPDATE rpt.sales_target_incentive_final_row SET final_amount=200 WHERE sales_target_incentive_final_row_id='${id(32)}'`);
    }
  });

  it("GET financial version equals the transaction-read version and binds reasons for norm-only exclusions", async () => {
    const listed = (await packages.list({ periodKey: "2026-05", companyIds: [id(1)] }))[0];
    const lockedRead = (await pool.query<PackageFinancialRow>(packageFinancialReadSql, [id(40)])).rows[0];
    expect(listed.financial_version).toMatch(/^[a-f0-9]{64}$/);
    expect(listed.financial_version).toBe(packageFinancialVersion("2026-05", lockedRead));
    const changed = { ...lockedRead, store_snapshots: structuredClone(lockedRead.store_snapshots!) };
    changed.store_snapshots[0].exclusions.find(person => person.employeeId === id(12))!.reasonNote = "Reason-only edit";
    expect(packageFinancialVersion("2026-05", changed)).not.toBe(listed.financial_version);
  });

  it("HR ignores the opposing draft and includes approved adjustments only for frozen included people", async () => {
    const rows = (await hr()).rows;
    expect(rows.map(row => [row.employee_id, row.final_amount])).toEqual([[id(10), "115.00"]]);
    expect(rows[0].payable_amount).toBe("100.00");
    expect(rows[0].manager_user_id).toBe(id(3));
  });

  it("frozen no-final-row reasons and revisions are present in the real HR hash input", async () => {
    const read = async () => ({ packages: (await pool.query<HrPackageRow>(hrPackagesSql, ["2026-05", [id(1)]])).rows, rows: (await hr()).rows, deliveries: [] });
    const snapshot = await read();
    expect(snapshot.packages[0].frozen_participation?.[0].exclusions).toContainEqual(exclusion(12));
    const version = hrSnapshotVersion("2026-05", snapshot, []);
    await pool.query(`UPDATE ops.sales_target_incentive_region_package_store SET participation_revision_no=3,
      participation_exclusions_json=$1`, [JSON.stringify([exclusion(11), exclusion(12, "Reason-only choice update")])]);
    expect(hrSnapshotVersion("2026-05", await read(), [])).not.toBe(version);
  });

  it("submitted confirmation uses frozen exclusions and absolute submitted corrections, not draft choices", async () => {
    await pool.query(`UPDATE ops.sales_target_incentive_region_package SET package_status='submitted';
      INSERT INTO ops.sales_target_incentive_region_correction VALUES
      ('${id(50)}','${id(40)}','${id(2)}','${id(31)}','submitted',150,'Included correction'),
      ('${id(51)}','${id(40)}','${id(2)}','${id(32)}','submitted',350,'Excluded correction');`);
    const result = (await packages.list({ periodKey: "2026-05", companyIds: [id(1)] }))[0];
    expect(result.frozen_total_amount).toBe("150.00");
    expect(result.store_snapshots).toEqual([{ storeId: id(2), finalSnapshotId: id(21), participationRevisionNo: 1, exclusions: [exclusion(11), exclusion(12)] }]);
    expect((await hr()).rows).toEqual([]);
  });

  it("monthly report uses only the latest snapshot plus approved adjustments and approved frozen exclusions", async () => {
    expect((await report()).incentive_total_amount).toBe("115.00");
    await pool.query(`UPDATE ops.sales_target_incentive_region_package SET package_status='submitted'`);
    expect((await report()).incentive_total_amount).toBe("315.00");
    await pool.query(`UPDATE ops.sales_target_incentive_region_package SET package_status='admin_approved';
      UPDATE ops.sales_target_incentive_region_package_store SET final_snapshot_id='${id(20)}'`);
    expect((await report()).incentive_total_amount).toBe("315.00");
  });

  it("legacy default metadata never receives today's draft exclusions", async () => {
    await pool.query(`UPDATE ops.sales_target_incentive_region_package_store SET participation_revision_no=0, participation_exclusions_json='[]'`);
    expect((await hr()).rows.map(row => row.final_amount)).toEqual(["115.00", "200.00"]);
    expect((await report()).incentive_total_amount).toBe("315.00");
    expect((await packages.list({ periodKey: "2026-05", companyIds: [id(1)] }))[0].frozen_total_amount).toBe("315.00");
  });

  it("all frozen exclusions yield zero approved summary/report and an empty HR export, not fabricated adjustments", async () => {
    await pool.query(`UPDATE ops.sales_target_incentive_region_package_store SET participation_exclusions_json=$1`, [JSON.stringify([exclusion(10), exclusion(11), exclusion(12)])]);
    expect((await hr()).rows).toEqual([]);
    expect((await report()).incentive_total_amount).toBe("0");
    expect((await packages.list({ periodKey: "2026-05", companyIds: [id(1)] }))[0].frozen_total_amount).toBe("0.00");
    expect((await pool.query(`SELECT COUNT(*)::int count FROM ops.sales_target_incentive_adjustment`)).rows[0].count).toBe(3);
  });

  it("preserves zero-net approved payments without resurrecting payable fallback", async () => {
    await pool.query(`INSERT INTO ops.sales_target_incentive_adjustment VALUES
      ('${id(2)}','${id(10)}','2026-05',NULL,'${id(31)}','final_snapshot','manual_adjustment',-115,'approved','2026-06-05')`);
    try {
      expect((await hr()).rows.map(row => row.final_amount)).toEqual(["0.00"]);
      expect((await report()).incentive_total_amount).toBe("0.00");
      expect((await packages.list({ periodKey: "2026-05", companyIds: [id(1)] }))[0].frozen_total_amount).toBe("0.00");
    } finally {
      await pool.query(`DELETE FROM ops.sales_target_incentive_adjustment WHERE adjustment_amount=-115`);
    }
  });

  it("isolates frozen choices by store even when the same employee has another store's final row", async () => {
    await pool.query(`INSERT INTO ops.store VALUES ('${id(6)}','${id(1)}','S2','Second synthetic store','active');
      INSERT INTO rpt.sales_target_incentive_final_snapshot (sales_target_incentive_final_snapshot_id,company_id,store_id,period_key,close_cutoff_at,close_run_id) VALUES ('${id(22)}','${id(1)}','${id(6)}','2026-05','2026-06-02','${id(5)}');
      INSERT INTO rpt.sales_target_incentive_final_row SELECT '${id(33)}','${id(22)}',employee_id,participant_type,position_code,
        normalized_from_position_code,rate_table_version,target_amount,actual_sales_amount,achievement_pct,applied_rate,
        raw_earned_amount,payable_amount,50,correction_amount,calculation_status
        FROM rpt.sales_target_incentive_final_row WHERE sales_target_incentive_final_row_id='${id(32)}';
      INSERT INTO ops.sales_target_incentive_region_package_store (region_package_id,store_id,final_snapshot_id)
        VALUES ('${id(40)}','${id(6)}','${id(22)}');`);
    try {
      expect((await hr()).rows.map(row => [row.store_id, row.employee_id, row.final_amount]))
        .toEqual([[id(2), id(10), "115.00"], [id(6), id(11), "50.00"]]);
      expect((await packages.list({ periodKey: "2026-05", companyIds: [id(1)] }))[0].frozen_total_amount).toBe("165.00");
    } finally {
      await pool.query(`DELETE FROM ops.sales_target_incentive_region_package_store WHERE store_id='${id(6)}';
        DELETE FROM rpt.sales_target_incentive_final_row WHERE final_snapshot_id='${id(22)}';
        DELETE FROM rpt.sales_target_incentive_final_snapshot WHERE store_id='${id(6)}';
        DELETE FROM ops.store WHERE store_id='${id(6)}';`);
    }
  });
});
