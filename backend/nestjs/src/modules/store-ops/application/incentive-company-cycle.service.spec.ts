import { ForbiddenException } from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/auth-context.service";
import { IncentiveCompanyCycleService, incentiveStageCompanies } from "./incentive-company-cycle.service";

const actor = (role="HR_ADMIN",permission="INCENTIVE_HR_APPROVAL") => ({
  userId:"synthetic",roleCodes:[role],roleScopes:{[role]:{companyIds:["owned"],regionIds:[],storeIds:[]}},
  permissionScopes:{[permission]:{companyIds:["owned","foreign"],regionIds:[],storeIds:[]}},
  readScope:{companyIds:["owned","foreign","ungranted"],regionIds:[],storeIds:[],allowGlobalScope:true},
}) as unknown as AuthenticatedUser;

describe("company stage scope boundary",()=>{
  it("HR-only reads intersect the matching HR persona and individual capability, not union/global read scope",async()=>{
    const repository={read:jest.fn(async companyId=>({companyId})),seal:jest.fn(),decide:jest.fn()};
    const service=new IncentiveCompanyCycleService(repository as never);
    expect(incentiveStageCompanies(actor(),"hr")).toEqual(["owned"]);
    expect(await service.list(actor(),"2026-09")).toEqual({items:[{companyId:"owned"}]});
    expect(repository.read).toHaveBeenCalledWith("owned","2026-09","synthetic");
    expect(repository.read).toHaveBeenCalledTimes(1);
    expect(()=>service.decide(actor(),{companyId:"foreign",period:"2026-09",cycleId:"cycle",revision:1,stage:"hr",sealHash:"a".repeat(64),decision:"approve"})).toThrow(ForbiddenException);
  });
  it.each([
    ["REPORT_VIEWER","INCENTIVE_FINAL_APPROVAL","sales_director"],
    ["REPORT_VIEWER","INCENTIVE_FINAL_APPROVAL","general_manager"],
    ["REPORT_VIEWER","INCENTIVE_HR_APPROVAL","hr"],
    ["HR_ADMIN","INCENTIVE_GENERAL_MANAGER_APPROVAL","general_manager"],
  ] as const)("%s/%s cannot become %s authority",(role,permission,stage)=>{
    expect(incentiveStageCompanies(actor(role,permission),stage)).toEqual([]);
  });
  it("a company-matching capability cannot borrow a different role's wider persona scope",()=>{
    const user=actor("REPORT_VIEWER","INCENTIVE_GENERAL_MANAGER_APPROVAL");
    user.roleCodes.push("HR_ADMIN"); user.roleScopes!.HR_ADMIN={companyIds:["foreign"],regionIds:[],storeIds:[]};
    expect(incentiveStageCompanies(user,"general_manager")).toEqual(["owned"]);
  });
});
