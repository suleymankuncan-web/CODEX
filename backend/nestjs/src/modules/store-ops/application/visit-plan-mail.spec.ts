import * as XLSX from 'xlsx-js-style';
import { ConfigService } from '@nestjs/config';
import { buildVisitPlanMailWorkbook } from './visit-plan-mail-workbook';
import { OperationalMailService } from './operational-mail.service';
import { visitPlanRecipient } from '../infrastructure/visit-plan-mail-read';
import { assertOperationalMailAttachment } from '../infrastructure/operational-mail-attachment';
import { DefiniteOperationalMailRejection } from '../infrastructure/operational-mailer';
const plan={managerName:'Fixture BM',weekStart:'2026-09-28',scopeRevision:'current',
  items:[{plannedDate:'30.09.2026',storeCode:'=1+1',storeName:'@store'}]};
function setup(settings={OPERATIONAL_VISIT_PLAN_EMAIL_ENABLED:'true'}) {
  const event={event_id:'event',kind:'visit_plan_created',payload:{weekStart:plan.weekStart}};
  const recipient={delivery_id:'delivery',recipient:visitPlanRecipient,user_id:null,audience:'visit_plan'};
  const repository={attempted:jest.fn(),activate:jest.fn(),abandon:jest.fn(),events:jest.fn(async()=>[event]),suppress:jest.fn(),expand:jest.fn(),
    pending:jest.fn(async()=>[recipient]),claim:jest.fn(async()=>true),finish:jest.fn()};
  const source={resolve:jest.fn(async()=>({complete:true,recipients:[recipient],content:{kind:event.kind,name:plan.managerName,range:plan.weekStart},visitPlan:plan}))};
  const scheduler={schedule:jest.fn()},reports={buildWeeklyWorkbook:jest.fn(),buildWorkbook:jest.fn()};
  const mailer={ready:jest.fn(()=>true),verify:jest.fn(),send:jest.fn(async()=>'<accepted>')};
  const service=new OperationalMailService(repository as never,source as never,scheduler as never,reports as never,mailer as never,
    new ConfigService({...settings,OPERATIONAL_MAIL_APP_ORIGIN:'https://hr.example'}));
  return {service,repository,source,scheduler,reports,mailer};
}
describe('saved weekly visit plan mail',()=>{
  it('exports only the saved BM plan and keeps formula-like store names literal',()=>{
    const report=buildVisitPlanMailWorkbook(plan),book=XLSX.read(report.buffer,{type:'buffer'});
    expect(report.fileName).toBe('BM-Ziyaret-Plani-2026-09-28.xlsx');expect(book.SheetNames).toEqual(['Fixture BM']);
    expect(XLSX.utils.sheet_to_json(book.Sheets['Fixture BM'],{header:1})).toContainEqual(['30.09.2026','=1+1','@store']);
    expect(book.Sheets['Fixture BM'].B7).toMatchObject({t:'s',v:'=1+1'});expect(book.Sheets['Fixture BM'].B7.f).toBeUndefined();
    const empty=XLSX.read(buildVisitPlanMailWorkbook({...plan,items:[],managerName:'/[]:*?\\'}).buffer,{type:'buffer'});
    expect(empty.SheetNames).toEqual(['Bölge Müdürü']);
    expect(XLSX.utils.sheet_to_json(empty.Sheets['Bölge Müdürü'],{header:1})).toContainEqual(['Planlanan ziyaret bulunmuyor']);
  });
  it('stays default-off and sends one independent event attachment to exactly the approved mailbox',async()=>{
    const off=setup({} as never);await off.service.runOnce();expect(off.mailer.verify).not.toHaveBeenCalled();
    const t=setup();await t.service.runOnce();expect(t.repository.activate).toHaveBeenCalledWith('visit_plans');
    expect(t.repository.events).toHaveBeenCalledWith(['visit_plans']);expect(t.mailer.send).toHaveBeenCalledTimes(1);
    expect(t.mailer.send).toHaveBeenCalledWith(expect.objectContaining({recipient:visitPlanRecipient,report:expect.objectContaining({fileName:'BM-Ziyaret-Plani-2026-09-28.xlsx'})}));
    expect(t.repository.claim).toHaveBeenCalledWith('delivery',expect.stringMatching(/^[a-f0-9]{64}$/));
    expect(t.repository.finish).toHaveBeenCalledWith('delivery','sent','<accepted>');expect(t.reports.buildWeeklyWorkbook).not.toHaveBeenCalled();
  });
  it('rechecks authority before claim and suppresses an obsolete or revoked plan',async()=>{
    const t=setup();const original=await t.source.resolve();t.source.resolve.mockClear();
    t.source.resolve.mockResolvedValueOnce(original).mockResolvedValueOnce({...original,visitPlan:{...plan,scopeRevision:'changed'}});
    await t.service.runOnce();expect(t.repository.claim).not.toHaveBeenCalled();expect(t.mailer.send).not.toHaveBeenCalled();
    const revoked=setup();revoked.source.resolve.mockResolvedValueOnce(null as never);await revoked.service.runOnce();
    expect(revoked.repository.suppress).toHaveBeenCalledWith('event');expect(revoked.mailer.send).not.toHaveBeenCalled();
  });
  it('refuses an unauthorized mailbox, path variant and oversized attachment',()=>{
    const report=buildVisitPlanMailWorkbook(plan);
    expect(()=>assertOperationalMailAttachment(visitPlanRecipient,report)).not.toThrow();
    expect(()=>assertOperationalMailAttachment('bm@example.test',report)).toThrow();
    expect(()=>assertOperationalMailAttachment(visitPlanRecipient,{...report,fileName:'../'+report.fileName})).toThrow();
    expect(()=>assertOperationalMailAttachment(visitPlanRecipient,{...report,buffer:Buffer.alloc(15*1024*1024+1)})).toThrow();
  });
  it('retains uncertain SMTP attempts and retries only definite rejection',async()=>{
    const uncertain=setup();uncertain.mailer.send.mockRejectedValueOnce(new Error('timeout after DATA'));await uncertain.service.runOnce();
    expect(uncertain.repository.finish).toHaveBeenCalledWith('delivery','uncertain');
    const rejected=setup();rejected.mailer.send.mockRejectedValueOnce(new DefiniteOperationalMailRejection('pre-DATA'));await rejected.service.runOnce();
    expect(rejected.repository.finish).toHaveBeenCalledWith('delivery','pending');
  });
});
