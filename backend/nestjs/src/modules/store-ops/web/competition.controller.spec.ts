import { CompetitionController } from "./competition.controller";

describe("CompetitionController manager read scope", () => {
  it("uses the manager profile stores even when another role adds an action store", async () => {
    const service = { listCompetitions: jest.fn(), getCompetitionDetail: jest.fn() };
    const controller = new CompetitionController(service as never);
    const request = { user: {
      userId: "manager-user", roleCodes: ["REGION_MANAGER", "STORE_MANAGER"],
      scope: { companyIds: [], regionIds: ["legacy-region"], storeIds: ["other-store"] },
      roleScopes: { REGION_MANAGER: { companyIds: [], regionIds: [], storeIds: ["manager-store"] } },
      actionScope: { assignedStoreIds: ["manager-store", "other-store"] },
    } };

    await controller.listCompetitions(request, {} as never);
    await controller.getCompetition(request, "competition-1");

    for (const read of [service.listCompetitions, service.getCompetitionDetail]) {
      expect(read).toHaveBeenCalledWith(expect.objectContaining({
        actorActionScope: { assignedStoreIds: ["manager-store"] },
      }));
    }
  });
});
