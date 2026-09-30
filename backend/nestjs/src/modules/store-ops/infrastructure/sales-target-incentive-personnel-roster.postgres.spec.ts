import { randomUUID } from "crypto";
import { Pool } from "pg";
import { SalesTargetIncentiveWorkspaceReadRepository } from "./sales-target-incentive-workspace-read.repository";

const postgresUrl = process.env.INCENTIVE_PARTICIPATION_POSTGRES_URL;
const describePostgres = postgresUrl ? describe : describe.skip;
const id = (suffix: string) => `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;

describePostgres("incentive norm roster PostgreSQL boundary", () => {
  const databaseName = `incentive_roster_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  let admin: Pool;
  let pool: Pool;
  let created = false;
  let repository: SalesTargetIncentiveWorkspaceReadRepository;

  beforeAll(async () => {
    admin = new Pool({ connectionString: postgresUrl });
    await admin.query(`CREATE DATABASE ${databaseName}`);
    created = true;
    const url = new URL(postgresUrl!);
    url.pathname = `/${databaseName}`;
    pool = new Pool({ connectionString: url.toString() });
    repository = new SalesTargetIncentiveWorkspaceReadRepository(pool as never);
    await pool.query(`
      CREATE SCHEMA ops;
      CREATE TABLE ops.store (store_id uuid PRIMARY KEY, company_id uuid, region_id uuid);
      CREATE TABLE ops.employee (employee_id uuid PRIMARY KEY, first_name text, last_name text,
        external_employee_ref text, employment_status text, termination_date date);
      CREATE TABLE ops.position (position_id uuid PRIMARY KEY, position_code text, job_family text);
      CREATE TABLE ops.employee_assignment_history (assignment_id uuid PRIMARY KEY, employee_id uuid,
        position_id uuid, store_id uuid, start_date date, end_date date, is_primary_assignment boolean, created_at timestamptz);
      CREATE TABLE ops.target_distribution_request (target_distribution_request_id uuid PRIMARY KEY,
        company_id uuid, region_id uuid, store_id uuid, request_month date, request_status text,
        approved_at timestamptz, updated_at timestamptz, created_at timestamptz);
      CREATE TABLE ops.personnel_target_reference (personnel_target_reference_id uuid PRIMARY KEY,
        employee_id uuid, store_id uuid, source_request_id uuid, period_start date, period_end date,
        target_type text, status text, target_value numeric(18,2));
      INSERT INTO ops.store VALUES ('${id("201")}','${id("1")}','${id("101")}'), ('${id("202")}','${id("2")}','${id("102")}');
      INSERT INTO ops.position VALUES ('${id("301")}','CASHIER','operations'), ('${id("302")}','WAREHOUSE_ASSOCIATE','operations');
      INSERT INTO ops.employee VALUES
        ('${id("801")}','Assigned','Cashier','staff-1','terminated','2026-10-31'),
        ('${id("802")}','Assigned','Warehouse','staff-2','active',NULL),
        ('${id("803")}','Foreign','Cashier','staff-3','active',NULL),
        ('${id("804")}','Future','Cashier','staff-4','active',NULL),
        ('${id("805")}','Former','Cashier','staff-5','terminated','2026-05-15');
      INSERT INTO ops.employee_assignment_history VALUES
        ('${id("901")}','${id("801")}','${id("301")}','${id("201")}','2026-01-01',NULL,TRUE,'2026-01-01'),
        ('${id("902")}','${id("802")}','${id("302")}','${id("201")}','2026-01-01',NULL,TRUE,'2026-01-01'),
        ('${id("903")}','${id("803")}','${id("301")}','${id("202")}','2026-01-01',NULL,TRUE,'2026-01-01'),
        ('${id("904")}','${id("804")}','${id("301")}','${id("201")}','2026-06-01',NULL,TRUE,'2026-06-01'),
        ('${id("905")}','${id("805")}','${id("301")}','${id("201")}','2026-01-01','2026-05-15',TRUE,'2026-01-01');
      INSERT INTO ops.target_distribution_request VALUES
        ('${id("401")}','${id("1")}','${id("101")}','${id("201")}','2026-05-01','approved','2026-04-01','2026-04-01','2026-04-01'),
        ('${id("402")}','${id("1")}','${id("101")}','${id("201")}','2026-05-01','approved','2026-04-02','2026-04-02','2026-04-02'),
        ('${id("403")}','${id("1")}','${id("101")}','${id("201")}','2026-05-01','draft',NULL,'2026-04-03','2026-04-03');
      INSERT INTO ops.personnel_target_reference VALUES
        ('${id("501")}','${id("802")}','${id("201")}','${id("401")}','2026-05-01','2026-05-31','monthly_sales_target','approved',100),
        ('${id("502")}','${id("802")}','${id("201")}','${id("402")}','2026-05-01','2026-05-31','monthly_sales_target','approved',200),
        ('${id("503")}','${id("802")}','${id("201")}','${id("403")}','2026-05-01','2026-05-31','monthly_sales_target','approved',400);
    `);
  });

  afterAll(async () => {
    if (pool) await pool.end();
    if (created) await admin.query(`DROP DATABASE ${databaseName}`);
    if (admin) await admin.end();
  });

  const read = () => repository.listPersonnelRoster({ storeIds: [id("201")], assignmentAsOfDate: "2026-05-31", periodStart: "2026-05-01", periodEnd: "2026-05-31" });

  it("keeps cashier and other norm positions visible, including a targetless employee who left after the month", async () => {
    const rows = await read();
    expect(rows.map((row) => row.employee_id)).toEqual([id("801"), id("802")]);
    expect(rows[0]).toMatchObject({ position_code: "CASHIER", target_amount: null, current_employment_status: "terminated", termination_date: "2026-10-31" });
    expect(rows[1]).toMatchObject({ position_code: "WAREHOUSE_ASSOCIATE", target_amount: "200.00" });
  });

  it("does not leak foreign stores or include future and already-ended assignments", async () => {
    const employees = (await read()).map((row) => row.employee_id);
    for (const employee of [id("803"), id("804"), id("805")]) expect(employees).not.toContain(employee);
  });

  it("does not require a target when the latest approved request has no matching person reference", async () => {
    await pool.query(`DELETE FROM ops.personnel_target_reference WHERE source_request_id=$1::uuid`, [id("402")]);
    const rows = await read();
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.target_amount === null)).toBe(true);
  });
});
