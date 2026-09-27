import { ConflictException, ForbiddenException } from "@nestjs/common";
import { ChecklistVisitPlanService } from "./checklist-visit-plan.service";

describe("ChecklistVisitPlanService", () => {
  const empty = { companyIds: [], regionIds: [], storeIds: [] };
  const repository = {
    getWeeklyPlan: jest.fn(),
    getManagerWeeklyPlan: jest.fn(),
    getAssignedWeeklyPlan: jest.fn(),
    saveWeeklyPlan: jest.fn(),
    saveAssignedWeeklyPlan: jest.fn(),
    listPeriod: jest.fn(),
    listCandidates: jest.fn(),
    listRegionOptions: jest.fn(),
    completeVisit: jest.fn(),
  };
  const service = new ChecklistVisitPlanService(repository as never);

  beforeEach(() => jest.clearAllMocks());

  const assignedActor = {
    actorUserId: "11111111-1111-4111-8111-111111111111",
    actorRoleCodes: ["REGION_MANAGER"],
    actorReadScope: { ...empty, regionIds: ["legacy-region"] },
    roleScopes: { REGION_MANAGER: { ...empty, storeIds: ["55555555-5555-4555-8555-555555555555"] } },
  };

  it("opens the current manager's assigned stores without region selection or another manager's identity", async () => {
    repository.getAssignedWeeklyPlan.mockResolvedValue({ regionId: null, scopeRevision: "a".repeat(64), items: [] });
    const result = await service.getWeeklyPlan({ ...assignedActor, managerUserId: "someone-else", weekStart: "2026-09-21" });
    expect(repository.getAssignedWeeklyPlan).toHaveBeenCalledWith({
      actorUserId: assignedActor.actorUserId, storeIds: assignedActor.roleScopes.REGION_MANAGER.storeIds, weekStart: "2026-09-21",
    });
    expect(result.capabilities.canMaintainWeeklyVisitPlan).toBe(true);
    expect(repository.getManagerWeeklyPlan).not.toHaveBeenCalled();
    expect(repository.getWeeklyPlan).not.toHaveBeenCalled();
  });

  it("requires a portfolio revision for atomic assigned-store writes", async () => {
    const input = { ...assignedActor, weekStart: "2026-09-21", expectedRevision: 0,
      idempotencyKey: "44444444-4444-4444-8444-444444444444", items: [] };
    await expect(service.saveWeeklyPlan(input)).rejects.toThrow("revision is stale");
    expect(repository.saveAssignedWeeklyPlan).not.toHaveBeenCalled();
    repository.saveAssignedWeeklyPlan.mockResolvedValue({ regionId: null, items: [], revision: 1 });
    await service.saveWeeklyPlan({ ...input, expectedScopeRevision: "a".repeat(64) });
    expect(repository.saveAssignedWeeklyPlan).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: assignedActor.actorUserId,
      authorizedStoreIds: assignedActor.roleScopes.REGION_MANAGER.storeIds,
      expectedScopeRevision: "a".repeat(64),
    }));
    expect(repository.saveWeeklyPlan).not.toHaveBeenCalled();
  });

  it("searches candidates and annual history across only direct assignments when no region is supplied", async () => {
    repository.listCandidates.mockResolvedValue({ items: [], total: 0 });
    repository.listPeriod.mockResolvedValue({ items: [], total: 0, metrics: {}, regionName: "" });
    await service.listCandidates(assignedActor);
    await service.listPeriod({ ...assignedActor, period: "2026-09" });
    for (const method of [repository.listCandidates, repository.listPeriod]) {
      expect(method).toHaveBeenCalledWith(expect.objectContaining({ regionId: null, storeIds: assignedActor.roleScopes.REGION_MANAGER.storeIds }));
    }
  });

  it("reads Report Viewer weekly plans through the selected manager identity and company scope", async () => {
    const managerUserId = "77777777-7777-4777-8777-777777777777";
    repository.getManagerWeeklyPlan.mockResolvedValue({ regionId: "33333333-3333-4333-8333-333333333333", items: [] });

    await service.getWeeklyPlan({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      actorRoleCodes: ["REPORT_VIEWER"],
      actorReadScope: empty,
      roleScopes: { REPORT_VIEWER: { ...empty, companyIds: ["99999999-9999-4999-8999-999999999999"] } },
      managerUserId,
      weekStart: "2026-07-13",
    });

    expect(repository.getManagerWeeklyPlan).toHaveBeenCalledWith({
      managerUserId,
      weekStart: "2026-07-13",
      companyIds: ["99999999-9999-4999-8999-999999999999"],
    });
    expect(repository.getWeeklyPlan).not.toHaveBeenCalled();
  });

  it("does not let Report Viewer fall back to a region identifier", async () => {
    await expect(service.getWeeklyPlan({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      actorRoleCodes: ["REPORT_VIEWER"],
      actorReadScope: empty,
      roleScopes: { REPORT_VIEWER: { ...empty, companyIds: ["99999999-9999-4999-8999-999999999999"] } },
      regionId: "33333333-3333-4333-8333-333333333333",
      weekStart: "2026-07-13",
    })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("denies a Region Manager with no direct assigned stores", async () => {
    const actor = {
      actorUserId: "11111111-1111-4111-8111-111111111111",
      actorRoleCodes: ["REGION_MANAGER"],
      actorReadScope: empty,
      roleScopes: { REGION_MANAGER: { ...empty, regionIds: ["22222222-2222-4222-8222-222222222222"], storeIds: [] } },
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

  it("records a visit only for the assigned Region Manager scope", async () => {
    const actor = {
      actorUserId: "11111111-1111-4111-8111-111111111111",
      actorRoleCodes: ["REGION_MANAGER"],
      actorReadScope: empty,
      roleScopes: { REGION_MANAGER: { ...empty, storeIds: ["55555555-5555-4555-8555-555555555555"] } },
      planItemId: "55555555-5555-4555-8555-555555555555",
      idempotencyKey: "66666666-6666-4666-8666-666666666666",
    };
    const completion = { planItemId: actor.planItemId, completedAt: "2026-07-15T10:00:00.000Z" };
    repository.completeVisit.mockResolvedValue(completion);

    await expect(service.completeVisit(actor)).resolves.toEqual(completion);
    expect(repository.completeVisit).toHaveBeenCalledWith({
      planItemId: actor.planItemId,
      actorUserId: actor.actorUserId,
      storeIds: ["55555555-5555-4555-8555-555555555555"],
      idempotencyKey: actor.idempotencyKey,
    });
  });

  it("denies visit completion for non-Region Managers", async () => {
    const planItemId = "55555555-5555-4555-8555-555555555555";
    const idempotencyKey = "66666666-6666-4666-8666-666666666666";
    await expect(service.completeVisit({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      actorRoleCodes: ["REPORT_VIEWER"],
      actorReadScope: empty,
      roleScopes: { REPORT_VIEWER: empty },
      planItemId,
      idempotencyKey,
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.completeVisit).not.toHaveBeenCalled();
  });

  it("rejects duplicate store/date entries before persistence", async () => {
    await expect(service.saveWeeklyPlan({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      actorRoleCodes: ["REGION_MANAGER"],
      actorReadScope: empty,
      roleScopes: { REGION_MANAGER: { ...empty, storeIds: ["55555555-5555-4555-8555-555555555555"] } },
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
      roleScopes: { REGION_MANAGER: { ...empty, storeIds: ["55555555-5555-4555-8555-555555555555"] } },
      regionId: "33333333-3333-4333-8333-333333333333",
      weekStart: "2026-07-13",
      expectedRevision: 0,
      idempotencyKey: "44444444-4444-4444-8444-444444444444",
      items: [{ storeId: "55555555-5555-4555-8555-555555555555", plannedDate: "2026-07-14", displayOrder: 0 }],
    });
    expect(repository.saveWeeklyPlan).toHaveBeenCalledWith(expect.objectContaining({
      requestSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      authorizedStoreIds: ["55555555-5555-4555-8555-555555555555"],
    }));
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
        REGION_MANAGER: {
          ...empty,
          regionIds: ["forged-region-must-not-authorize"],
          storeIds: ["55555555-5555-4555-8555-555555555555"],
        },
      },
      regionId,
      period: "2026-07",
    });
    expect(repository.listPeriod).toHaveBeenCalledWith(expect.objectContaining({
      regionId,
      storeIds: ["55555555-5555-4555-8555-555555555555"],
    }));
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
      roleScopes: { REGION_MANAGER: empty },
    })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("lists only named Region Manager role-scope regions in one bounded read", async () => {
    const regionIds = [
      "33333333-3333-4333-8333-333333333333",
      "22222222-2222-4222-8222-222222222222",
    ];
    const storeIds = ["55555555-5555-4555-8555-555555555555", "66666666-6666-4666-8666-666666666666"];
    repository.listRegionOptions.mockResolvedValue({ total: 200, items: [
      { regionId: regionIds[1], regionName: "Ege" },
      { regionId: regionIds[0], regionName: "Marmara" },
    ] });

    await expect(service.listRegionOptions({
      actorRoleCodes: ["REPORT_VIEWER", "REGION_MANAGER"],
      actorReadScope: empty,
      roleScopes: {
        REPORT_VIEWER: { ...empty, regionIds: ["99999999-9999-4999-8999-999999999999"] },
        REGION_MANAGER: { ...empty, regionIds, storeIds },
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
    expect(repository.listRegionOptions).toHaveBeenCalledWith({ storeIds, query: "Bölge", limit: 2, offset: 2 });
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
