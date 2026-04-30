import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const schema = readFileSync(join(process.cwd(), "..", "..", "db", "schema.sql"), "utf8");
const migrationsRoot = join(process.cwd(), "..", "..", "db", "migrations");
const migrationName = "043_user_role_assignment_active_uniqueness.sql";
const migrationPath = join(migrationsRoot, migrationName);
const zeroUuid = "'00000000-0000-0000-0000-000000000000'::uuid";

function readMigration() {
  return readFileSync(migrationPath, "utf8");
}

describe("user role assignment active uniqueness schema contract", () => {
  it("adds a nullable-scope safe active unique index through migration 043", () => {
    expect(existsSync(migrationPath)).toBe(true);
    if (!existsSync(migrationPath)) {
      return;
    }

    const migration = readMigration();

    expect(migration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS uq_user_role_assignment_active_scope");
    expect(migration).toContain("ON ops.user_role_assignment");
    expect(migration).toContain("WHERE end_at IS NULL");
    expect(migration).toContain(`COALESCE(company_id, ${zeroUuid})`);
    expect(migration).toContain(`COALESCE(region_id, ${zeroUuid})`);
    expect(migration).toContain(`COALESCE(store_id, ${zeroUuid})`);
  });

  it("fails safely when duplicate open-ended active role assignments already exist", () => {
    expect(existsSync(migrationPath)).toBe(true);
    if (!existsSync(migrationPath)) {
      return;
    }

    const migration = readMigration();

    expect(migration).toContain("FROM ops.user_role_assignment");
    expect(migration).toContain("WHERE end_at IS NULL");
    expect(migration).toContain("GROUP BY");
    expect(migration).toContain("user_id");
    expect(migration).toContain("role_id");
    expect(migration).toContain("scope_type");
    expect(migration).toContain(`COALESCE(company_id, ${zeroUuid})`);
    expect(migration).toContain(`COALESCE(region_id, ${zeroUuid})`);
    expect(migration).toContain(`COALESCE(store_id, ${zeroUuid})`);
    expect(migration).toContain("HAVING COUNT(*) > 1");
    expect(migration).toContain("RAISE EXCEPTION");
  });

  it("keeps canonical schema aligned with the migration index", () => {
    expect(schema).toContain("CREATE UNIQUE INDEX IF NOT EXISTS uq_user_role_assignment_active_scope");
    expect(schema).toContain("ON ops.user_role_assignment");
    expect(schema).toContain("WHERE end_at IS NULL");
    expect(schema).toContain(`COALESCE(company_id, ${zeroUuid})`);
    expect(schema).toContain(`COALESCE(region_id, ${zeroUuid})`);
    expect(schema).toContain(`COALESCE(store_id, ${zeroUuid})`);
  });
});
