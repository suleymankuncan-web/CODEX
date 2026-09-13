import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readRankingStoreRange, readRankingRangeBenchmarks } from "./ranking-range-read";
import { readRankingPersonnelRange } from "./ranking-personnel-range-read";
import { readEmployeeTurkeyBenchmarks } from "./personnel-benchmark-read";
import { RankingReportingReadRepository } from "./ranking-reporting-read.repository";

// Explicit local fixture opt-in. Every write stays inside a newly created disposable database.
const container = process.env.RANKING_RANGE_POSTGRES_CONTAINER;
const integration = container ? describe : describe.skip;
integration("ranking daily physical aggregation (PostgreSQL)", () => {
  const databaseName = `ranking_range_fixture_${process.pid}_${randomUUID().slice(0, 8)}`;
  let created = false;
  const company = "00000000-0000-4000-8000-000000000001";
  const store = "00000000-0000-4000-8000-000000000002";
  const employee = "00000000-0000-4000-8000-000000000003";
  function psql(sql: string, database = databaseName) {
    return execFileSync("docker", ["exec", "-i", container!, "sh", "-c",
      `exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d ${database} -Atq`],
      { input: sql, encoding: "utf8", windowsHide: true }).trim();
  }
  const literal = (value: unknown): string => value == null ? "NULL"
    : Array.isArray(value) ? `ARRAY[${value.map(literal).join(",")}]::text[]`
    : `'${String(value).replace(/'/g, "''")}'`;
  const database = { query: async (sql: string, values: unknown[]) => {
    const query = sql.replace(/\$(\d+)/g, (_, index) => literal(values[Number(index) - 1]));
    const output = psql(`SELECT COALESCE(json_agg(result), '[]'::json) FROM (${query}) result`);
    return { rows: JSON.parse(output) };
  } };
  beforeAll(() => {
    psql(`CREATE DATABASE ${databaseName}`, "postgres");
    created = true;
    psql(`CREATE SCHEMA ops;
      CREATE TABLE ops.store(store_id uuid, company_id uuid, region_id uuid, store_name text, kpi_import_enabled boolean);
      CREATE TABLE ops.region(region_id uuid, region_name text);
      CREATE TABLE ops.kpi_definition(kpi_id int, kpi_code text, kpi_name text);
      CREATE TABLE ops.kpi_actual(kpi_id int, store_id uuid, employee_id uuid, company_id uuid, scope_type text, period_type text, period_start date, period_end date, actual_value numeric, source_type text);
      CREATE TABLE ops.kpi_target(kpi_id int, store_id uuid, scope_type text, period_type text, period_start date, period_end date, target_value numeric);
      CREATE TABLE ops.company_daily_kpi_store_gsm(store_id uuid, component_outcome_id int, business_date date, operation text, yes_customer_count int, total_customer_count int);
      CREATE TABLE ops.company_daily_kpi_component_outcome(component_outcome_id int, business_date date, operation text, status text, integration_source_id int);
      CREATE TABLE ops.user_action_store_assignment(store_id uuid, user_id uuid, start_at timestamptz, end_at timestamptz);
      CREATE TABLE ops.user_role_assignment(user_id uuid, role_id int, start_at timestamptz, end_at timestamptz);
      CREATE TABLE ops.role(role_id int, role_code text);
      CREATE TABLE ops.user_account(user_id uuid, employee_id uuid, username text, email text, is_active boolean);
      CREATE TABLE ops.employee(employee_id uuid, first_name text, last_name text);
      CREATE TABLE ops.employee_assignment_history(employee_id uuid, position_id int, assignment_status text, is_primary_assignment boolean, start_date date);
      CREATE TABLE ops.position(position_id int, position_code text);
      CREATE TABLE ops.personnel_target_reference(employee_id uuid, store_id uuid, target_value numeric, period_start date, period_end date, target_type text, status text);
      INSERT INTO ops.store VALUES ('${store}','${company}',NULL,'Fixture',true);
      INSERT INTO ops.employee VALUES ('${employee}','Fixture','Employee');
      INSERT INTO ops.kpi_definition VALUES (1,'NET_SALES','Sales'),(2,'ITEM_COUNT','Items'),(3,'TICKET_COUNT','Tickets'),(4,'FF','Traffic'),(5,'ATV','ATV'),(6,'UPT','UPT'),(7,'CR','CR'),(8,'TARGET_ACHIEVEMENT','HG'),(9,'gsm_approval','GSM');
      INSERT INTO ops.kpi_actual
        SELECT metric, '${store}', '${employee}', '${company}', scope, 'daily', day::date, day::date, value, 'company'
        FROM (VALUES (1,'2026-09-01',100::numeric),(2,'2026-09-01',2),(3,'2026-09-01',1),(4,'2026-09-01',10),
          (1,'2026-09-02',900),(2,'2026-09-02',30),(3,'2026-09-02',9),(4,'2026-09-02',30),
          (1,'2026-09-03',300),(4,'2026-09-03',100),
          (1,'2026-08-31',99999),(2,'2026-08-31',99999),(3,'2026-08-31',99999),
          (5,'2026-09-01',99999),(5,'2026-09-02',99999)) v(metric,day,value)
        CROSS JOIN (VALUES ('store'),('employee')) scopes(scope);
      INSERT INTO ops.kpi_target SELECT 1,'${store}','store','daily',day::date,day::date,value
        FROM (VALUES ('2026-09-01',200),('2026-09-02',800),('2026-09-03',300)) v(day,value);
      INSERT INTO ops.personnel_target_reference VALUES ('${employee}','${store}',30000,'2026-09-01','2026-09-30','monthly_sales_target','approved');
      INSERT INTO ops.company_daily_kpi_component_outcome VALUES (1,'2026-09-01','gsm','succeeded',1),(2,'2026-09-02','gsm','succeeded',1);
      INSERT INTO ops.company_daily_kpi_store_gsm VALUES ('${store}',1,'2026-09-01','gsm',1,2),('${store}',2,'2026-09-02','gsm',8,10);
      INSERT INTO ops.kpi_target VALUES (9,'${store}','store','daily','2026-09-01','2026-09-01',0.5),(9,'${store}','store','daily','2026-09-02','2026-09-02',0.8);
      INSERT INTO ops.kpi_actual VALUES (5,'${store}',NULL,'${company}','store','monthly','2026-09-01','2026-09-30',99999,'company');
      INSERT INTO ops.kpi_actual VALUES (5,'${store}',NULL,'${company}','store','monthly','2026-07-01','2026-07-31',100,'company');
      INSERT INTO ops.kpi_actual VALUES (1,'${store}',NULL,'${company}','store','daily','2026-09-01','2026-09-01',99999,'demo_seed');`);
  });
  afterAll(() => { if (created) psql(`DROP DATABASE ${databaseName}`, "postgres"); });
  const input = { companyIds: [company], periodStart: "2026-09-01", periodEnd: "2026-09-30", metricCodes: ["TARGET_ACHIEVEMENT", "ATV", "UPT", "CR", "gsm_approval"] };
  it("uses all observed month days, matching ratio pairs, weighted GSM and exact physical targets", async () => {
    const rows = await readRankingStoreRange(database as never, input);
    const metric = (code: string) => rows.find(row => row.kpi_code === code)!;
    expect(Number(metric("TARGET_ACHIEVEMENT").actual_value)).toBe(1300);
    expect(Number(metric("TARGET_ACHIEVEMENT").target_value)).toBe(1300);
    expect(Number(metric("ATV").actual_value)).toBe(100);
    expect(Number(metric("UPT").actual_value)).toBe(3.2);
    expect(Number(metric("CR").actual_value)).toBe(0.25);
    expect(Number(metric("gsm_approval").actual_value)).toBe(75);
    expect(Number(metric("gsm_approval").target_value)).toBe(75);
    const benchmarks = await readRankingRangeBenchmarks(database as never, { ...input, companyId: company });
    expect(Number(benchmarks.find(row => row.kpi_code === "UPT")?.benchmark_value)).toBe(3.2);
  });
  it("keeps interval boundaries inclusive and personnel references on exactly the same period", async () => {
    const range = { ...input, periodEnd: "2026-09-02" };
    const rows = await readRankingPersonnelRange(database as never, range);
    expect(Number(rows.find(row => row.kpi_code === "ATV")?.actual_value)).toBe(100);
    expect(Number(rows.find(row => row.kpi_code === "TARGET_ACHIEVEMENT")?.target_value)).toBe(2000);
    const benchmarks = await readEmployeeTurkeyBenchmarks(database as never, { ...range, companyId: company, isRange: true, periodType: "monthly" });
    expect(Number(benchmarks.find(row => row.kpi_code === "UPT")?.benchmark_value)).toBe(3.2);
    const single = await readRankingStoreRange(database as never, { ...range, periodStart: "2026-09-02" });
    expect(Number(single.find(row => row.kpi_code === "UPT")?.actual_value)).toBeCloseTo(30 / 9);
    const missing = await readRankingStoreRange(database as never, { ...range, periodStart: "2026-09-03", periodEnd: "2026-09-03" });
    expect(missing.find(row => row.kpi_code === "ATV")?.actual_value).toBeNull();
    expect(missing.find(row => row.kpi_code === "CR")?.actual_value).toBeNull();
  });
  it("prefers daily facts over monthly snapshots and does not substitute another month", async () => {
    const repository = new RankingReportingReadRepository(database as never);
    expect(await repository.getLatestRankingPeriod({ metricCodes: ["ATV"], periodType: "monthly", periodStart: "2026-09-01" })).toEqual({ period_type: "monthly", period_start: "2026-09-01", period_end: "2026-09-30", uses_daily_components: true });
    expect(await repository.getLatestRankingPeriod({ metricCodes: ["ATV"], periodType: "monthly", periodStart: "2026-10-01" })).toBeNull();
    expect(await repository.getLatestRankingPeriod({ metricCodes: ["ATV"], periodType: "monthly", periodStart: "2026-07-01" })).toEqual({ period_type: "monthly", period_start: "2026-07-01", period_end: "2026-07-31", uses_daily_components: false });
    expect(await repository.getLatestRankingPeriod({ metricCodes: ["ATV"], periodType: "daily", periodStart: "2026-09-02" })).toEqual({ period_type: "daily", period_start: "2026-09-02", period_end: "2026-09-02", uses_daily_components: false });
    expect(await repository.getLatestRankingPeriod({ metricCodes: ["ATV"], periodType: "monthly", periodStart: "2026-09-01", companyIds: ["00000000-0000-4000-8000-000000000099"] })).toBeNull();
    expect(await readRankingStoreRange(database as never, { ...input, companyIds: ["00000000-0000-4000-8000-000000000099"] })).toEqual([]);
  });
});
