import "reflect-metadata";
import { REQUIRED_ROLES_KEY } from "../../auth/decorators/roles.decorator";
import { REQUIRED_SCOPE_KEY } from "../../auth/decorators/scope.decorator";
import { ChecklistCommandController } from "./checklist-command.controller";

describe("ChecklistCommandController", () => {
  it("exposes region aggregates only to Report Viewer", async () => {
    const service = { list: jest.fn(), listRegions: jest.fn(async () => ({ data: "ok" })) };
    const controller = new ChecklistCommandController(service as never);
    const handler = ChecklistCommandController.prototype.listRegions;

    expect(Reflect.getMetadata(REQUIRED_SCOPE_KEY, handler)).toBe("authenticated");
    expect(Reflect.getMetadata(REQUIRED_ROLES_KEY, handler)).toEqual(["REPORT_VIEWER"]);

    await controller.listRegions(
      {
        user: {
          userId: "user-1",
          roleCodes: ["REPORT_VIEWER"],
          scope: { companyIds: ["aggregate-company"], regionIds: [], storeIds: [] },
          readScope: { companyIds: ["aggregate-company"], regionIds: [], storeIds: [] },
          actionScope: { assignedStoreIds: [] },
          assignedStoreIds: [],
          roleScopes: {
            REPORT_VIEWER: { companyIds: ["viewer-company"], regionIds: [], storeIds: [] },
          },
        },
      },
      { period: "2026-07", query: "Marmara", signal: "all", sort: "manager_asc", limit: 20, offset: 0 },
    );

    expect(service.listRegions).toHaveBeenCalledWith(expect.objectContaining({
      actorRoleCodes: ["REPORT_VIEWER"],
      roleScopes: {
        REPORT_VIEWER: { companyIds: ["viewer-company"], regionIds: [], storeIds: [] },
      },
      query: "Marmara",
    }));
  });

  it("exposes an authenticated read endpoint to the existing checklist personas", async () => {
    const service = { list: jest.fn(async () => ({ data: "ok" })) };
    const controller = new ChecklistCommandController(service as never);
    const handler = ChecklistCommandController.prototype.list;

    expect(Reflect.getMetadata(REQUIRED_SCOPE_KEY, handler)).toBe("authenticated");
    expect(Reflect.getMetadata(REQUIRED_ROLES_KEY, handler)).toEqual([
      "STORE_MANAGER",
      "SUPER_ADMIN",
      "REPORT_VIEWER",
      "REGION_MANAGER",
      "VISUAL_MERCHANDISER",
    ]);

    await controller.list(
      {
        user: {
          userId: "user-1",
          roleCodes: ["REPORT_VIEWER"],
          scope: { companyIds: ["aggregate-company"], regionIds: [], storeIds: [] },
          readScope: { companyIds: ["aggregate-company"], regionIds: [], storeIds: [] },
          actionScope: { assignedStoreIds: [] },
          assignedStoreIds: [],
          roleScopes: {
            REPORT_VIEWER: { companyIds: ["viewer-company"], regionIds: [], storeIds: [] },
          },
        },
      },
      { period: "2026-07", status: "all", sort: "store_asc", limit: 30, offset: 0 },
    );

    expect(service.list).toHaveBeenCalledWith(
      expect.objectContaining({
        actorRoleCodes: ["REPORT_VIEWER"],
        actorReadScope: { companyIds: ["aggregate-company"], regionIds: [], storeIds: [] },
        roleScopes: {
          REPORT_VIEWER: { companyIds: ["viewer-company"], regionIds: [], storeIds: [] },
        },
      }),
    );
  });
});
