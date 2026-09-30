import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool, type PoolClient } from "pg";
import { CompanyDailyKpiComponentRepository } from "./company-daily-kpi-component.repository";
import { KpiMaterializationRepository } from "./kpi-materialization.repository";

const url = process.env.COMPANY_RETURNS_POSTGRES_URL;
const postgres = url ? describe : describe.skip;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
postgres("company returns v2 PostgreSQL integrity", () => {
  const name = `company_returns_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  let admin: Pool, pool: Pool;
  let created = false;
  let components: CompanyDailyKpiComponentRepository, kpis: KpiMaterializationRepository;
  const migration = readFileSync(resolve(process.cwd(), "../../db/migrations/096_store_aware_kpi_returns_v2.sql"), "utf8");
  const apply = async (sql: string) => { const c = await pool.connect(); try { await c.query("BEGIN"); await c.query(sql); await c.query("COMMIT"); }
    catch (e) { await c.query("ROLLBACK"); throw e; } finally { c.release(); } };
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (parsed.hostname !== "127.0.0.1" || !["55437", "5432"].includes(parsed.port) || parsed.pathname !== "/postgres")
      throw new Error("isolated company-returns fixture required");
    admin = new Pool({ connectionString: url });
    await admin.query(`CREATE DATABASE ${name}`); created = true;
    parsed.pathname = `/${name}`; pool = new Pool({ connectionString: parsed.toString() });
    const database = { query: (sql: string, args?: unknown[]) => pool.query(sql, args),
      withTransaction: async <T>(work: (client: PoolClient) => Promise<T>) => { const c = await pool.connect();
        try { await c.query("BEGIN"); const result = await work(c); await c.query("COMMIT"); return result; }
        catch (e) { await c.query("ROLLBACK"); throw e; } finally { c.release(); } } };
    components = new CompanyDailyKpiComponentRepository(database as never);
    kpis = new KpiMaterializationRepository(database as never);
    await pool.query(`CREATE SCHEMA ops; CREATE SCHEMA stg;
      CREATE TABLE stg.integration_source(integration_source_id uuid PRIMARY KEY,is_active boolean);
      CREATE TABLE ops.store(store_id uuid PRIMARY KEY,status text,kpi_import_enabled boolean);
      CREATE TABLE ops.employee(employee_id uuid PRIMARY KEY);
      CREATE TABLE ops.kpi_actual(kpi_actual_id uuid PRIMARY KEY,kpi_id uuid,scope_type text,company_id uuid,
        region_id uuid,store_id uuid,employee_id uuid,period_type text,period_start date,period_end date,
        actual_value numeric(18,4),achievement_rate numeric(18,6),calculated_at timestamptz,
        source_batch_id text,source_payload_hash text,last_synced_at timestamptz,source_type text);
      CREATE UNIQUE INDEX kpi_actual_employee_live_unique_idx ON ops.kpi_actual
        (kpi_id,employee_id,period_type,period_start,period_end) WHERE scope_type='employee' AND employee_id IS NOT NULL;
      INSERT INTO stg.integration_source VALUES ('${id(1)}',TRUE);
      INSERT INTO ops.store VALUES ('${id(101)}','active',TRUE),('${id(102)}','active',TRUE);
      INSERT INTO ops.employee VALUES ('${id(201)}');`);
    await apply(readFileSync(resolve(process.cwd(), "../../db/migrations/075_company_daily_kpi_component_storage_v1.sql"), "utf8"));
    await apply(readFileSync(resolve(process.cwd(), "../../db/migrations/081_store_sales_signed_totals_v1.sql"), "utf8"));
    await pool.query(`INSERT INTO ops.kpi_actual(kpi_actual_id,kpi_id,scope_type,employee_id,store_id,period_type,period_start,period_end,actual_value)
      VALUES ('${id(901)}','${id(301)}','employee','${id(201)}','${id(101)}','daily','2026-09-29','2026-09-29',123);`);
    await apply(migration); await apply(migration);
  });
  afterAll(async () => { if (pool) await pool.end(); if (created) await admin.query(`DROP DATABASE ${name}`); if (admin) await admin.end(); });
  const metric = (storeId: string | null, value: string) => ({ kpiId: id(301), employeeId: id(201), storeId,
    companyId: id(401), regionId: null, periodType: "daily", periodStart: "2026-09-29", periodEnd: "2026-09-29",
    actualValue: value, achievementRate: null, batchEnvelope: { sourceBatchId: "synthetic", sourcePayloadHash: null, sourceCapturedAt: null } });

  it("retains historical rows while accepting/replacing two store-bound keys and a storeless legacy key", async () => {
    expect((await pool.query("SELECT actual_value FROM ops.kpi_actual WHERE kpi_actual_id=$1", [id(901)])).rows[0].actual_value).toBe("123.0000");
    await kpis.upsertEmployeeKpiActual(metric(id(101), "90.0011"));
    await kpis.upsertEmployeeKpiActual(metric(id(102), "70"));
    await kpis.upsertEmployeeKpiActual(metric(null, "160.0011"));
    await kpis.upsertEmployeeKpiActual(metric(id(102), "80"));
    await kpis.upsertEmployeeKpiActual(metric(null, "170.0011"));
    expect((await pool.query("SELECT actual_value FROM ops.kpi_actual ORDER BY store_id NULLS LAST")).rows.map(r => r.actual_value))
      .toEqual(["90.0011", "80.0000", "170.0011"]);
  });

  const input = () => ({ integrationSourceId: id(1), businessDate: "2026-09-30", operation: "sales" as const,
    aggregateCount: 1, retryCount: 0, sanitizedSetDigest: "a".repeat(64), returnAttributionVersion: 2 as const,
    employeeSales: [], storeSales: [{ storeId: id(101), saleInvoiceCount: 0, returnInvoiceCount: 1,
      saleQuantity: "0", signedReturnQuantity: "-1", netQuantity: "-1", saleAmountTry: "0",
      signedReturnAmountTry: "-20", netAmountTry: "-20" }], returnFacts: [{ storeId: id(101), businessDate: "2026-09-30",
      receivingStoreCode: "store-A", originalStoreCode: "external-A", personnelCode: "seller-A",
      direction: "received" as const, returnKind: "cross_store" as const, returnInvoiceCount: 1,
      signedReturnQuantity: "-1", signedReturnAmountTry: "-20" }] });

  it("replaces return details with their component and preserves prior accepted data on a write failure", async () => {
    await components.replaceSuccessfulComponentSet(input());
    await components.replaceSuccessfulComponentSet(input());
    expect((await pool.query("SELECT COUNT(*) FROM ops.company_daily_kpi_return")).rows[0].count).toBe("1");
    await pool.query(`CREATE FUNCTION ops.reject_return() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'synthetic rejected write'; END$$;
      CREATE TRIGGER reject_return BEFORE INSERT ON ops.company_daily_kpi_return FOR EACH ROW EXECUTE FUNCTION ops.reject_return();`);
    const corrected = input(); corrected.sanitizedSetDigest = "b".repeat(64);
    await expect(components.replaceSuccessfulComponentSet(corrected)).rejects.toThrow("synthetic rejected write");
    expect((await pool.query("SELECT sanitized_set_digest,return_attribution_version FROM ops.company_daily_kpi_component_outcome")).rows[0])
      .toMatchObject({ sanitized_set_digest: "a".repeat(64), return_attribution_version: 2 });
    expect((await pool.query("SELECT COUNT(*) FROM ops.company_daily_kpi_return")).rows[0].count).toBe("1");
    await pool.query("DROP TRIGGER reject_return ON ops.company_daily_kpi_return");
  });

  it("rejects inconsistent return relations and duplicate grains even through direct SQL", async () => {
    await expect(pool.query(`UPDATE ops.company_daily_kpi_return SET return_kind='same_store',original_store_code=NULL`)).rejects.toThrow();
    await expect(pool.query(`INSERT INTO ops.company_daily_kpi_return
      (component_outcome_id,business_date,store_id,receiving_store_code,original_store_code,personnel_code,
       direction,return_kind,return_invoice_count,signed_return_quantity,signed_return_amount_try)
      SELECT component_outcome_id,business_date,store_id,receiving_store_code,original_store_code,personnel_code,
       direction,return_kind,return_invoice_count,signed_return_quantity,signed_return_amount_try
      FROM ops.company_daily_kpi_return`)).rejects.toThrow("duplicate");
    const bad = input(); bad.returnFacts[0].signedReturnAmountTry = "20";
    await expect(components.replaceSuccessfulComponentSet(bad)).rejects.toThrow("invalid_return_fact");
  });
});
