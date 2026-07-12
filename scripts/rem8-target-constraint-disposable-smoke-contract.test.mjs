import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = join(import.meta.dirname, "..");
const source = readFileSync(
  join(root, "scripts", "rem8-target-constraint-disposable-smoke.mjs"),
  "utf8",
);

// Trace: FR-11..17; NFR-02..06; AC-04..08; EC-11..15.
test("REM-8 disposable smoke pins PostgreSQL 17 dump/restore and exact cleanup", () => {
  assert.match(source, /postgres:17/);
  assert.match(source, /pg_dump/);
  assert.match(source, /pg_restore/);
  assert.match(source, /sourceAggregateDigest/);
  assert.match(source, /restoreAggregateDigest/);
  assert.match(source, /rem8-target-constraint-observation\.ts/);
  assert.match(source, /eligible_for_disposable_rehearsal/);
  assert.match(source, /syntheticScaleRows = 5000/);
  assert.match(source, /store-ops-rem8-postgres17/);
  assert.match(source, /assertContainerAbsent/);
  assert.match(source, /cleanup\(\)/);
  assert.match(source, /cleanup was not verified/);
});

test("REM-8 disposable smoke cannot target staging, production or arbitrary databases", () => {
  assert.doesNotMatch(source, /DATABASE_INVARIANT_PREFLIGHT_TARGET:\s*["']staging["']/);
  assert.doesNotMatch(source, /api-staging|supabase\.co|pooler\.supabase/);
  assert.match(source, /\^store_ops_rem8_target_rehearsal_/);
  assert.match(source, /127\.0\.0\.1/);
  assert.doesNotMatch(source, /docker[^\n]+system\s+prune|docker[^\n]+volume\s+prune/);
});
