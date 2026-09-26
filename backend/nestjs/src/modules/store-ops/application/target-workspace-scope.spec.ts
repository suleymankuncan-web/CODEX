import { resolveTargetWorkspaceScope } from "./target-workspace-scope";

// Traceability: TGT-FR-001/005, NFR-005, AC-TGT-001/003, EC-017/022.

const empty = { companyIds: [], regionIds: [], storeIds: [] };

describe("resolveTargetWorkspaceScope", () => {
  it("uses only the dedicated Report Viewer company scope and disables writes", () => {
    expect(resolveTargetWorkspaceScope({
      actorRoleCodes: ["REPORT_VIEWER", "REGION_MANAGER"],
      actorReadScope: { companyIds: ["aggregate-company"], regionIds: ["aggregate-region"], storeIds: ["aggregate-store"] },
      actorActionScope: { assignedStoreIds: ["manager-store"] },
      roleScopes: {
        REPORT_VIEWER: { companyIds: ["viewer-company", "viewer-company"], regionIds: ["ignored-region"], storeIds: ["ignored-store"] },
        REGION_MANAGER: { companyIds: [], regionIds: ["manager-region"], storeIds: ["manager-store"] },
      },
    })).toEqual({
      view: "report_viewer",
      readScope: { companyIds: ["viewer-company"], regionIds: [], storeIds: [] },
      actionableStoreIds: [],
      capabilities: { canCreateRequest: false, canApproveRequest: false },
    });
  });

  it("limits a Region Manager read and approval scope to exact assigned stores", () => {
    expect(resolveTargetWorkspaceScope({
      actorRoleCodes: ["REGION_MANAGER"],
      actorReadScope: { companyIds: ["company"], regionIds: ["broad-region"], storeIds: [] },
      actorActionScope: { assignedStoreIds: ["store-b", "store-a", "store-a"] },
      roleScopes: { REGION_MANAGER: { companyIds: ["company"], regionIds: ["broad-region"], storeIds: ["store-a", "store-b"] } },
    })).toEqual({
      view: "region_manager",
      readScope: { companyIds: [], regionIds: [], storeIds: ["store-a", "store-b"] },
      actionableStoreIds: ["store-a", "store-b"],
      capabilities: { canCreateRequest: false, canApproveRequest: true },
    });
  });

  it("intersects Store Manager role stores with assigned action stores", () => {
    expect(resolveTargetWorkspaceScope({
      actorRoleCodes: ["STORE_MANAGER"],
      actorReadScope: { companyIds: ["company"], regionIds: ["region"], storeIds: ["own-store", "leaked-store"] },
      actorActionScope: { assignedStoreIds: ["own-store", "support-store"] },
      roleScopes: { STORE_MANAGER: { companyIds: [], regionIds: [], storeIds: ["own-store"] } },
    })).toEqual({
      view: "store_manager",
      readScope: { companyIds: [], regionIds: [], storeIds: ["own-store"] },
      actionableStoreIds: ["own-store"],
      capabilities: { canCreateRequest: true, canApproveRequest: false },
    });
  });

  it("fails closed when a dedicated persona scope is missing", () => {
    expect(resolveTargetWorkspaceScope({
      actorRoleCodes: ["REPORT_VIEWER"], actorReadScope: empty,
      actorActionScope: { assignedStoreIds: ["store"] }, roleScopes: undefined,
    })?.readScope).toEqual(empty);
    expect(resolveTargetWorkspaceScope({
      actorRoleCodes: ["STORE_MANAGER"], actorReadScope: { ...empty, storeIds: ["store"] },
      actorActionScope: { assignedStoreIds: ["store"] }, roleScopes: undefined,
    })?.readScope).toEqual(empty);
    expect(resolveTargetWorkspaceScope({
      actorRoleCodes: ["REGION_MANAGER"], actorReadScope: { ...empty, regionIds: ["region"] },
      actorActionScope: { assignedStoreIds: ["store"] }, roleScopes: undefined,
    })?.readScope).toEqual(empty);
  });

  it("intersects aggregate action stores with explicit Region Manager role stores", () => {
    expect(resolveTargetWorkspaceScope({
      actorRoleCodes: ["REGION_MANAGER", "STORE_MANAGER"], actorReadScope: empty,
      actorActionScope: { assignedStoreIds: ["manager-store", "own-store"] },
      roleScopes: {
        REGION_MANAGER: { companyIds: [], regionIds: [], storeIds: ["manager-store"] },
        STORE_MANAGER: { companyIds: [], regionIds: [], storeIds: ["own-store"] },
      },
    })?.readScope).toEqual({ companyIds: [], regionIds: [], storeIds: ["manager-store"] });
  });

  it("rejects roles outside the Targets workspace", () => {
    expect(resolveTargetWorkspaceScope({
      actorRoleCodes: ["STORE_PERSONNEL"], actorReadScope: empty,
      actorActionScope: { assignedStoreIds: [] }, roleScopes: {},
    })).toBeNull();
  });
});
