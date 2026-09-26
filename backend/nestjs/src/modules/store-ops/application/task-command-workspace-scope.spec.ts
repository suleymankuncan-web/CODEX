import { resolveTaskCommandWorkspaceScope } from "./task-command-workspace-scope";

const companyId = "11111111-1111-4111-8111-111111111111";
const regionId = "22222222-2222-4222-8222-222222222222";
const storeId = "33333333-3333-4333-8333-333333333333";

describe("resolveTaskCommandWorkspaceScope", () => {
  it("accepts directly assigned manager stores without requiring a region identifier", () => {
    const result = resolveTaskCommandWorkspaceScope({
      actorRoleCodes: ["REGION_MANAGER"],
      actorReadScope: { companyIds: [], regionIds: [], storeIds: [storeId] },
      actorActionScope: { assignedStoreIds: [storeId, "other-store"] },
      roleScopes: { REGION_MANAGER: { companyIds: [], regionIds: [], storeIds: [storeId] } },
    });
    expect(result).toEqual(expect.objectContaining({view:"region_manager",regionIds:[],storeIds:[storeId]}));
  });
  it("does not borrow another role's action stores for an empty manager role", () => {
    expect(resolveTaskCommandWorkspaceScope({
      actorRoleCodes: ["REGION_MANAGER","STORE_MANAGER"],
      actorReadScope: {companyIds:[],regionIds:[],storeIds:[storeId]},
      actorActionScope: {assignedStoreIds:[storeId]},
      roleScopes: {REGION_MANAGER:{companyIds:[],regionIds:[],storeIds:[]}},
    })).toBeNull();
  });
  it("keeps mixed Report Viewer sessions company scoped and read only", () => {
    expect(
      resolveTaskCommandWorkspaceScope({
        actorRoleCodes: ["REGION_MANAGER", "REPORT_VIEWER"],
        actorReadScope: { companyIds: [companyId], regionIds: [regionId], storeIds: [storeId] },
        actorActionScope: { assignedStoreIds: [storeId] },
        roleScopes: {
          REPORT_VIEWER: { companyIds: [companyId], regionIds: [], storeIds: [] },
          REGION_MANAGER: { companyIds: [companyId], regionIds: [regionId], storeIds: [storeId] },
        },
      }),
    ).toEqual({
      view: "report_viewer",
      companyIds: [companyId],
      regionIds: [],
      storeIds: [],
      capabilities: { canStart: false, canUpdate: false, canComplete: false, canCancel: false, canReview: false },
    });
  });

  it("uses the Region Manager role scope without granting mutations", () => {
    expect(
      resolveTaskCommandWorkspaceScope({
        actorRoleCodes: ["REGION_MANAGER"],
        actorReadScope: { companyIds: [companyId], regionIds: [regionId], storeIds: [storeId] },
        actorActionScope: { assignedStoreIds: [storeId] },
        roleScopes: {
          REGION_MANAGER: { companyIds: [companyId], regionIds: [regionId], storeIds: [storeId] },
        },
      }),
    ).toEqual({
      view: "region_manager",
      companyIds: [],
      regionIds: [],
      storeIds: [storeId],
      capabilities: { canStart: false, canUpdate: false, canComplete: false, canCancel: false, canReview: true },
    });
  });

  it("uses Store Manager action stores and exposes existing plan commands", () => {
    expect(
      resolveTaskCommandWorkspaceScope({
        actorRoleCodes: ["STORE_MANAGER"],
        actorReadScope: { companyIds: [companyId], regionIds: [], storeIds: [storeId] },
        actorActionScope: { assignedStoreIds: [storeId] },
      }),
    ).toEqual({
      view: "store_manager",
      companyIds: [],
      regionIds: [],
      storeIds: [storeId],
      capabilities: { canStart: true, canUpdate: true, canComplete: true, canCancel: true, canReview: false },
    });
  });

  it("fails closed when the resolved role scope is empty", () => {
    expect(
      resolveTaskCommandWorkspaceScope({
        actorRoleCodes: ["REPORT_VIEWER"],
        actorReadScope: { companyIds: [], regionIds: [], storeIds: [] },
        actorActionScope: { assignedStoreIds: [] },
      }),
    ).toBeNull();
  });

  it("does not borrow union read scope for a mixed role when role scope is missing", () => {
    expect(
      resolveTaskCommandWorkspaceScope({
        actorRoleCodes: ["STORE_MANAGER", "REPORT_VIEWER"],
        actorReadScope: { companyIds: [companyId], regionIds: [regionId], storeIds: [storeId] },
        actorActionScope: { assignedStoreIds: [storeId] },
      }),
    ).toBeNull();

    expect(
      resolveTaskCommandWorkspaceScope({
        actorRoleCodes: ["STORE_MANAGER", "REGION_MANAGER"],
        actorReadScope: { companyIds: [companyId], regionIds: [regionId], storeIds: [storeId] },
        actorActionScope: { assignedStoreIds: [storeId] },
      }),
    ).toBeNull();
  });
});
