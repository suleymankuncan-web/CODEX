import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const workspaceRoot = join(import.meta.dirname, "..");
const packageJson = JSON.parse(readFileSync(join(workspaceRoot, "package.json"), "utf8"));
const runner = readFileSync(
  join(workspaceRoot, "scripts", "region-weekly-visit-plan-schema-smoke.mjs"),
  "utf8",
);
const fixture = readFileSync(
  join(workspaceRoot, "db", "preflight", "region-weekly-visit-plan-v1-smoke.sql"),
  "utf8",
);
const invariantContract = readFileSync(
  join(workspaceRoot, "scripts", "database-invariant-preflight-contract.test.mjs"),
  "utf8",
);

test("weekly visit plan exposes one canonical fresh-db and rollback verification command", () => {
  assert.equal(
    packageJson.scripts["smoke:visit-plan-schema"],
    "node scripts/region-weekly-visit-plan-schema-smoke.mjs",
  );
  assert.match(runner, /smoke:migration:fresh-db/);
  assert.match(runner, /ON_ERROR_STOP=1/);
  assert.match(runner, /residualFixtureRows/);
});

test("weekly visit plan schema verification is local-only and rollback-bound", () => {
  assert.match(runner, /NODE_ENV === "production"/);
  assert.match(runner, /store_ops_fresh_migration_smoke/);
  assert.match(fixture, /BEGIN;/);
  assert.match(fixture, /ROLLBACK;/);
  assert.doesNotMatch(fixture, /\b(COMMIT|TRUNCATE|DROP)\b/i);
  assert.match(invariantContract, /ops\.region_weekly_visit_plan_item/);
  assert.match(fixture, /fk_region_weekly_visit_plan_item_store_region/);
});

