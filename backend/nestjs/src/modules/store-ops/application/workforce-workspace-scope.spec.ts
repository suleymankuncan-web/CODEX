import { resolveWorkforceWorkspaceScope } from "./workforce-workspace-scope";

const empty = { companyIds: [], regionIds: [], storeIds: [] };

describe("resolveWorkforceWorkspaceScope", () => {
  it("keeps mixed Report Viewer sessions company-scoped and read-only", () => {
    const result = resolveWorkforceWorkspaceScope({
      actorRoleCodes: ["REPORT_VIEWER", "STORE_MANAGER"],
      actorReadScope: empty,
      actorActionScope: { assignedStoreIds: ["store-action"] },
      roleScopes: {
        REPORT_VIEWER: { companyIds: ["company-a"], regionIds: [], storeIds: [] },
        STORE_MANAGER: { companyIds: [], regionIds: [], storeIds: ["store-action"] },
      },
    });

    expect(result).toEqual({
      view: "report_viewer",
      readScope: { companyIds: ["company-a"], regionIds: [], storeIds: [] },
      actionableStoreIds: [],
      capabilities: {
        canCreateSellerCodeRequest: false,
        canCreateOffboardingRequest: false,
      },
    });
  });

  it("opens a Store Manager directly in the intersection of role and action scope", () => {
    const result = resolveWorkforceWorkspaceScope({
      actorRoleCodes: ["STORE_MANAGER"],
      actorReadScope: { companyIds: [], regionIds: [], storeIds: ["store-a", "store-b"] },
      actorActionScope: { assignedStoreIds: ["store-b", "store-c"] },
      roleScopes: {
        STORE_MANAGER: { companyIds: [], regionIds: [], storeIds: ["store-a", "store-b"] },
      },
    });

    expect(result?.readScope.storeIds).toEqual(["store-b"]);
    expect(result?.capabilities).toEqual({
      canCreateSellerCodeRequest: true,
      canCreateOffboardingRequest: true,
    });
  });

  it("never widens a Region Manager workspace to company scope", () => {
    const result = resolveWorkforceWorkspaceScope({
      actorRoleCodes: ["REGION_MANAGER"],
      actorReadScope: { companyIds: ["company-a"], regionIds: ["region-a"], storeIds: [] },
      actorActionScope: { assignedStoreIds: ["store-a"] },
      roleScopes: {
        REGION_MANAGER: { companyIds: ["company-a"], regionIds: ["region-a"], storeIds: [] },
      },
    });

    expect(result?.readScope).toEqual({
      companyIds: [],
      regionIds: ["region-a"],
      storeIds: ["store-a"],
    });
  });

  it("returns no workspace for unsupported roles", () => {
    expect(resolveWorkforceWorkspaceScope({
      actorRoleCodes: ["HR_ADMIN"],
      actorReadScope: empty,
      actorActionScope: { assignedStoreIds: [] },
    })).toBeNull();
  });
});
