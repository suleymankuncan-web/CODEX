import { ConflictException, ForbiddenException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { IncentiveCompanyCycleRepository } from "./incentive-company-cycle.repository";
import { IncentiveHrHandoffRepository, hrSnapshotReady, hrSnapshotVersion } from "./incentive-hr-handoff.repository";
import { SalesTargetIncentiveParticipationRepository } from "./sales-target-incentive-participation.repository";
import { SalesTargetIncentiveManagerPackageRepository } from "./sales-target-incentive-manager-package.repository";
import { SalesTargetIncentiveApprovalRepository } from "./sales-target-incentive-approval.repository";
import { SalesTargetIncentiveCorrectionRepository } from "./sales-target-incentive-correction.repository";
import { cycleDatabase, cycleId as id, cyclePeriod as period, seedCompanyCycle } from "./incentive-company-cycle.postgres-fixture";
import { packageFinancialReadSql } from "./incentive-package-financial-version";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const url = process.env.INCENTIVE_PARTICIPATION_POSTGRES_URL;
const describePostgres = url ? describe : describe.skip;
jest.setTimeout(20000);
describePostgres("sealed company approval PostgreSQL boundary", () => {
  const name = `incentive_cycle_${randomUUID().replaceAll("-", "").slice(0,16)}`;
  let admin: Pool; let pool: Pool; let created = false;
  const db = () => cycleDatabase(pool);
  const repo = () => new IncentiveCompanyCycleRepository(db() as never);
  const seal = () => repo().seal({ companyId:id(1),period,actorId:id(22),expectedRevision:0 });
  const decide = (sealed: Awaited<ReturnType<typeof seal>>, stage: "sales_director" | "hr" | "general_manager", actorId = id(stage === "sales_director" ? 22 : stage === "hr" ? 23 : 24), decision: "approve" | "return" = "approve") => repo().decide({ companyId:id(1),period,cycleId:sealed.cycleId,revision:sealed.revision,sealHash:sealed.sealHash,stage,actorId,decision,...(decision === "return" ? { reasonNote:"Synthetic return" } : {}) });
  beforeAll(async () => {
    admin = new Pool({ connectionString:url }); await admin.query(`CREATE DATABASE ${name}`); created=true;
    const owned = new URL(url!); owned.pathname=`/${name}`; pool = new Pool({ connectionString:owned.toString() });
  });
  beforeEach(async () => seedCompanyCycle(pool));
  afterAll(async () => { await pool?.end(); if(created) await admin.query(`DROP DATABASE ${name} WITH (FORCE)`); await admin?.end(); });

  it("seals every manager/store with complete included norm roster and binds ordered decisions to one hash", async () => {
    const sealed=await seal(); expect(sealed.total).toBe("225.00");
    const detail=await repo().read(id(1),period,id(23));
    expect(detail.revisions[0].payload.roster).toHaveLength(3);
    expect(detail.revisions[0].payload.rows).toHaveLength(2);
    expect(detail.revisions[0].payload.proposals).toHaveLength(1);
    expect(detail.revisions[0].payload.responsibility).toEqual([{store_id:id(2),owners:[id(20)]},{store_id:id(3),owners:[id(21)]}]);
    await expect(decide(sealed,"hr")).rejects.toBeInstanceOf(ConflictException);
    await decide(sealed,"sales_director"); await decide(sealed,"hr");
    expect((await pool.query("SELECT COUNT(*)::int AS count FROM ops.sales_target_incentive_adjustment")).rows[0].count).toBe(0);
    expect((await pool.query("SELECT package_status FROM ops.sales_target_incentive_region_package WHERE period_key=$1",[period])).rows.every(p=>p.package_status==="submitted")).toBe(true);
    await decide(sealed,"general_manager");
    expect((await pool.query("SELECT before_amount::text,after_amount::text,adjustment_amount::text,evidence FROM ops.sales_target_incentive_adjustment")).rows).toEqual([expect.objectContaining({before_amount:"100.00",after_amount:"125.00",adjustment_amount:"25.00",evidence:expect.objectContaining({companySealHash:sealed.sealHash,regionCorrectionId:id(90)})})]);
    await expect(decide(sealed,"general_manager")).rejects.toBeInstanceOf(ConflictException);
    expect((await repo().read(id(1),period,id(25))).decisions).toHaveLength(3);
  });

  it.each([
    ["missing owner",`DELETE FROM ops.user_action_store_assignment WHERE store_id='${id(3)}'`],
    ["ambiguous owner",`INSERT INTO ops.user_action_store_assignment(user_id,store_id,start_at) VALUES('${id(20)}','${id(3)}','2020-01-01')`],
    ["source not closed",`INSERT INTO ops.store(store_id,company_id,region_id,store_code,store_name,store_type) VALUES('${id(4)}','${id(1)}','${id(6)}','S3','Unclosed','company'); INSERT INTO ops.user_action_store_assignment(user_id,store_id,start_at) VALUES('${id(20)}','${id(4)}','2020-01-01')`],
    ["missing review",`UPDATE ops.sales_target_incentive_store_review SET review_status='pending_review',reviewed_by_user_id=NULL,reviewed_at=NULL WHERE store_id='${id(3)}'`],
    ["not submitted",`UPDATE ops.sales_target_incentive_region_package SET package_status='admin_returned',reviewed_by_user_id='${id(22)}',reviewed_at=NOW(),review_note='Not ready' WHERE sales_target_incentive_region_package_id='${id(81)}'`],
    ["expired current ownership",`UPDATE ops.user_action_store_assignment SET end_at=NOW()-INTERVAL '1 day' WHERE store_id='${id(3)}'`],
  ])("fails closed sealing %s",async (_label,sql)=> { await pool.query(sql); await expect(seal()).rejects.toBeInstanceOf(ConflictException); expect((await pool.query("SELECT COUNT(*)::int AS count FROM ops.incentive_company_revision")).rows[0].count).toBe(0); });

  it.each(["sales_director","hr","general_manager"] as const)("rejects wrong actor and revoked %s capability",async stage=> {
    const sealed=await seal(); if(stage!=="sales_director") await decide(sealed,"sales_director"); if(stage==="general_manager") await decide(sealed,"hr");
    await expect(decide(sealed,stage,id(26))).rejects.toBeInstanceOf(ForbiddenException);
    const actor=id(stage==="sales_director" ? 22 : stage==="hr" ? 23 : 24);
    await pool.query("UPDATE ops.user_permission_assignment SET revoked_at=NOW(),revoked_by_user_id=$2::uuid,revoke_reason='Synthetic revoke' WHERE user_id=$1::uuid",[actor,id(26)]);
    await expect(decide(sealed,stage)).rejects.toBeInstanceOf(ForbiddenException);
    expect((await pool.query("SELECT COUNT(*)::int AS count FROM ops.incentive_company_decision WHERE stage=$1",[stage])).rows[0].count).toBe(0);
  });

  it("rejects cross-company and legacy-grant-only actors without using the wider read scope",async()=> {
    const sealed=await seal(); await expect(repo().read(id(9),period,id(23))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(repo().decide({companyId:id(9),period,cycleId:sealed.cycleId,revision:1,sealHash:sealed.sealHash,stage:"sales_director",actorId:id(22),decision:"approve"})).rejects.toBeInstanceOf(ConflictException);
    await pool.query("UPDATE ops.user_permission_assignment SET revoked_at=NOW(),revoked_by_user_id=$2::uuid,revoke_reason='Legacy is not stage permission' WHERE user_id=$1::uuid",[id(22),id(26)]);
    await expect(decide(sealed,"sales_director")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("archives names and individual money; later live metadata changes cannot carry earlier approvals",async()=> {
    const sealed=await seal(); await decide(sealed,"sales_director");
    await pool.query("UPDATE ops.employee SET first_name='Changed' WHERE employee_id=$1::uuid",[id(12)]);
    const detail=await repo().read(id(1),period,id(23)); expect(detail.revisions[0].payload.roster.find(p=>p.employee_id===id(12))?.display_name).toBe("Norm Only");
    await expect(decide(sealed,"hr")).rejects.toBeInstanceOf(ConflictException);
    await decide(sealed,"hr",id(23),"return");
    const replacement=await repo().seal({companyId:id(1),period,actorId:id(22),expectedRevision:1});
    expect(replacement.stage).toBe("sales_director"); expect(replacement.revision).toBe(2); expect(replacement.sealHash).not.toBe(sealed.sealHash);
    const history=await repo().read(id(1),period,id(23)); expect(history.revisions).toHaveLength(2); expect(history.decisions).toHaveLength(2);
    expect(history.revisions[0].payload.roster.find(p=>p.employee_id===id(12))?.display_name).toBe("Norm Only");
  });

  it("rejects offsetting individual proposal changes even when company total stays identical",async()=> {
    const sealed=await seal(); await decide(sealed,"sales_director");
    await pool.query("UPDATE ops.sales_target_incentive_region_correction SET final_amount=135 WHERE sales_target_incentive_region_correction_id=$1::uuid",[id(90)]);
    await pool.query(`INSERT INTO ops.sales_target_incentive_region_correction(region_package_id,company_id,region_id,store_id,employee_id,participant_type,final_row_id,period_key,before_amount,final_amount,reason_note,correction_status,created_by_user_id,submitted_by_user_id,submitted_at)
      VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,'personnel',$6::uuid,$7,100,90,'Offsetting synthetic proposal','submitted',$8::uuid,$8::uuid,'2026-06-03')`,[id(81),id(1),id(6),id(3),id(11),id(41),period,id(21)]);
    const amounts=await Promise.all([id(80),id(81)].map(async packageId=>(await pool.query(packageFinancialReadSql,[packageId])).rows[0].frozen_total_amount));
    expect(amounts).toEqual(["135.00","90.00"]); expect(amounts.reduce((total,value)=>total+Number(value),0).toFixed(2)).toBe(sealed.total);
    await expect(decide(sealed,"hr")).rejects.toBeInstanceOf(ConflictException);
    const archived=(await repo().read(id(1),period,id(23))).revisions[0];
    expect(archived.payload.rows.map(row=>row.proposed_amount)).toEqual(["125.00","100.00"]);
    expect(archived.seal_hash).toBe(sealed.sealHash);
  });

  it("return permits own-scope RM remediation, preserves untouched submissions, resets changed store review and reseals at SD",async()=> {
    const sealed=await seal(); await decide(sealed,"sales_director"); await decide(sealed,"hr",id(23),"return");
    const participation=new SalesTargetIncentiveParticipationRepository(db() as never);
    await expect(participation.setParticipation({period,storeId:id(2),employeeId:id(12),included:false,reasonNote:"Norm-only exclusion",expectedRevision:0,expectedSnapshotId:id(30),actorUserId:id(21)})).rejects.toBeInstanceOf(ForbiddenException);
    await participation.setParticipation({period,storeId:id(2),employeeId:id(12),included:false,reasonNote:"Norm-only exclusion",expectedRevision:0,expectedSnapshotId:id(30),actorUserId:id(20)});
    expect((await pool.query("SELECT package_status FROM ops.sales_target_incentive_region_package WHERE sales_target_incentive_region_package_id=$1::uuid",[id(81)])).rows[0].package_status).toBe("submitted");
    await expect(repo().seal({companyId:id(1),period,actorId:id(22),expectedRevision:1})).rejects.toBeInstanceOf(ConflictException);
    const approval=new SalesTargetIncentiveApprovalRepository(db() as never);
    await approval.markStoreReview({periodKey:period,store:{companyId:id(1),regionId:id(6),storeId:id(2)},actorUserId:id(20),reviewStatus:"reviewed",expectedParticipationRevision:1,expectedSnapshotId:id(30)});
    await new SalesTargetIncentiveManagerPackageRepository(db() as never).submit({companyId:id(1),periodKey:period,managerUserId:id(20),storeIds:[id(2)],submissionNote:null});
    const replacement=await repo().seal({companyId:id(1),period,actorId:id(22),expectedRevision:1}); expect(replacement.stage).toBe("sales_director");
    const detail=await repo().read(id(1),period,id(23)); expect(detail.revisions[0].payload.roster.find(p=>p.employee_id===id(12))?.included).toBe(true);
    expect(detail.revisions[1].payload.roster.find(p=>p.employee_id===id(12))).toMatchObject({included:false,reason_note:"Norm-only exclusion"});
  });

  it("denies both old package approval paths and admin monetary fallback on pending new-contract data",async()=> {
    await expect(new SalesTargetIncentiveManagerPackageRepository(db() as never).review({periodKey:period,packageId:id(80),submittedAt:null,actorUserId:id(22),companyIds:[id(1)],decision:"admin_approved",reviewNote:null})).rejects.toBeInstanceOf(ConflictException);
    await expect(new SalesTargetIncentiveCorrectionRepository(db() as never).applyAdminFinalRowCorrection({periodKey:period,storeId:id(2),employeeId:id(10),participantType:"personnel",adjustmentAmount:"10",reasonCode:"synthetic",reasonNote:"No bypass",actorUserId:id(26),readScope:{companyIds:[id(1)],regionIds:[],storeIds:[],allowGlobalScope:false}})).rejects.toBeInstanceOf(ConflictException);
    await expect(pool.query("UPDATE ops.sales_target_incentive_region_package SET package_status='admin_approved',reviewed_by_user_id=$2::uuid,reviewed_at=NOW() WHERE sales_target_incentive_region_package_id=$1::uuid",[id(80),id(22)])).rejects.toThrow("General Manager");
    expect((await pool.query("SELECT COUNT(*)::int AS count FROM ops.sales_target_incentive_adjustment")).rows[0].count).toBe(0);
  });

  it("rolls back GM decision and every payment atomically on failure and permits only one concurrent decision",async()=> {
    const sealed=await seal(); const results=await Promise.allSettled([decide(sealed,"sales_director"),decide(sealed,"sales_director")]);
    expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1); await decide(sealed,"hr");
    const failing=new IncentiveCompanyCycleRepository(cycleDatabase(pool,{beforeCommit:async()=>{throw new Error("Synthetic atomic failure");}}) as never);
    await expect(failing.decide({companyId:id(1),period,cycleId:sealed.cycleId,revision:1,sealHash:sealed.sealHash,stage:"general_manager",actorId:id(24),decision:"approve"})).rejects.toThrow("Synthetic atomic failure");
    expect((await pool.query("SELECT COUNT(*)::int AS count FROM ops.sales_target_incentive_adjustment")).rows[0].count).toBe(0);
    expect((await pool.query("SELECT stage FROM ops.incentive_company_cycle")).rows[0].stage).toBe("general_manager");
    await decide(sealed,"general_manager"); expect((await pool.query("SELECT COUNT(*)::int AS count FROM ops.sales_target_incentive_adjustment")).rows[0].count).toBe(1);
  });

  it("protects append-only proofs and parent deletion with real cascading FKs",async()=> {
    const sealed=await seal(); await decide(sealed,"sales_director");
    await expect(pool.query("UPDATE ops.incentive_company_revision SET payload='{}' WHERE cycle_id=$1::uuid",[sealed.cycleId])).rejects.toThrow("append-only");
    await expect(pool.query("DELETE FROM ops.incentive_company_decision WHERE cycle_id=$1::uuid",[sealed.cycleId])).rejects.toThrow("append-only");
    await expect(pool.query("DELETE FROM ops.incentive_company_cycle WHERE cycle_id=$1::uuid",[sealed.cycleId])).rejects.toThrow("append-only");
    await expect(pool.query("DELETE FROM ops.sales_target_incentive_region_package WHERE sales_target_incentive_region_package_id=$1::uuid",[id(81)])).rejects.toThrow("immutable");
    expect((await repo().read(id(1),period,id(23))).revisions[0].seal_hash).toBe(sealed.sealHash);
    expect((await pool.query("SELECT COUNT(*)::int AS count FROM ops.incentive_legacy_approval")).rows[0].count).toBe(2);
    expect((await pool.query("SELECT package_scope FROM ops.incentive_legacy_approval ORDER BY package_scope")).rows.map(r=>r.package_scope)).toEqual(["legacy_region","manager_assignment"]);
  });

  it("payroll requires GM final and uses only sealed rows/names/targets despite later live changes, once per company-month",async()=> {
    const sealed=await seal(); const hr=new IncentiveHrHandoffRepository(db() as never);
    expect(hrSnapshotReady(await hr.read(period,[id(1)],id(25)))).toBe(false);
    await decide(sealed,"sales_director"); await decide(sealed,"hr"); expect(hrSnapshotReady(await hr.read(period,[id(1)],id(25)))).toBe(false);
    await decide(sealed,"general_manager");
    await pool.query("UPDATE ops.employee SET first_name='Live changed' WHERE employee_id=$1::uuid",[id(10)]);
    await pool.query("UPDATE ops.user_action_store_assignment SET end_at=NOW()-INTERVAL '1 day'");
    const snapshot=await hr.read(period,[id(1)],id(25)); expect(hrSnapshotReady(snapshot)).toBe(true);
    expect(snapshot.rows.find(r=>r.employee_id===id(10))).toMatchObject({display_name:"Included One",final_amount:"125.00",target_amount:"1000.0000"});
    expect(snapshot.packages.every(p=>p.final_seal_hash===sealed.sealHash && p.approval_origin==="company_cycle")).toBe(true);
    const config=[{companyId:id(1),recipients:["payroll@example.test"]}]; const version=hrSnapshotVersion(period,snapshot,config);
    const input={period,companyIds:[id(1)],actorId:id(25),version,config,attachments:[{companyId:id(1),sha256:"a".repeat(64)}]};
    await expect(hr.claim({...input,actorId:id(22)})).rejects.toBeInstanceOf(ForbiddenException);
    const delivery=await hr.claim(input); expect(delivery).toHaveLength(1); await hr.finish(delivery[0].delivery_id,"uncertain",null);
    await expect(hr.claim(input)).rejects.toBeInstanceOf(ConflictException);
    expect((await pool.query("SELECT final_cycle_id::text,final_revision_no,final_seal_hash,status FROM ops.incentive_hr_delivery")).rows[0]).toMatchObject({final_cycle_id:sealed.cycleId,final_revision_no:1,final_seal_hash:sealed.sealHash,status:"uncertain"});
  });

  it.each((["sales_director","hr","general_manager"] as const).flatMap(stage=>[[stage,"expiry"],[stage,"revoke"],[stage,"role_expiry"]] as const))("rechecks %s %s after a real company lock wait",async(stage,mode)=> {
    const sealed=await seal(); if(stage!=="sales_director") await decide(sealed,"sales_director"); if(stage==="general_manager") await decide(sealed,"hr");
    const actor=id(stage==="sales_director" ? 22 : stage==="hr" ? 23 : 24);
    const blocker=await pool.connect(); let started!:()=>void; const waiting=new Promise<void>(resolve=>{started=resolve;}); let pid=0;
    try {
      await blocker.query("BEGIN"); await blocker.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)",[`incentive-company-cycle:${id(1)}:${period}`]);
      const queued=new IncentiveCompanyCycleRepository(cycleDatabase(pool,{beforeQuery:async(sql,client)=>{
        if(!pid && sql.includes("pg_advisory_xact_lock")) { pid=(await client.query("SELECT pg_backend_pid() AS pid")).rows[0].pid; started(); }
      }}) as never).decide({companyId:id(1),period,cycleId:sealed.cycleId,revision:1,sealHash:sealed.sealHash,stage,actorId:actor,decision:"approve"});
      const rejection=expect(queued).rejects.toBeInstanceOf(ForbiddenException);
      await waiting;
      let blocked=false;
      for(let attempt=0;attempt<50 && !blocked;attempt++) {
        blocked=(await pool.query("SELECT cardinality(pg_blocking_pids($1))>0 AS blocked",[pid])).rows[0].blocked;
        if(!blocked) await new Promise(resolve=>setTimeout(resolve,10));
      }
      expect(blocked).toBe(true);
      if(mode==="revoke") await blocker.query("UPDATE ops.user_permission_assignment SET revoked_at=clock_timestamp(),revoked_by_user_id=$2::uuid,revoke_reason='Synthetic waited revoke' WHERE user_id=$1::uuid",[actor,id(26)]);
      else {
        await blocker.query(mode==="role_expiry" ? "UPDATE ops.user_role_assignment SET end_at=clock_timestamp()+INTERVAL '20 milliseconds' WHERE user_id=$1::uuid" : "UPDATE ops.user_permission_assignment SET ends_at=clock_timestamp()+INTERVAL '20 milliseconds' WHERE user_id=$1::uuid",[actor]);
        await blocker.query("SELECT pg_sleep(0.03)");
      }
      await blocker.query("COMMIT"); await rejection;
      expect((await pool.query("SELECT COUNT(*)::int AS count FROM ops.incentive_company_decision WHERE stage=$1",[stage])).rows[0].count).toBe(0);
    } finally { await blocker.query("ROLLBACK"); blocker.release(); }
  });

  it.each(["sales_director","hr","general_manager"] as const)("denies self-submission even with a valid %s persona/capability",async stage=> {
    const sealed=await seal(); if(stage!=="sales_director") await decide(sealed,"sales_director"); if(stage==="general_manager") await decide(sealed,"hr");
    const role=id(stage==="hr" ? 72 : 71); const permission=stage==="sales_director" ? "INCENTIVE_SALES_DIRECTOR_APPROVAL" : stage==="hr" ? "INCENTIVE_HR_APPROVAL" : "INCENTIVE_GENERAL_MANAGER_APPROVAL";
    await pool.query(`INSERT INTO ops.user_role_assignment(user_role_assignment_id,user_id,role_id,company_id,scope_type,start_at) VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,'company','2020-01-01');
      `,[id(126),id(20),role,id(1)]);
    await pool.query(`INSERT INTO ops.user_permission_assignment(user_role_assignment_id,user_id,permission_id,scope_type,company_id,starts_at,granted_by_user_id,grant_reason)
      SELECT $1::uuid,$2::uuid,permission_id,'company',$3::uuid,'2020-01-01',$4::uuid,'Synthetic self boundary' FROM ops.permission WHERE permission_code=$5`,[id(126),id(20),id(1),id(26),permission]);
    await expect(decide(sealed,stage,id(20))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("zero effective total and no payable personnel remain valid final payroll without inventing norm payments",async()=> {
    await pool.query("UPDATE ops.sales_target_incentive_region_package SET package_status='admin_returned',reviewed_by_user_id=$1::uuid,reviewed_at=NOW(),review_note='Synthetic exclusions' WHERE period_key=$2",[id(22),period]);
    const participation=new SalesTargetIncentiveParticipationRepository(db() as never);
    await participation.setParticipation({period,storeId:id(2),employeeId:id(10),included:false,reasonNote:"Synthetic exclusion one",expectedRevision:0,expectedSnapshotId:id(30),actorUserId:id(20)});
    await participation.setParticipation({period,storeId:id(3),employeeId:id(11),included:false,reasonNote:"Synthetic exclusion two",expectedRevision:0,expectedSnapshotId:id(31),actorUserId:id(21)});
    await pool.query("UPDATE ops.sales_target_incentive_store_review SET review_status='reviewed',reviewed_by_user_id=CASE store_id WHEN $1::uuid THEN $2::uuid ELSE $3::uuid END,reviewed_at=NOW()",[id(2),id(20),id(21)]);
    const manager=new SalesTargetIncentiveManagerPackageRepository(db() as never);
    await manager.submit({companyId:id(1),periodKey:period,managerUserId:id(20),storeIds:[id(2)],submissionNote:null});
    await manager.submit({companyId:id(1),periodKey:period,managerUserId:id(21),storeIds:[id(3)],submissionNote:null});
    const sealed=await seal(); expect(sealed.total).toBe("0.00"); await decide(sealed,"sales_director"); await decide(sealed,"hr"); await decide(sealed,"general_manager");
    const snapshot=await new IncentiveHrHandoffRepository(db() as never).read(period,[id(1)],id(25)); expect(hrSnapshotReady(snapshot)).toBe(true); expect(snapshot.rows).toHaveLength(0);
    expect((await repo().read(id(1),period,id(25))).revisions[0].payload.roster).toHaveLength(3);
  });

  it("preserves both real legacy approval scopes, actual money and uncertain receipts without fabricating company decisions",async()=> {
    await seedCompanyCycle(pool,{legacyEvidence:true});
    const hr=new IncentiveHrHandoffRepository(db() as never); const historical=await hr.read("2026-04",[id(1)],id(25));
    expect(hrSnapshotReady(historical)).toBe(true); expect(historical.rows.map(row=>row.final_amount).sort()).toEqual(["100.00","105.00"]);
    expect(historical.packages.every(p=>p.approval_origin==="legacy_approved" && p.final_cycle_id===null && p.final_seal_hash===null)).toBe(true);
    expect(historical.packages.find(p=>p.package_id===id(82))?.manager_user_id).toBe(id(20));
    const config=[{companyId:id(1),recipients:["historical@example.test"]}];
    await expect(hr.claim({period:"2026-04",companyIds:[id(1)],actorId:id(25),version:hrSnapshotVersion("2026-04",historical,config),config,attachments:[{companyId:id(1),sha256:"b".repeat(64)}]})).rejects.toBeInstanceOf(ConflictException);
    const correction=new SalesTargetIncentiveCorrectionRepository(db() as never);
    await expect(correction.applyAdminFinalRowCorrection({periodKey:"2026-04",storeId:id(2),employeeId:id(10),participantType:"personnel",adjustmentAmount:"2",reasonCode:"historical_review",reasonNote:"Synthetic legacy arithmetic",actorUserId:id(26),readScope:{companyIds:[id(1)],regionIds:[],storeIds:[],allowGlobalScope:false}})).resolves.toMatchObject({beforeAmount:"105.00",afterAmount:"107.00"});
    expect((await pool.query("SELECT before_amount::text,after_amount::text,evidence FROM ops.sales_target_incentive_adjustment WHERE sales_target_incentive_adjustment_id=$1::uuid",[id(100)])).rows[0]).toEqual({before_amount:"100.00",after_amount:"105.00",evidence:{source:"historical_approval"}});
    expect((await pool.query("SELECT COUNT(*)::int AS count FROM ops.incentive_company_decision")).rows[0].count).toBe(0);
    expect(hrSnapshotReady(await hr.read(period,[id(1)],id(25)))).toBe(false);
    await expect(pool.query("UPDATE ops.sales_target_incentive_region_package SET package_status='admin_returned' WHERE sales_target_incentive_region_package_id=$1::uuid",[id(82)])).rejects.toThrow("immutable");
  },10000);

  it("read-only invariant overlay validates seal, stage, application and payroll proof without leaking references",async()=> {
    const sealed=await seal(); await decide(sealed,"sales_director"); await decide(sealed,"hr"); await decide(sealed,"general_manager");
    const sql=readFileSync(resolve(process.cwd(),"../../db/preflight/incentive-company-cycle-invariants-v1.sql"),"utf8");
    const client=await pool.connect();
    try {
      await client.query("BEGIN READ ONLY"); const checks=(await client.query(sql)).rows;
      expect(checks).toHaveLength(4); expect(checks.every(check=>check.violation_count==="0" && check.sample_refs.length===0)).toBe(true);
      await client.query("ROLLBACK");
    } finally { client.release(); }
    const evidence=(await pool.query("SELECT authority_evidence FROM ops.incentive_company_decision ORDER BY decided_at")).rows;
    expect(evidence.map(row=>row.authority_evidence.permissionCode)).toEqual(["INCENTIVE_SALES_DIRECTOR_APPROVAL","INCENTIVE_HR_APPROVAL","INCENTIVE_GENERAL_MANAGER_APPROVAL"]);
  });
});
