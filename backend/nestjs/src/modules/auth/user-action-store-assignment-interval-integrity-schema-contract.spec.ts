import { readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = join(process.cwd(), "..", "..");
const migration = readFileSync(
  join(
    projectRoot,
    "db",
    "migrations",
    "074_user_action_store_assignment_interval_integrity_v1.sql",
  ),
  "utf8",
);
const schema = readFileSync(join(projectRoot, "db", "schema.sql"), "utf8");
const rollback = readFileSync(
  join(
    projectRoot,
    "db",
    "rollback",
    "074_user_action_store_assignment_interval_integrity_v1.rollback.sql",
  ),
  "utf8",
);

const constraintName = "ex_user_action_store_assignment_no_overlap_v1";
const legacyIndexName = "uq_user_action_store_assignment_active";

describe("user action-store assignment interval integrity schema contract", () => {
  it("uses bounded transactional migration settings and installs btree_gist", () => {
    expect(migration).toContain("SET LOCAL lock_timeout = '5000ms';");
    expect(migration).toContain("SET LOCAL statement_timeout = '30000ms';");
    expect(migration).toContain("CREATE EXTENSION IF NOT EXISTS btree_gist;");
  });

  it("fails closed on existing overlap before adding the exclusion", () => {
    expect(migration).toContain("overlapping intervals exist.");
    expect(migration).toContain("tstzrange(");
    expect(migration).toContain("'[)'\n           ) && tstzrange(");
    expect(migration.indexOf("overlapping intervals exist.")).toBeLessThan(
      migration.indexOf("ADD CONSTRAINT " + constraintName),
    );
  });

  it("keeps the exact half-open exclusion contract in migration and schema", () => {
    for (const sql of [migration, schema]) {
      expect(sql).toContain("EXCLUDE USING gist");
      expect(sql).toContain(constraintName);
      expect(sql).toContain("user_id WITH =");
      expect(sql).toContain("store_id WITH =");
      expect(sql).toContain("tstzrange(start_at, end_at, '[)') WITH &&");
    }
  });

  it("retains the rolling compatibility index", () => {
    expect(schema).toContain(legacyIndexName);
    expect(migration).toContain(legacyIndexName);
    expect(migration).not.toContain("DROP INDEX");
    expect(rollback).not.toContain(legacyIndexName);
  });

  it("rolls back only the exclusion constraint and migration record", () => {
    expect(rollback).toContain(
      `DROP CONSTRAINT IF EXISTS ${constraintName}`,
    );
    expect(rollback).toContain(
      "074_user_action_store_assignment_interval_integrity_v1.sql",
    );
    expect(rollback).not.toMatch(/DROP\s+EXTENSION\s+btree_gist/i);
    expect(rollback).not.toMatch(/DROP\s+(?:UNIQUE\s+)?INDEX/i);
  });
});
