import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("account security canonical schema", () => {
  it("mirrors the additive migration exactly once after parent tables", () => {
    const migration = readFileSync(resolve(process.cwd(), "../../db/migrations/099_auth_account_security.sql"), "utf8");
    const body = migration.split("BEGIN;\n")[1].split("\nCOMMIT;")[0].trim();
    const schema = readFileSync(resolve(process.cwd(), "../../db/schema.sql"), "utf8");
    expect(schema.split(body)).toHaveLength(2);
    expect(schema.indexOf(body)).toBeGreaterThan(schema.indexOf("CREATE TABLE ops.identity_lifecycle_job"));
    expect(schema.indexOf(body)).toBeLessThan(schema.indexOf("CREATE TABLE ops.user_action_store_assignment"));
  });
});
