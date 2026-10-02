import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { ConfigService } from '@nestjs/config';
import { cycleDatabase,cycleId as id,seedCompanyCycle } from './incentive-company-cycle.postgres-fixture';
import { ChecklistVisitPlanRepository } from './checklist-visit-plan.repository';
import { OperationalMailRepository } from './operational-mail.repository';
import { OperationalMailSource } from './operational-mail-source';
import { OperationalMailScheduler } from './operational-mail-scheduler.repository';
import { OperationalMailService } from '../application/operational-mail.service';
import * as XLSX from 'xlsx-js-style';
import { readVisitPlanMail,visitPlanRecipient } from './visit-plan-mail-read';
const url=process.env.INCENTIVE_PARTICIPATION_POSTGRES_URL;
const describePg=url ? describe : describe.skip;
jest.setTimeout(30000);
describePg('saved weekly visit plan mail native PostgreSQL',()=>{
  const name=`visit_plan_mail_${randomUUID().replaceAll('-','').slice(0,12)}`,week='2026-09-28';
  const now=new Date('2026-10-02T06:00Z');
  let admin:Pool,pool:Pool;
  const db=()=>cycleDatabase(pool) as never;
  const plans=()=>new ChecklistVisitPlanRepository(db());
  const repo=()=>new OperationalMailRepository(db());
  async function input() {
    const current=await plans().getAssignedWeeklyPlan({actorUserId:id(20),weekStart:week,storeIds:[id(2),id(4)]});
    return {actorUserId:id(20),weekStart:week,authorizedStoreIds:[id(2),id(4)],expectedRevision:current.revision,
      expectedScopeRevision:current.scopeRevision!,idempotencyKey:randomUUID(),requestSha256:'a'.repeat(64),
      items:[{storeId:id(2),plannedDate:'2026-09-28',displayOrder:0},{storeId:id(4),plannedDate:'2026-09-30',displayOrder:1}]};
  }
  beforeAll(async()=>{
    admin=new Pool({connectionString:url});await admin.query(`CREATE DATABASE "${name}"`);
    const parsed=new URL(url!);parsed.pathname=`/${name}`;pool=new Pool({connectionString:parsed.href});
  });
  beforeEach(async()=>{
    await seedCompanyCycle(pool);
    for(const file of ['101_operational_mail_pilot_v1.sql','103_visit_plan_created_mail_v1.sql'])
      await pool.query(readFileSync(resolve(process.cwd(),'../../db/migrations',file),'utf8'));
    await pool.query(`INSERT INTO ops.region(region_id,company_id,region_code,region_name) VALUES('${id(7)}','${id(1)}','SECOND','Second region');
      INSERT INTO ops.store(store_id,company_id,region_id,store_code,store_name,store_type) VALUES('${id(4)}','${id(1)}','${id(7)}','S4','Store four','company');
      INSERT INTO ops.user_action_store_assignment(user_id,store_id,start_at) VALUES('${id(20)}','${id(4)}','2020-01-01');
      UPDATE ops.user_account SET first_name='Fixture',last_name='Manager' WHERE user_id='${id(20)}';`);
  });
  afterAll(async()=>{await pool?.end();if(admin){await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH(FORCE)`);await admin.end();}});
  it('captures one committed portfolio save across regions and preserves its exact revision snapshot on replay',async()=>{
    await repo().activate('visit_plans');const write=await input();await plans().saveAssignedWeeklyPlan(write);
    const [event]=await repo().events(['visit_plans']);expect(await repo().events(['visit_plans'])).toHaveLength(1);
    expect(event.payload).toMatchObject({userId:id(20),weekStart:week,storeIds:[id(2),id(4)]});
    expect(event.payload.revisionIds).toHaveLength(2);
    const data=await readVisitPlanMail(db(),event,now);
    expect(data).toMatchObject({managerName:'Fixture Manager',weekStart:week,
      items:[{plannedDate:'28.09.2026',storeCode:'S1'},{plannedDate:'30.09.2026',storeCode:'S4'}]});
    await plans().saveAssignedWeeklyPlan(write);expect(await repo().events(['visit_plans'])).toHaveLength(1);
    const unchanged=await input();await plans().saveAssignedWeeklyPlan(unchanged);expect(await repo().events(['visit_plans'])).toHaveLength(1);
    const changed=await input();changed.items[0].plannedDate='2026-09-29';changed.requestSha256='b'.repeat(64);
    await plans().saveAssignedWeeklyPlan(changed);expect(await repo().events(['visit_plans'])).toHaveLength(2);
    expect((await readVisitPlanMail(db(),event,now))?.items[0].plannedDate).toBe('28.09.2026');
  });
  it('captures nothing before activation and keeps a failed save and its mail rolled back together',async()=>{
    const write=await input();await plans().saveAssignedWeeklyPlan(write);
    expect((await pool.query('SELECT * FROM ops.operational_mail_event')).rows).toEqual([]);
    await repo().activate('visit_plans');expect(await repo().events(['visit_plans'])).toEqual([]);
    const next=await input();next.items[0].plannedDate='2026-09-29';
    const brokenDb=cycleDatabase(pool,{beforeCommit:async()=>{throw new Error('fixture rollback');}});
    await expect(new ChecklistVisitPlanRepository(brokenDb as never).saveAssignedWeeklyPlan(next)).rejects.toThrow('fixture rollback');
    expect(await repo().events(['visit_plans'])).toEqual([]);
    expect((await plans().getAssignedWeeklyPlan({actorUserId:id(20),weekStart:week,storeIds:[id(2),id(4)]})).items[0].plannedDate).toBe('2026-09-28');
  });
  it('supports the legacy single-region save, emits no event for attendance and deduplicates fixed delivery receipts',async()=>{
    await repo().activate('visit_plans');const write=await input();
    await plans().saveWeeklyPlan({...write,regionId:id(6),expectedRevision:0,items:write.items.slice(0,1)});
    const [event]=await repo().events(['visit_plans']);expect(await repo().events(['weekly','operational'])).toEqual([]);
    const source=new OperationalMailSource(db(),new ConfigService());const resolved=await source.resolve(event,now);
    expect(resolved?.recipients).toEqual([{recipient:visitPlanRecipient,audience:'visit_plan',user_id:null}]);
    await repo().expand(event,resolved!.recipients,true);await repo().expand(event,resolved!.recipients,true);
    const [delivery]=await repo().pending(event.event_id);expect(await repo().pending(event.event_id)).toHaveLength(1);
    expect(await repo().claim(delivery.delivery_id,'a'.repeat(64))).toBe(true);await repo().finish(delivery.delivery_id,'uncertain');
    expect(await repo().claim(delivery.delivery_id)).toBe(false);expect(await repo().events(['visit_plans'])).toEqual([]);
    const item=(await pool.query('SELECT plan_item_id FROM ops.region_weekly_visit_plan_item')).rows[0];
    await pool.query(`INSERT INTO ops.region_weekly_visit_plan_completion(plan_item_id,completed_by_user_id,idempotency_key) VALUES($1,$2,$3)`,[item.plan_item_id,id(20),randomUUID()]);
    expect((await pool.query('SELECT count(*) FROM ops.operational_mail_event')).rows[0].count).toBe('1');
  });
  it('does not capture a foreign-company BM role and cancels export when a saved store or active role is revoked',async()=>{
    await repo().activate('visit_plans');await plans().saveAssignedWeeklyPlan(await input());const [event]=await repo().events(['visit_plans']);
    await pool.query('UPDATE ops.user_action_store_assignment SET end_at=clock_timestamp() WHERE user_id=$1 AND store_id=$2',[id(20),id(4)]);
    expect(await readVisitPlanMail(db(),event,now)).toBeNull();
    await pool.query('UPDATE ops.user_role_assignment SET company_id=$1 WHERE user_id=$2',[id(9),id(20)]);
    expect(await readVisitPlanMail(db(),event,now)).toBeNull();
    await plans().saveWeeklyPlan({...await input(),regionId:id(6),expectedRevision:1,authorizedStoreIds:[id(2)],items:[{storeId:id(2),plannedDate:'2026-09-29',displayOrder:0}]});
    expect(await repo().events(['visit_plans'])).toHaveLength(1);
  });
  it('allows upcoming-week plans, suppresses closed-week backlog and rejects malformed or mismatched snapshots',async()=>{
    await repo().activate('visit_plans');await plans().saveAssignedWeeklyPlan(await input());const [event]=await repo().events(['visit_plans']);
    expect(await readVisitPlanMail(db(),event,new Date('2026-09-20T09:00Z'))).not.toBeNull();
    expect(await readVisitPlanMail(db(),event,new Date('2026-10-05T06:00Z'))).toBeNull();
    expect(await readVisitPlanMail(db(),{...event,payload:{...event.payload,userId:id(21)}},now)).toBeNull();
    expect(await readVisitPlanMail(db(),{...event,payload:{...event.payload,weekStart:'2026-09-29'}},now)).toBeNull();
    expect(await readVisitPlanMail(db(),{...event,payload:{...event.payload,revisionIds:[id(999)]}},now)).toBeNull();
  });
  it('delivers the real saved plan workbook once through the outbox and has no Monday schedule',async()=>{
    await repo().activate('visit_plans');await plans().saveAssignedWeeklyPlan(await input());
    const repository=repo(),source=new OperationalMailSource(db(),new ConfigService());
    const scheduler=new OperationalMailScheduler(db(),repository,source);
    const before=(await pool.query('SELECT count(*) FROM ops.operational_mail_event')).rows[0].count;
    await scheduler.schedule(['visit_plans'],new Date('2026-10-05T06:00Z'));
    expect((await pool.query('SELECT count(*) FROM ops.operational_mail_event')).rows[0].count).toBe(before);
    const mailer={ready:()=>true,verify:jest.fn(),send:jest.fn(async (_input:{recipient:string;report?:{buffer:Buffer};content:{title:string}})=>'<accepted>')};
    const clockedSource={resolve:(event:Parameters<typeof source.resolve>[0])=>source.resolve(event,now)};
    const service=new OperationalMailService(repository,clockedSource as never,scheduler,{} as never,mailer as never,
      new ConfigService({OPERATIONAL_VISIT_PLAN_EMAIL_ENABLED:'true',OPERATIONAL_MAIL_APP_ORIGIN:'https://hr.example'}));
    await service.runOnce();await service.runOnce();expect(mailer.send).toHaveBeenCalledTimes(1);
    const message=mailer.send.mock.calls[0][0];
    expect(message.recipient).toBe(visitPlanRecipient);expect(message.content.title).toBe('Fixture Manager haftalık shiftini oluşturdu');
    const book=XLSX.read(message.report!.buffer,{type:'buffer'});
    expect(XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{header:1})).toContainEqual(['30.09.2026','S4','Store four']);
    const receipts=(await pool.query('SELECT recipient,status,attachment_sha256 FROM ops.operational_mail_delivery')).rows;
    expect(receipts).toEqual([{recipient:visitPlanRecipient,status:'sent',attachment_sha256:expect.stringMatching(/^[a-f0-9]{64}$/)}]);
  });
});
