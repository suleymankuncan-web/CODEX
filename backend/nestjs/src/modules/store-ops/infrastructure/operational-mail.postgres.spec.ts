import { OperationalMailService } from "../application/operational-mail.service";
import * as XLSX from "xlsx-js-style";
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { cycleDatabase,cycleId as id,seedCompanyCycle } from './incentive-company-cycle.postgres-fixture';
import { OperationalMailRepository } from './operational-mail.repository';
import { OperationalMailSource } from './operational-mail-source';
import { OperationalMailScheduler } from './operational-mail-scheduler.repository';
import { StoreMonthlyReportPackageRepository } from './store-monthly-report-package.repository';

const url=process.env.INCENTIVE_PARTICIPATION_POSTGRES_URL;
const describePg=url ? describe : describe.skip;
jest.setTimeout(20000);
describePg('operational mail native PostgreSQL',()=>{
  const name=`operational_mail_${randomUUID().replaceAll('-','').slice(0,12)}`;
  let admin:Pool,pool:Pool;
  const db=()=>cycleDatabase(pool) as never;
  const repo=()=>new OperationalMailRepository(db());
  const source=(settings={})=>new OperationalMailSource(db(),new ConfigService(settings));
  async function checklist(store=id(2),completed='2026-09-30T09:00:00Z',identifier=id(201)) {
    await pool.query(`INSERT INTO ops.checklist_instance(checklist_instance_id,checklist_template_id,store_id,status,completed_by_user_id,completed_at,total_score)
      VALUES($1::uuid,$2::uuid,$3::uuid,'completed',$4,$5::timestamptz,80)`,[identifier,id(200),store,id(20),completed]);
  }
  async function action(identifier=id(202),status='open') {
    await pool.query(`INSERT INTO ops.store_action_plan(store_action_plan_id,company_id,region_id,store_id,owner_user_id,created_by_user_id,source_type,source_id,title,due_on,status)
      VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,'checklist_remediation',$7,'Fixture action','2026-10-05',$8)`,
    [identifier,id(1),id(6),id(2),id(26),id(20),`checklist:${id(201)}:item:${identifier}`,status]);
  }
  beforeAll(async()=>{admin=new Pool({connectionString:url});await admin.query(`CREATE DATABASE "${name}"`);
    const parsed=new URL(url!);parsed.pathname=`/${name}`;pool=new Pool({connectionString:parsed.href});});
  beforeEach(async()=>{
    await seedCompanyCycle(pool);
    await pool.query(readFileSync(resolve(process.cwd(),'../../db/migrations/101_operational_mail_pilot_v1.sql'),'utf8'));
    await repo().activate('operational');
    await pool.query(`INSERT INTO ops.role(role_id,role_code,role_name,role_scope_type) VALUES('${id(74)}','STORE_MANAGER','SM','store'),('${id(75)}','SUPER_ADMIN','Admin','global');
      INSERT INTO ops.user_role_assignment(user_id,role_id,scope_type,store_id,start_at) VALUES('${id(26)}','${id(74)}','store','${id(2)}','2020-01-01');
      INSERT INTO ops.user_role_assignment(user_id,role_id,scope_type,start_at) VALUES('${id(26)}','${id(75)}','global','2020-01-01');
      INSERT INTO ops.user_action_store_assignment(user_id,store_id,start_at) VALUES('${id(26)}','${id(2)}','2020-01-01');
      INSERT INTO ops.store_contact_email(company_id,store_id,email_address,is_primary) VALUES('${id(1)}','${id(2)}','store@example.test',true);
      INSERT INTO ops.checklist_template(checklist_template_id,company_id,template_code,template_name,category,version_no,effective_from,created_by,status)
        VALUES('${id(200)}','${id(1)}','FIXTURE','Store visit','fixture',1,'2020-01-01','${id(20)}','active');`);
  });
  afterAll(async()=>{await pool?.end();if(admin){await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH(FORCE)`);await admin.end();}});
  it('captures completion transactionally, resolves exactly three audiences, and dedupes the same mailbox',async()=>{
    const client=await pool.connect();try {await client.query('BEGIN');await client.query(`INSERT INTO ops.checklist_instance(checklist_template_id,store_id,status,completed_at) VALUES($1,$2,'completed',clock_timestamp())`,[id(200),id(2)]);await client.query('ROLLBACK');} finally {client.release();}
    expect(await repo().events(['operational'])).toEqual([]);
    await checklist();const [event]=await repo().events(['operational']);const resolved=await source().resolve(event);
    expect(resolved?.complete).toBe(true);expect(resolved?.recipients.map(r=>r.audience).sort()).toEqual(['author_bm','store_mailbox','store_manager']);
    await Promise.all([repo().expand(event,resolved!.recipients,true),repo().expand(event,resolved!.recipients,true)]);
    expect(await repo().pending(event.event_id)).toHaveLength(3);
    const [delivery]=await repo().pending(event.event_id);const claims=await Promise.all([repo().claim(delivery.delivery_id),repo().claim(delivery.delivery_id)]);
    expect(claims.filter(Boolean)).toHaveLength(1);await repo().finish(delivery.delivery_id,'uncertain');
    expect((await repo().pending(event.event_id)).some(d=>d.delivery_id===delivery.delivery_id)).toBe(false);
    await pool.query("UPDATE ops.store_contact_email SET email_address='SYNTHETIC-26@example.test' WHERE store_id=$1",[id(2)]);
    expect((await source().resolve(event))?.recipients).toHaveLength(2);
    await pool.query('UPDATE ops.user_action_store_assignment SET end_at=clock_timestamp() WHERE user_id=$1',[id(26)]);
    expect((await source().resolve(event))?.complete).toBe(false);
  });
  it('coalesces actual assigned actions and rechecks deadline/closed/review responsibility',async()=>{
    await checklist();await action();await action(id(203));
    const raw=(await pool.query("SELECT * FROM ops.operational_mail_event WHERE kind='actions_assigned'")).rows;
    expect(raw).toHaveLength(1);expect(raw[0].payload.actionIds).toHaveLength(2);
    expect((await source().resolve(raw[0]))?.content.actionCount).toBe(2);
    const scheduler=new OperationalMailScheduler(db(),repo(),source());
    await scheduler.schedule(['operational'],new Date('2026-10-01T06:00:00Z'));
    const reminder=(await repo().events(['operational'])).find(e=>e.kind==='action_reminder')!;
    expect((await source().resolve(reminder,new Date('2026-10-01T06:00:00Z')))?.recipients).toHaveLength(3);
    await pool.query("UPDATE ops.store_action_plan SET status='solution_review_pending' WHERE store_action_plan_id=$1",[reminder.entity_id]);
    expect(await source().resolve(reminder,new Date('2026-10-01T06:00:00Z'))).toBeNull();
    await scheduler.schedule(['operational'],new Date('2026-10-01T06:00:00Z'));
    const review=(await repo().events(['operational'])).find(e=>e.kind==='action_reminder' && e.payload.reviewPending)!;
    expect((await source().resolve(review,new Date('2026-10-01T06:00:00Z')))?.recipients.map(r=>r.audience)).toEqual(['region_manager']);
    await pool.query("UPDATE ops.store_action_plan SET status='closed',closed_at=clock_timestamp(),resolution_note='Closed' WHERE store_action_plan_id=$1",[review.entity_id]);
    expect(await source().resolve(review,new Date('2026-10-01T06:00:00Z'))).toBeNull();
    expect((await repo().events(['operational'])).some(e=>e.kind==='action_closed')).toBe(true);
  });
  it('starts a new action batch after any audience has been prepared, even with incomplete mappings',async()=>{
    await checklist();await action();
    const original=(await pool.query("SELECT * FROM ops.operational_mail_event WHERE kind='actions_assigned'")).rows[0];
    const resolved=(await source().resolve(original))!;
    await repo().expand(original,resolved.recipients.slice(0,1),false);
    const [delivery]=await repo().pending(original.event_id);await repo().claim(delivery.delivery_id);await repo().finish(delivery.delivery_id,'sent','fixture');
    await action(id(203));
    const batches=(await pool.query("SELECT * FROM ops.operational_mail_event WHERE kind='actions_assigned' ORDER BY created_at")).rows;
    expect(batches).toHaveLength(2);
    expect(batches[0].payload.actionIds).toEqual([id(202)]);expect(batches[1].payload.actionIds).toEqual([id(203)]);
    await repo().expand(batches[1],resolved.recipients,true);
    expect((await repo().pending(batches[1].event_id)).some(d=>d.recipient===delivery.recipient)).toBe(true);
  });
  it('does not rewrite historical last visit across Istanbul month boundaries',async()=>{
    await checklist(id(2),'2026-08-31T21:00:00Z',id(211));
    await checklist(id(2),'2026-09-30T20:59:59Z',id(212));
    await checklist(id(2),'2026-09-30T21:00:00Z',id(213));
    await checklist(id(3),'2026-10-01T09:00:00Z',id(214));
    const reports=new StoreMonthlyReportPackageRepository(db());
    const rows=await reports.getStoreMonthlyReportPackageRows({periodStart:'2026-09-01',periodEnd:'2026-09-30',companyIds:[],regionIds:[],storeIds:[id(2),id(3)]});
    expect(rows.find(r=>r.store_id===id(2))).toMatchObject({last_visit_date:'2026-09-30',bm_checklist_score:'80.0000000000000000'});
    expect(rows.find(r=>r.store_id===id(3))?.last_visit_date).toBeNull();
  });
  it('keeps reports scoped to current BM stores, starts Monday09, and monthly requires real completed closure',async()=>{
    await repo().activate('weekly');await repo().activate('monthly');
    const scheduler=new OperationalMailScheduler(db(),repo(),source());
    await scheduler.schedule(['weekly'],new Date('2026-10-05T05:59:00Z'));expect(await repo().events(['weekly'])).toHaveLength(0);
    await scheduler.schedule(['weekly'],new Date('2026-10-05T06:00:00Z'));await scheduler.schedule(['weekly'],new Date('2026-10-05T06:05:00Z'));
    const reports=await repo().events(['weekly']);expect(reports).toHaveLength(2);
    expect((await source().resolve(reports.find(e=>e.entity_id===id(20))!))?.reportManager?.store_ids).toEqual([id(2)]);
    await scheduler.schedule(['monthly'],new Date('2026-10-01T06:00:00Z'));expect(await repo().events(['monthly'])).toHaveLength(0);
    await pool.query(`INSERT INTO rpt.snapshot_run(snapshot_date,snapshot_type,period_start,period_end,run_status,generated_by,company_ids,finished_at)
      VALUES('2026-09-30','monthly','2026-09-01','2026-09-30','completed','fixture',$1,clock_timestamp())`,[[id(1)]]);
    await scheduler.schedule(['monthly'],new Date('2026-10-01T06:00:00Z'));expect(await repo().events(['monthly'])).toHaveLength(2);
    await pool.query('UPDATE ops.user_action_store_assignment SET end_at=clock_timestamp() WHERE user_id=$1',[id(20)]);
    expect(await source().resolve(reports.find(e=>e.entity_id===id(20))!)).toBeNull();
  });
  it('keeps missing-target digest private and stops missing notices immediately after valid submission',async()=>{
    const period=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit'}).format(new Date()).slice(0,7);
    await repo().enqueue({key:'missing',kind:'target_missing',storeId:id(2),companyId:id(1),payload:{period}});
    await repo().enqueue({key:'digest',kind:'target_missing_digest',payload:{period}});
    const events=await repo().events(['operational']);const missing=events.find(e=>e.kind==='target_missing')!;
    expect((await source().resolve(missing))?.recipients.map(r=>r.audience).sort()).toEqual(['region_manager','store_mailbox']);
    const digest=events.find(e=>e.kind==='target_missing_digest')!;
    expect(await source({OPERATIONAL_TARGET_OWNER_EMAIL:'missing@example.test'}).resolve(digest)).toMatchObject({recipients:[],complete:false});
    expect(await source({OPERATIONAL_TARGET_OWNER_EMAIL:'synthetic-20@example.test'}).resolve(digest)).toMatchObject({recipients:[],complete:false});
    expect((await source({OPERATIONAL_TARGET_OWNER_EMAIL:'synthetic-26@example.test'}).resolve(digest))?.content.missingStores).toHaveLength(2);
    await pool.query(`INSERT INTO ops.target_distribution_request(company_id,region_id,store_id,request_month,target_label,total_target_value,submitted_by_user_id)
      VALUES($1,$2,$3,$4,'Fixture',1000,$5)`,[id(1),id(6),id(2),`${period}-01`,id(26)]);
    expect(await source().resolve(missing)).toBeNull();
  });
  it('exports all personnel once per month at Istanbul09, only to CRM/HR, including terminated and unassigned employees',async()=>{
    await repo().activate('personnel');const scheduler=new OperationalMailScheduler(db(),repo(),source());
    await scheduler.schedule(['personnel'],new Date('2026-10-01T05:59:59Z'));expect(await repo().events(['personnel'])).toHaveLength(0);
    await scheduler.schedule(['personnel'],new Date('2026-10-01T06:00:00Z'));await scheduler.schedule(['personnel'],new Date('2026-10-01T06:01:00Z'));
    const [event]=await repo().events(['personnel']);expect(event.payload).toEqual({period:'2026-10'});expect(await repo().events(['personnel'])).toHaveLength(1);
    expect((await source().resolve(event))?.recipients.map(r=>r.recipient)).toEqual(['crm@lufian.com.tr','ik@lufian.com.tr']);
    await pool.query("UPDATE ops.employee SET phone_number='05550000001' WHERE employee_id=$1",[id(10)]);
    await pool.query("UPDATE ops.employee SET employment_status='terminated',termination_date='2026-09-30' WHERE employee_id=$1",[id(11)]);
    await pool.query("UPDATE ops.employee SET employment_status='inactive' WHERE employee_id=$1",[id(12)]);
    await pool.query("INSERT INTO ops.employee(employee_id,company_id,first_name,last_name,hire_date,employment_type) VALUES($1,$2,'Unassigned','Other Company','2026-09-01','full_time')",[id(401),id(9)]);
    await pool.query("UPDATE ops.employee_assignment_history SET end_date='2026-09-29' WHERE employee_id=$1",[id(10)]);
    await pool.query("INSERT INTO ops.employee_assignment_history(employee_id,store_id,region_id,position_id,start_date,is_primary_assignment) VALUES($1,$2,$3,$4,'2026-09-30',false)",[id(10),id(3),id(6),id(8)]);
    const roster=await repo().personnelRoster('2026-10-01');expect(roster).toHaveLength(4);
    expect(roster.find(r=>r.first_name==='Unassigned')).toMatchObject({store_name:null,position_name:null,status:'Aktif'});
    expect(roster.find(r=>r.first_name==='Included' && r.last_name==='One')).toMatchObject({store_name:'Synthetic Store 2',phone_number:'05550000001',status:'Aktif'});
    expect(roster.filter(r=>r.status==='Pasif')).toHaveLength(2);
    const sent:Array<{recipient:string;report:{fileName:string;buffer:Buffer};content:{facts:unknown}}>=[];
    const mailer={ready:()=>true,verify:async()=>undefined,send:async(input:typeof sent[number])=>{sent.push(input);return '<synthetic-roster>';}};
    const config=new ConfigService({OPERATIONAL_PERSONNEL_ROSTER_EMAIL_ENABLED:'true',OPERATIONAL_MAIL_APP_ORIGIN:'https://hr.example'});
    const worker=new OperationalMailService(repo(),source(),scheduler,{} as never,mailer as never,config);
    await worker.runOnce();expect(sent.map(m=>m.recipient)).toEqual(expect.arrayContaining(['crm@lufian.com.tr','ik@lufian.com.tr']));expect(sent).toHaveLength(2);
    expect(sent[0].report.buffer.equals(sent[1].report.buffer)).toBe(true);
    const book=XLSX.read(sent[0].report.buffer,{type:'buffer'});expect(XLSX.utils.sheet_to_json(book.Sheets['Personel Listesi'])).toHaveLength(4);
    expect(sent[0].content.facts).toEqual([{label:'Toplam personel',value:'4'},{label:'Aktif / Pasif',value:'2 / 2'}]);
    await worker.runOnce();expect(sent).toHaveLength(2);
    await scheduler.schedule(['personnel'],new Date('2026-11-02T00:00:00Z'));
    expect((await repo().events(['personnel'])).some(e=>e.payload.period==='2026-11')).toBe(true);
    expect(await source().resolve({...event,payload:{period:'2026-09'}})).toBeNull();
  });
  it('builds actual weekly physical ratios across months without leaking monthly ratios or other stores',async()=>{
    await pool.query('UPDATE ops.store SET kpi_import_enabled=true WHERE store_id=$1',[id(2)]);
    const codes=['NET_SALES','TICKET_COUNT','ITEM_COUNT','FF'];
    for(let i=0;i<codes.length;i++) await pool.query(`INSERT INTO ops.kpi_definition(kpi_id,kpi_code,kpi_name,metric_type,unit_type,aggregation_type,scope_type,target_direction)
      VALUES($1,$2,$2,'number','number','sum','store','higher_is_better')`,[id(250+i),codes[i]]);
    const days=[['2026-09-28',[100,1,3,15]],['2026-09-29',[900,9,27,85]],['2026-10-01',[40,null,2,40]],['2026-10-05',[9999,10,20,30]]] as const;
    for(const [day,values] of days) for(let i=0;i<values.length;i++) if(values[i]!==null) await pool.query(`INSERT INTO ops.kpi_actual(kpi_id,scope_type,company_id,store_id,period_type,period_start,period_end,actual_value,source_type)
      VALUES($1,'store',$2,$3,'daily',$4,$4,$5,'company')`,[id(250+i),id(1),id(2),day,values[i]]);
    await pool.query(`INSERT INTO ops.kpi_actual(kpi_id,scope_type,company_id,store_id,period_type,period_start,period_end,actual_value,source_type)
      VALUES($1,'store',$2,$3,'daily','2026-09-30','2026-09-30',999999,'demo_seed'),($1,'store',$2,$4,'daily','2026-09-30','2026-09-30',888888,'company')`,[id(250),id(1),id(2),id(3)]);
    await pool.query(`INSERT INTO ops.kpi_target(kpi_id,scope_type,company_id,store_id,period_type,period_start,period_end,target_value)
        VALUES($1,'store',$2,$3,'monthly','2026-09-01','2026-09-30',30000),($1,'store',$2,$3,'monthly','2026-10-01','2026-10-31',31000)`,[id(250),id(1),id(2)]);
    const rows=await new StoreMonthlyReportPackageRepository(db()).getStoreWeeklyReportPackageRows({periodStart:'2026-09-28',periodEnd:'2026-10-04',companyIds:[],regionIds:[],storeIds:[id(2)]});
    expect(rows).toHaveLength(1);const row=rows[0];
    expect(Number(row.atv_value)).toBe(100);expect(Number(row.upt_value)).toBe(3);
    expect(Number(row.cr_value)).toBeCloseTo(10/140);expect(Number(row.hg_value)).toBeCloseTo(1040/61000*100);
    expect(row.score_value).toBeNull();expect(row.gsm_value).toBeNull();
  });
  it('captures personnel requests only for trusted current HR recipients and omits private identity data',async()=>{
    await pool.query(`INSERT INTO ops.seller_code_request(company_id,region_id,store_id,store_type,request_type,first_name,last_name,national_id_hash,national_id_last4,
      phone_number,requested_hire_date,requested_position_id,employment_type,requested_seller_code,submitted_by_user_id)
      VALUES($1,$2,$3,'company','create_code','Fixture','Person','private-hash','1234','05555555555','2026-10-02',$4,'full_time','TEST-CODE',$5)`,[id(1),id(6),id(2),id(8),id(26)]);
    const event=(await repo().events(['operational'])).find(e=>e.kind==='entry_requested')!;
    const reader=source({OPERATIONAL_HR_RECIPIENTS_JSON:JSON.stringify({[id(1)]:['synthetic-20@example.test','synthetic-23@example.test','ik@example.test']})});
    const resolved=await reader.resolve(event);
    expect(resolved?.recipients.map(r=>r.recipient).sort()).toEqual(['ik@example.test','synthetic-23@example.test']);
    expect(resolved?.content).toMatchObject({name:'Fixture Person',code:'TEST-CODE',date:'02.10.2026'});
    expect(JSON.stringify(resolved)).not.toContain('private-hash');expect(JSON.stringify(resolved)).not.toContain('05555555555');
    await pool.query("UPDATE ops.user_account SET is_active=false WHERE user_id=$1",[id(23)]);
    expect((await reader.resolve(event))?.recipients.map(r=>r.recipient)).toEqual(['ik@example.test']);
    await pool.query("UPDATE ops.seller_code_request SET request_status='approved',reviewed_at=clock_timestamp() WHERE seller_code_request_id=$1",[event.entity_id]);
    expect(await reader.resolve(event)).toBeNull();
  });
});
