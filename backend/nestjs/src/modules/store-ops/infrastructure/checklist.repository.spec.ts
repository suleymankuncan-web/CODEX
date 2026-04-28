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
