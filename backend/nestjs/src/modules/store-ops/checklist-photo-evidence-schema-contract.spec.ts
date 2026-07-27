import { readFileSync } from "fs";
import { join } from "path";

const root = join(__dirname, "../../../../..");
const schemaSql = readFileSync(join(root, "db/schema.sql"), "utf8");
const migrationSql = readFileSync(
  join(root, "db/migrations/062_checklist_photo_evidence_foundation_v1.sql"),
  "utf8",
);

const expectedOpsTables = [
  "evidence_retention_policy",
  "media_asset",
  "checklist_response_media",
  "store_action_solution_attempt",
  "store_action_plan_evidence",
  "store_action_solution_review",
  "visual_reference_set",
  "visual_reference_draft_item",
  "visual_reference_draft_item_asset",
  "visual_campaign_revision",
  "visual_campaign_assignment",
  "visual_campaign_assignment_outcome",
  "visual_campaign_submission",
  "visual_campaign_submission_media",
  "visual_reference_item",
  "visual_reference_item_asset",
  "visual_comparison_run",
  "visual_comparison_review",
] as const;

function expectFoundationTables(sql: string): void {
  for (const table of expectedOpsTables) {
    expect(sql).toMatch(new RegExp(`CREATE TABLE(?: IF NOT EXISTS)? ops\\.${table}\\s*\\(`));
  }
  expect(sql).toMatch(/CREATE TABLE(?: IF NOT EXISTS)? audit\.photo_evidence_event\s*\(/);
}

describe("checklist photo evidence schema contract", () => {
  it("[FR-03][FR-07][FR-08][FR-09][FR-12] defines the complete additive foundation", () => {
    for (const sql of [schemaSql, migrationSql]) {
      expectFoundationTables(sql);
      expect(sql).toContain("CONSTRAINT uq_evidence_retention_policy_version UNIQUE (company_id, version_no)");
      expect(sql).toContain("CONSTRAINT uq_media_asset_company UNIQUE (media_asset_id, company_id)");
      expect(sql).toContain("CONSTRAINT uq_media_asset_store UNIQUE (media_asset_id, company_id, store_id)");
      expect(sql).toContain("CONSTRAINT fk_media_asset_retention_policy FOREIGN KEY (retention_policy_id, company_id, retention_policy_version)");
      expect(sql).toContain("expires_at TIMESTAMPTZ");
      expect(sql).toContain("deleted_tombstone");
      expect(sql).toContain("raw_disposed_at TIMESTAMPTZ");
      expect(sql).toContain("trg_evidence_retention_policy_immutable");
    }
  });

  it("[NFR-01][AC-02] binds every store-owned link through composite tenant keys", () => {
    for (const sql of [schemaSql, migrationSql]) {
      expect(sql).toContain("CREATE UNIQUE INDEX IF NOT EXISTS idx_store_company_region_identity");
      expect(sql).toContain("ON ops.store (store_id, company_id, region_id)");
      expect(sql).toContain("CREATE UNIQUE INDEX IF NOT EXISTS idx_checklist_instance_store_identity");
      expect(sql).toContain("ON ops.checklist_instance (checklist_instance_id, store_id)");
      expect(sql).toContain("CREATE UNIQUE INDEX IF NOT EXISTS idx_checklist_response_instance_identity");
      expect(sql).toContain("ON ops.checklist_response (response_id, checklist_instance_id)");
      expect(sql).toContain("CREATE UNIQUE INDEX IF NOT EXISTS idx_store_action_plan_scope_identity");
      expect(sql).toContain("ON ops.store_action_plan (store_action_plan_id, company_id, region_id, store_id)");
      expect(sql).toContain("REFERENCES ops.store(store_id, company_id, region_id)");
      expect(sql).toContain("REFERENCES ops.media_asset(media_asset_id, company_id, store_id)");
    }
  });

  it("[NFR-02][AC-03] keeps object identity private and finalized evidence sanitized", () => {
    for (const sql of [schemaSql, migrationSql]) {
      expect(sql).toContain("raw_object_key = btrim(raw_object_key)");
      expect(sql).toContain("raw_object_key ~ '^[A-Za-z0-9][A-Za-z0-9._/-]*$'");
      expect(sql).toContain("raw_object_key !~ '//'");
      expect(sql).toContain("canonical_object_key = btrim(canonical_object_key)");
      expect(sql).toContain("thumbnail_object_key = btrim(thumbnail_object_key)");
      expect(sql).toContain("metadata_stripped_at TIMESTAMPTZ");
      expect(sql).toContain("safety_scanned_at TIMESTAMPTZ");
      expect(sql).toContain("CHECK (state <> 'ready' OR");
      expect(sql).not.toContain("signed_url");
      expect(sql).not.toContain("provider_url");
    }
  });

  it("[FR-15][FR-16][AC-15][AC-16][AC-17] preserves immutable campaign windows and outcomes", () => {
    for (const sql of [schemaSql, migrationSql]) {
      expect(sql).toContain("timezone_name TEXT NOT NULL DEFAULT 'Europe/Istanbul'");
      expect(sql).toContain("CHECK (starts_at < submission_closes_at)");
      expect(sql).toContain("expected_revision INTEGER NOT NULL");
      expect(sql).toContain("first_valid_submission_at TIMESTAMPTZ");
      expect(sql).toContain("deadline_status TEXT NOT NULL");
      expect(sql).toContain("review_status TEXT NOT NULL");
      expect(sql).toContain("CHECK (deadline_status IN ('scheduled', 'open', 'on_time', 'missed', 'exempt', 'withdrawn', 'operational_hold'))");
      expect(sql).toContain("CHECK (review_status IN ('not_submitted', 'review_pending', 'correction_requested', 'completed'))");
      expect(sql).toContain("CONSTRAINT uq_visual_campaign_outcome_revision UNIQUE (assignment_id, campaign_revision_id)");
      expect(sql).toContain("CONSTRAINT ck_visual_campaign_outcome_deadline CHECK (deadline_status IN ('on_time', 'missed', 'exempt', 'withdrawn', 'operational_hold'))");
    }
  });

  it("[FR-10][FR-11][AC-09] isolates comparison records from official business tables", () => {
    for (const sql of [schemaSql, migrationSql]) {
      expect(sql).toContain("isolation_class TEXT NOT NULL");
      expect(sql).toContain("CHECK (isolation_class IN ('shadow', 'advisory'))");
      expect(sql).toContain("result_json JSONB");
      expect(sql).not.toMatch(/visual_comparison_(?:run|review)[\s\S]{0,2500}REFERENCES (?:rpt\.)?(?:snapshot|ranking|competition|sales_target_incentive|store_action_plan)/i);
    }
  });

  it("[FR-13][FR-15][FR-16] keeps manual VM submission truth independent from optional AI", () => {
    for (const sql of [schemaSql, migrationSql]) {
      expect(sql).toContain("CREATE TABLE IF NOT EXISTS ops.visual_campaign_submission (");
      expect(sql).toContain("CREATE TABLE IF NOT EXISTS ops.visual_campaign_submission_media (");
      expect(sql).toContain("fk_visual_campaign_submission_assignment");
      expect(sql).toContain("fk_visual_campaign_submission_revision");
      expect(sql).toContain("fk_visual_campaign_submission_media_item");
      expect(sql).toContain("fk_visual_campaign_submission_media_asset");
    }
  });

  it("[NFR-03] makes revision, review, link, outcome, and evidence audit rows mechanically append-only", () => {
    for (const sql of [schemaSql, migrationSql]) {
      expect(sql).toContain("CREATE OR REPLACE FUNCTION ops.guard_checklist_photo_evidence_immutable()");
      expect(sql).toContain("CREATE OR REPLACE FUNCTION audit.guard_photo_evidence_event_append_only()");
      expect(sql).toContain("trg_visual_campaign_revision_immutable");
      expect(sql).toContain("trg_visual_campaign_assignment_outcome_immutable");
      expect(sql).toContain("trg_visual_campaign_submission_immutable");
      expect(sql).toContain("trg_visual_campaign_submission_media_immutable");
      expect(sql).toContain("trg_visual_reference_item_immutable");
      expect(sql).toContain("trg_visual_reference_item_asset_immutable");
      expect(sql).toContain("trg_store_action_solution_attempt_immutable");
      expect(sql).toContain("trg_store_action_solution_review_immutable");
      expect(sql).toContain("trg_visual_comparison_review_immutable");
      expect(sql).toContain("trg_photo_evidence_event_append_only");
      expect(sql).toContain("trg_checklist_response_media_lifecycle");
      expect(sql).toContain("guard_checklist_response_media_lifecycle");
    }
  });

  it("[NFR-10][AC-10] supports hold-aware cleanup and durable tombstones", () => {
    for (const sql of [schemaSql, migrationSql]) {
      expect(sql).toContain("legal_hold BOOLEAN NOT NULL DEFAULT FALSE");
      expect(sql).toContain("operational_hold BOOLEAN NOT NULL DEFAULT FALSE");
      expect(sql).toContain("active_workflow_hold BOOLEAN NOT NULL DEFAULT FALSE");
      expect(sql).toContain("ai_review_hold BOOLEAN NOT NULL DEFAULT FALSE");
      expect(sql).toContain("deleted_at TIMESTAMPTZ");
      expect(sql).toContain("deletion_reason TEXT");
      expect(sql).toContain("tombstone_sha256 CHAR(64)");
      expect(sql).toContain("idx_media_asset_cleanup_eligibility");
    }
  });

  it("keeps PR-2 schema-only and provider-neutral", () => {
    expect(migrationSql).not.toMatch(/INSERT\s+INTO\s+ops\.(?:checklist_instance|checklist_response|store_action_plan)/i);
    expect(migrationSql).not.toMatch(/https?:\/\//i);
    expect(migrationSql).not.toMatch(/gemini|openai|sentry/i);
    expect(migrationSql).not.toMatch(/CREATE\s+(?:OR\s+REPLACE\s+)?VIEW/i);
  });

  it("[NFR-09] enforces the PR-1 typed audit vocabulary and reasoned transitions", () => {
    for (const sql of [schemaSql, migrationSql]) {
      expect(sql).toContain("ck_photo_evidence_event_type");
      expect(sql).toContain("checklist_photo_evidence.media.upload_initiated");
      expect(sql).toContain("checklist_photo_evidence.authorization.denied");
      expect(sql).toContain("ck_photo_evidence_event_entity");
      expect(sql).toContain("ck_photo_evidence_event_state_before");
      expect(sql).toContain("ck_photo_evidence_event_state_after");
      expect(sql).toContain("ck_photo_evidence_event_reason");
      expect(sql).toContain("decision <> 'reject' OR (reason IS NOT NULL AND length(btrim(reason)) > 0)");
      expect(sql).toContain("deadline_status <> 'operational_hold' OR (current_hold_reason IS NOT NULL AND length(btrim(current_hold_reason)) > 0)");
    }
  });
});
