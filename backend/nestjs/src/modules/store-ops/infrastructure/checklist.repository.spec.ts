import { ChecklistRepository } from "./checklist.repository";

function createQueryMock(overrides?: {
  stores?: Record<string, unknown>[];
  templates?: Record<string, unknown>[];
  activeInstances?: Record<string, unknown>[];
  completedThisMonth?: Record<string, unknown>[];
  monthlySummaries?: Record<string, unknown>[];
}) {
  return jest
    .fn()
    .mockResolvedValueOnce({ rows: overrides?.stores ?? [] })
    .mockResolvedValueOnce({ rows: overrides?.templates ?? [] })
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
        { templateItemId: "item-1", weight: 60 },
        { templateItemId: "item-2", weight: 40 },
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

  it("returns no mobile today rows when actor has no assigned stores", async () => {
    const query = jest.fn();
    const repository = new ChecklistRepository({ query } as never);

    const result = await repository.getMobileChecklistToday({
      actorUserId: "region-user-1",
      assignedStoreIds: [],
      readStoreIds: [],
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
    });

    expect(query).toHaveBeenCalledWith(expect.stringContaining("s.store_id = ANY($1::uuid[])"), [
      ["assigned-store-1"],
    ]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("SELECT DISTINCT s.company_id"),
      [["assigned-store-1"]],
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
    });

    expect(query).toHaveBeenCalledWith(expect.stringContaining("s.store_id = ANY($1::uuid[])"), [
      ["read-store-1"],
    ]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("SELECT DISTINCT s.company_id"), [
      ["read-store-1"],
    ]);
  });

  it("scopes templates to companies for the effective store ids", async () => {
    const query = createQueryMock({
      templates: [
        {
          checklist_template_id: "template-1",
          template_code: "BM_VISIT_V1",
          template_type: "BM_STORE_VISIT",
          template_name: "BM Visit",
          version_no: 3,
        },
      ],
    });
    const repository = new ChecklistRepository({ query } as never);

    const result = await repository.getMobileChecklistToday({
      actorUserId: "region-user-1",
      assignedStoreIds: ["store-1"],
      readStoreIds: ["read-store-1"],
    });

    const [templateSql, templateParams] = query.mock.calls[1];
    expect(templateSql).toContain("FROM ops.checklist_template ct");
    expect(templateSql).toContain("ct.company_id IN");
    expect(templateSql).toContain("SELECT DISTINCT s.company_id");
    expect(templateSql).toContain("s.store_id = ANY($1::uuid[])");
    expect(templateParams).toEqual([["store-1"]]);
    expect(result.templates).toEqual([
      {
        checklistTemplateId: "template-1",
        templateCode: "BM_VISIT_V1",
        templateType: "BM_STORE_VISIT",
        templateName: "BM Visit",
        versionNo: 3,
      },
    ]);
  });

  it("excludes completed checklist rows without total scores", async () => {
    const query = createQueryMock();
    const repository = new ChecklistRepository({ query } as never);

    await repository.getMobileChecklistToday({
      actorUserId: "region-user-1",
      assignedStoreIds: ["store-1"],
      readStoreIds: [],
    });

    const completedSql = query.mock.calls[3][0] as string;
    const monthlySummarySql = query.mock.calls[4][0] as string;
    expect(completedSql).toContain("ci.total_score IS NOT NULL");
    expect(monthlySummarySql).toContain("ci.total_score IS NOT NULL");
  });
});
