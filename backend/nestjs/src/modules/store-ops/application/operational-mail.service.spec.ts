import { ConfigService } from '@nestjs/config';
import { OperationalMailService } from './operational-mail.service';
import { DefiniteOperationalMailRejection } from '../infrastructure/operational-mailer';

function setup(kind='checklist_completed',settings:Record<string,string>={OPERATIONAL_MAIL_ENABLED:'true'}) {
  const event={event_id:'event',kind,payload:{checklistId:'checklist',start:'2026-09-28',end:'2026-10-04'}};
  const recipient={delivery_id:'delivery',recipient:'store@example.test',user_id:null,audience:'store_mailbox'};
  const repository={attempted:jest.fn(),activate:jest.fn(),abandon:jest.fn(),events:jest.fn(async()=>[event]),suppress:jest.fn(),expand:jest.fn(),pending:jest.fn(async()=>[recipient]),claim:jest.fn(async()=>true),finish:jest.fn()};
  const source={resolve:jest.fn(async()=>({complete:true,recipients:[recipient],content:{kind,storeName:'Store',actionCount:1},
    ...(kind.includes('report') ? {reportManager:{user_id:'bm',email:recipient.recipient,store_ids:['own-store'],company_ids:['company']}} : {})}))};
  const scheduler={schedule:jest.fn()};
  const reports={buildWeeklyWorkbook:jest.fn(async()=>({fileName:'magaza-izleyis-haftalik-2026-09-28-2026-10-04.xlsx',buffer:Buffer.from('real-report')})),buildWorkbook:jest.fn()};
  const mailer={ready:jest.fn(()=>true),verify:jest.fn(),send:jest.fn(async()=>'<accepted>')};
  const service=new OperationalMailService(repository as never,source as never,scheduler as never,reports as never,mailer as never,
    new ConfigService({...settings,OPERATIONAL_MAIL_APP_ORIGIN:'https://hr.example'}));
  return {service,repository,source,scheduler,reports,mailer};
}
describe('operational mail delivery boundary',()=>{
  it('is disabled by default and separates weekly pilot switch',async()=>{
    const off=setup('checklist_completed',{});await off.service.runOnce();expect(off.mailer.verify).not.toHaveBeenCalled();
    const weekly=setup('weekly_report',{OPERATIONAL_WEEKLY_REPORT_EMAIL_ENABLED:'true'});await weekly.service.runOnce();
    expect(weekly.repository.events).toHaveBeenCalledWith(['weekly']);
    expect(weekly.reports.buildWeeklyWorkbook).toHaveBeenCalledWith(expect.objectContaining({periodStart:'2026-09-28',periodEnd:'2026-10-04',companyIds:[],regionIds:[],storeIds:['own-store']}));
    expect(weekly.mailer.send).toHaveBeenCalledWith(expect.objectContaining({recipient:'store@example.test',report:expect.objectContaining({buffer:Buffer.from('real-report')})}));
  });
  it('preflights before claiming but retains activation through SMTP outage',async()=>{
    const t=setup();t.mailer.verify.mockRejectedValueOnce(new Error('offline'));await t.service.runOnce();
    expect(t.repository.activate).toHaveBeenCalledWith('operational');expect(t.repository.claim).not.toHaveBeenCalled();expect(t.mailer.send).not.toHaveBeenCalled();
    expect(t.scheduler.schedule).toHaveBeenCalledWith(['operational']);
  });
  it('suppresses stale actions and revoked recipients without sending',async()=>{
    const t=setup();t.source.resolve.mockResolvedValueOnce(null as never);await t.service.runOnce();
    expect(t.repository.suppress).toHaveBeenCalledWith('event');expect(t.mailer.send).not.toHaveBeenCalled();
    const revoked=setup();const initial=await revoked.source.resolve();revoked.source.resolve.mockClear();
    revoked.source.resolve.mockResolvedValueOnce(initial).mockResolvedValueOnce({...initial,recipients:[]});
    await revoked.service.runOnce();
    // Recheck is authoritative even when stored pending recipients exist.
    expect(revoked.source.resolve).toHaveBeenCalledTimes(2);
    expect(revoked.mailer.send).not.toHaveBeenCalled();expect(revoked.repository.finish).toHaveBeenCalledWith('delivery','cancelled');
  });
  it('does not send a report after store scope changes during workbook creation',async()=>{
    const t=setup('weekly_report',{OPERATIONAL_WEEKLY_REPORT_EMAIL_ENABLED:'true'});
    const original=await t.source.resolve();t.source.resolve.mockResolvedValueOnce(original).mockResolvedValueOnce(original)
      .mockResolvedValueOnce({...original,reportManager:{...original.reportManager!,store_ids:['different-store']}});
    await t.service.runOnce();expect(t.mailer.send).not.toHaveBeenCalled();expect(t.repository.finish).toHaveBeenCalledWith('delivery','cancelled');
  });
  it('never retries an uncertain accepted attempt but permits definite rejection retry',async()=>{
    const uncertain=setup();uncertain.mailer.send.mockRejectedValueOnce(new Error('timeout after DATA'));await uncertain.service.runOnce();
    expect(uncertain.repository.finish).toHaveBeenCalledWith('delivery','uncertain');
    const rejected=setup();rejected.mailer.send.mockRejectedValueOnce(new DefiniteOperationalMailRejection('pre-DATA'));await rejected.service.runOnce();
    expect(rejected.repository.finish).toHaveBeenCalledWith('delivery','pending');
  });
  it('rotates source failures and keeps an oversized report pending before any SMTP claim',async()=>{
    const failure=setup();failure.source.resolve.mockRejectedValueOnce(new Error('source unavailable'));await failure.service.runOnce();
    expect(failure.repository.attempted).toHaveBeenCalledWith('event');expect(failure.repository.claim).not.toHaveBeenCalled();
    const large=setup('weekly_report',{OPERATIONAL_WEEKLY_REPORT_EMAIL_ENABLED:'true'});
    large.reports.buildWeeklyWorkbook.mockResolvedValueOnce({fileName:'magaza-izleyis-haftalik-2026-09-28-2026-10-04.xlsx',buffer:Buffer.alloc(15*1024*1024+1)});
    await large.service.runOnce();expect(large.repository.claim).not.toHaveBeenCalled();expect(large.mailer.send).not.toHaveBeenCalled();
  });
  it('normal operational mail carries only content and no Excel',async()=>{
    const t=setup();await t.service.runOnce();expect(t.reports.buildWeeklyWorkbook).not.toHaveBeenCalled();
    expect(t.mailer.send).toHaveBeenCalledWith(expect.objectContaining({report:undefined}));expect(t.repository.finish).toHaveBeenCalledWith('delivery','sent','<accepted>');
  });
});
