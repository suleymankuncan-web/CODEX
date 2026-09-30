import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("company-cycle canonical schema mirror",()=>{
  it("mirrors migration 095 exactly without changing historical migrations",()=>{
    const schema=readFileSync(resolve(process.cwd(),"../../db/schema.sql"),"utf8");
    const migration=readFileSync(resolve(process.cwd(),"../../db/migrations/095_incentive_company_cycle_v1.sql"),"utf8");
    expect(schema.slice(schema.indexOf("CREATE TABLE ops.incentive_legacy_approval")).trim()).toBe(migration.trim());
  });
});
