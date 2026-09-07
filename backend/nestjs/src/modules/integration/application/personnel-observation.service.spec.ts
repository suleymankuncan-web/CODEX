import { PersonnelObservationService } from "./personnel-observation.service";
import { PersonnelObservationRepository } from "../infrastructure/personnel-observation.repository";
import { NeutralSalesLine } from "./company-daily-kpi-pure-adapter";

const sourceId = "00000000-0000-4000-8000-000000000001";
const businessDate = "2026-09-06";
function line(overrides: Partial<NeutralSalesLine> = {}): NeutralSalesLine {
  return { sourceDateToken: businessDate, ephemeralInvoiceId: "invoice-A",
    personnelCode: "001a", storeCode: "shop-A", isReturn: false,
    quantity: "1", amountTry: "12.35", displayName: "synthetic-person", ...overrides };
}
function setup() {
  const repository = { beginAttempt: jest.fn(), replace: jest.fn().mockResolvedValue({acceptedCount: 1}),
    list: jest.fn().mockResolvedValue({rows: [], total: 0}) };
  return { repository, service: new PersonnelObservationService(repository as unknown as PersonnelObservationRepository) };
}
describe("PersonnelObservationService", () => {
  it("deduplicates lines while retaining multiple stores, exact codes and return-only activity", async () => {
    const {service,repository}=setup();
    await service.acceptSales({sourceId,businessDate,generation:"1",rows:[line(),line(),
      line({storeCode:"shop-B",isReturn:true,quantity:"-1",amountTry:"-12.35"})]});
    const input=repository.replace.mock.calls[0][0];
    expect(input.observations).toEqual([
      {storeCode:"shop-A",personnelCode:"001a"},{storeCode:"shop-B",personnelCode:"001a"}]);
    expect(JSON.stringify(input)).not.toMatch(/synthetic-person|invoice-A|amountTry|displayName/);
  });
  it("does not write a mixed-day response or one with invalid return signs", async () => {
    const {service,repository}=setup();
    for(const bad of [line({sourceDateToken:"2026-09-05"}),line({isReturn:true})]) {
      await expect(service.acceptSales({sourceId,businessDate,generation:"1",rows:[line(),bad]})).rejects.toThrow();
    }
    expect(repository.replace).not.toHaveBeenCalled();
  });
  it("excludes missing personnel codes without manufacturing identities", async () => {
    const {service,repository}=setup();
    await service.acceptSales({sourceId,businessDate,generation:"1",rows:[line({personnelCode:""})]});
    expect(repository.replace.mock.calls[0][0].observations).toEqual([]);
  });
  it("accepts an explicit successful empty set and makes its digest deterministic", async () => {
    const {service,repository}=setup();
    await service.acceptSales({sourceId,businessDate,generation:"1",rows:[]});
    await service.acceptSales({sourceId,businessDate,generation:"2",rows:[]});
    expect(repository.replace.mock.calls[0][0].digest).toBe(repository.replace.mock.calls[1][0].digest);
  });
  it("binds digest to code, store and business date but never names or invoice identities", async () => {
    const {service,repository}=setup();
    for(const row of [line(),line({ephemeralInvoiceId:"invoice-B",displayName:"synthetic-other"}),line({storeCode:"shop-B"})]) {
      await service.acceptSales({sourceId,businessDate,generation:"1",rows:[row]});
    }
    const digests=repository.replace.mock.calls.map(([x])=>x.digest);
    expect(digests[0]).toBe(digests[1]);expect(digests[0]).not.toBe(digests[2]);
  });
  it("fails closed on company scope, invalid dates and unbounded listing", async () => {
    const {service,repository}=setup();
    const input={actorCompanyIds:[sourceId],fromDate:businessDate,toDate:businessDate};
    for(const overrides of [{actorCompanyIds:[]},{fromDate:"2026-02-30"},{toDate:"2028-09-06"},{limit:201},{offset:-1}]) {
      await expect(service.list({...input,...overrides})).rejects.toThrow();
    }
    expect(repository.list).not.toHaveBeenCalled();
    await service.list(input);
    expect(repository.list).toHaveBeenCalledWith({...input,limit:50,offset:0});
  });
});
