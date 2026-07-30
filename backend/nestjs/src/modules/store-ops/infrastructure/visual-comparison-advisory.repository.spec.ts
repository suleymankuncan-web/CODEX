import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ConflictException } from "@nestjs/common";
import { VisualComparisonAdvisoryRepository } from "./visual-comparison-advisory.repository";

describe("VisualComparisonAdvisoryRepository contract", () => {
  const source = readFileSync(join(__dirname, "visual-comparison-advisory.repository.ts"), "utf8");
  const cohort = {
    companyId: "11111111-1111-4111-8111-111111111111",
    referenceSetId: "44444444-4444-4444-8444-444444444444",
    notBefore: new Date("2026-07-30T00:00:00.000Z"),
    modelId: "qwen3.7-plus-2026-05-26",
    promptVersion: "hr-axis-qwen-prompt-policy-v1",
    rubricVersion: "hr-axis-vm-rubric-v1",
    policyVersion: "hr-axis-visual-comparison-result-v1",
  };

  it("[NFR-3][AC-7] rechecks current Region Manager and action-store assignments", () => {
    expect(source).toContain("ops.user_role_assignment");
    expect(source).toContain("role.role_code = 'REGION_MANAGER'");
    expect(source).toContain("ops.user_action_store_assignment");
    expect(source).toContain("FOR UPDATE");
    expect(source).toContain("run.company_id = $4::uuid");
    expect(source).toContain("run.visual_reference_set_id = $5::uuid");
    expect(source).toContain("run.provider_model_id = $7");
  });

  it("[NFR-4][AC-11] mutates only experimental review, run status and typed audit sinks", () => {
    expect(source).toContain("INSERT INTO ops.visual_comparison_review");
    expect(source).toContain("UPDATE ops.visual_comparison_run SET status = 'human_reviewed'");
    expect(source).toContain("INSERT INTO audit.photo_evidence_event");
    for (const forbidden of ["ops.checklist_instance", "ops.store_action_plan", "ops.kpi", "ops.target", "ops.incentive", "ops.ranking"]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("[FR-10][AC-10][EC-5] rejects accept below the configured confidence threshold", async () => {
    const client = { query: jest.fn()
      .mockResolvedValueOnce({ rows: [{
        status: "completed", decision: "pass", overall_confidence: 0.59,
        company_id: "11111111-1111-4111-8111-111111111111",
      }] })
      .mockResolvedValueOnce({ rows: [] }) };
    const database = { withTransaction: (callback: (value: typeof client) => unknown) => callback(client) };
    const repository = new VisualComparisonAdvisoryRepository(database as never);

    await expect(repository.review({
      actorUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      regionIds: ["22222222-2222-4222-8222-222222222222"],
      storeIds: ["33333333-3333-4333-8333-333333333333"],
      ...cohort,
      comparisonRunId: "55555555-5555-4555-8555-555555555555",
      decision: "accept", reason: "Saha kontrolü tamamlandı.", minimumConfidence: 0.6,
    })).rejects.toBeInstanceOf(ConflictException);
    expect(client.query).toHaveBeenCalledTimes(2);
  });

  it("[FR-10][AC-10] treats an identical first-review replay as idempotent", async () => {
    const client = { query: jest.fn()
      .mockResolvedValueOnce({ rows: [{
        status: "completed", decision: "pass", overall_confidence: 0.9,
        company_id: "11111111-1111-4111-8111-111111111111",
      }] })
      .mockResolvedValueOnce({ rows: [{
        review_decision: "accept", review_reason: "Saha kontrolü tamamlandı.",
        after_result_json: { source: "region_manager", decision: "pass" },
      }] }) };
    const database = { withTransaction: (callback: (value: typeof client) => unknown) => callback(client) };
    const repository = new VisualComparisonAdvisoryRepository(database as never);

    await expect(repository.review({
      actorUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      regionIds: ["22222222-2222-4222-8222-222222222222"],
      storeIds: ["33333333-3333-4333-8333-333333333333"],
      ...cohort,
      comparisonRunId: "55555555-5555-4555-8555-555555555555",
      decision: "accept", reason: "Saha kontrolü tamamlandı.", minimumConfidence: 0.6,
    })).resolves.toEqual({
      comparisonRunId: "55555555-5555-4555-8555-555555555555",
      decision: "accept", finalDecision: "pass",
    });
    expect(client.query).toHaveBeenCalledTimes(2);
  });

  it("[FR-8][AC-8] projects the validated advisory payload without provider metadata", async () => {
    const database = { query: jest.fn(async () => ({ rows: [{
      comparison_run_id: "55555555-5555-4555-8555-555555555555",
      store_name: "Pilot Mağaza", reference_name: "VM düzeni",
      status: "completed", decision: "partial", overall_confidence: "0.82",
      result_json: {
        result: {
          qualityFlags: ["glare"], modelLimitations: ["rear_rack_occluded"],
          dimensions: [{ key: "color_flow", score: 72 }],
        },
        usage: { inputTokens: 999 }, provider: "must-not-leak",
      },
      finished_at: "2026-07-30T10:00:00.000Z", reviewed: false, total_count: 1,
    }] })) };
    const repository = new VisualComparisonAdvisoryRepository(database as never);
    const response = await repository.list({
      actorUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      regionIds: ["22222222-2222-4222-8222-222222222222"],
      storeIds: ["33333333-3333-4333-8333-333333333333"],
      ...cohort,
      limit: 25, offset: 0,
    });

    expect(response.items[0]).toEqual(expect.objectContaining({
      qualityFlags: ["glare"], modelLimitations: ["rear_rack_occluded"],
      dimensions: [{ key: "color_flow", score: 72 }],
    }));
    expect(response.items[0]).not.toHaveProperty("usage");
    expect(response.items[0]).not.toHaveProperty("provider");
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining("run.comparison_policy_version = $10"),
      expect.arrayContaining([cohort.companyId, cohort.referenceSetId, cohort.modelId, cohort.policyVersion]));
  });

  it("[FR-8][AC-8] maps the public recapture command to the immutable legacy storage value", async () => {
    const client = { query: jest.fn()
      .mockResolvedValueOnce({ rows: [{
        status: "completed", decision: "partial", overall_confidence: 0.8,
        company_id: cohort.companyId, region_id: "22222222-2222-4222-8222-222222222222",
        store_id: "33333333-3333-4333-8333-333333333333",
        evidence_media_asset_id: "66666666-6666-4666-8666-666666666666",
      }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValue({ rows: [] }) };
    const database = { withTransaction: (callback: (value: typeof client) => unknown) => callback(client) };
    const repository = new VisualComparisonAdvisoryRepository(database as never);

    await expect(repository.review({
      actorUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      regionIds: ["22222222-2222-4222-8222-222222222222"],
      storeIds: ["33333333-3333-4333-8333-333333333333"], ...cohort,
      comparisonRunId: "55555555-5555-4555-8555-555555555555",
      decision: "recapture", reason: "Yeni ve doğrudan bir çekim gerekli.", minimumConfidence: 0.6,
    })).resolves.toMatchObject({ decision: "recapture", finalDecision: null });
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO ops.visual_comparison_review"),
      expect.arrayContaining(["request_recapture"]));
  });
});
