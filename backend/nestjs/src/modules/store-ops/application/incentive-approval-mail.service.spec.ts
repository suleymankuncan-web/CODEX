import { ConfigService } from "@nestjs/config";
import { IncentiveApprovalMailService } from "./incentive-approval-mail.service";
import { DefiniteIncentiveSmtpRejection } from "../infrastructure/incentive-hr-mailer";
import { hrTestSnapshot } from "./incentive-hr-handoff.fixture";
import type { ApprovalMailEvent } from "../infrastructure/incentive-approval-mail-event";

const event: ApprovalMailEvent = {event_id:"event",company_id:"company",company_name:"Lufian",period_key:"2026-09",stage:"general_manager",actor_user_id:"gm",approver_name:"GM Adı",package_id:null,cycle_id:"cycle",revision_no:1,seal_hash:"a".repeat(64)};
function setup(values: Record<string,string> = {}) {
  const repository = {attempted:jest.fn(),abandon:jest.fn(),events:jest.fn(async()=>[event]),expand:jest.fn(),pending:jest.fn(async()=>[
    {delivery_id:"bm",recipient:"bm@example.test",user_id:"bm",audience:"region_manager"},
    {delivery_id:"sd",recipient:"sd@example.test",user_id:"sd",audience:"sales_director"},
  ]),claim:jest.fn(async()=>true),finishNotice:jest.fn(),hrMailboxSafe:jest.fn(async()=>true),finalSnapshot:jest.fn(async()=>hrTestSnapshot()),claimFinalHr:jest.fn(async()=>"hr-delivery")};
  const mailer = {ready:jest.fn(()=>true),verify:jest.fn(),recipients:jest.fn(()=>["ik@example.test"]),sendNotification:jest.fn(async()=>"notice-id"),send:jest.fn(async()=>"hr-id")};
  const hrRepository = {finish:jest.fn()};
  const config = new ConfigService({INCENTIVE_APPROVAL_EMAIL_ENABLED:"true",INCENTIVE_APPROVAL_EMAIL_APP_ORIGIN:"https://hraxis.example.test",...values});
  const service = new IncentiveApprovalMailService(repository as never,mailer as never,hrRepository as never,config);
  return {repository,mailer,hrRepository,service};
}

describe("approval mail isolation",()=>{
  it("GM final sends plain notices to BM/SD and a separate Excel only to configured HR",async()=>{
    const {service,mailer,repository,hrRepository}=setup(); await service.runOnce();
    expect(mailer.sendNotification).toHaveBeenCalledTimes(2);
    for(const [input] of mailer.sendNotification.mock.calls as unknown as [{recipient:string;content:{facts?:unknown;paragraphs:string[];action:{url:string};title:string}}][]) {
      expect(input.content.title).toBe("Eylül 2026 primleri GM Adı tarafından onaylanmıştır.");
      expect(input.content.paragraphs).toEqual([]); expect(input.content.facts).toBeUndefined();
      expect(input).not.toHaveProperty("attachment");
      expect(input.content.action.url).toBe("https://hraxis.example.test/store/incentives?period=2026-09");
    }
    expect(mailer.send).toHaveBeenCalledWith(expect.objectContaining({recipients:["ik@example.test"],companyId:"company",attachment:expect.any(Buffer),filename:"Primler-2026-09.xlsx"}));
    expect(repository.claimFinalHr).toHaveBeenCalledTimes(1);
    expect(hrRepository.finish).toHaveBeenCalledWith("hr-delivery","sent","hr-id");
  });
  it.each(["region_manager","sales_director","hr"] as const)("%s stage never builds or sends any workbook",async stage=>{
    const {service,mailer,repository}=setup(); repository.events.mockResolvedValue([{...event,stage}]);
    await service.runOnce(); expect(mailer.send).not.toHaveBeenCalled(); expect(repository.finalSnapshot).not.toHaveBeenCalled();
  });
  it("an unsafe HR mapping cannot send a workbook",async()=>{
    const {service,mailer,repository}=setup(); repository.hrMailboxSafe.mockResolvedValue(false);
    await service.runOnce(); expect(mailer.send).not.toHaveBeenCalled(); expect(repository.claimFinalHr).not.toHaveBeenCalled();
  });
  it("a prior manual or automatic HR claim is never duplicated",async()=>{
    const {service,mailer,repository}=setup(); repository.claimFinalHr.mockResolvedValue(null as never);
    await service.runOnce(); expect(mailer.send).not.toHaveBeenCalled();
  });
  it("SMTP preflight failure leaves all deliveries unclaimed",async()=>{
    const {service,mailer,repository}=setup(); mailer.verify.mockRejectedValue(new Error("offline"));
    await service.runOnce(); expect(repository.claim).not.toHaveBeenCalled(); expect(repository.claimFinalHr).not.toHaveBeenCalled();
  });
  it.each([new Error("post-DATA timeout"),new DefiniteIncentiveSmtpRejection("recipient")])("SMTP failures preserve uncertainty/retry distinctions",async error=>{
    const {service,mailer,repository}=setup(); mailer.sendNotification.mockRejectedValue(error);
    await service.runOnce(); expect(repository.finishNotice).toHaveBeenCalledWith("bm",error instanceof DefiniteIncentiveSmtpRejection ? "pending" : "uncertain");
    expect(mailer.sendNotification).toHaveBeenCalledTimes(2);
  });
  it("rotates a failed event before resolving recipients without claiming it",async()=>{
    const {service,repository,mailer}=setup();mailer.recipients.mockImplementation(()=>{throw new Error("invalid configuration");});
    await service.runOnce();expect(repository.attempted).toHaveBeenCalledWith(event.event_id);
    expect(repository.claim).not.toHaveBeenCalled();expect(repository.claimFinalHr).not.toHaveBeenCalled();
  });
  it("disabling notifications leaves the existing approval flow independent",async()=>{
    const {service,repository}=setup({INCENTIVE_APPROVAL_EMAIL_ENABLED:"false"}); await service.runOnce(); expect(repository.events).not.toHaveBeenCalled();
  });
  it("ambiguous/untrusted application origins cannot generate actionable mail",async()=>{
    const {service,repository}=setup({INCENTIVE_APPROVAL_EMAIL_APP_ORIGIN:"http://example.test"}); await service.runOnce(); expect(repository.events).not.toHaveBeenCalled();
  });
});
