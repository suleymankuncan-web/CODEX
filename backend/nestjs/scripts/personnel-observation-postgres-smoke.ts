import "reflect-metadata";
import * as assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";
import { DatabaseService } from "../src/shared/database/database.service";
import { buildDatabasePoolConfig } from "../src/shared/database/database-pool-config";
import { PersonnelObservationRepository } from "../src/modules/integration/infrastructure/personnel-observation.repository";

let stage = "configuration";
async function main() {
  // This program can only write the explicitly named disposable clone.
  if (process.env.PERSONNEL_OBSERVATION_SMOKE !== "synthetic-disposable") throw new Error("fixture_only");
  const url = new URL(readFileSync("/run/secrets/migrator_database_url", "utf8").trim());
  url.pathname = "/hr_axis_observations_smoke";
  const pool = new Pool(buildDatabasePoolConfig({ databaseUrl:url.toString(),sslMode:"verify-full",
    sslCa:readFileSync("/run/secrets/postgres_tls_ca","utf8"),poolMax:3,
    connectionTimeoutMs:5000,idleTimeoutMs:10000,queryTimeoutMs:30000,statementTimeoutMs:30000 }));
  try {
    stage = "connection";
    const identity=await pool.query("SELECT current_database() AS name");
    assert.equal(identity.rows[0].name,"hr_axis_observations_smoke");
    const db=new DatabaseService(pool);
    const repo=new PersonnelObservationRepository(db);
    stage = "fixture-source";
    const source=await pool.query(`INSERT INTO stg.integration_source(source_code,source_name,entity_type)
      VALUES ('synthetic-observation-smoke','Synthetic observation smoke','kpi') RETURNING integration_source_id`);
    const sourceId:string=source.rows[0].integration_source_id;
    const stores=await pool.query(`SELECT store_id,store_code,company_id FROM ops.store
      WHERE status='active' AND kpi_import_enabled ORDER BY store_id LIMIT 2`);
    assert.equal(stores.rows.length,2);
    const [a,b]=stores.rows;
    const before=await pool.query(`SELECT (SELECT count(*) FROM ops.employee)::text AS employees,
      (SELECT count(*) FROM ops.employee_assignment_history)::text AS assignments`);
    const day="2026-09-06";
    const g1=await repo.beginAttempt(sourceId,day);
    const input={sourceId,businessDate:day,generation:g1,digest:"a".repeat(64),observations:[
      {storeCode:a.store_code,personnelCode:"synthetic-code-001"},
      {storeCode:b.store_code,personnelCode:"synthetic-code-001"},
      {storeCode:"synthetic-unmapped-store",personnelCode:"synthetic-code-002"}]};
    assert.deepEqual(await repo.replace(input),{acceptedCount:2,excludedCount:1,unchanged:false});
    assert.deepEqual(await repo.replace(input),{acceptedCount:2,excludedCount:1,unchanged:true});
    const competing=await Promise.all([repo.beginAttempt(sourceId,day),repo.beginAttempt(sourceId,day)]);
    competing.sort((x,y)=>BigInt(x)<BigInt(y)?-1:1);
    const newest={...input,generation:competing[1],digest:"b".repeat(64),observations:[input.observations[0]]};
    await repo.replace(newest);
    await assert.rejects(repo.replace({...input,generation:competing[0]}));
    const scoped=await repo.list({actorCompanyIds:[a.company_id],fromDate:day,toDate:day,limit:20,offset:0});
    assert.equal(scoped.total,1);
    const denied=await repo.list({actorCompanyIds:["00000000-0000-4000-8000-999999999999"],fromDate:day,toDate:day,limit:20,offset:0});
    assert.equal(denied.total,0);
    await pool.query(`CREATE FUNCTION ops.synthetic_observation_fail() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.personnel_code='synthetic-fail' THEN RAISE EXCEPTION 'synthetic failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER synthetic_observation_fail BEFORE INSERT ON ops.personnel_observation
      FOR EACH ROW EXECUTE FUNCTION ops.synthetic_observation_fail()`);
    const failedGeneration=await repo.beginAttempt(sourceId,day);
    await assert.rejects(repo.replace({...input,generation:failedGeneration,digest:"c".repeat(64),
      observations:[{storeCode:a.store_code,personnelCode:"synthetic-fail"}]}));
    assert.equal((await repo.list({actorCompanyIds:[a.company_id],fromDate:day,toDate:day,limit:20,offset:0})).total,1);
    await pool.query("DROP TRIGGER synthetic_observation_fail ON ops.personnel_observation; DROP FUNCTION ops.synthetic_observation_fail()");
    const nextDay="2026-09-07";
    const nextGeneration=await repo.beginAttempt(sourceId,nextDay);
    await repo.replace({...input,businessDate:nextDay,generation:nextGeneration,digest:"d".repeat(64),observations:[]});
    assert.equal((await repo.list({actorCompanyIds:[a.company_id],fromDate:day,toDate:nextDay,limit:20,offset:0})).total,1);
    const after=await pool.query(`SELECT (SELECT count(*) FROM ops.employee)::text AS employees,
      (SELECT count(*) FROM ops.employee_assignment_history)::text AS assignments`);
    assert.deepEqual(after.rows,before.rows);
    const rollback=readFileSync(resolve(process.cwd(),"../../db/rollback/076_sales_personnel_observations_v1.rollback.sql"),"utf8");
    const client=await pool.connect();
    try {
      await assert.rejects(client.query(rollback));
      await client.query("ROLLBACK");
      assert.equal((await client.query("SELECT count(*)::int AS count FROM ops.personnel_observation")).rows[0].count,1);
      await client.query("TRUNCATE ops.personnel_observation,ops.personnel_observation_attempt");
      await client.query(rollback);
      assert.equal((await client.query("SELECT to_regclass('ops.personnel_observation') AS table_name")).rows[0].table_name,null);
    } finally {client.release();}
    console.log(JSON.stringify({event:"personnel_observation.postgres_smoke",passed:true,
      checks:["retry","stale-generation","multi-store","unmapped-exclusion","company-scope","atomic-failure","absence-preserves-history","no-employment-writes","rollback-refuses-data","empty-rollback"]}));
  } finally {await pool.end();}
}
void main().catch(error=>{
  const code = error && typeof error === "object" && "code" in error && typeof error.code === "string"
    && /^[A-Z0-9_]{1,64}$/.test(error.code) ? error.code : "UNCLASSIFIED";
  const reason = error instanceof Error && /timeout/i.test(error.message) ? "timeout"
    : error instanceof Error && /certificate/i.test(error.message) ? "certificate"
    : error instanceof Error && /password authentication/i.test(error.message) ? "authentication"
    : error instanceof Error && /pg_hba/i.test(error.message) ? "pg_hba"
    : "unclassified";
  const frames = error instanceof Error ? error.stack?.split("\n").slice(1, 5)
    .filter(line => /^\s+at /.test(line)) : [];
  console.error(JSON.stringify({event:"personnel_observation.postgres_smoke_failed",stage,code,reason,frames}));
  process.exitCode=1;
});
