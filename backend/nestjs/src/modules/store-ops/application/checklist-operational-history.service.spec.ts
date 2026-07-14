import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { ChecklistOperationalHistoryService } from "./checklist-operational-history.service";

const storeId = "11111111-1111-4111-8111-111111111111";
const roleScopes = {
  REGION_MANAGER: { companyIds: [], regionIds: ["33333333-3333-4333-8333-333333333333"], storeIds: [] },
};

describe("ChecklistOperationalHistoryService", () => {
  it("fails closed for unsupported and empty role scopes", async () => {
    const repository = { read: jest.fn() };
    const service = new ChecklistOperationalHistoryService(repository as never);
    await expect(service.read({ actorRoleCodes: ["VISUAL_MERCHANDISER"], roleScopes: {}, storeId })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.read({ actorRoleCodes: ["REGION_MANAGER"], roleScopes: {}, storeId })).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.read).not.toHaveBeenCalled();
  });

  it("returns 20 rows and binds the next cursor to store and normalized filters", async () => {
    const items = Array.from({ length: 21 }, (_, index) => ({
      event: {
        id: `evt_${index}`,
        kind: "task_assigned" as const,
        occurredAt: `2026-07-${String(21 - index).padStart(2, "0")}T10:00:00.000Z`,
        title: "Görev atandı",
        detail: "Mağaza için operasyon görevi atandı.",
        actorSnapshot: { displayName: null, roleLabel: null, assignmentLabel: null, identityStatus: "unknown" as const },
        details: [],
      },
      cursor: {
        occurredAt: "2026-07-14T10:00:00.000Z",
        kindRank: 3,
        eventKey: index.toString(16).padStart(32, "0"),
      },
    }));
    const repository = {
      read: jest.fn().mockResolvedValue({
        store: { id: storeId, name: "Pilot Store", city: null, district: null },
        summary: { eventCount: 21, completedVisitCount: 0, assignedTaskCount: 21, openTaskCount: 2 },
        items,
      }),
    };
    const service = new ChecklistOperationalHistoryService(repository as never);
    const result = await service.read({
      actorRoleCodes: ["REGION_MANAGER"], roleScopes, storeId, range: "6m", kinds: "task_assigned",
    });
    expect(result.items).toHaveLength(20);
    expect(result.page).toEqual({ hasMore: true, nextCursor: expect.any(String) });
    expect(repository.read).toHaveBeenCalledWith(expect.objectContaining({
      storeId, range: "6m", kinds: ["task_assigned"], cursor: null, limit: 21,
      companyIds: [], regionIds: roleScopes.REGION_MANAGER.regionIds, storeIds: [],
    }));

    await service.read({
      actorRoleCodes: ["REGION_MANAGER"], roleScopes, storeId, range: "6m", kinds: "task_assigned", cursor: result.page.nextCursor!,
    });
    expect(repository.read).toHaveBeenLastCalledWith(expect.objectContaining({
      cursor: { occurredAt: "2026-07-14T10:00:00.000Z", kindRank: 3, eventKey: "00000000000000000000000000000013" },
    }));
  });

  it("uses one generic missing result for out-of-scope and nonexistent stores", async () => {
    const service = new ChecklistOperationalHistoryService({ read: jest.fn().mockResolvedValue(null) } as never);
    await expect(service.read({ actorRoleCodes: ["REGION_MANAGER"], roleScopes, storeId })).rejects.toBeInstanceOf(NotFoundException);
  });
});
