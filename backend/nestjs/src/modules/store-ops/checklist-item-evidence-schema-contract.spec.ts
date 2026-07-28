import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationPath = join(
  __dirname,
  "../../../../../db/migrations/064_checklist_item_evidence_v1.sql",
);
const openApiPath = join(__dirname, "../../../../../docs/api/openapi.json");

describe("checklist item evidence schema contract", () => {
  it("pins strict template policy and immutable per-instance item policy", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("ADD COLUMN IF NOT EXISTS evidence_policy");
    expect(sql).toContain("CHECK (evidence_policy IN ('none', 'optional', 'required'))");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS ops.checklist_instance_item_policy");
    expect(sql).toContain("UNIQUE (checklist_instance_id, template_item_id)");
    expect(sql).toContain("guard_checklist_instance_item_policy_immutable");
    expect(sql).toContain("fk_checklist_response_media_instance_policy");
    expect(sql).toContain("uq_checklist_response_media_global_asset");
  });

  it("adds optimistic instance versioning and digest-bound command receipts", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("ADD COLUMN IF NOT EXISTS evidence_version_no INTEGER NOT NULL DEFAULT 0");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS ops.photo_evidence_command_receipt");
    expect(sql).toContain("command_digest CHAR(64) NOT NULL");
    expect(sql).toContain("result_json JSONB NOT NULL");
    expect(sql).toContain("jsonb_typeof(result_json) = 'object'");
    expect(sql).toContain("result_json ?& ARRAY[");
    expect(sql).toContain("UNIQUE (actor_user_id, idempotency_key)");
    expect(sql).toContain("evidence_version_no");
  });

  it("binds each upload immutably to one checklist item and actor", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS ops.checklist_item_evidence_upload_intent");
    expect(sql).toContain("uploaded_by_user_id UUID NOT NULL");
    expect(sql).toContain("trg_checklist_item_evidence_upload_intent_immutable");
  });

  it("does not rewrite completed checklist history", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).not.toMatch(/UPDATE\s+ops\.checklist_instance_item_policy/i);
    expect(sql).not.toMatch(/WHERE\s+ci\.status\s*=\s*'completed'/i);
  });

  it("publishes multipart upload, typed command results, and authoritative capture capability", () => {
    const document = JSON.parse(readFileSync(openApiPath, "utf8"));
    const upload = document.paths[
      "/api/mobile/checklists/instances/{checklistInstanceId}/items/{templateItemId}/evidence/uploads"
    ].post;
    const link = document.paths[
      "/api/mobile/checklists/instances/{checklistInstanceId}/items/{templateItemId}/evidence"
    ].post;
    const today = document.components.schemas.MobileChecklistTodayResponse;

    expect(upload.requestBody.content["multipart/form-data"].schema.properties.file.format)
      .toBe("binary");
    expect(upload.responses["201"].content["application/json"].schema.required)
      .toEqual(expect.arrayContaining(["mediaAssetId", "state"]));
    expect(link.responses["201"].content["application/json"].schema.properties.data.properties.evidence.required)
      .toEqual(expect.arrayContaining(["evidenceVersion", "idempotent"]));
    expect(today.properties.data.properties.evidenceCapabilities.required)
      .toEqual(expect.arrayContaining(["captureAvailable", "syntheticFixtureOnly", "unavailableReason"]));
  });
});
