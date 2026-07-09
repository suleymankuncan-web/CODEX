import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const script = readFileSync("scripts/migration-fresh-db-smoke.mjs", "utf8");
const runbook = readFileSync("docs/plans/migration-fresh-db-smoke-v1.md", "utf8");
const currentState = readFileSync("docs/history/current-state-through-pr-913-2026-07-09.md", "utf8");
const activeNextActions = readFileSync("docs/plans/active-next-actions.md", "utf8");
const debtLedger = readFileSync("docs/plans/project-debt-ledger.md", "utf8");

test("migration fresh db smoke is exposed as an explicit local-only command", () => {
  assert.equal(
    packageJson.scripts["smoke:migration:fresh-db"],
    "node scripts/migration-fresh-db-smoke.mjs",
  );
  assert.match(script, /store_ops_fresh_migration_smoke/);
  assert.match(script, /infra\/docker-compose\.live-e2e\.yml/);
  assert.match(script, /NODE_ENV/);
  assert.match(script, /production/);
});

test("migration fresh db smoke creates only a disposable local database", () => {
  assert.match(script, /dropdb/);
  assert.match(script, /createdb/);
  assert.match(script, /assertSafeDatabaseName/);
  assert.match(script, /localhost/);
  assert.match(script, /54329/);
  assert.doesNotMatch(script, /store_ops_live['"`]/);
});

test("migration fresh db smoke proves migration tracking and schema counts", () => {
  assert.match(script, /npm/);
  assert.match(script, /cmd\.exe/);
  assert.match(script, /\/d/);
  assert.match(script, /db:migrate/);
  assert.match(script, /audit\.schema_migration/);
  assert.match(script, /status='failed'/);
  assert.match(script, /pg_tables/);
  assert.match(script, /ops/);
  assert.match(script, /stg/);
  assert.match(script, /rpt/);
  assert.match(script, /audit/);
});

test("migration fresh db smoke runbook keeps production blocked and links handoff docs", () => {
  assert.match(runbook, /Migration Fresh DB Smoke V1/);
  assert.match(runbook, /Production database is never a valid target/);
  assert.match(runbook, /store_ops_fresh_migration_smoke/);
  assert.match(runbook, /Go \/ Conditional Go \/ No-Go/);
  assert.match(currentState, /Migration Fresh DB Smoke V1/);
  assert.match(activeNextActions, /Migration Fresh DB Smoke V1/);
  assert.match(debtLedger, /74\. Migration Fresh DB Smoke V1/);
});
