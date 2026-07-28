import { ChecklistRepository } from "./checklist.repository";
import { createHash } from "node:crypto";

function createQueryMock(overrides?: {
  stores?: Record<string, unknown>[];
  templates?: Record<string, unknown>[];
  templateItems?: Record<string, unknown>[];
  activeInstances?: Record<string, unknown>[];
  completedThisMonth?: Record<string, unknown>[];
  monthlySummaries?: Record<string, unknown>[];
}) {
  return jest
    .fn()
    .mockResolvedValueOnce({ rows: overrides?.stores ?? [] })
    .mockResolvedValueOnce({ rows: overrides?.templates ?? [] })
    .mockResolvedValueOnce({ rows: overrides?.templateItems ?? [] })
    .mockResolvedValueOnce({ rows: overrides?.activeInstances ?? [] })
    .mockResolvedValueOnce({ rows: overrides?.completedThisMonth ?? [] })
    .mockResolvedValueOnce({ rows: overrides?.monthlySummaries ?? [] });
}

describe("ChecklistRepository", () => {
  function createTransactionHarness() {
    const client = {
      query: jest.fn(),
    };
    const databaseService = {
      query: jest.fn(),
      withTransaction: jest.fn(async (work: (transactionClient: typeof client) => Promise<unknown>) =>
        work(client),
      ),
    };
    const repository = new ChecklistRepository(databaseService as never);

    return { client, databaseService, repository };
  }

  it("links one ready same-store asset to the exact evidence-enabled item", async () => {
    const { client, repository } = createTransactionHarness();
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          checklist_instance_id: "instance-1",
          company_id: "company-1",
          region_id: "region-1",
          store_id: "store-1",
          status: "in_progress",
          evidence_version_no: 0,
          evidence_policy: "required",
          max_evidence_count: 2,
          response_id: "response-1",
          media_count: "0",
          next_display_order: 0,
          asset_state: "ready",
          asset_classification: "checklist_evidence",
          asset_company_id: "company-1",
          asset_store_id: "store-1",
          intent_instance_id: "instance-1",
          intent_item_id: "item-1",
          intent_actor_user_id: "user-1",
          canonical_sha256: "a".repeat(64),
          capture_source: "system_generated",
        }],
      })
      .mockResolvedValueOnce({
        rows: [{ checklist_response_media_id: "link-1", display_order: 0 }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          evidence_version_no: 1,
          evidence_policy: "required",
          max_evidence_count: 2,
          evidence_json: [{
            mediaAssetId: "asset-1",
            displayOrder: 0,
            captureSource: "system_generated",
            thumbnailAvailable: true,
          }],
        }],
      })
      .mockResolvedValueOnce({ rows: [] });

    await expect(repository.linkMobileChecklistItemEvidence({
      checklistInstanceId: "instance-1",
      templateItemId: "item-1",
      mediaAssetId: "asset-1",
      expectedEvidenceVersion: 0,
      idempotencyKey: "key-1",
      actorUserId: "user-1",
      actorRoleCodes: ["REGION_MANAGER"],
      actorActionScope: { assignedStoreIds: ["store-1"] },
    })).resolves.toMatchObject({
      evidenceVersion: 1,
      evidencePolicy: "required",
      evidence: [expect.objectContaining({ mediaAssetId: "asset-1" })],
    });

    expect(String(client.query.mock.calls[2][0])).toContain("FOR UPDATE OF ci");
    expect(String(client.query.mock.calls[3][0])).toContain("ops.checklist_response_media");
    expect(String(client.query.mock.calls[5][0])).toContain("active_workflow_hold = TRUE");
    expect(String(client.query.mock.calls[6][0])).toContain("'ready', 'ready'");
  });

  it("rejects evidence mutation for a cancelled instance", async () => {
    const { client, repository } = createTransactionHarness();
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          checklist_instance_id: "instance-1",
          company_id: "company-1",
          region_id: "region-1",
          store_id: "store-1",
          status: "cancelled",
          evidence_version_no: 0,
          evidence_policy: "required",
          max_evidence_count: 1,
          response_id: "response-1",
          media_count: "0",
          next_display_order: 0,
          asset_state: "ready",
          asset_classification: "checklist_evidence",
          asset_company_id: "company-1",
          asset_store_id: "store-1",
          intent_instance_id: "instance-1",
          intent_item_id: "item-1",
          intent_actor_user_id: "user-1",
          canonical_sha256: "a".repeat(64),
          capture_source: "system_generated",
        }],
      });

    await expect(repository.linkMobileChecklistItemEvidence({
      checklistInstanceId: "instance-1",
      templateItemId: "item-1",
      mediaAssetId: "asset-1",
      expectedEvidenceVersion: 0,
      idempotencyKey: "key-1",
      actorUserId: "user-1",
      actorRoleCodes: ["REGION_MANAGER"],
      actorActionScope: { assignedStoreIds: ["store-1"] },
    })).rejects.toThrow("instance_locked");
    expect(client.query).toHaveBeenCalledTimes(3);
  });

  it("rejects evidence for an item whose pinned policy is none", async () => {
    const { client, repository } = createTransactionHarness();
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          checklist_instance_id: "instance-1",
          company_id: "company-1",
          region_id: "region-1",
          store_id: "store-1",
          status: "in_progress",
          evidence_version_no: 0,
          evidence_policy: "none",
          max_evidence_count: 0,
          response_id: "response-1",
          media_count: "0",
          next_display_order: 0,
          asset_state: "ready",
          asset_classification: "checklist_evidence",
          asset_company_id: "company-1",
          asset_store_id: "store-1",
          intent_instance_id: "instance-1",
          intent_item_id: "item-1",
          intent_actor_user_id: "user-1",
          canonical_sha256: "a".repeat(64),
          capture_source: "system_generated",
        }],
      });

    await expect(repository.linkMobileChecklistItemEvidence({
      checklistInstanceId: "instance-1",
      templateItemId: "item-1",
      mediaAssetId: "asset-1",
      expectedEvidenceVersion: 0,
      idempotencyKey: "key-1",
      actorUserId: "user-1",
      actorRoleCodes: ["REGION_MANAGER"],
      actorActionScope: { assignedStoreIds: ["store-1"] },
    })).rejects.toThrow("policy_forbids");

    expect(client.query).toHaveBeenCalledTimes(3);
  });

  it("rejects a ready asset whose immutable upload intent is for another item", async () => {
    const { client, repository } = createTransactionHarness();
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          checklist_instance_id: "instance-1",
          company_id: "company-1",
          region_id: "region-1",
          store_id: "store-1",
          status: "in_progress",
          evidence_version_no: 0,
          evidence_policy: "required",
          max_evidence_count: 2,
          response_id: "response-1",
          media_count: "0",
          next_display_order: 4,
          asset_state: "ready",
          asset_classification: "checklist_evidence",
          asset_company_id: "company-1",
          asset_store_id: "store-1",
          intent_instance_id: "instance-1",
          intent_item_id: "item-other",
          intent_actor_user_id: "user-1",
          canonical_sha256: "a".repeat(64),
          capture_source: "system_generated",
        }],
      });

    await expect(repository.linkMobileChecklistItemEvidence({
      checklistInstanceId: "instance-1",
      templateItemId: "item-1",
      mediaAssetId: "asset-1",
      expectedEvidenceVersion: 0,
      idempotencyKey: "key-1",
      actorUserId: "user-1",
      actorRoleCodes: ["REGION_MANAGER"],
      actorActionScope: { assignedStoreIds: ["store-1"] },
    })).rejects.toThrow("asset_intent_mismatch");

    expect(String(client.query.mock.calls[2][0])).toContain("MAX(existing.display_order)");
  });

  it.each([
    ["wrong classification", { asset_classification: "profile_photo" }, "asset_intent_mismatch"],
    ["wrong upload actor", { intent_actor_user_id: "user-other" }, "asset_intent_mismatch"],
    ["wrong company", { asset_company_id: "company-other" }, "asset_scope_mismatch"],
    ["wrong store", { asset_store_id: "store-other" }, "asset_scope_mismatch"],
    ["stale version", { evidence_version_no: 3 }, "stale_version"],
    ["evidence limit", { media_count: "2", max_evidence_count: 2 }, "evidence_limit_reached"],
  ])("fails closed for %s", async (_caseName, override, expectedError) => {
    const { client, repository } = createTransactionHarness();
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          checklist_instance_id: "instance-1",
          company_id: "company-1",
          region_id: "region-1",
          store_id: "store-1",
          status: "in_progress",
          evidence_version_no: 0,
          evidence_policy: "required",
          max_evidence_count: 2,
          response_id: "response-1",
          media_count: "0",
          next_display_order: 5,
          asset_state: "ready",
          asset_classification: "checklist_evidence",
          asset_company_id: "company-1",
          asset_store_id: "store-1",
          intent_instance_id: "instance-1",
          intent_item_id: "item-1",
          intent_actor_user_id: "user-1",
          canonical_sha256: "a".repeat(64),
          capture_source: "system_generated",
          ...override,
        }],
      });

    await expect(repository.linkMobileChecklistItemEvidence({
      checklistInstanceId: "instance-1",
      templateItemId: "item-1",
      mediaAssetId: "asset-1",
      expectedEvidenceVersion: 0,
      idempotencyKey: "key-1",
      actorUserId: "user-1",
      actorRoleCodes: ["REGION_MANAGER"],
      actorActionScope: { assignedStoreIds: ["store-1"] },
    })).rejects.toThrow(expectedError as string);
  });

  it("fails closed when the current assignment no longer authorizes the instance", async () => {
    const { client, repository } = createTransactionHarness();
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(repository.linkMobileChecklistItemEvidence({
      checklistInstanceId: "instance-1",
      templateItemId: "item-1",
      mediaAssetId: "asset-1",
      expectedEvidenceVersion: 0,
      idempotencyKey: "key-1",
      actorUserId: "user-1",
      actorRoleCodes: ["REGION_MANAGER"],
      actorActionScope: { assignedStoreIds: [] },
    })).rejects.toThrow("instance_locked");
    expect(client.query).toHaveBeenCalledTimes(3);
  });

  it("replays the original sanitized receipt result without reading current projection state", async () => {
    const { client, repository } = createTransactionHarness();
    const command = {
      checklistInstanceId: "instance-1",
      templateItemId: "item-1",
      mediaAssetId: "asset-1",
      expectedEvidenceVersion: 0,
    };
    const digest = createHash("sha256")
      .update(JSON.stringify({ commandType: "link", ...command }))
      .digest("hex");
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          command_digest: digest,
          result_json: {
            ...command,
            evidenceVersion: 1,
            evidencePolicy: "required",
            maxEvidenceCount: 2,
            evidence: [{ mediaAssetId: "asset-1" }],
          },
        }],
      });

    await expect(repository.linkMobileChecklistItemEvidence({
      ...command,
      idempotencyKey: "key-1",
      actorUserId: "user-1",
      actorRoleCodes: ["SUPER_ADMIN"],
      actorActionScope: { assignedStoreIds: [] },
    })).resolves.toMatchObject({
      evidenceVersion: 1,
      evidence: [{ mediaAssetId: "asset-1" }],
      idempotent: true,
    });
    expect(client.query).toHaveBeenCalledTimes(2);
  });

  it("locks checklist template code before allocating the next draft version", async () => {
    const { client, databaseService, repository } = createTransactionHarness();
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ version_no: 2 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            checklist_template_id: "template-1",
            company_id: "company-1",
            template_code: "HR_OPENING",
            template_type: "HR_STORE_VISIT",
            template_name: "HR Opening",
            category: "HR",
            version_no: 2,
            status: "draft",
            effective_from: "2026-05-01",
            effective_to: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            template_item_id: "item-1",
            section_name: "People",
            item_no: 1,
            item_text: "Review staffing",
            response_type: "score",
            weight: "100.00",
            max_score: "5.00",
            expected_value: null,
          },
        ],
      });

    await repository.createTemplate({
      companyId: "company-1",
      templateCode: "HR_OPENING",
      templateName: "HR Opening",
      templateType: "HR_STORE_VISIT",
      category: "HR",
      effectiveFrom: "2026-05-01",
      actorUserId: "user-1",
      items: [
        {
          sectionName: "People",
          itemNo: 1,
          itemText: "Review staffing",
          responseType: "score",
          weight: 100,
          maxScore: 5,
        },
      ],
    });

    expect(databaseService.withTransaction).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("pg_advisory_xact_lock(hashtext($1)::bigint)"),
      ["HR_OPENING"],
    );
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("COALESCE(MAX(version_no), 0) + 1"),
      ["HR_OPENING"],
    );
  });

  it("returns draft checklist template metadata and items for publishing", async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            checklist_template_id: "template-1",
            company_id: "company-1",
            effective_from: "2026-05-01",
            effective_to: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            template_item_id: "item-1",
            weight: "60.00",
          },
          {
            template_item_id: "item-2",
            weight: "40.00",
          },
        ],
      });
    const repository = new ChecklistRepository({ query } as never);

    await expect(repository.getDraftTemplateForPublish("template-1")).resolves.toEqual({
      checklistTemplateId: "template-1",
      companyId: "company-1",
      effectiveFrom: "2026-05-01",
      effectiveTo: null,
      items: [
        { templateItemId: "item-1", weight: 60, evidencePolicy: "none", maxEvidenceCount: 0 },
        { templateItemId: "item-2", weight: 40, evidencePolicy: "none", maxEvidenceCount: 0 },
      ],
    });
  });

  it("throws a clear not found error when a draft checklist template is missing or non-draft", async () => {
    const query = jest.fn().mockResolvedValueOnce({ rows: [] });
    const repository = new ChecklistRepository({ query } as never);

    await expect(repository.getDraftTemplateForPublish("template-1")).rejects.toThrow(
      "Draft checklist template not found",
    );
  });

  it("starts a mobile checklist instance with the actor user as starter", async () => {
    const query = jest.fn().mockResolvedValueOnce({
      rows: [
        {
          checklist_instance_id: "instance-1",
          status: "in_progress",
          created_at: "2026-04-28T10:00:00.000Z",
        },
      ],
    });
    const repository = new ChecklistRepository({ query } as never);

    await expect(
      repository.startMobileChecklistInstance({
        checklistTemplateId: "template-1",
        storeId: "store-1",
        actorUserId: "user-1",
      }),
    ).resolves.toEqual({
      checklist_instance_id: "instance-1",
      status: "in_progress",
      created_at: "2026-04-28T10:00:00.000Z",
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("started_by_user_id"),
      ["template-1", "store-1", "user-1"],
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("ct.status = 'published'"),
      expect.any(Array),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("s.company_id = ct.company_id"),
      expect.any(Array),
    );
  });

  it("rejects starting a mobile checklist when the template is not available for the store", async () => {
    const query = jest.fn().mockResolvedValueOnce({ rows: [] });
    const repository = new ChecklistRepository({ query } as never);

    await expect(
      repository.startMobileChecklistInstance({
        checklistTemplateId: "template-1",
        storeId: "store-1",
        actorUserId: "user-1",
      }),
    ).rejects.toThrow("Checklist template is not available for this store");
  });

  it("saves a mobile checklist response and keeps planned instances in progress", async () => {
    const { client, databaseService, repository } = createTransactionHarness();
    client.query
      .mockResolvedValueOnce({
        rows: [
          {
            checklist_instance_id: "instance-1",
            store_id: "store-1",
            status: "in_progress",
            response_type: "score",
            max_score: "10.00",
            expected_value: JSON.stringify({ lowScoreThreshold: 6 }),
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            response_id: "response-1",
            responded_at: "2026-04-28T10:05:00.000Z",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      repository.saveMobileChecklistResponse({
        checklistInstanceId: "instance-1",
        templateItemId: "item-1",
        scoreValue: 8,
        commentText: "Good",
        actorUserId: "user-1",
      }),
    ).resolves.toEqual({
      response_id: "response-1",
      responded_at: "2026-04-28T10:05:00.000Z",
    });

    expect(databaseService.withTransaction).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("FOR UPDATE OF ci"),
      ["instance-1", "item-1"],
    );
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("ON CONFLICT (checklist_instance_id, template_item_id)"),
      ["instance-1", "item-1", 8, "Good", false],
    );
    expect(client.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("status = 'in_progress'"),
      ["instance-1", "user-1"],
    );
  });

  it("marks mobile checklist responses non-compliant when the score is at or below the configured low threshold", async () => {
    const { client, repository } = createTransactionHarness();
    client.query
      .mockResolvedValueOnce({
        rows: [
          {
            checklist_instance_id: "instance-1",
            store_id: "store-1",
            status: "in_progress",
            response_type: "score",
            max_score: "10.00",
            expected_value: JSON.stringify({ lowScoreThreshold: 6 }),
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            response_id: "response-1",
            responded_at: "2026-04-28T10:05:00.000Z",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    await repository.saveMobileChecklistResponse({
      checklistInstanceId: "instance-1",
      templateItemId: "item-1",
      scoreValue: 6,
      actorUserId: "user-1",
    });

    expect(client.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("is_non_compliant"),
      ["instance-1", "item-1", 6, null, true],
    );
  });

  it("rejects saving a response when the item is not on the instance template", async () => {
    const { client, repository } = createTransactionHarness();
    client.query.mockResolvedValueOnce({ rows: [] });

    await expect(
      repository.saveMobileChecklistResponse({
        checklistInstanceId: "instance-1",
        templateItemId: "item-1",
        scoreValue: 8,
        actorUserId: "user-1",
      }),
    ).rejects.toThrow("Checklist template item is not available for this instance");

    expect(client.query).toHaveBeenCalledTimes(1);
  });

  it("rejects saving a response above the item max score", async () => {
    const { client, repository } = createTransactionHarness();
    client.query.mockResolvedValueOnce({
      rows: [
        {
          checklist_instance_id: "instance-1",
          store_id: "store-1",
          status: "in_progress",
          response_type: "score",
          max_score: "5.00",
          expected_value: null,
        },
      ],
    });

    await expect(
      repository.saveMobileChecklistResponse({
        checklistInstanceId: "instance-1",
        templateItemId: "item-1",
        scoreValue: 8,
        actorUserId: "user-1",
      }),
    ).rejects.toThrow("Checklist score exceeds item max score");

    expect(client.query).toHaveBeenCalledTimes(1);
  });

  it("rejects saving a score response below the item min score", async () => {
    const { client, repository } = createTransactionHarness();
    client.query.mockResolvedValueOnce({
      rows: [
        {
          checklist_instance_id: "instance-1",
          store_id: "store-1",
          status: "in_progress",
          response_type: "score",
          max_score: "5.00",
          expected_value: JSON.stringify({ minScore: 1 }),
        },
      ],
    });

    await expect(
      repository.saveMobileChecklistResponse({
        checklistInstanceId: "instance-1",
        templateItemId: "item-1",
        scoreValue: 0,
        actorUserId: "user-1",
      }),
    ).rejects.toThrow("Checklist score is below item min score");

    expect(client.query).toHaveBeenCalledTimes(1);
  });

  it("allows zero score for yes no responses even when expected value carries min score", async () => {
    const { client, repository } = createTransactionHarness();
    client.query
      .mockResolvedValueOnce({
        rows: [
          {
            checklist_instance_id: "instance-1",
            store_id: "store-1",
            status: "in_progress",
            response_type: "yes_no",
            max_score: "1.00",
            expected_value: JSON.stringify({ minScore: 1, lowScoreThreshold: 0 }),
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            response_id: "response-1",
            responded_at: "2026-04-28T10:05:00.000Z",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      repository.saveMobileChecklistResponse({
        checklistInstanceId: "instance-1",
        templateItemId: "item-1",
        scoreValue: 0,
        actorUserId: "user-1",
      }),
    ).resolves.toEqual({
      response_id: "response-1",
      responded_at: "2026-04-28T10:05:00.000Z",
    });

    expect(client.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("is_non_compliant"),
      ["instance-1", "item-1", 0, null, true],
    );
  });

  it("calculates mobile checklist completion score and missing mandatory count", async () => {
    const query = jest.fn().mockResolvedValueOnce({
      rows: [
        {
          total_score: "86.00",
          compliance_rate: "1.0000",
          missing_mandatory_count: "0",
        },
      ],
    });
    const repository = new ChecklistRepository({ query } as never);

    await expect(repository.calculateMobileChecklistCompletion("instance-1")).resolves.toEqual({
      totalScore: "86.00",
      complianceRate: "1.0000",
      missingMandatoryCount: 0,
      missingRequiredEvidenceCount: 0,
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("missing_mandatory_count"),
      ["instance-1"],
    );
  });

  it("completes and locks a mobile checklist instance", async () => {
    const { client, databaseService, repository } = createTransactionHarness();
    client.query
      .mockResolvedValueOnce({
        rows: [
          {
            checklist_instance_id: "instance-1",
            store_id: "store-1",
            status: "in_progress",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            total_score: "86.00",
            compliance_rate: "1.0000",
            missing_mandatory_count: "0",
          },
        ],
      })
      .mockResolvedValueOnce({
      rows: [
        {
          checklist_instance_id: "instance-1",
          status: "completed",
          total_score: "86.00",
          compliance_rate: "1.0000",
          completed_at: "2026-04-28T10:10:00.000Z",
          locked_at: "2026-04-28T10:10:00.000Z",
        },
      ],
    });

    await expect(
      repository.completeMobileChecklistInstance({
        checklistInstanceId: "instance-1",
        actorUserId: "user-1",
        actorRoleCodes: ["REGION_MANAGER"],
        actorActionScope: { assignedStoreIds: ["store-1"] },
      }),
    ).resolves.toEqual({
      checklist_instance_id: "instance-1",
      status: "completed",
      total_score: "86.00",
      compliance_rate: "1.0000",
      completed_at: "2026-04-28T10:10:00.000Z",
      locked_at: "2026-04-28T10:10:00.000Z",
    });
    expect(databaseService.withTransaction).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("FOR UPDATE"),
      ["instance-1", ["store-1"], ["REGION_MANAGER"]],
    );
    expect(client.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("locked_at = NOW()"),
      ["instance-1", "user-1", "86.00", "1.0000"],
    );
  });

  it("returns the existing deterministic state for an authorized repeated completion", async () => {
    const { client, repository } = createTransactionHarness();
    client.query.mockResolvedValueOnce({
      rows: [{
        checklist_instance_id: "instance-1",
        store_id: "store-1",
        status: "completed",
        total_score: "86.00",
        compliance_rate: "1.0000",
        completed_at: "2026-04-28T10:10:00.000Z",
        locked_at: "2026-04-28T10:10:00.000Z",
      }],
    });

    await expect(repository.completeMobileChecklistInstance({
      checklistInstanceId: "instance-1",
      actorUserId: "user-1",
      actorRoleCodes: ["REGION_MANAGER"],
      actorActionScope: { assignedStoreIds: ["store-1"] },
    })).resolves.toMatchObject({ status: "completed", total_score: "86.00" });
    expect(client.query).toHaveBeenCalledTimes(1);
  });

  it("returns no mobile today rows when actor has no assigned stores", async () => {
    const query = jest.fn();
    const repository = new ChecklistRepository({ query } as never);

    const result = await repository.getMobileChecklistToday({
      actorUserId: "region-user-1",
      assignedStoreIds: [],
      readStoreIds: [],
      allowedTemplateTypes: ["BM_STORE_VISIT"],
    });

    expect(result).toEqual({
      stores: [],
      templates: [],
      activeInstances: [],
      completedThisMonth: [],
      pendingAcknowledgements: [],
      monthlySummaries: [],
    });
    expect(query).not.toHaveBeenCalled();
  });

  it("uses assigned stores before read stores for mobile checklist today read model", async () => {
    const query = createQueryMock({
      stores: [{ store_id: "assigned-store-1", store_name: "Marmara Park" }],
    });
    const repository = new ChecklistRepository({ query } as never);

    await repository.getMobileChecklistToday({
      actorUserId: "region-user-1",
      assignedStoreIds: ["assigned-store-1"],
      readStoreIds: ["read-store-1"],
      allowedTemplateTypes: ["BM_STORE_VISIT"],
    });

    expect(query).toHaveBeenCalledWith(expect.stringContaining("s.store_id = ANY($1::uuid[])"), [
      ["assigned-store-1"],
    ]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("SELECT DISTINCT s.company_id"),
      [["assigned-store-1"], ["BM_STORE_VISIT"]],
    );
  });

  it("uses read stores when actor has no assigned stores", async () => {
    const query = createQueryMock({
      stores: [{ store_id: "read-store-1", store_name: "Emaar Square" }],
    });
    const repository = new ChecklistRepository({ query } as never);

    await repository.getMobileChecklistToday({
      actorUserId: "region-user-1",
      assignedStoreIds: [],
      readStoreIds: ["read-store-1"],
      allowedTemplateTypes: ["BM_STORE_VISIT"],
    });

    expect(query).toHaveBeenCalledWith(expect.stringContaining("s.store_id = ANY($1::uuid[])"), [
      ["read-store-1"],
    ]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("SELECT DISTINCT s.company_id"), [
      ["read-store-1"],
      ["BM_STORE_VISIT"],
    ]);
  });

  it("resolves region scope to stores when actor has no explicit store ids", async () => {
    const query = createQueryMock({
      stores: [{ store_id: "region-store-1", store_name: "Forum Istanbul" }],
    });
    const repository = new ChecklistRepository({ query } as never);

    await repository.getMobileChecklistToday({
      actorUserId: "region-user-1",
      assignedStoreIds: [],
      readStoreIds: [],
      readRegionIds: ["region-1"],
      readCompanyIds: ["company-1"],
      allowedTemplateTypes: ["BM_STORE_VISIT"],
    });

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("s.region_id = ANY($1::uuid[])"),
      [["region-1"]],
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("SELECT DISTINCT s.company_id"),
      [["region-store-1"], ["BM_STORE_VISIT"]],
    );
  });

  it("scopes templates to companies for the effective store ids", async () => {
    const query = createQueryMock({
      stores: [{ store_id: "store-1", store_name: "Marmara Park" }],
      templates: [
        {
          checklist_template_id: "template-1",
          template_code: "BM_VISIT_V1",
          template_type: "BM_STORE_VISIT",
          template_name: "BM Visit",
          version_no: 3,
        },
      ],
      templateItems: [
        {
          checklist_template_id: "template-1",
          template_item_id: "item-1",
          section_name: "Sales floor",
          item_no: 1,
          item_text: "Review presentation",
          response_type: "score",
          weight: "100.00",
          max_score: "5.00",
          expected_value: JSON.stringify({
            lowScoreThreshold: 2,
            minScore: 1,
            requiresLowScoreNote: true,
          }),
        },
      ],
    });
    const repository = new ChecklistRepository({ query } as never);

    const result = await repository.getMobileChecklistToday({
      actorUserId: "region-user-1",
      assignedStoreIds: ["store-1"],
      readStoreIds: ["read-store-1"],
      allowedTemplateTypes: ["BM_STORE_VISIT"],
    });

    const [templateSql, templateParams] = query.mock.calls[1];
    expect(templateSql).toContain("FROM ops.checklist_template ct");
    expect(templateSql).toContain("ct.company_id IN");
    expect(templateSql).toContain("SELECT DISTINCT s.company_id");
    expect(templateSql).toContain("s.store_id = ANY($1::uuid[])");
    expect(templateParams).toEqual([["store-1"], ["BM_STORE_VISIT"]]);
    const [itemsSql] = query.mock.calls[2];
    expect(itemsSql).toContain("cti.expected_value");
    expect(result.templates).toEqual([
      {
        checklistTemplateId: "template-1",
        templateCode: "BM_VISIT_V1",
        templateType: "BM_STORE_VISIT",
        templateName: "BM Visit",
        versionNo: 3,
        items: [
          {
            templateItemId: "item-1",
            sectionName: "Sales floor",
            itemNo: 1,
            itemText: "Review presentation",
            responseType: "score",
            weight: 100,
            maxScore: 5,
            minScore: 1,
            lowScoreThreshold: 2,
            requiresLowScoreNote: true,
            evidencePolicy: "none",
            maxEvidenceCount: 0,
          },
        ],
      },
    ]);
  });

  it("returns only the latest currently effective published template version per code", async () => {
    const query = createQueryMock({
      stores: [{ store_id: "store-1", store_name: "Marmara Park" }],
      templates: [
        {
          checklist_template_id: "template-v2",
          template_code: "BM_STORE_VISIT_2026",
          template_type: "BM_STORE_VISIT",
          template_name: "BM Store Visit",
          version_no: 2,
        },
      ],
    });
    const repository = new ChecklistRepository({ query } as never);

    await repository.getMobileChecklistToday({
      actorUserId: "region-user-1",
      assignedStoreIds: ["store-1"],
      readStoreIds: [],
      allowedTemplateTypes: ["BM_STORE_VISIT"],
    });

    const [templateSql] = query.mock.calls[1];
    expect(templateSql).toContain("ROW_NUMBER() OVER");
    expect(templateSql).toContain(
      "PARTITION BY ct.company_id, ct.template_type, ct.template_code",
    );
    expect(templateSql).toContain("ranked_templates.version_rank = 1");
  });

  it("hydrates active mobile checklist draft responses", async () => {
    const query = createQueryMock({
      stores: [{ store_id: "store-1", store_name: "Marmara Park" }],
      templates: [
        {
          checklist_template_id: "template-1",
          template_code: "BM_VISIT_V1",
          template_type: "BM_STORE_VISIT",
          template_name: "BM Visit",
          version_no: 1,
        },
      ],
      activeInstances: [
        {
          checklist_instance_id: "instance-1",
          checklist_template_id: "template-1",
          store_id: "store-1",
          status: "in_progress",
          started_at: "2026-04-28T10:00:00.000Z",
          updated_at: "2026-04-28T10:05:00.000Z",
          responses_json: [
            {
              templateItemId: "item-1",
              scoreValue: "8.00",
              commentText: "Raf ve vitrin uygun",
            },
          ],
        },
      ],
    });
    const repository = new ChecklistRepository({ query } as never);

    const result = await repository.getMobileChecklistToday({
      actorUserId: "region-user-1",
      assignedStoreIds: ["store-1"],
      readStoreIds: [],
      allowedTemplateTypes: ["BM_STORE_VISIT"],
    });

    expect(result.activeInstances).toEqual([
      {
        checklistInstanceId: "instance-1",
        checklistTemplateId: "template-1",
        storeId: "store-1",
        status: "in_progress",
        startedAt: "2026-04-28T10:00:00.000Z",
        updatedAt: "2026-04-28T10:05:00.000Z",
        evidenceVersion: 0,
        evidence: [],
        responses: [
          {
            templateItemId: "item-1",
            scoreValue: 8,
            commentText: "Raf ve vitrin uygun",
          },
        ],
      },
    ]);
  });

  it("reads active draft updatedAt from the latest response timestamp", async () => {
    const query = createQueryMock({
      stores: [{ store_id: "store-1", store_name: "Marmara Park" }],
      templates: [
        {
          checklist_template_id: "template-1",
          template_code: "BM_VISIT_V1",
          template_type: "BM_STORE_VISIT",
          template_name: "BM Visit",
          version_no: 1,
        },
      ],
      activeInstances: [
        {
          checklist_instance_id: "instance-1",
          checklist_template_id: "template-1",
          store_id: "store-1",
          status: "in_progress",
          started_at: "2026-04-28T10:00:00.000Z",
          updated_at: "2026-04-28T10:12:00.000Z",
          responses_json: [],
        },
      ],
    });
    const repository = new ChecklistRepository({ query } as never);

    const result = await repository.getMobileChecklistToday({
      actorUserId: "region-user-1",
      assignedStoreIds: ["store-1"],
      readStoreIds: [],
      allowedTemplateTypes: ["BM_STORE_VISIT"],
    });

    const activeSql = query.mock.calls.find(([sql]) =>
      String(sql).includes("ci.status IN ('planned', 'in_progress')"),
    )?.[0] as string | undefined;
    expect(activeSql).toBeDefined();
    expect(activeSql).toContain("COALESCE(MAX(cr.responded_at), ci.created_at) AS updated_at");
    expect(activeSql).toContain("LEFT JOIN ops.checklist_response cr");
    expect(activeSql).toContain("ON cr.checklist_instance_id = ci.checklist_instance_id");
    expect(result.activeInstances[0]?.updatedAt).toBe("2026-04-28T10:12:00.000Z");
  });

  it("excludes completed checklist rows without total scores", async () => {
    const query = createQueryMock({
      stores: [{ store_id: "store-1", store_name: "Marmara Park" }],
    });
    const repository = new ChecklistRepository({ query } as never);

    await repository.getMobileChecklistToday({
      actorUserId: "region-user-1",
      assignedStoreIds: ["store-1"],
      readStoreIds: [],
      allowedTemplateTypes: ["BM_STORE_VISIT"],
    });

    const completedSql = query.mock.calls[3][0] as string;
    const monthlySummarySql = query.mock.calls[4][0] as string;
    expect(completedSql).toContain("ci.total_score IS NOT NULL");
    expect(monthlySummarySql).toContain("ci.total_score IS NOT NULL");
  });
});
