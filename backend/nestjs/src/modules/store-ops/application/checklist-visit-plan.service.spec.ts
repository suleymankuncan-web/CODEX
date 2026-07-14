import { ConflictException, ForbiddenException } from "@nestjs/common";
import { ChecklistVisitPlanService } from "./checklist-visit-plan.service";

describe("ChecklistVisitPlanService", () => {
  const empty = { companyIds: [], regionIds: [], storeIds: [] };
  const repository = { getWeeklyPlan: jest.fn(), saveWeeklyPlan: jest.fn() };
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
});
