import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";
import { cycleDatabase, cycleId as id, seedCompanyCycle } from "./incentive-company-cycle.postgres-fixture";
import { SalesTargetIncentiveReadRepository } from "./sales-target-incentive-read.repository";
import { SalesTargetIncentiveCorrectionRepository } from "./sales-target-incentive-correction.repository";

const url = process.env.INCENTIVE_PARTICIPATION_POSTGRES_URL;
const postgres = url ? describe : describe.skip;
postgres("V2 net incentive PostgreSQL boundaries", () => {
  const name = `incentive_net_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  let admin: Pool, pool: Pool, created = false;
  const migrate = async (file: string) => { const client = await pool.connect(); try {
    await client.query("BEGIN"); await client.query(readFileSync(resolve(process.cwd(), `../../db/migrations/${file}`), "utf8"));
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); } };
  beforeAll(async () => {
    const target = new URL(url!);
    if (target.hostname !== "127.0.0.1" || !["5432", "55437"].includes(target.port) || target.pathname !== "/postgres")
      throw new Error("isolated incentive fixture required");
    admin = new Pool({ connectionString: url }); await admin.query(`CREATE DATABASE ${name}`); created = true;
    target.pathname = `/${name}`; pool = new Pool({ connectionString: target.toString() });
    await seedCompanyCycle(pool);
    const historicalMigration = readFileSync(resolve(process.cwd(), "../../db/migrations/052_sales_target_incentive_v1.sql"), "utf8");
    const seedStart = historicalMigration.indexOf("WITH rule AS (");
    const seedEnd = historicalMigration.indexOf("DROP TRIGGER IF EXISTS", seedStart);
    expect(seedStart).toBeGreaterThanOrEqual(0); expect(seedEnd).toBeGreaterThan(seedStart);
    await pool.query(historicalMigration.slice(seedStart, seedEnd));
    await migrate("096_store_aware_kpi_returns_v2.sql");
    await migrate("097_incentive_net_sales_v2.sql"); await migrate("097_incentive_net_sales_v2.sql");
  });
  afterAll(async () => { if (pool) await pool.end(); if (created) await admin.query(`DROP DATABASE ${name}`); if (admin) await admin.end(); });

  it("retains all rates and immutable historical net/version after reapplication", async () => {
    const rates = await pool.query(`SELECT rule.rule_version_code, COUNT(*)::int AS n FROM ops.sales_target_incentive_rate_bracket b
      JOIN ops.sales_target_incentive_rule_version rule ON rule.sales_target_incentive_rule_version_id=b.rule_version_id
      WHERE rule.rule_version_code IN ('sales-target-incentive-v1.0.0','sales-target-incentive-v2.0.0') GROUP BY rule.rule_version_code`);
    expect(rates.rows.map(row => row.n)).toEqual([14,14]);
    const differences = await pool.query(`SELECT audience,sort_order,rate_table_version,min_achievement_pct,max_achievement_pct,rate FROM ops.sales_target_incentive_rate_bracket
      WHERE rule_version_id=(SELECT sales_target_incentive_rule_version_id FROM ops.sales_target_incentive_rule_version WHERE rule_version_code='sales-target-incentive-v1.0.0')
      EXCEPT SELECT audience,sort_order,rate_table_version,min_achievement_pct,max_achievement_pct,rate FROM ops.sales_target_incentive_rate_bracket
      WHERE rule_version_id=(SELECT sales_target_incentive_rule_version_id FROM ops.sales_target_incentive_rule_version WHERE rule_version_code='sales-target-incentive-v2.0.0')`);
    expect(differences.rows).toEqual([]);
    await expect(pool.query(`UPDATE rpt.sales_target_incentive_final_row SET actual_sales_amount=1300
      WHERE sales_target_incentive_final_row_id='${id(40)}'`)).rejects.toThrow();
    const legacy = await new SalesTargetIncentiveCorrectionRepository(cycleDatabase(pool) as never)
      .listApprovedAdjustmentSummaries({ periodKey: "2026-05", storeIds: [id(2)], includeFinalRows: true });
    expect(legacy[0]).toMatchObject({ actual_sales_amount: "1200.0000", rule_version_code: "synthetic-v1" });
    await expect(pool.query(`INSERT INTO rpt.sales_target_incentive_final_row(final_snapshot_id,employee_id,participant_type,position_code,
      rate_table_version,target_amount,actual_sales_amount,payable_amount,final_amount)
      VALUES ('${id(30)}','${id(12)}','personnel','SALES_ASSOCIATE','p-v1',100,-20,0,0)`)).rejects.toThrow("Signed incentive sales require");
  });

  it("persists signed net under V2 without modifying a historical snapshot", async () => {
    await pool.query(`INSERT INTO ops.sales_target_incentive_close_run(sales_target_incentive_close_run_id,company_id,period_key,period_start,period_end,close_cutoff_at,rule_version_id,status,completed_at,source_evidence)
      SELECT '${id(310)}','${id(1)}','2026-09','2026-09-01','2026-09-30','2026-10-01',sales_target_incentive_rule_version_id,'succeeded','2026-10-01',jsonb_build_object('ownershipRevision',ops.store_ownership_revision_v1('${id(1)}'))
      FROM ops.sales_target_incentive_rule_version WHERE rule_version_code='sales-target-incentive-v2.0.0';
      INSERT INTO rpt.sales_target_incentive_final_snapshot(sales_target_incentive_final_snapshot_id,close_run_id,company_id,region_id,store_id,period_key,period_start,period_end,close_cutoff_at,rule_version_id,rule_version_code,manager_rate_table_version,personnel_rate_table_version)
      SELECT '${id(311)}','${id(310)}','${id(1)}','${id(6)}','${id(2)}','2026-09','2026-09-01','2026-09-30','2026-10-01',sales_target_incentive_rule_version_id,rule_version_code,'manager-sales-target-v1.0.0','personnel-sales-target-v1.0.0'
      FROM ops.sales_target_incentive_rule_version WHERE rule_version_code='sales-target-incentive-v2.0.0';
      INSERT INTO rpt.sales_target_incentive_final_row(final_snapshot_id,employee_id,participant_type,position_code,rate_table_version,target_amount,actual_sales_amount,payable_amount,final_amount)
      VALUES('${id(311)}','${id(10)}','personnel','SALES_ASSOCIATE','personnel-sales-target-v1.0.0',100,-20.1234,0,0);`);
    const signed = await new SalesTargetIncentiveCorrectionRepository(cycleDatabase(pool) as never)
      .listApprovedAdjustmentSummaries({periodKey:"2026-09",storeIds:[id(2)],includeFinalRows:true});
    expect(signed[0]).toMatchObject({actual_sales_amount:"-20.1234",rule_version_code:"sales-target-incentive-v2.0.0",final_amount:"0.00"});
  });

  it("retains V1 adjustment history without applying it to a current V2 projection", async () => {
    await pool.query(`INSERT INTO ops.sales_target_incentive_projection(sales_target_incentive_projection_id,company_id,region_id,store_id,period_key,period_start,period_end,rule_version_id,manager_rate_table_version,personnel_rate_table_version)
      SELECT '${id(320)}','${id(1)}','${id(6)}','${id(2)}','2026-08','2026-08-01','2026-08-31',sales_target_incentive_rule_version_id,'manager-sales-target-v1.0.0','personnel-sales-target-v1.0.0'
      FROM ops.sales_target_incentive_rule_version WHERE rule_version_code='sales-target-incentive-v2.0.0';
      INSERT INTO ops.sales_target_incentive_projection_row(sales_target_incentive_projection_row_id,projection_id,employee_id,position_code,participant_type,personnel_positive_sales_amount,personnel_net_sales_amount)
      VALUES('${id(321)}','${id(320)}','${id(10)}','SALES_ASSOCIATE','personnel',1200,-20.1234);
      INSERT INTO ops.sales_target_incentive_adjustment(company_id,region_id,store_id,employee_id,projection_row_id,rule_version_id,period_key,adjustment_scope,adjustment_type,adjustment_amount,before_amount,after_amount,reason_code,reason_note,status,created_by_user_id,approved_by_user_id,approved_at)
      VALUES('${id(1)}','${id(6)}','${id(2)}','${id(10)}','${id(321)}','${id(60)}','2026-08','projection','correction',10,20,30,'synthetic','Synthetic preserved history','approved','${id(26)}','${id(22)}','2026-08-31');`);
    const repository = new SalesTargetIncentiveCorrectionRepository(cycleDatabase(pool) as never);
    expect(await repository.listApprovedAdjustmentSummaries({periodKey:"2026-08",storeIds:[id(2)]})).toEqual([]);
    const preserved = await pool.query(`SELECT personnel_positive_sales_amount::text,personnel_net_sales_amount::text,
      (SELECT COUNT(*)::int FROM ops.sales_target_incentive_adjustment WHERE period_key='2026-08') AS history_count
      FROM ops.sales_target_incentive_projection_row WHERE sales_target_incentive_projection_row_id='${id(321)}'`);
    expect(preserved.rows[0]).toEqual({personnel_positive_sales_amount:"1200.0000",personnel_net_sales_amount:"-20.1234",history_count:1});
  });

  it("prefers verified daily net with worker UUID lineage and fails closed on unresolved attribution", async () => {
    await pool.query(`INSERT INTO stg.integration_source(integration_source_id,source_code,source_name,entity_type)
      VALUES('${id(300)}','net-fixture','Synthetic','kpi');
      INSERT INTO stg.import_batch(import_batch_id,integration_source_id,company_ids,entity_type,source_batch_id,status,finished_at,error_count)
      VALUES('${id(301)}','${id(300)}',ARRAY['${id(1)}']::uuid[],'kpi','synthetic-source-day','completed','2026-09-30',0);
      INSERT INTO ops.kpi_definition(kpi_id,kpi_code,kpi_name,metric_type,unit_type,aggregation_type,scope_type,target_direction)
      VALUES('${id(302)}','NET_SALES','Synthetic net','amount','TRY','sum','both','higher');
      INSERT INTO ops.company_daily_kpi_component_outcome(component_outcome_id,integration_source_id,business_date,operation,status,
        aggregate_count,sanitized_set_digest,return_attribution_version,retry_count)
      VALUES('${id(303)}','${id(300)}','2026-09-30','sales','succeeded',2,repeat('a',64),2,0);
      INSERT INTO ops.company_daily_kpi_employee_sales(component_outcome_id,business_date,store_id,employee_id,
        sale_invoice_count,return_invoice_count,sale_quantity,signed_return_quantity,net_quantity,sale_amount_try,signed_return_amount_try,net_amount_try)
      VALUES('${id(303)}','2026-09-30','${id(2)}','${id(10)}',1,1,2,-1,1,10000,-1000,9000);
      INSERT INTO ops.kpi_actual(kpi_id,scope_type,company_id,region_id,store_id,employee_id,period_type,period_start,period_end,actual_value,source_batch_id,source_type)
      VALUES('${id(302)}','employee','${id(1)}','${id(6)}','${id(2)}','${id(10)}','daily','2026-09-30','2026-09-30',9000,'${id(301)}','integration'),
        ('${id(302)}','store','${id(1)}','${id(6)}','${id(2)}',NULL,'daily','2026-09-30','2026-09-30',6000,'${id(301)}','integration');`);
    const repo = new SalesTargetIncentiveReadRepository(cycleDatabase(pool) as never);
    const input = { companyIds: [id(1)], regionIds: [], storeIds: [id(2)], periodStart: "2026-09-01", periodEnd: "2026-09-30", assignmentAsOfDate: "2026-09-30" };
    const read = async () => (await repo.listPersonnelProjectionSources(input)).find(row => row.employee_id===id(10));
    expect(await read()).toMatchObject({ personnel_net_sales_amount: "9000.0000", store_net_sales_amount: "6000.0000" });
    expect((await repo.listStoreProjectionSources(input))[0].store_net_sales_amount).toBe("6000.0000");
    await pool.query(`UPDATE ops.kpi_actual SET actual_value=8999 WHERE scope_type='employee' AND store_id='${id(2)}'`);
    expect((await read())?.personnel_net_sales_amount).toBeNull();
    await pool.query(`UPDATE ops.kpi_actual SET actual_value=9000 WHERE scope_type='employee' AND store_id='${id(2)}'`);
    await pool.query(`UPDATE ops.company_daily_kpi_component_outcome SET return_attribution_version=1 WHERE component_outcome_id='${id(303)}'`);
    expect((await read())?.personnel_net_sales_amount).toBeNull();
    await pool.query(`UPDATE ops.company_daily_kpi_component_outcome SET return_attribution_version=2 WHERE component_outcome_id='${id(303)}';
      INSERT INTO ops.company_daily_kpi_component_outcome(component_outcome_id,integration_source_id,business_date,operation,status,aggregate_count,sanitized_set_digest,return_attribution_version,retry_count)
      VALUES('${id(304)}','${id(300)}','2026-09-29','sales','succeeded',0,repeat('b',64),2,0);
      INSERT INTO ops.company_daily_kpi_return(component_outcome_id,business_date,store_id,receiving_store_code,return_kind,direction,
        return_invoice_count,signed_return_quantity,signed_return_amount_try)
      VALUES('${id(304)}','2026-09-29','${id(2)}','S1','unresolved','received',1,-1,-100);`);
    expect((await read())?.personnel_net_sales_amount).toBeNull();
    expect((await repo.listPersonnelProjectionSources({ ...input, closeCutoffAt: "2026-09-29T23:59:59Z" })).find(row => row.employee_id===id(10))?.personnel_net_sales_amount).toBeNull();
    expect(await repo.listPersonnelProjectionSources({ ...input, storeIds: [], companyIds: [] })).toEqual([]);
  });
});
