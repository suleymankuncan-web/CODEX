import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const workspaceRoot = join(import.meta.dirname, "..");
const packageJson = JSON.parse(readFileSync(join(workspaceRoot, "package.json"), "utf8"));
const runner = readFileSync(
  join(workspaceRoot, "scripts", "checklist-photo-evidence-schema-smoke.mjs"),
  "utf8",
);
const fixture = readFileSync(
  join(workspaceRoot, "db", "preflight", "checklist-photo-evidence-foundation-v1-smoke.sql"),
  "utf8",
);
const rollback = readFileSync(
  join(workspaceRoot, "db", "preflight", "checklist-photo-evidence-foundation-v1-rollback.sql"),
  "utf8",
);
const itemEvidenceRollback = readFileSync(
  join(workspaceRoot, "db", "preflight", "checklist-item-evidence-pr4-v1-rollback.sql"),
  "utf8",
);

test("photo evidence schema exposes one canonical fresh-db and rollback verification command", () => {
  assert.equal(
    packageJson.scripts["smoke:photo-evidence-schema"],
    "node scripts/checklist-photo-evidence-schema-smoke.mjs",
  );
  assert.match(runner, /smoke:migration:fresh-db/);
  assert.match(runner, /ON_ERROR_STOP=1/);
  assert.match(runner, /residualFixtureRows/);
  assert.match(runner, /preUseRollback/);
  assert.match(runner, /forwardReapply/);
  assert.match(runner, /checklist-item-evidence-pr4-v1-rollback\.sql/);
  assert.match(runner, /064_checklist_item_evidence_v1\.sql/);
});

test("photo evidence schema verification is local-only, synthetic, and rollback-bound", () => {
  assert.match(runner, /NODE_ENV === "production"/);
  assert.match(runner, /store_ops_fresh_migration_smoke/);
  assert.match(fixture, /BEGIN;/);
  assert.match(fixture, /ROLLBACK;/);
  assert.doesNotMatch(fixture, /\b(COMMIT|TRUNCATE|DROP)\b/i);
  assert.match(fixture, /tenant_scope_rejected/);
  assert.match(fixture, /private_object_key_rejected/);
  assert.match(fixture, /tenant_constraint_catalog_complete/);
  assert.match(fixture, /leading-space/);
  assert.match(fixture, /path-traversal/);
  assert.match(fixture, /immutable_history_rejected/);
  assert.match(fixture, /retention_history_immutable/);
  assert.match(fixture, /pre_completion_unlink_allowed/);
  assert.match(fixture, /completion_lock_enforced/);
  assert.match(fixture, /post_completion_unlink_rejected/);
  assert.match(fixture, /residual_marker/);
  assert.match(rollback, /foundation_row_count <> 0/);
  assert.match(rollback, /062_checklist_photo_evidence_foundation_v1\.sql/);
  assert.match(rollback, /DROP COLUMN IF EXISTS current_solution_attempt_id/);
  assert.match(itemEvidenceRollback, /rollback refused after feature use/);
  assert.match(itemEvidenceRollback, /ops\.checklist_item_evidence_upload_intent/);
  assert.match(itemEvidenceRollback, /DROP CONSTRAINT IF EXISTS ck_photo_evidence_event_type/);
  assert.match(runner, /checklist_item_evidence_pr4_smoke\.completed/);
});
