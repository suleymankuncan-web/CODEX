import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readRankingStoreRange, readRankingRangeBenchmarks } from "./ranking-range-read";
import { readRankingPersonnelRange } from "./ranking-personnel-range-read";
import { readEmployeeTurkeyBenchmarks } from "./personnel-benchmark-read";
import { RankingReportingReadRepository } from "./ranking-reporting-read.repository";
import { KpiBenchmarkScoringService } from "../application/kpi-benchmark-scoring.service";

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
  });
  beforeEach(() => {
    psql(`SET client_min_messages = warning; DROP SCHEMA IF EXISTS ops CASCADE; CREATE SCHEMA ops;
      CREATE TABLE ops.store(store_id uuid, company_id uuid, region_id uuid, store_name text, kpi_import_enabled boolean);
      CREATE TABLE ops.region(region_id uuid, region_name text);
      CREATE TABLE ops.kpi_definition(kpi_id int, kpi_code text, kpi_name text);
      CREATE TABLE ops.kpi_actual(kpi_id int, store_id uuid, employee_id uuid, company_id uuid, scope_type text, period_type text, period_start date, period_end date, actual_value numeric, source_type text, achievement_rate numeric, region_id uuid);
      CREATE TABLE ops.kpi_target(kpi_id int, store_id uuid, scope_type text, period_type text, period_start date, period_end date, target_value numeric);
      CREATE TABLE ops.company_daily_kpi_store_gsm(store_id uuid, component_outcome_id int, business_date date, operation text, yes_customer_count int, total_customer_count int);
      CREATE TABLE ops.company_daily_kpi_component_outcome(component_outcome_id int, business_date date, operation text, status text, integration_source_id int);
      CREATE TABLE ops.user_action_store_assignment(store_id uuid, user_id uuid, start_at timestamptz, end_at timestamptz);
      CREATE TABLE ops.user_role_assignment(user_id uuid, role_id int, start_at timestamptz, end_at timestamptz);
      CREATE TABLE ops.role(role_id int, role_code text);
      CREATE TABLE ops.user_account(user_id uuid, employee_id uuid, username text, email text, is_active boolean);
      CREATE TABLE ops.employee(employee_id uuid, first_name text, last_name text);
      CREATE TABLE ops.employee_assignment_history(employee_id uuid, position_id int, assignment_status text, is_primary_assignment boolean, start_date date, store_id uuid, region_id uuid);
      CREATE TABLE ops.position(position_id int, position_code text);
      CREATE TABLE ops.personnel_target_reference(employee_id uuid, store_id uuid, target_value numeric, period_start date, period_end date, target_type text, status text);
      CREATE TABLE ops.target_distribution_request(target_distribution_request_id uuid DEFAULT gen_random_uuid(), company_id uuid, store_id uuid, request_month date, total_target_value numeric, request_status text, approved_at timestamptz, updated_at timestamptz DEFAULT NOW(), created_at timestamptz DEFAULT NOW());
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
      INSERT INTO ops.kpi_target VALUES (8,'${store}','store','monthly','2026-09-01','2026-09-30',30000);
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
  it("uses observed month components against the full monthly target and preserves weighted ratios", async () => {
    const rows = await readRankingStoreRange(database as never, input);
    const metric = (code: string) => rows.find(row => row.kpi_code === code)!;
    expect(Number(metric("TARGET_ACHIEVEMENT").actual_value)).toBe(1300);
    expect(Number(metric("TARGET_ACHIEVEMENT").target_value)).toBe(30000);
    expect(Number(metric("ATV").actual_value)).toBe(100);
    expect(Number(metric("UPT").actual_value)).toBe(3.2);
    expect(Number(metric("CR").actual_value)).toBeCloseTo(10 / 140);
    expect(Number(metric("gsm_approval").actual_value)).toBe(75);
    expect(Number(metric("gsm_approval").target_value)).toBe(75);
    const benchmarks = await readRankingRangeBenchmarks(database as never, { ...input, companyId: company });
    expect(Number(benchmarks.find(row => row.kpi_code === "UPT")?.benchmark_value)).toBe(3.2);
  });
  it("keeps sales boundaries inclusive and personnel targets at their full monthly amount", async () => {
    const range = { ...input, periodEnd: "2026-09-02" };
    const rows = await readRankingPersonnelRange(database as never, range);
    expect(Number(rows.find(row => row.kpi_code === "ATV")?.actual_value)).toBe(100);
    expect(Number(rows.find(row => row.kpi_code === "TARGET_ACHIEVEMENT")?.target_value)).toBe(30000);
    const benchmarks = await readEmployeeTurkeyBenchmarks(database as never, { ...range, companyId: company, isRange: true, periodType: "monthly" });
    expect(Number(benchmarks.find(row => row.kpi_code === "UPT")?.benchmark_value)).toBe(3.2);
    const single = await readRankingStoreRange(database as never, { ...range, periodStart: "2026-09-02" });
    expect(Number(single.find(row => row.kpi_code === "UPT")?.actual_value)).toBeCloseTo(30 / 9);
    const missing = await readRankingStoreRange(database as never, { ...range, periodStart: "2026-09-03", periodEnd: "2026-09-03" });
    expect(missing.find(row => row.kpi_code === "ATV")?.actual_value).toBeNull();
    expect(missing.find(row => row.kpi_code === "CR")?.actual_value).toBeNull();
  });
  const readers = [readRankingStoreRange, readRankingPersonnelRange];
  const hg = (rows: Array<{ kpi_code: string; actual_value: string | null; target_value: string | null }>) =>
    rows.find(row => row.kpi_code === "TARGET_ACHIEVEMENT")!;
  it("adds 3% and 5% daily sales to 8% of the same monthly target for both leaderboards", async () => {
    psql(`UPDATE ops.kpi_actual SET actual_value = CASE period_start WHEN '2026-09-01' THEN 900 ELSE 1500 END
      WHERE kpi_id=1 AND period_start IN ('2026-09-01','2026-09-02') AND source_type='company';
      INSERT INTO ops.kpi_actual VALUES (8,'${store}',NULL,'${company}','store','daily','2026-09-01','2026-09-01',99999,'company');`);
    for (const read of readers) {
      const one = hg(await read(database as never, { ...input, periodEnd: "2026-09-01" }));
      const two = hg(await read(database as never, { ...input, periodStart: "2026-09-02", periodEnd: "2026-09-02" }));
      const both = hg(await read(database as never, { ...input, periodEnd: "2026-09-02" }));
      expect([one, two, both].map(row => Number(row.target_value))).toEqual([30000, 30000, 30000]);
      expect([one, two, both].map(row => Number(row.actual_value) / Number(row.target_value))).toEqual([0.03, 0.05, 0.08]);
      const score = new KpiBenchmarkScoringService().scoreLiveMetric({ metricCode: "TARGET_ACHIEVEMENT",
        actualValue: Number(both.actual_value), targetValue: Number(both.target_value), benchmarkValue: null,
        benchmarkSource: "TARGET", weightPercent: 100, direction: "HIGHER_IS_BETTER", capRatio: 2 });
      expect(score.actualRatio).toBe(0.08);
      expect(score.scoreContribution).toBe(8);
    }
  });
  it("keeps full targets for a single-day API request and for legacy monthly facts", async () => {
    psql(`INSERT INTO ops.kpi_actual SELECT 8,'${store}','${employee}','${company}',scope,'monthly',
      '2026-09-01','2026-09-30',1300,'company',NULL,NULL FROM (VALUES ('store'),('employee')) scopes(scope);`);
    const repository = new RankingReportingReadRepository(database as never);
    for (const period of [
      { periodType: "daily", periodStart: "2026-09-02", periodEnd: "2026-09-02", actual: 900 },
      { periodType: "monthly", periodStart: "2026-09-01", periodEnd: "2026-09-30", actual: 1300 },
    ]) {
      const request = { ...input, ...period, isRange: period.periodType === "daily" };
      for (const rows of [await repository.listRankingStoreKpiRows(request), await repository.listRankingPersonnelKpiRows(request)]) {
        expect(Number(hg(rows).actual_value)).toBe(period.actual);
        expect(Number(hg(rows).target_value)).toBe(30000);
      }
    }
  });
  it("keeps legacy daily ratios alongside NET_SALES while applying full-month HG", async () => {
    psql(`INSERT INTO ops.kpi_actual SELECT metric,'${store}','${employee}','${company}',scope,'daily',
      '2026-07-04','2026-07-04',CASE metric WHEN 5 THEN 250 ELSE 1500 END,'company',NULL,NULL
      FROM (VALUES (1),(8),(5)) metrics(metric) CROSS JOIN (VALUES ('store'),('employee')) scopes(scope);
      INSERT INTO ops.kpi_target VALUES (8,'${store}','store','monthly','2026-07-01','2026-07-31',10000);
      INSERT INTO ops.personnel_target_reference VALUES ('${employee}','${store}',10000,'2026-07-01','2026-07-31','monthly_sales_target','approved');`);
    const repository = new RankingReportingReadRepository(database as never);
    const period = await repository.getLatestRankingPeriod({ ...input, periodType: "daily", periodStart: "2026-07-04" });
    expect(period?.uses_daily_components).toBe(false);
    const request = { ...input, periodType: "daily", periodStart: "2026-07-04", periodEnd: "2026-07-04", isRange: false };
    for (const rows of [await repository.listRankingStoreKpiRows(request), await repository.listRankingPersonnelKpiRows(request)]) {
      expect(Number(hg(rows).actual_value) / Number(hg(rows).target_value)).toBe(0.15);
      expect(Number(rows.find(row => row.kpi_code === "ATV")?.actual_value)).toBe(250);
    }
  });
  it("keeps mixed daily sales aliases additive and prefers each day's net sales, including zero and returns", async () => {
    psql(`DELETE FROM ops.kpi_actual WHERE kpi_id=1 AND period_start='2026-09-01' AND scope_type='store';
      INSERT INTO ops.kpi_actual VALUES
        (8,'${store}',NULL,'${company}','store','daily','2026-09-01','2026-09-01',100,'company'),
        (8,'${store}',NULL,'${company}','store','daily','2026-09-02','2026-09-02',99999,'company');`);
    const read = (start: string, end: string) => readRankingStoreRange(database as never, { ...input, periodStart: start, periodEnd: end });
    const first = hg(await read('2026-09-01', '2026-09-01'));
    const second = hg(await read('2026-09-02', '2026-09-02'));
    const combined = hg(await read('2026-09-01', '2026-09-02'));
    expect(Number(combined.actual_value)).toBe(Number(first.actual_value) + Number(second.actual_value));
    expect(Number(combined.actual_value)).toBe(1000);
    for (const net of [0, -50]) {
      psql(`UPDATE ops.kpi_actual SET actual_value=${net} WHERE kpi_id=1 AND scope_type='store' AND period_start='2026-09-02'`);
      expect(Number(hg(await read('2026-09-01', '2026-09-02')).actual_value)).toBe(100 + net);
    }
  });
  it("uses approved revisions immediately, ignoring pending, superseded and foreign-store targets", async () => {
    psql(`INSERT INTO ops.target_distribution_request(company_id,store_id,request_month,total_target_value,request_status,approved_at)
      VALUES ('${company}','${store}','2026-09-01',45000,'approved','2026-09-01'),
        ('${company}','${store}','2026-09-01',60000,'approved','2026-09-02'),
        ('${company}','${store}','2026-09-01',90000,'pending_region_approval','2026-09-03'),
        ('00000000-0000-4000-8000-000000000099','${store}','2026-09-01',999999,'approved','2026-09-04');
      UPDATE ops.personnel_target_reference SET status='superseded';
      INSERT INTO ops.personnel_target_reference VALUES ('${employee}','${store}',60000,'2026-09-01','2026-09-30','monthly_sales_target','approved'),
        ('${employee}','00000000-0000-4000-8000-000000000099',999999,'2026-09-01','2026-09-30','monthly_sales_target','approved');`);
    for (const read of readers) expect(Number(hg(await read(database as never, input)).target_value)).toBe(60000);
    psql("UPDATE ops.personnel_target_reference SET target_value=75000 WHERE status='approved'; UPDATE ops.target_distribution_request SET total_target_value=75000 WHERE total_target_value=60000");
    for (const read of readers) expect(Number(hg(await read(database as never, input)).target_value)).toBe(75000);
  });
  it("counts each touched month's target once and does not ignore a month with a missing target", async () => {
    const range = { ...input, periodStart: "2026-08-31", periodEnd: "2026-09-02" };
    for (const read of readers) expect(hg(await read(database as never, range)).target_value).toBeNull();
    psql(`INSERT INTO ops.kpi_target VALUES (8,'${store}','store','monthly','2026-08-01','2026-08-31',45000);
      INSERT INTO ops.personnel_target_reference VALUES ('${employee}','${store}',45000,'2026-08-01','2026-08-31','monthly_sales_target','approved');`);
    for (const read of readers) {
      const result = hg(await read(database as never, range));
      expect(Number(result.target_value)).toBe(75000);
      expect(Number(result.actual_value)).toBe(100999);
    }
  });
  it("uses leap-year and year-boundary monthly targets without day-count assumptions", async () => {
    for (const [start, end, months] of [
      ["2024-02-29", "2024-03-01", [["2024-02-01", "2024-02-29"], ["2024-03-01", "2024-03-31"]]],
      ["2026-12-31", "2027-01-01", [["2026-12-01", "2026-12-31"], ["2027-01-01", "2027-01-31"]]],
    ] as const) {
      for (const day of [start, end]) psql(`INSERT INTO ops.kpi_actual SELECT 1,'${store}','${employee}','${company}',scope,'daily','${day}','${day}',1000,'company',NULL,NULL FROM (VALUES ('store'),('employee')) scopes(scope)`);
      for (const [monthStart, monthEnd] of months) psql(`INSERT INTO ops.kpi_target VALUES (8,'${store}','store','monthly','${monthStart}','${monthEnd}',10000);
        INSERT INTO ops.personnel_target_reference VALUES ('${employee}','${store}',10000,'${monthStart}','${monthEnd}','monthly_sales_target','approved')`);
      for (const read of readers) {
        const result = hg(await read(database as never, { ...input, periodStart: start, periodEnd: end }));
        expect(Number(result.actual_value) / Number(result.target_value)).toBe(0.1);
      }
    }
  });
  it("does not substitute daily targets or prorated partial references for a missing monthly target", async () => {
    psql("DELETE FROM ops.kpi_target WHERE period_type='monthly'; UPDATE ops.personnel_target_reference SET period_start='2026-09-02'");
    for (const read of readers) expect(hg(await read(database as never, { ...input, periodStart: "2026-09-02", periodEnd: "2026-09-02" })).target_value).toBeNull();
  });
  it("keeps zero targets unavailable and rejects ambiguous or negative monthly references", async () => {
    psql("UPDATE ops.kpi_target SET target_value=0 WHERE period_type='monthly'; UPDATE ops.personnel_target_reference SET target_value=0");
    for (const read of readers) {
      const result = hg(await read(database as never, input));
      expect(Number(result.target_value)).toBe(0);
      const score = new KpiBenchmarkScoringService().scoreLiveMetric({ metricCode: "TARGET_ACHIEVEMENT", actualValue: Number(result.actual_value), targetValue: 0,
        benchmarkValue: null, benchmarkSource: "TARGET", weightPercent: 100, direction: "HIGHER_IS_BETTER", capRatio: 2 });
      expect(score.actualRatio).toBeNull();
    }
    psql("UPDATE ops.kpi_target SET target_value=-1 WHERE period_type='monthly'; UPDATE ops.personnel_target_reference SET target_value=-1");
    for (const read of readers) expect(hg(await read(database as never, input)).target_value).toBeNull();
    psql("UPDATE ops.kpi_target SET target_value=30000 WHERE period_type='monthly'; UPDATE ops.personnel_target_reference SET target_value=30000; INSERT INTO ops.kpi_target SELECT * FROM ops.kpi_target WHERE period_type='monthly'; INSERT INTO ops.personnel_target_reference SELECT * FROM ops.personnel_target_reference");
    for (const read of readers) expect(hg(await read(database as never, input)).target_value).toBeNull();
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
