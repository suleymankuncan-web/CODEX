import { SalesTargetIncentiveReadRepository } from "./sales-target-incentive-read.repository";
import { incentiveDailySalesCoverageSql, dailySalesCoverageParams } from "./incentive-daily-sales-coverage.sql";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool, type PoolClient } from "pg";
import { seedCompanyCycle, cycleId as id } from "./incentive-company-cycle.postgres-fixture";
import { StoreReturnsReadRepository } from "./store-returns-read.repository";
import { StorePositiveSellersReadRepository } from "./store-positive-sellers-read.repository";

const url = process.env.INCENTIVE_PARTICIPATION_POSTGRES_URL;
const postgres = url ? describe : describe.skip;
postgres("shared return ledger and positive seller PostgreSQL boundaries", () => {
  const name = `returns_read_${randomUUID().replaceAll("-", "").slice(0,16)}`;
  let admin: Pool, pool: Pool, client: PoolClient, created=false;
  let ledger: StoreReturnsReadRepository, sellers: StorePositiveSellersReadRepository;
  const read = (category: "inside" | "other"="inside", storeId=id(2), offset=0) => ledger.getLedger({
    storeId,scope:{companyIds:[id(1)],regionIds:[],storeIds:[]},periodStart:"2026-05-01",periodEnd:"2026-05-31",
    category,limit:50,offset,
  });
  const people = () => sellers.list({storeIds:[id(2)],periodStart:"2026-05-01",throughDate:"2026-05-31"});

  beforeAll(async () => {
    const target=new URL(url!);
    if(target.hostname!=="127.0.0.1" || !["5432","55437"].includes(target.port) || target.pathname!=="/postgres")
      throw new Error("Owned isolated database required");
    admin=new Pool({connectionString:url}); await admin.query(`CREATE DATABASE ${name}`); created=true;
    target.pathname=`/${name}`; pool=new Pool({connectionString:target.toString()});
    await seedCompanyCycle(pool);
    const connection=await pool.connect();
    try {
      await connection.query("BEGIN");
      await connection.query(readFileSync(resolve(process.cwd(),"../../db/migrations/096_store_aware_kpi_returns_v2.sql"),"utf8"));
      await connection.query("COMMIT");
    } catch(error) { await connection.query("ROLLBACK"); throw error; } finally { connection.release(); }
    await pool.query(`
      UPDATE ops.employee SET external_employee_ref='SELLER-1' WHERE employee_id='${id(10)}';
      UPDATE ops.employee SET external_employee_ref='SELLER-2' WHERE employee_id='${id(12)}';
      INSERT INTO ops.employee(employee_id,company_id,external_employee_ref,first_name,last_name,hire_date,employment_type)
        VALUES('${id(13)}','${id(1)}','SELLER-3','Targetless','Seller','2020-01-01','full_time');
      INSERT INTO ops.store(store_id,company_id,region_id,store_code,store_name,store_type)
        VALUES('${id(4)}','${id(1)}','${id(6)}','PARTNER-1','Synthetic Partner','franchise');
      INSERT INTO stg.integration_source(integration_source_id,source_code,source_name,entity_type)
        VALUES('${id(400)}','returns-read-fixture','Synthetic return ledger','kpi');
      INSERT INTO ops.kpi_definition(kpi_id,kpi_code,kpi_name,metric_type,unit_type,aggregation_type,scope_type,target_direction)
        VALUES('${id(401)}','NET_SALES','Synthetic net','amount','TRY','sum','both','higher');
      INSERT INTO stg.import_batch(import_batch_id,integration_source_id,company_ids,entity_type,source_batch_id,status,finished_at,error_count)
        SELECT ('00000000-0000-4000-8000-'||LPAD((500+n)::text,12,'0'))::uuid,'${id(400)}',ARRAY['${id(1)}']::uuid[],
          'kpi','synthetic-day-'||n,'completed','2026-05-31',0 FROM generate_series(1,31) n;
      INSERT INTO ops.company_daily_kpi_component_outcome(component_outcome_id,integration_source_id,business_date,operation,status,
        aggregate_count,retry_count,sanitized_set_digest,return_attribution_version,accepted_at,updated_at)
        SELECT ('00000000-0000-4000-8000-'||LPAD((600+n)::text,12,'0'))::uuid,'${id(400)}',DATE '2026-05-01'+n-1,
          'sales','succeeded',0,0,repeat('a',64),2,'2026-05-31','2026-05-31' FROM generate_series(1,31) n;
      INSERT INTO ops.company_daily_kpi_store_sales(component_outcome_id,business_date,store_id,sale_invoice_count,return_invoice_count,
        sale_quantity,signed_return_quantity,net_quantity,sale_amount_try,signed_return_amount_try,net_amount_try)
        SELECT outcome.component_outcome_id,outcome.business_date,store.store_id,0,0,0,0,0,0,0,0
        FROM ops.company_daily_kpi_component_outcome outcome CROSS JOIN ops.store store
        WHERE outcome.integration_source_id='${id(400)}' AND store.store_id IN ('${id(2)}','${id(3)}','${id(4)}');
      INSERT INTO ops.kpi_actual(kpi_id,scope_type,company_id,region_id,store_id,period_type,period_start,period_end,actual_value,source_batch_id,source_type,last_synced_at,calculated_at)
        SELECT '${id(401)}','store','${id(1)}','${id(6)}',facts.store_id,'daily',facts.business_date,facts.business_date,0,
          ('00000000-0000-4000-8000-'||LPAD((500+EXTRACT(DAY FROM facts.business_date)::int)::text,12,'0')),'integration','2026-05-31','2026-05-31'
        FROM ops.company_daily_kpi_store_sales facts;
      INSERT INTO ops.company_daily_kpi_employee_sales(component_outcome_id,business_date,store_id,employee_id,sale_invoice_count,return_invoice_count,
        sale_quantity,signed_return_quantity,net_quantity,sale_amount_try,signed_return_amount_try,net_amount_try)
        VALUES('${id(601)}','2026-05-01','${id(2)}','${id(12)}',1,0,1,0,1,500,0,500),
          ('${id(601)}','2026-05-01','${id(2)}','${id(13)}',1,0,1,0,1,100,0,100),
          ('${id(619)}','2026-05-19','${id(2)}','${id(10)}',1,0,1,0,1,1000,0,1000),
          ('${id(620)}','2026-05-20','${id(2)}','${id(10)}',0,1,0,-1,-1,0,-100,-100),
          ('${id(620)}','2026-05-20','${id(2)}','${id(12)}',0,1,0,-1,-1,0,-50,-50),
          ('${id(620)}','2026-05-20','${id(2)}','${id(13)}',0,1,0,-1,-1,0,-200,-200);
      UPDATE ops.company_daily_kpi_store_sales SET sale_invoice_count=2,sale_quantity=2,net_quantity=2,sale_amount_try=600,net_amount_try=600
        WHERE store_id='${id(2)}' AND business_date='2026-05-01';
      UPDATE ops.company_daily_kpi_store_sales SET sale_invoice_count=1,sale_quantity=1,net_quantity=1,sale_amount_try=1000,net_amount_try=1000
        WHERE store_id='${id(2)}' AND business_date='2026-05-19';
      UPDATE ops.kpi_actual SET actual_value=600 WHERE store_id='${id(2)}' AND period_start='2026-05-01';
      UPDATE ops.kpi_actual SET actual_value=1000 WHERE store_id='${id(2)}' AND period_start='2026-05-19';
      INSERT INTO ops.kpi_actual(kpi_id,scope_type,company_id,region_id,store_id,employee_id,period_type,period_start,period_end,
        actual_value,source_batch_id,source_type,last_synced_at,calculated_at)
        SELECT '${id(401)}','employee','${id(1)}','${id(6)}',facts.store_id,facts.employee_id,'daily',facts.business_date,facts.business_date,
          ROUND(facts.net_amount_try,4),('00000000-0000-4000-8000-'||LPAD((500+EXTRACT(DAY FROM facts.business_date)::int)::text,12,'0')),
          'integration','2026-05-31','2026-05-31' FROM ops.company_daily_kpi_employee_sales facts;
      INSERT INTO ops.company_daily_kpi_return(return_id,component_outcome_id,business_date,store_id,receiving_store_code,original_store_code,
        personnel_code,direction,return_kind,return_invoice_count,signed_return_quantity,signed_return_amount_try)
        VALUES('${id(700)}','${id(620)}','2026-05-20','${id(2)}','S1','S1','SELLER-1','received','same_store',1,-1,-100),
          ('${id(701)}','${id(620)}','2026-05-20','${id(2)}','S1','S1','SELLER-2','received','same_store',1,-1,-50),
          ('${id(702)}','${id(620)}','2026-05-20','${id(2)}','S1','S1','SELLER-3','received','same_store',1,-1,-200),
          ('${id(703)}','${id(620)}','2026-05-20','${id(2)}','S1','S2','SELLER-1','received','cross_store',1,-1,-300),
          ('${id(704)}','${id(621)}','2026-05-21','${id(2)}','EXTERNAL-1','S1','SELLER-1','external','cross_store',1,-1,-400),
          ('${id(705)}','${id(620)}','2026-05-20','${id(4)}','PARTNER-1','S1','SELLER-1','received','cross_store',1,-1,-75);
      UPDATE ops.company_daily_kpi_store_sales SET return_invoice_count=1,signed_return_quantity=-4,net_quantity=-4,
        signed_return_amount_try=-650,net_amount_try=-650 WHERE store_id='${id(2)}' AND business_date='2026-05-20';
      UPDATE ops.kpi_actual SET actual_value=-650 WHERE scope_type='store' AND store_id='${id(2)}' AND period_start='2026-05-20';
      UPDATE ops.company_daily_kpi_store_sales SET return_invoice_count=1,signed_return_quantity=-1,net_quantity=-1,
        signed_return_amount_try=-75,net_amount_try=-75 WHERE store_id='${id(4)}' AND business_date='2026-05-20';
      UPDATE ops.kpi_actual SET actual_value=-75 WHERE store_id='${id(4)}' AND period_start='2026-05-20';
    `);
  });
  beforeEach(async () => {
    client=await pool.connect(); await client.query("BEGIN");
    const database={query:(sql:string,params?:unknown[])=>client.query(sql,params)};
    ledger=new StoreReturnsReadRepository(database as never);
    sellers=new StorePositiveSellersReadRepository(database as never);
  });
  afterEach(async()=>{if(client){await client.query("ROLLBACK");client.release();}});
  afterAll(async()=>{if(pool)await pool.end();if(created)await admin.query(`DROP DATABASE ${name}`);if(admin)await admin.end();});

  const missing = async (forceDaily=true, closeCutoffAt="2026-06-01T00:00:00Z") =>
    (await client.query(incentiveDailySalesCoverageSql,dailySalesCoverageParams({
      companyIds:[id(1)],storeIds:[id(2)],periodStart:"2026-05-01",periodEnd:"2026-05-31",closeCutoffAt,forceDaily,
    }))).rows;

  it("accepts explicit complete zero days and excludes partner financial coverage",async()=>{
    expect(await missing()).toEqual([]);
  });
  it.each(["2026-05-01","2026-05-15","2026-05-31"])("blocks financial close for a missing day %s",async date=>{
    await client.query("DELETE FROM ops.company_daily_kpi_store_sales WHERE store_id=$1 AND business_date=$2",[id(2),date]);
    expect(await missing()).toEqual([{store_id:id(2),business_date:date}]);
  });
  it("honors store open/close dates and refuses data accepted after the close cutoff",async()=>{
    await client.query("UPDATE ops.store SET open_date='2026-05-10',close_date='2026-05-20' WHERE store_id=$1",[id(2)]);
    await client.query("DELETE FROM ops.company_daily_kpi_store_sales WHERE store_id=$1 AND business_date NOT BETWEEN '2026-05-10' AND '2026-05-20'",[id(2)]);
    expect(await missing()).toEqual([]);
    await client.query("UPDATE ops.company_daily_kpi_component_outcome SET accepted_at='2026-06-02',updated_at='2026-06-02' WHERE component_outcome_id=$1",[id(615)]);
    expect((await missing()).filter(row=>row.store_id===id(2))).toEqual([{store_id:id(2),business_date:"2026-05-15"}]);
  });
  it("keeps explicit monthly compatibility but automatic daily close still requires each day",async()=>{
    await client.query("DELETE FROM ops.kpi_actual WHERE scope_type='store' AND period_type='daily' AND store_id=$1",[id(2)]);
    expect(await missing(false)).toEqual([]);
    expect((await missing(true)).filter(row=>row.store_id===id(2))).toHaveLength(31);
  });
  it("does not expose a mismatched or legacy personal net as a verified amount",async()=>{
    await client.query("UPDATE ops.kpi_actual SET actual_value=999 WHERE scope_type='employee' AND employee_id=$1 AND period_start='2026-05-01'",[id(13)]);
    expect((await people()).find(person=>person.employee_id===id(13))).toMatchObject({sale_amount:"100.000000000000",net_amount:null});
    await client.query("UPDATE ops.company_daily_kpi_component_outcome SET return_attribution_version=1 WHERE component_outcome_id=$1",[id(619)]);
    expect((await people()).find(person=>person.employee_id===id(10))?.net_amount).toBeNull();
  });
  it.each([20,25])("clears inactivity immediately when selling again on day %s, in the selected store only",async day=>{
    await client.query("DELETE FROM ops.company_daily_kpi_employee_sales WHERE employee_id=$1",[id(12)]);
    const activity=()=>sellers.listActivity({storeIds:[id(2)],throughDate:`2026-05-${day}`});
    expect((await activity()).find(person=>person.employee_id===id(12))?.no_positive_sales_15_days).toBe(true);
    await client.query(`INSERT INTO ops.company_daily_kpi_employee_sales(component_outcome_id,business_date,store_id,employee_id,sale_invoice_count,return_invoice_count,
      sale_quantity,signed_return_quantity,net_quantity,sale_amount_try,signed_return_amount_try,net_amount_try)
      VALUES($1,$2,$3,$4,1,0,1,0,1,100,0,100)`,[id(600+day),`2026-05-${day}`,id(3),id(12)]);
    expect((await activity()).find(person=>person.employee_id===id(12))?.no_positive_sales_15_days).toBe(true);
    await client.query("UPDATE ops.company_daily_kpi_employee_sales SET store_id=$1 WHERE employee_id=$2",[id(2),id(12)]);
    expect((await activity()).find(person=>person.employee_id===id(12))?.no_positive_sales_15_days).toBe(false);
  });

  it("uses attributed canonical net in legacy workspace tracking and masks inconsistent personnel",async()=>{
    const repository=new SalesTargetIncentiveReadRepository({query:(sql:string,params:unknown[])=>client.query(sql,params)} as never);
    const input={storeIds:[id(2)],periodStart:"2026-05-01",throughDate:"2026-05-31"};
    expect((await repository.listMovementTracking(input)).find(row=>row.employee_id===id(13))?.net_amount).toBe("-100.0000");
    expect((await repository.listDailySalesTracking(input)).find(row=>row.employee_id===id(13))?.actual_amount).toBe("-100.0000");
    await client.query("UPDATE ops.kpi_actual SET actual_value=999 WHERE employee_id=$1 AND period_start='2026-05-01'",[id(13)]);
    expect((await repository.listMovementTracking(input)).find(row=>row.employee_id===id(13))?.net_amount).toBeNull();
    expect((await repository.listDailySalesTracking(input)).find(row=>row.employee_id===id(13))?.actual_amount).toBeNull();
  });

  it("rejects conflicting mappings and never assigns unknown sales to a norm employee",async()=>{
    await client.query("SAVEPOINT invalid_identity");
    await expect(client.query(`INSERT INTO stg.external_id_map(integration_source_id,entity_type,external_id,internal_id)
      VALUES($1,'employee','SELLER-2',$2)`,[id(400),id(13)])).rejects.toThrow("conflicts with a reserved master identity code");
    await client.query("ROLLBACK TO SAVEPOINT invalid_identity");
    await client.query(`INSERT INTO ops.company_daily_kpi_unmapped_personnel_sales(component_outcome_id,business_date,store_id,personnel_code,sale_invoice_count,return_invoice_count,
      sale_quantity,signed_return_quantity,net_quantity,sale_amount_try,signed_return_amount_try,net_amount_try)
      VALUES($1,'2026-05-20',$2,'UNKNOWN-SELLER',1,1,1,-1,0,100,-5,95)`,[id(620),id(2)]);
    await client.query(`INSERT INTO ops.company_daily_kpi_return(return_id,component_outcome_id,business_date,store_id,receiving_store_code,original_store_code,
      personnel_code,direction,return_kind,return_invoice_count,signed_return_quantity,signed_return_amount_try)
      VALUES($1,$2,'2026-05-20',$3,'S1','S1','UNKNOWN-SELLER','received','same_store',1,-1,-5)`,[id(706),id(620),id(2)]);
    await client.query("UPDATE ops.company_daily_kpi_store_sales SET sale_invoice_count=1,return_invoice_count=2,sale_quantity=1,signed_return_quantity=-5,net_quantity=-4,sale_amount_try=100,signed_return_amount_try=-655,net_amount_try=-555 WHERE store_id=$1 AND business_date='2026-05-20'",[id(2)]);
    await client.query("UPDATE ops.kpi_actual SET actual_value=-555 WHERE scope_type='store' AND store_id=$1 AND period_start='2026-05-20'",[id(2)]);
    const activity=await sellers.listActivity({storeIds:[id(2)],throughDate:"2026-05-20"});
    expect(activity.find(person=>person.employee_id===id(12))?.no_positive_sales_15_days).toBe(true);
    expect((await read("other")).rows.find(row=>row.returnId===id(706))).toMatchObject({employeeId:null,category:"review_required"});
    expect((await people()).find(person=>person.employee_id===null)).toMatchObject({personnel_code:"UNKNOWN-SELLER"});
  });

  it("classifies historical norm/cross returns and keeps external returns informational",async()=>{
    const inside=await read(); const other=await read("other");
    expect(inside.rows.map(row=>row.returnId)).toEqual([id(700)]);
    expect(other.rows.find(row=>row.returnId===id(701))?.category).toBe("out_of_norm");
    expect(other.rows.find(row=>row.returnId===id(702))?.category).toBe("out_of_norm");
    expect(other.rows.find(row=>row.returnId===id(703))?.category).toBe("cross_store");
    expect(other.rows.find(row=>row.returnId===id(704))).toMatchObject({direction:"external",category:"cross_store"});
    expect(inside.totals).toEqual(other.totals);
    expect(inside.totals).toMatchObject({receivedSignedAmount:"-650.000000000000",receivedInvoiceCount:1,externalSignedAmount:"-400.000000000000",netSales:"950.0000"});
    expect(inside.coverage).toMatchObject({coveredDays:31,expectedDays:31,status:"complete",missingDates:[]});
  });

  it("includes targetless and negative-net positive sellers without creating norms or financial rows",async()=>{
    const before=await client.query("SELECT COUNT(*)::int AS n FROM ops.employee_assignment_history");

    expect((await people()).find(person=>person.employee_id===id(13))).toMatchObject({sale_amount:"100.000000000000",net_amount:"-100.0000",position_code:null});
    expect((await people()).map(person=>person.employee_id)).toEqual([id(10),id(12),id(13)]);
    expect((await client.query("SELECT COUNT(*)::int AS n FROM ops.employee_assignment_history")).rows).toEqual(before.rows);
    expect((await client.query("SELECT actual_sales_amount::text FROM rpt.sales_target_incentive_final_row WHERE sales_target_incentive_final_row_id=$1",[id(40)])).rows[0]).toEqual({actual_sales_amount:"1200.0000"});
  });

  it("preserves old aliases and never lets a future sale or assignment relabel an earlier return",async()=>{
    await client.query(`UPDATE ops.store SET store_code='S1-NEW' WHERE store_id='${id(2)}';
      UPDATE ops.employee SET external_employee_ref='SELLER-1-NEW' WHERE employee_id='${id(10)}';
      INSERT INTO ops.employee_assignment_history(employee_id,store_id,region_id,position_id,start_date)
        VALUES('${id(13)}','${id(2)}','${id(6)}','${id(8)}','2026-05-25');
      INSERT INTO ops.company_daily_kpi_employee_sales(component_outcome_id,business_date,store_id,employee_id,sale_invoice_count,return_invoice_count,
        sale_quantity,signed_return_quantity,net_quantity,sale_amount_try,signed_return_amount_try,net_amount_try)
        VALUES('${id(625)}','2026-05-25','${id(2)}','${id(12)}',1,0,1,0,1,100,0,100)`);
    expect((await read()).rows[0]).toMatchObject({returnId:id(700),originalStoreCode:"S1",originalStoreName:"Synthetic Store 1",employeeId:id(10)});
    expect((await read("other")).rows.find(row=>row.returnId===id(701))?.category).toBe("out_of_norm");
    expect((await read("other")).rows.find(row=>row.returnId===id(702))?.category).toBe("out_of_norm");
  });

  it("does not infer zeros or inactive staff from a missing completed store day",async()=>{
    await client.query(`DELETE FROM ops.company_daily_kpi_store_sales WHERE store_id='${id(2)}' AND business_date='2026-05-10'`);
    expect((await read()).coverage).toMatchObject({coveredDays:30,status:"partial",missingDates:["2026-05-10"]});
    expect((await read("other")).rows.find(row=>row.returnId===id(701))?.category).toBe("review_required");
  });

  it("clears the15-day warning on a new positive in that store and requires all15 days",async()=>{
    expect((await people()).find(person=>person.employee_id===id(12))?.no_positive_sales_15_days).toBe(true);
    await client.query(`UPDATE ops.company_daily_kpi_employee_sales SET business_date='2026-05-31',component_outcome_id='${id(631)}'
      WHERE store_id='${id(2)}' AND employee_id='${id(12)}' AND business_date='2026-05-01'`);
    expect((await people()).find(person=>person.employee_id===id(12))?.no_positive_sales_15_days).toBe(false);
  });

  it("includes registered partner stores while rejecting unauthorized stores and retaining empty pagination totals",async()=>{
    expect((await read("other",id(4))).totals).toMatchObject({receivedSignedAmount:"-75.000000000000",receivedInvoiceCount:1,netSales:"-75.0000"});
    expect(await ledger.canReadStore({storeId:id(2),scope:{companyIds:[id(9)],regionIds:[id(6)],storeIds:[]}})).toBe(false);
    await expect(ledger.getLedger({storeId:id(2),scope:{companyIds:[],regionIds:[id(6)],storeIds:[id(3)]},periodStart:"2026-05-01",periodEnd:"2026-05-31",category:"other",limit:50,offset:0})).rejects.toThrow("Store not found");
    const empty=await read("other",id(2),50); expect(empty.rows).toEqual([]);expect(empty.page.total).toBe(4);
  });
});
