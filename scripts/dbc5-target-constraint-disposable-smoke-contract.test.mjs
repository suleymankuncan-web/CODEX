import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = join(import.meta.dirname, "..");
const source = readFileSync(
  join(root, "scripts", "dbc5-target-constraint-disposable-smoke.mjs"),
  "utf8",
);

// Trace: FR-02, FR-03, FR-05, FR-06, FR-09, FR-11; NFR-02..05, NFR-07;
// AC-02, AC-03, AC-05, AC-07; EC-04..07.
test("DB-C5 disposable smoke proves PostgreSQL 17 semantics and exact rollback", () => {
  assert.match(source, /postgres:17/);
  assert.match(source, /060_target_distribution_duplicate_employee_constraint_v1\.sql/);
  assert.match(source, /ck_target_distribution_employee_ids_unique_v1/);
  assert.match(source, /target_distribution_employee_ids_unique_v1/);
  assert.match(source, /23514/);
  assert.match(source, /case_variant_duplicate/);
  assert.match(source, /pilot_empty/);
  assert.match(source, /separate_request/);
  assert.match(source, /malformed_shape_policy/);
  assert.match(source, /rollback\.sql/);
  assert.match(source, /cleanupVerified/);
});

test("DB-C5 disposable smoke cannot target staging, production or arbitrary databases", () => {
  assert.doesNotMatch(source, /DATABASE_INVARIANT_PREFLIGHT_TARGET:\s*["']staging["']/);
  assert.doesNotMatch(source, /api-staging|supabase\.co|pooler\.supabase/);
  assert.match(source, /\^store_ops_dbc5_target_smoke_/);
  assert.match(source, /127\.0\.0\.1/);
  assert.doesNotMatch(source, /docker[^\n]+system\s+prune|docker[^\n]+volume\s+prune/);
});
