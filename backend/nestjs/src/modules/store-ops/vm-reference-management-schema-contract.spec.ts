import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(__dirname, "../../../../../db/migrations/066_vm_reference_management_v1.sql"),
  "utf8",
);
const rollback = readFileSync(
  resolve(__dirname, "../../../../../db/rollback/066_vm_reference_management_v1.rollback.sql"),
  "utf8",
);

describe("VM reference management migration contract", () => {
  it("creates default-denied scoped capabilities and complete immutable provenance", () => {
    expect(migration).toContain("'VM_REFERENCE_PUBLISHER'");
    expect(migration).toContain("'VM_VISUAL_REVIEWER'");
    expect(migration).toContain("'VM_CAMPAIGN_WINDOW_AUTHORITY'");
    expect(migration).toContain("'VM_CAMPAIGN_SCOPE_AUTHORITY'");
    expect(migration).toContain("'VM_CAMPAIGN_EMERGENCY_AUTHORITY'");
    expect(migration).not.toContain("INSERT INTO ops.user_role_assignment");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS ops.visual_reference_version");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS ops.visual_campaign_revision_store");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS ops.visual_campaign_command_receipt");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS ops.checklist_instance_item_visual_reference");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS ops.visual_reference_upload_intent");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS ops.visual_campaign_submission_upload_intent");
    expect(migration).toContain("classification IN ('checklist_evidence', 'action_evidence', 'vm_reference',");
    expect(migration).toContain("'vm_campaign_evidence'");
  });

  it("pins one exact item, one exact version, and sanitized idempotency identity", () => {
    expect(migration).toContain("CHECK (required_evidence_count = 1)");
    expect(migration).toContain("visual_reference_version_id UUID NOT NULL");
    expect(migration).toContain("payload_sha256 CHAR(64)");
    expect(migration).toContain("idempotency_key UUID NOT NULL");
    expect(migration).toContain("assignment_snapshot_sha256 CHAR(64)");
    expect(migration).toContain("idx_visual_campaign_submission_media_asset_unique");
    expect(migration).toContain("actor_identity TEXT NOT NULL");
    expect(migration).toContain("actor_identity = 'system:settlement'");
    expect(migration).toContain("trg_checklist_instance_pin_visual_references");
    expect(migration).toContain("CURRENT_TIMESTAMP < revision.submission_closes_at");
    expect(migration).toContain("hold_reconciled_at TIMESTAMPTZ");
  });

  it("is near-one-way and refuses destructive rollback after any use", () => {
    expect(rollback).toContain("Migration 066 rollback refused after VM reference management use.");
    expect(rollback).toContain("ops.user_role_assignment");
    expect(rollback).toContain("audit.photo_evidence_event");
    expect(rollback).toContain("classification IN ('vm_reference', 'vm_campaign_evidence')");
    expect(rollback).toContain("role.role_code <> permission.permission_code");
    expect(rollback).toContain("'VM_REFERENCE_PUBLISHER', 'VM_VISUAL_REVIEWER'");
    expect(rollback.indexOf("RAISE EXCEPTION")).toBeLessThan(
      rollback.indexOf("DROP TABLE IF EXISTS ops.checklist_instance_item_visual_reference"),
    );
  });
});
