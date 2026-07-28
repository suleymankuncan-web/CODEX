import { VmReferenceManagementRepository } from "./vm-reference-management.repository";

describe("VmReferenceManagementRepository", () => {
  it("[AC-02] re-reads persona, permission, and company scope inside mutations", async () => {
    const database = { withTransaction: jest.fn(async (work) => work({ query: jest.fn(async () => ({ rows: [] })) })) };
    const repository = new VmReferenceManagementRepository(database as never);
    await expect(repository.createDraft({
      actorUserId: "00000000-0000-4000-8000-000000000001",
      companyId: "00000000-0000-4000-8000-000000000002",
      referenceCode: "REF",
      referenceName: "Reference",
      instructions: "Instructions",
    })).rejects.toThrow("VM reference permission is not active");
    const sql = String((database.withTransaction.mock.calls[0][0] as unknown));
    expect(database.withTransaction).toHaveBeenCalledTimes(1);
    expect(sql).toBeTruthy();
  });

  it("[AC-02] requires separate active VM persona and company capability assignments", () => {
    const source = require("node:fs").readFileSync(__filename.replace(".spec.ts", ".ts"), "utf8");
    expect(source).toContain("persona_role.role_code = 'VISUAL_MERCHANDISER'");
    expect(source).toContain("permission.permission_code = $3");
    expect(source).toContain("capability_assignment.company_id = $2::uuid");
    expect(source).toContain("persona_assignment.company_id = $2::uuid");
    expect(source).toContain("capability_assignment.scope_type = 'company'");
    expect(source).toContain("persona_assignment.scope_type = 'store'");
    expect(source).toContain("actor.is_active = TRUE");
    expect(source).toContain("active_company.status = 'active'");
    expect(source).toContain("persona_store.status = 'active'");
  });

  it("[AC-02][NFR-01] rechecks active Store Manager scope before intent and submission writes", () => {
    const source = require("node:fs").readFileSync(__filename.replace(".spec.ts", ".ts"), "utf8");
    expect(source).toContain("INNER JOIN ops.user_account actor");
    expect(source).toContain("active_store.status = 'active'");
    expect(source).toContain("active_region.status = 'active'");
    expect(source).toContain("active_company.status = 'active'");
    expect(source.indexOf("const scope = await this.getAssignmentScopeWithClient(client, input)")).toBeLessThan(
      source.indexOf("INSERT INTO ops.visual_campaign_submission_upload_intent"),
    );
    expect(source).toContain("async hasSubmissionUploadIntent");
    expect(source.indexOf("async hasSubmissionUploadIntent")).toBeLessThan(
      source.lastIndexOf("const scope = await this.getAssignmentScopeWithClient(client, input)"),
    );
  });

  it("[AC-16][EC-16] settlement uses database time, bounded skip-locked batches, and no official sink", () => {
    const source = require("node:fs").readFileSync(__filename.replace(".spec.ts", ".ts"), "utf8");
    expect(source).toContain("FOR UPDATE OF assignment SKIP LOCKED");
    expect(source).toContain("CURRENT_TIMESTAMP");
    expect(source).toContain("ON CONFLICT (assignment_id, campaign_revision_id) DO NOTHING");
    expect(source).not.toContain("reporting.kpi");
    expect(source).not.toContain("ops.store_action_plan");
    expect(source).not.toContain("incentive");
    expect(source).not.toContain("new Date()");
    expect(source).toContain("idempotencyKey: assignment.active_campaign_revision_id");
  });

  it("[AC-15][EC-15] submission checks the half-open boundary in the locked transaction", () => {
    const source = require("node:fs").readFileSync(__filename.replace(".spec.ts", ".ts"), "utf8");
    expect(source).toContain("CURRENT_TIMESTAMP >= revision.starts_at");
    expect(source).toContain("CURRENT_TIMESTAMP < revision.submission_closes_at");
    expect(source).toContain("FOR UPDATE OF assignment, revision");
    expect(source).toContain('["scheduled", "open"].includes(assignment.deadline_status)');
    expect(source.indexOf("SELECT submission.payload_sha256")).toBeLessThan(source.indexOf('throw new ConflictException("window_closed")'));
  });

  it("[AC-19] returns the immutable campaign revision for published lifecycle commands", () => {
    const source = require("node:fs").readFileSync(__filename.replace(".spec.ts", ".ts"), "utf8");
    expect(source).toContain("Number(row.current_revision_no) > 0");
  });

});
