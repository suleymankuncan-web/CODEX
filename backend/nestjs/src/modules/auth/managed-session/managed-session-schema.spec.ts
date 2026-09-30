import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("managed session canonical schema", () => {
  it("mirrors migration 098 exactly once after its account dependency", () => {
    const schema = readFileSync(resolve(process.cwd(), "../../db/schema.sql"), "utf8");
    const migration = readFileSync(resolve(process.cwd(), "../../db/migrations/098_managed_browser_session_v2.sql"), "utf8");
    const ddl = migration.slice(migration.indexOf("-- Provider tokens never enter")).trim();
    expect(ddl).toContain("CREATE TABLE IF NOT EXISTS ops.managed_browser_session");
    expect(schema).toContain(ddl);
    expect(schema.split("CREATE TABLE IF NOT EXISTS ops.managed_browser_session")).toHaveLength(2);
    const accountAt = schema.indexOf("CREATE TABLE ops.user_account (");
    expect(accountAt).toBeGreaterThanOrEqual(0);
    expect(accountAt).toBeLessThan(schema.indexOf(ddl));
  });
});
