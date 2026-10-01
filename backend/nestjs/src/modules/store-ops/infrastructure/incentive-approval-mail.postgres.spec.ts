import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cycleDatabase, cycleId as id, cyclePeriod as period, seedCompanyCycle } from "./incentive-company-cycle.postgres-fixture";
import { IncentiveCompanyCycleRepository } from "./incentive-company-cycle.repository";
import { IncentiveApprovalMailRepository } from "./incentive-approval-mail.repository";
import { openCompanyRemediation } from "./incentive-company-remediation";
import { enqueueApprovalMail } from "./incentive-approval-mail-event";
import { companyPayloadSql, companyResponsibilitySql } from "./incentive-company-seal.sql";

const url=process.env.INCENTIVE_PARTICIPATION_POSTGRES_URL;
const describePg=url ? describe : describe.skip;
jest.setTimeout(20000);
describePg("approval notification PostgreSQL boundary",()=>{
  const name=`incentive_mail_${randomUUID().replaceAll("-","").slice(0,12)}`;
  let admin:Pool; let pool:Pool;
  const repo=()=>new IncentiveApprovalMailRepository(cycleDatabase(pool) as never);
  const cycle=()=>new IncentiveCompanyCycleRepository(cycleDatabase(pool) as never);
  const approve=async(stage:"sales_director"|"hr"|"general_manager",sealed:Awaited<ReturnType<IncentiveCompanyCycleRepository["seal"]>>)=>
    cycle().decide({companyId:id(1),period,cycleId:sealed.cycleId,revision:sealed.revision,sealHash:sealed.sealHash,stage,decision:"approve",actorId:id(stage==="sales_director" ? 22 : stage==="hr" ? 23 : 24)});
  beforeAll(async()=>{
    admin=new Pool({connectionString:url}); await admin.query(`CREATE DATABASE "${name}"`);
    const parsed=new URL(url!); parsed.pathname=`/${name}`; pool=new Pool({connectionString:parsed.href});
  });
  beforeEach(async()=>seedCompanyCycle(pool));
  afterAll(async()=>{await pool?.end(); if(admin){await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);await admin.end();}});

  it("persists only approved decisions; rollback/return cannot emit mail",async()=>{
    const sealed=await cycle().seal({companyId:id(1),period,actorId:id(22),expectedRevision:0});
    const broken=new IncentiveCompanyCycleRepository(cycleDatabase(pool,{beforeCommit:async()=>{throw new Error("rollback");}}) as never);
    await expect(broken.decide({companyId:id(1),period,cycleId:sealed.cycleId,revision:1,sealHash:sealed.sealHash,stage:"sales_director",decision:"approve",actorId:id(22)})).rejects.toThrow("rollback");
    expect(await repo().events()).toEqual([]);
    await cycle().decide({companyId:id(1),period,cycleId:sealed.cycleId,revision:1,sealHash:sealed.sealHash,stage:"sales_director",decision:"return",reasonNote:"Return",actorId:id(22)});
    expect(await repo().events()).toEqual([]);
  });
  it("BM submission goes only to live sales director capability and is idempotent",async()=>{
    const input={key:"submission:test",companyId:id(1),period,stage:"region_manager" as const,actorId:id(20),packageId:id(80)};
    await enqueueApprovalMail(pool,input); await enqueueApprovalMail(pool,input);
    const [event]=await repo().events(); await Promise.all([repo().expand(event,[]),repo().expand(event,[])]);
    expect(await repo().pending(event.event_id)).toEqual([expect.objectContaining({user_id:id(22),audience:"sales_director",recipient:"synthetic-22@example.test"})]);
    await pool.query("UPDATE ops.user_permission_assignment SET revoked_at=clock_timestamp(),revoked_by_user_id=$2::uuid,revoke_reason='Synthetic revoke' WHERE user_id=$1::uuid",[id(22),id(26)]);
    const [delivery]=await repo().pending(event.event_id); expect(await repo().claim(event,delivery,[])).toBe(false);
  });
  it("SD → HR and HR → GM require matching persona/capability, excluding generic viewers",async()=>{
    const sealed=await cycle().seal({companyId:id(1),period,actorId:id(22),expectedRevision:0});
    await approve("sales_director",sealed); const [sd]=await repo().events(); await repo().expand(sd,["ik@example.test"]);
    const recipients=await repo().pending(sd.event_id);
    expect(recipients.map(r=>r.recipient).sort()).toEqual(["ik@example.test","synthetic-23@example.test","synthetic-25@example.test"]);
    await approve("hr",sealed); const hr=(await repo().events()).find(e=>e.stage==="hr")!;await repo().expand(hr,[]);
    expect(await repo().pending(hr.event_id)).toEqual([expect.objectContaining({user_id:id(24),audience:"general_manager"})]);
  });
  it("GM final notifies all company BMs/SD/HR while only HR receives a guarded workbook claim",async()=>{
    const sealed=await cycle().seal({companyId:id(1),period,actorId:id(22),expectedRevision:0});
    await approve("sales_director",sealed);await approve("hr",sealed);await approve("general_manager",sealed);
    const event=(await repo().events()).find(e=>e.stage==="general_manager")!;
    await repo().expand(event,["synthetic-23@example.test"]);
    expect((await repo().pending(event.event_id)).map(r=>r.user_id).sort()).toEqual([id(20),id(21),id(22),id(25)]);
    expect(await repo().hrMailboxSafe(id(1),["synthetic-22@example.test"])).toBe(false);
    expect(await repo().hrMailboxSafe(id(1),["synthetic-20@example.test"])).toBe(false);
    expect(await repo().hrMailboxSafe(id(1),["synthetic-23@example.test"])).toBe(true);
    await expect(repo().claimFinalHr(event,["synthetic-22@example.test"],"a".repeat(64))).rejects.toThrow("HR only");
    const attempts=await Promise.all([repo().claimFinalHr(event,["synthetic-23@example.test"],"a".repeat(64)),repo().claimFinalHr(event,["synthetic-23@example.test"],"a".repeat(64))]);
    expect(attempts.filter(Boolean)).toHaveLength(1);
    const record=(await pool.query("SELECT created_by_user_id::text,delivery_origin,recipients,final_seal_hash FROM ops.incentive_hr_delivery WHERE period_key=$1",[period])).rows[0];
    expect(record).toMatchObject({created_by_user_id:id(24),delivery_origin:"gm_final",recipients:["synthetic-23@example.test"],final_seal_hash:sealed.sealHash});
    await expect(pool.query("UPDATE ops.incentive_hr_delivery SET recipients=ARRAY['synthetic-22@example.test'] WHERE period_key=$1",[period])).rejects.toThrow("immutable");
    await pool.query("UPDATE ops.company SET status='inactive' WHERE company_id=$1::uuid",[id(1)]);
    expect(await repo().hrMailboxSafe(id(1),["ik@example.test"])).toBe(false);
    const manager=(await repo().pending(event.event_id)).find(d=>d.user_id===id(20))!;
    expect(await repo().claim(event,manager,[])).toBe(false);
  });
  it("an automatic HR send cannot borrow another actor or a pre-final decision",async()=>{
    const sealed=await cycle().seal({companyId:id(1),period,actorId:id(22),expectedRevision:0});
    await approve("sales_director",sealed); const event=(await repo().events())[0];
    await expect(repo().claimFinalHr({...event,actor_user_id:id(24)},["ik@example.test"],"a".repeat(64))).rejects.toThrow("exact General Manager");
    await approve("hr",sealed);await approve("general_manager",sealed);
    const final=(await repo().events()).find(e=>e.stage==="general_manager")!;
    await expect(repo().claimFinalHr({...final,actor_user_id:id(23)},["ik@example.test"],"a".repeat(64))).rejects.toThrow("exact General Manager");
  });
  it("a BM role in another company cannot borrow a directly assigned store for final notices",async()=>{
    await pool.query("INSERT INTO ops.user_role_assignment(user_id,role_id,company_id,scope_type,start_at) VALUES($1,$2,$3,'company','2020-01-01')",[id(26),id(70),id(9)]);
    await pool.query("INSERT INTO ops.user_action_store_assignment(user_id,store_id,start_at) VALUES($1,$2,'2020-01-01')",[id(26),id(2)]);
    await expect(openCompanyRemediation(pool,period,id(2),id(26))).rejects.toThrow("Current assigned manager authority");
    const sealed=await cycle().seal({companyId:id(1),period,actorId:id(22),expectedRevision:0});
    await approve("sales_director",sealed);await approve("hr",sealed);await approve("general_manager",sealed);
    const event=(await repo().events()).find(e=>e.stage==="general_manager")!;await repo().expand(event,["ik@example.test"]);
    const deliveries=await repo().pending(event.event_id);
    expect(deliveries.some(d=>d.user_id===id(26))).toBe(false);
    const bm=deliveries.find(d=>d.user_id===id(20))!;
    await pool.query("UPDATE ops.user_role_assignment SET company_id=$2 WHERE user_id=$1 AND role_id=$3",[id(20),id(9),id(70)]);
    expect(await repo().claim(event,bm,[])).toBe(false);
  });
  it("a full batch of unconfigured old events cannot starve later valid approvals",async()=>{
    for(let n=0;n<101;n++) await enqueueApprovalMail(pool,{key:`submission:queue:${n}`,companyId:id(1),period,stage:"region_manager",actorId:id(20),packageId:id(80)});
    const batch=await repo().events();expect(batch).toHaveLength(100);
    const blocked=new Set(batch.map(e=>e.event_id));
    for(const event of batch) await repo().attempted(event.event_id);
    const next=await repo().events();expect(blocked.has(next[0].event_id)).toBe(false);
    await repo().expand(next[0],[]);const [delivery]=await repo().pending(next[0].event_id);
    expect(await repo().claim(next[0],delivery,[])).toBe(true);
    expect((await pool.query("SELECT COUNT(*)::int AS count FROM ops.incentive_approval_mail_delivery WHERE status='sent'")).rows[0].count).toBe(0);
  });
  it("preserves pending seals from before supplemental drawer sales were archived",async()=>{
    const responsibility=(await pool.query(companyResponsibilitySql,[id(1),period])).rows;
    // Produce the old format from these exact sources; retain PostgreSQL numeric text and timestamps.
    const legacy=(await pool.query(`SELECT payload::text AS payload_text FROM (${companyPayloadSql}) archived`,
      [id(1),period,[id(80),id(81)],JSON.stringify(responsibility),null])).rows[0];
    const cycleId=id(405);
    await pool.query("INSERT INTO ops.incentive_company_cycle(cycle_id,company_id,period_key) VALUES($1,$2,$3)",[cycleId,id(1),period]);
    const revision=(await pool.query("INSERT INTO ops.incentive_company_revision(cycle_id,revision_no,seal_hash,payload,sealed_by_user_id) VALUES($1,1,encode(digest($2::jsonb::text,'sha256'),'hex'),$2::jsonb,$3) RETURNING seal_hash",[cycleId,legacy.payload_text,id(22)])).rows[0];
    await pool.query("UPDATE ops.incentive_company_cycle SET current_revision=1,stage='sales_director' WHERE cycle_id=$1",[cycleId]);
    await expect(cycle().decide({companyId:id(1),period,cycleId,revision:1,sealHash:revision.seal_hash,stage:'sales_director',actorId:id(22),decision:'approve'})).resolves.toMatchObject({stage:'hr',total:'225.00'});
  });
  it("migration reapplication preserves recorded outbox/delivery data",async()=>{
    await enqueueApprovalMail(pool,{key:"submission:persist",companyId:id(1),period,stage:"region_manager",actorId:id(20),packageId:id(80)});
    await pool.query(readFileSync(resolve(process.cwd(),"../../db/migrations/100_incentive_approval_mail_v1.sql"),"utf8"));
    expect(await repo().events()).toHaveLength(1);
  });
});
