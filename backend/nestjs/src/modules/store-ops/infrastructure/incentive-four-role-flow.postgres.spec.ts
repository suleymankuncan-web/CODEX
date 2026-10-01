import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, ConflictException } from '@nestjs/common';
import * as XLSX from 'xlsx-js-style';
import type { AuthenticatedUser } from '../../auth/auth-context.service';
import { IncentiveCompanyCycleService } from '../application/incentive-company-cycle.service';
import { IncentiveApprovalMailService } from '../application/incentive-approval-mail.service';
import { IncentiveCompanyCycleRepository } from './incentive-company-cycle.repository';
import { IncentiveApprovalMailRepository } from './incentive-approval-mail.repository';
import { IncentiveHrHandoffRepository, hrSnapshotReady } from './incentive-hr-handoff.repository';
import { SalesTargetIncentiveManagerPackageRepository } from './sales-target-incentive-manager-package.repository';
import { cycleDatabase, cycleId as id, cyclePeriod as period, seedCompanyCycle } from './incentive-company-cycle.postgres-fixture';

const url=process.env.INCENTIVE_PARTICIPATION_POSTGRES_URL;
const describePg=url ? describe : describe.skip;
jest.setTimeout(25000);
function actor(user:number,role:string,permission?:string):AuthenticatedUser {
  const scope={companyIds:[id(1)],regionIds:[],storeIds:[]};
  return {userId:id(user),roleCodes:[role],scope,readScope:scope,actionScope:{assignedStoreIds:[]},assignedStoreIds:[],
    roleScopes:{[role]:scope},permissionScopes:permission ? {[permission]:scope} : {}};
}
const bm=actor(20,'REGION_MANAGER'),sd=actor(22,'REPORT_VIEWER','INCENTIVE_SALES_DIRECTOR_APPROVAL');
const hr=actor(23,'HR_ADMIN','INCENTIVE_HR_APPROVAL'),gm=actor(24,'REPORT_VIEWER','INCENTIVE_GENERAL_MANAGER_APPROVAL');

describePg('synthetic four-role package flow with actual PostgreSQL, services and workbook',()=>{
  const name=`four_role_flow_${randomUUID().replaceAll('-','').slice(0,12)}`;
  let admin:Pool,pool:Pool;
  const db=()=>cycleDatabase(pool) as never;
  const cycle=()=>new IncentiveCompanyCycleRepository(db());
  const service=()=>new IncentiveCompanyCycleService(cycle());
  const snapshot=()=>new IncentiveHrHandoffRepository(db()).read(period,[id(1)],id(25));
  beforeAll(async()=>{admin=new Pool({connectionString:url});await admin.query(`CREATE DATABASE "${name}"`);
    const parsed=new URL(url!);parsed.pathname=`/${name}`;pool=new Pool({connectionString:parsed.href});});
  beforeEach(async()=>{
    await seedCompanyCycle(pool);
    await pool.query("UPDATE ops.sales_target_incentive_region_package SET package_status='admin_returned',reviewed_by_user_id=$1,reviewed_at=clock_timestamp(),review_note='Synthetic preparation' WHERE period_key=$2",[id(22),period]);
  });
  afterAll(async()=>{await pool?.end();if(admin){await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH(FORCE)`);await admin.end();}});
  async function submitBoth() {
    const manager=new SalesTargetIncentiveManagerPackageRepository(db());
    await expect(manager.submit({companyId:id(1),periodKey:period,managerUserId:id(20),storeIds:[id(3)],submissionNote:null})).rejects.toBeInstanceOf(ForbiddenException);
    for(const [user,store] of [[20,2],[21,3]]) {
      const submission=await manager.submit({companyId:id(1),periodKey:period,managerUserId:id(user),storeIds:[id(store)],submissionNote:'Synthetic BM note'});
      expect(submission.package_status).toBe('submitted');
    }
  }
  it('BM → SD → HR → GM preserves the exact seal, applies once and sends the final Excel only to HR',async()=>{
    await pool.query(`INSERT INTO stg.integration_source(integration_source_id,source_code,source_name,entity_type)
      VALUES('${id(410)}','four-role-physical','Synthetic physical','kpi');
      INSERT INTO stg.import_batch(import_batch_id,integration_source_id,company_ids,entity_type,source_batch_id,status,finished_at,error_count)
      VALUES('${id(411)}','${id(410)}',ARRAY['${id(1)}']::uuid[],'kpi','four-role-source','completed','2026-05-31',0);
      INSERT INTO ops.kpi_definition(kpi_id,kpi_code,kpi_name,metric_type,unit_type,aggregation_type,scope_type,target_direction)
      VALUES('${id(412)}','NET_SALES','Synthetic net','amount','TRY','sum','both','higher');
      INSERT INTO ops.company_daily_kpi_component_outcome(component_outcome_id,integration_source_id,business_date,operation,status,aggregate_count,sanitized_set_digest,return_attribution_version,retry_count)
      VALUES('${id(413)}','${id(410)}','2026-05-31','sales','succeeded',1,repeat('a',64),2,0);
      INSERT INTO ops.company_daily_kpi_employee_sales(component_outcome_id,business_date,store_id,employee_id,sale_invoice_count,return_invoice_count,
        sale_quantity,signed_return_quantity,net_quantity,sale_amount_try,signed_return_amount_try,net_amount_try)
      VALUES('${id(413)}','2026-05-31','${id(2)}','${id(10)}',1,1,2,-1,1,1400,-200,1200);
      INSERT INTO ops.kpi_actual(kpi_id,scope_type,company_id,region_id,store_id,employee_id,period_type,period_start,period_end,actual_value,source_batch_id,source_type)
      VALUES('${id(412)}','employee','${id(1)}','${id(6)}','${id(2)}','${id(10)}','daily','2026-05-31','2026-05-31',1200,'${id(411)}','integration');`);
    const notices: Array<{recipient:string;content:{title:string};attachment?:unknown}>=[];
    const workbooks: Array<{recipients:string[];attachment:Buffer}>=[];
    // Only SMTP is a test double; queue, live authority, transitions, receipts and Excel are real.
    const mailer={ready:()=>true,verify:async()=>undefined,recipients:()=>['ik@example.test'],
      sendNotification:async(input:typeof notices[number])=>{notices.push(input);return '<synthetic-notice>';},
      send:async(input:typeof workbooks[number])=>{workbooks.push(input);return '<synthetic-workbook>';}};
    const worker=new IncentiveApprovalMailService(new IncentiveApprovalMailRepository(db()),mailer as never,new IncentiveHrHandoffRepository(db()),
      new ConfigService({INCENTIVE_APPROVAL_EMAIL_ENABLED:'true',INCENTIVE_APPROVAL_EMAIL_APP_ORIGIN:'https://hr.example.test'}));
    await submitBoth();await worker.runOnce();
    expect(notices.map(n=>n.recipient)).toEqual(['synthetic-22@example.test','synthetic-22@example.test']);
    expect(workbooks).toHaveLength(0);expect(hrSnapshotReady(await snapshot())).toBe(false);
    expect(()=>service().seal(bm,{companyId:id(1),period,expectedRevision:0})).toThrow(ForbiddenException);
    const sealed=await service().seal(sd,{companyId:id(1),period,expectedRevision:0});expect(sealed.total).toBe('225.00');
    const command={companyId:id(1),period,cycleId:sealed.cycleId,revision:sealed.revision,sealHash:sealed.sealHash,decision:'approve' as const};
    await expect(service().decide(gm,{...command,stage:'general_manager'})).rejects.toBeInstanceOf(ConflictException);
    const steps=[{actor:sd,stage:'sales_director' as const,next:'hr',recipient:'ik@example.test'},
      {actor:hr,stage:'hr' as const,next:'general_manager',recipient:'synthetic-24@example.test'},
      {actor:gm,stage:'general_manager' as const,next:'final',recipient:'synthetic-20@example.test'}];
    for(const step of steps) {
      for(const wrong of [bm,sd,hr,gm].filter(a=>a!==step.actor)) expect(()=>service().decide(wrong,{...command,stage:step.stage})).toThrow(ForbiddenException);
      const before=notices.length;await service().decide(step.actor,{...command,stage:step.stage});await worker.runOnce();
      const state=await cycle().read(id(1),period,step.actor.userId);
      expect(state.cycle?.stage).toBe(step.next);expect(state.cycle?.current_revision).toBe(1);expect(state.revisions[0].seal_hash).toBe(sealed.sealHash);
      expect(notices.slice(before).some(n=>n.recipient===step.recipient)).toBe(true);
      if(step.stage!=='general_manager') {expect(workbooks).toHaveLength(0);expect(hrSnapshotReady(await snapshot())).toBe(false);}
    }
    expect(notices.every(n=>!n.attachment)).toBe(true);expect(workbooks).toHaveLength(1);expect(workbooks[0].recipients).toEqual(['ik@example.test']);
    expect(hrSnapshotReady(await snapshot())).toBe(true);
    await pool.query("UPDATE ops.company_daily_kpi_employee_sales SET sale_amount_try=1500,signed_return_amount_try=-300 WHERE component_outcome_id=$1",[id(413)]);
    const archived=await snapshot();expect(archived.rows.find(r=>r.employee_id===id(10))).toMatchObject({gross_sales:'1400.000000000000',signed_returns:'-200.000000000000',actual_sales_amount:'1200.0000'});
    const book=XLSX.read(workbooks[0].attachment,{type:'buffer'});expect(book.SheetNames).toEqual(['Müdür Özeti','Personel Primleri','Onay Kaydı','Paket Notları','Mağaza Özeti']);
    const rows=XLSX.utils.sheet_to_json<unknown[]>(book.Sheets['Personel Primleri'],{header:1});
    expect(JSON.stringify(rows)).toContain('Synthetic proposal');
    expect(JSON.stringify(XLSX.utils.sheet_to_json(book.Sheets['Paket Notları'],{header:1}))).toContain('Synthetic BM note');
    expect(book.Sheets['Personel Primleri'].P2.v).toBe(1400);expect(book.Sheets['Personel Primleri'].Q2.v).toBe(-200);
    expect(book.Sheets['Personel Primleri'].N2.v).toBe(100);expect(book.Sheets['Personel Primleri'].O2.v).toBe(25);
    expect((await pool.query("SELECT final_amount::text FROM ops.sales_target_incentive_region_correction WHERE sales_target_incentive_region_correction_id=$1",[id(90)])).rows[0].final_amount).toBe('125.00');
    expect((await pool.query("SELECT COUNT(*)::int AS count FROM ops.sales_target_incentive_adjustment")).rows[0].count).toBe(1);
    await expect(service().decide(gm,{...command,stage:'general_manager'})).rejects.toBeInstanceOf(ConflictException);
    await worker.runOnce();expect(workbooks).toHaveLength(1);
    expect((await pool.query("SELECT status,delivery_origin FROM ops.incentive_hr_delivery")).rows).toEqual([{status:'sent',delivery_origin:'gm_final'}]);
  });
  it.each(['sales_director','hr','general_manager'] as const)('a %s return resets to preparation without payment or HR send',async stage=>{
    await submitBoth();const sealed=await service().seal(sd,{companyId:id(1),period,expectedRevision:0});
    const command={companyId:id(1),period,cycleId:sealed.cycleId,revision:sealed.revision,sealHash:sealed.sealHash,decision:'approve' as const};
    if(stage!=='sales_director')await service().decide(sd,{...command,stage:'sales_director'});
    if(stage==='general_manager')await service().decide(hr,{...command,stage:'hr'});
    const approver=stage==='sales_director'?sd:stage==='hr'?hr:gm;
    await service().decide(approver,{...command,stage,decision:'return',reasonNote:'Synthetic return reason'});
    expect((await cycle().read(id(1),period,approver.userId)).cycle?.stage).toBe('preparation');
    expect(hrSnapshotReady(await snapshot())).toBe(false);
    expect((await pool.query('SELECT COUNT(*)::int AS count FROM ops.sales_target_incentive_adjustment')).rows[0].count).toBe(0);
    const next=await service().seal(sd,{companyId:id(1),period,expectedRevision:1});expect(next.revision).toBe(2);expect(next.stage).toBe('sales_director');
    await expect(service().decide(sd,{...command,stage:'sales_director'})).rejects.toBeInstanceOf(ConflictException);
  });
});
