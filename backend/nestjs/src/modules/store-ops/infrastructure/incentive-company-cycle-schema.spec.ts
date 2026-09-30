import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("company-cycle canonical schema mirror",()=>{
  it("mirrors migration 095 exactly without changing historical migrations",()=>{
    const schema=readFileSync(resolve(process.cwd(),"../../db/schema.sql"),"utf8");
    const migration=readFileSync(resolve(process.cwd(),"../../db/migrations/095_incentive_company_cycle_v1.sql"),"utf8");
    const start=schema.indexOf("-- Company incentive cycle v1.");
    expect(start).toBeGreaterThanOrEqual(0);
    expect(schema.slice(start,start+migration.trim().length)).toBe(migration.trim());
  });
  it("mirrors the V2 net DDL while rate seeding remains in the migration",()=>{
    const schema=readFileSync(resolve(process.cwd(),"../../db/schema.sql"),"utf8");
    const migration=readFileSync(resolve(process.cwd(),"../../db/migrations/097_incentive_net_sales_v2.sql"),"utf8");
    const start=migration.indexOf("-- New projections preserve V1");
    const end=migration.indexOf("INSERT INTO ops.sales_target_incentive_rule_version",start);
    expect(start).toBeGreaterThanOrEqual(0); expect(end).toBeGreaterThan(start);
    expect(schema.slice(schema.indexOf("-- New projections preserve V1")).trim()).toBe(migration.slice(start,end).trim());
  });
});
