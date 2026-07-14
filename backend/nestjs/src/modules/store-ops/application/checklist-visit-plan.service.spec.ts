import { ConflictException, ForbiddenException } from "@nestjs/common";
import { ChecklistVisitPlanService } from "./checklist-visit-plan.service";

describe("ChecklistVisitPlanService", () => {
  const empty = { companyIds: [], regionIds: [], storeIds: [] };
  const repository = {
    getWeeklyPlan: jest.fn(),
    saveWeeklyPlan: jest.fn(),
    listPeriod: jest.fn(),
    listCandidates: jest.fn(),
    listRegionOptions: jest.fn(),
  };
  const service = new ChecklistVisitPlanService(repository as never);

  beforeEach(() => jest.clearAllMocks());

  it("denies a Region Manager cross-region read and write", async () => {
    const actor = {
      actorUserId: "11111111-1111-4111-8111-111111111111",
      actorRoleCodes: ["REGION_MANAGER"],
      actorReadScope: empty,
      roleScopes: { REGION_MANAGER: { ...empty, regionIds: ["22222222-2222-4222-8222-222222222222"] } },
    };
    const regionId = "33333333-3333-4333-8333-333333333333";

    await expect(service.getWeeklyPlan({ ...actor, regionId, weekStart: "2026-07-13" })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.saveWeeklyPlan({
      ...actor,
      regionId,
      weekStart: "2026-07-13",
      expectedRevision: 0,
      idempotencyKey: "44444444-4444-4444-8444-444444444444",
      items: [],
    })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("denies writes for Report Viewer and Store Manager", async () => {
    for (const role of ["REPORT_VIEWER", "STORE_MANAGER"]) {
      await expect(service.saveWeeklyPlan({
        actorUserId: "11111111-1111-4111-8111-111111111111",
        actorRoleCodes: [role],
        actorReadScope: empty,
        roleScopes: { [role]: empty },
        regionId: "33333333-3333-4333-8333-333333333333",
        weekStart: "2026-07-13",
        expectedRevision: 0,
        idempotencyKey: "44444444-4444-4444-8444-444444444444",
        items: [],
      })).rejects.toBeInstanceOf(ForbiddenException);
    }
  });

  it("rejects duplicate store/date entries before persistence", async () => {
    await expect(service.saveWeeklyPlan({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      actorRoleCodes: ["REGION_MANAGER"],
      actorReadScope: empty,
      roleScopes: { REGION_MANAGER: { ...empty, regionIds: ["33333333-3333-4333-8333-333333333333"] } },
      regionId: "33333333-3333-4333-8333-333333333333",
      weekStart: "2026-07-13",
      expectedRevision: 0,
      idempotencyKey: "44444444-4444-4444-8444-444444444444",
      items: [
        { storeId: "55555555-5555-4555-8555-555555555555", plannedDate: "2026-07-14", displayOrder: 0 },
        { storeId: "55555555-5555-4555-8555-555555555555", plannedDate: "2026-07-14", displayOrder: 1 },
      ],
    })).rejects.toBeInstanceOf(ConflictException);
    expect(repository.saveWeeklyPlan).not.toHaveBeenCalled();
  });

  it("passes a deterministic canonical digest to persistence", async () => {
    repository.saveWeeklyPlan.mockResolvedValue({ revision: 1, items: [] });
    await service.saveWeeklyPlan({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      actorRoleCodes: ["REGION_MANAGER"],
      actorReadScope: empty,
      roleScopes: { REGION_MANAGER: { ...empty, regionIds: ["33333333-3333-4333-8333-333333333333"] } },
      regionId: "33333333-3333-4333-8333-333333333333",
      weekStart: "2026-07-13",
      expectedRevision: 0,
      idempotencyKey: "44444444-4444-4444-8444-444444444444",
      items: [{ storeId: "55555555-5555-4555-8555-555555555555", plannedDate: "2026-07-14", displayOrder: 0 }],
    });
    expect(repository.saveWeeklyPlan).toHaveBeenCalledWith(expect.objectContaining({ requestSha256: expect.stringMatching(/^[0-9a-f]{64}$/) }));
  });

  it("uses only the Region Manager role scope for full-period reads even for dual-role users", async () => {
    repository.listPeriod.mockResolvedValue({
      metrics: { totalStores: 0, high: 0, medium: 0, low: 0, planned: 0, unplanned: 0, waiting: 0, missed: 0, completed: 0 },
      items: [],
      total: 0,
    });
    const regionId = "33333333-3333-4333-8333-333333333333";
    await service.listPeriod({
      actorRoleCodes: ["REPORT_VIEWER", "REGION_MANAGER"],
      actorReadScope: empty,
      roleScopes: {
        REPORT_VIEWER: { companyIds: ["99999999-9999-4999-8999-999999999999"], regionIds: [], storeIds: [] },
        REGION_MANAGER: { ...empty, regionIds: [regionId] },
      },
      regionId,
      period: "2026-07",
    });
    expect(repository.listPeriod).toHaveBeenCalledWith(expect.objectContaining({ regionId }));
  });

  it("denies non-Region Managers and cross-region period/candidate reads", async () => {
    const base = {
      actorReadScope: empty,
      regionId: "33333333-3333-4333-8333-333333333333",
    };
    await expect(service.listPeriod({
      ...base,
      actorRoleCodes: ["REPORT_VIEWER"],
      roleScopes: { REPORT_VIEWER: { ...empty, companyIds: ["99999999-9999-4999-8999-999999999999"] } },
      period: "2026-07",
    })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.listCandidates({
      ...base,
      actorRoleCodes: ["REGION_MANAGER"],
      roleScopes: { REGION_MANAGER: { ...empty, regionIds: ["22222222-2222-4222-8222-222222222222"] } },
    })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("lists only named Region Manager role-scope regions in one bounded read", async () => {
    const regionIds = [
      "33333333-3333-4333-8333-333333333333",
      "22222222-2222-4222-8222-222222222222",
    ];
    repository.listRegionOptions.mockResolvedValue({ total: 200, items: [
      { regionId: regionIds[1], regionName: "Ege" },
      { regionId: regionIds[0], regionName: "Marmara" },
    ] });

    await expect(service.listRegionOptions({
      actorRoleCodes: ["REPORT_VIEWER", "REGION_MANAGER"],
      actorReadScope: empty,
      roleScopes: {
        REPORT_VIEWER: { ...empty, regionIds: ["99999999-9999-4999-8999-999999999999"] },
        REGION_MANAGER: { ...empty, regionIds },
      },
      query: "  Bölge ", limit: 2, offset: 2,
    })).resolves.toEqual({
      view: "region_manager",
      capabilities: { canMaintainWeeklyVisitPlan: true },
      items: [
        { regionId: regionIds[1], regionName: "Ege" },
        { regionId: regionIds[0], regionName: "Marmara" },
      ],
      page: { total: 200, limit: 2, offset: 2, hasMore: true },
    });
    expect(repository.listRegionOptions).toHaveBeenCalledWith({ regionIds, query: "Bölge", limit: 2, offset: 2 });
  });

  it("rejects region options for a non-Region Manager and returns an honest empty scope", async () => {
    await expect(service.listRegionOptions({
      actorRoleCodes: ["REPORT_VIEWER"], actorReadScope: empty,
      roleScopes: { REPORT_VIEWER: empty },
    })).rejects.toBeInstanceOf(ForbiddenException);

    await expect(service.listRegionOptions({
      actorRoleCodes: ["REGION_MANAGER"], actorReadScope: empty,
      roleScopes: { REGION_MANAGER: empty },
    })).resolves.toEqual({
      view: "region_manager",
      capabilities: { canMaintainWeeklyVisitPlan: true },
      items: [],
      page: { total: 0, limit: 20, offset: 0, hasMore: false },
    });
    expect(repository.listRegionOptions).not.toHaveBeenCalled();
  });
});
