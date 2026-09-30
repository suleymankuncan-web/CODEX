import * as request from "supertest";
import { buildAuthenticatedUser } from "../../src/modules/auth/auth-context.service";
import { createIntegrationApp } from "./test-app";

const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const query={storeId:id(2),periodStart:"2026-05-01",periodEnd:"2026-05-31"};

describe("shared return ledger HTTP authorization and bounds",()=>{
  const database={query:jest.fn(async(sql:string,params:unknown[])=>{
    const companies=params[1] as string[],stores=params[2] as string[];
    if(params[0]!==id(2) || (!companies.includes(id(1)) && !stores.includes(id(2)))) return {rows:[]};
    return {rows:sql.includes("AS ledger") ? [{ledger:{storeId:id(2),rows:[],page:{total:0,limit:50,offset:0}}}] : [{store_id:id(2)}]};
  }),withTransaction:jest.fn()};
  const auth={resolveUser:jest.fn(async(incoming:{headers:Record<string,string>})=>{
    const persona=incoming.headers["x-test-persona"]??"report";
    const role=persona==="hr" ? "HR_ADMIN" : persona.startsWith("manager") ? "REGION_MANAGER" : "REPORT_VIEWER";
    return buildAuthenticatedUser({userId:id(9),roleCodes:persona==="mixed"?["REPORT_VIEWER","SUPER_ADMIN"]:[role],
      readScope:{companyIds:[id(1),id(8)],regionIds:[id(6)],storeIds:[id(2)]},
      assignedStoreIds:persona==="manager-unassigned"?[]:[id(2)],
      roleScopes:{[role]:{companyIds:role==="REPORT_VIEWER"?[id(1)]:[id(8)],regionIds:[id(6)],storeIds:role==="REGION_MANAGER"?[id(2)]:[]},
        ...(persona==="mixed"?{SUPER_ADMIN:{companyIds:[id(8)],regionIds:[],storeIds:[]}}:{})},
    });
  })};
  let app:Awaited<ReturnType<typeof createIntegrationApp>>;
  beforeAll(async()=>{app=await createIntegrationApp({databaseService:database,authContextService:auth});});
  afterAll(async()=>{await app.close();});
  beforeEach(()=>database.query.mockClear());

  it("uses the same own-role company boundary for authorization and the ledger",async()=>{
    const result=await request(app.getHttpServer()).get("/api/reports/store-returns").query(query).set("x-test-persona","mixed").expect(200);
    expect(result.body.data.storeId).toBe(id(2));
    expect(database.query.mock.calls).toHaveLength(2);
    for(const [,params] of database.query.mock.calls) expect(params.slice(0,3)).toEqual([id(2),[id(1)],[]]);
  });
  it("requires an actual current manager assignment and rejects out-of-scope stores",async()=>{
    await request(app.getHttpServer()).get("/api/reports/store-returns").query(query).set("x-test-persona","manager").expect(200);
    await request(app.getHttpServer()).get("/api/reports/store-returns").query(query).set("x-test-persona","manager-unassigned").expect(404);
    await request(app.getHttpServer()).get("/api/reports/store-returns").query({...query,storeId:id(3)}).expect(404);
  });
  it("rejects roles outside the reporting/assigned-store contract",async()=>{
    await request(app.getHttpServer()).get("/api/reports/store-returns").query(query).set("x-test-persona","hr").expect(403);
    expect(database.query).not.toHaveBeenCalled();
  });
  it("rejects impossible dates, reversed/oversized ranges, pagination and scope overrides",async()=>{
    for(const override of [{periodStart:"2026-02-30"},{periodStart:"2026-06-01"},
      {periodStart:"2024-01-01"},{limit:101},{offset:-1},{category:"all"},{companyId:id(8)},{storeId:"unknown"}]) {
      await request(app.getHttpServer()).get("/api/reports/store-returns").query({...query,...override}).expect(400);
    }
    expect(database.query).not.toHaveBeenCalled();
  });
});
