import { validateSync } from "class-validator";
import { DecideIncentiveCompanyDto, SealIncentiveCompanyDto } from "./incentive-company-cycle.dto";

const valid = {companyId:"00000000-0000-4000-8000-000000000001",period:"2026-09",cycleId:"00000000-0000-4000-8000-000000000002",revision:1,stage:"hr",sealHash:"a".repeat(64),decision:"approve"};
describe("company confirmation DTO",()=>{
  const errors=(input: Record<string,unknown>)=>validateSync(Object.assign(new DecideIncentiveCompanyDto(),input),{whitelist:true,forbidNonWhitelisted:true});
  it("accepts the exact company/cycle/formal revision/stage/hash tuple",()=>expect(errors(valid)).toHaveLength(0));
  it.each([{revision:0},{revision:1.5},{stage:"final"},{stage:"preparation"},{sealHash:"old-package-token"},{companyId:"not-a-uuid"},{period:"2026-13"}])("rejects malformed or nonformal confirmation %j",patch=>expect(errors({...valid,...patch}).length).toBeGreaterThan(0));
  it("cannot smuggle sealed target edits or another actor into a GM decision",()=>{
    expect(errors({...valid,stage:"general_manager",amount:"999",actorUserId:valid.companyId}).length).toBeGreaterThan(0);
  });
  it("preparation alone accepts revision zero, not a fake stage proof",()=>{
    expect(validateSync(Object.assign(new SealIncentiveCompanyDto(),{companyId:valid.companyId,period:valid.period,expectedRevision:0}))).toHaveLength(0);
  });
});
