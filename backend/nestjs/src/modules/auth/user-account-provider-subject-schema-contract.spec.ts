import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const schema = readFileSync(join(process.cwd(), "..", "..", "db", "schema.sql"), "utf8");
const migrationsRoot = join(process.cwd(), "..", "..", "db", "migrations");

function readMigration(name: string) {
  return readFileSync(join(migrationsRoot, name), "utf8");
}

describe("user account provider subject schema contract", () => {
  it("stores durable provider subject mapping on user accounts", () => {
    expect(schema).toContain("provider_subject TEXT");
    expect(schema).toContain("updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()");
    expect(schema).toContain("deactivation_reason TEXT");
    expect(schema).toContain("deactivated_by_user_id UUID REFERENCES ops.user_account(user_id)");
    expect(schema).toContain("deactivated_at TIMESTAMPTZ");
    expect(schema).toContain("uq_user_account_auth_provider_subject");
    expect(schema).toContain("WHERE provider_subject IS NOT NULL");
  });

  it("adds provider subject through an additive migration", () => {
    const migrationPath = join(migrationsRoot, "041_user_account_provider_subject.sql");

    expect(existsSync(migrationPath)).toBe(true);

    const migration = readMigration("041_user_account_provider_subject.sql");

    expect(migration).toContain("ALTER TABLE ops.user_account");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS provider_subject TEXT");
    expect(migration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS uq_user_account_auth_provider_subject");
    expect(migration).toContain("ON ops.user_account (auth_provider, provider_subject)");
  });

  it("adds user access lifecycle metadata through an additive migration", () => {
    const migrationPath = join(migrationsRoot, "044_user_access_lifecycle_metadata.sql");

    expect(existsSync(migrationPath)).toBe(true);

    const migration = readMigration("044_user_access_lifecycle_metadata.sql");

    expect(migration).toContain("ADD COLUMN IF NOT EXISTS deactivation_reason TEXT");
    expect(migration).toContain(
      "ADD COLUMN IF NOT EXISTS deactivated_by_user_id UUID REFERENCES ops.user_account(user_id)",
    );
    expect(migration).toContain("CREATE INDEX IF NOT EXISTS idx_user_account_active_employee");
    expect(migration).toContain("ON ops.user_account (is_active, employee_id)");
  });
});
