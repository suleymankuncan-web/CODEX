import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "../../../../..");
const migration = readFileSync(join(root, "db/migrations/065_store_action_photo_review_v2.sql"), "utf8");
const rollback = readFileSync(join(root, "db/rollback/065_store_action_photo_review_v2.rollback.sql"), "utf8");
const repository = readFileSync(join(root, "backend/nestjs/src/modules/store-ops/infrastructure/store-action-photo-review.repository.ts"), "utf8");

describe("Store Action photo review V2 schema", () => {
  it("[NFR-03][AC-05][EC-12] pins V1/V2 and retains both non-terminal review states", () => {
    expect(migration).toContain("resolution_workflow_version SMALLINT NOT NULL DEFAULT 1");
    expect(migration).toContain("resolution_workflow_version IN (1, 2)");
    expect(migration).toContain("'solution_review_pending', 'correction_required'");
    expect(migration).not.toMatch(/UPDATE\s+ops\.store_action_plan\s+SET\s+resolution_workflow_version/i);
  });

  it("[AC-02][FR-07] binds an immutable plan-scoped upload intent and keeps active source identity", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS ops.store_action_solution_upload_intent");
    expect(migration).toContain("uq_store_action_solution_upload_intent_asset UNIQUE (media_asset_id)");
    expect(migration).toContain("trg_store_action_solution_upload_intent_immutable");
    expect(migration).toMatch(/WHERE status IN \([\s\S]*'solution_review_pending', 'correction_required'/);
  });

  it("fails destructive rollback closed after any V2 usage", () => {
    expect(rollback).toContain("resolution_workflow_version = 2");
    expect(rollback).toContain("store_action_photo_review_v2_rows_exist");
    expect(rollback).toContain("store_action_photo_review_v2_upload_intents_exist");
  });

  it("[FR-07][EC-02][EC-05] serializes commands and rejects stale attempts", () => {
    expect(repository.match(/FOR UPDATE/g)?.length).toBeGreaterThanOrEqual(3);
    expect(repository).toContain("photo_evidence_version");
    expect(repository).toContain("Idempotency key payload does not match");
    expect(repository).toContain("Superseded or stale solution attempt cannot be reviewed");
    expect(repository).toContain("current_solution_attempt_id = $2::uuid");
    expect(repository).toContain("active_workflow_hold = TRUE");
    expect(repository).toContain("active_workflow_hold = FALSE");
    expect(repository).toContain("content_sha256");
  });
});
