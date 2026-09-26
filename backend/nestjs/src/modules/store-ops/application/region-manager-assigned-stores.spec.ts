import { resolveRegionManagerAssignedStoreIds, resolveReportingReadScope } from "./region-manager-assigned-stores";

describe("Region Manager assigned store scope", () => {
  it("excludes stores contributed only by another role on the same profile", () => {
    expect(resolveRegionManagerAssignedStoreIds({
      roleCodes: ["REGION_MANAGER", "STORE_MANAGER"],
      roleScopes: { REGION_MANAGER: { storeIds: ["manager-store"] } },
      assignedStoreIds: ["manager-store", "store-manager-only"],
    })).toEqual(["manager-store"]);
  });

  it("fails closed without the Region Manager profile assignment", () => {
    expect(resolveRegionManagerAssignedStoreIds({
      roleCodes: ["REGION_MANAGER"], assignedStoreIds: ["legacy-store"],
    })).toEqual([]);
  });

  it("does not let an independent Report Viewer role broaden manager action stores", () => {
    expect(resolveRegionManagerAssignedStoreIds({
      roleCodes: ["REGION_MANAGER", "REPORT_VIEWER"],
      roleScopes: { REGION_MANAGER: { storeIds: ["manager-store"] } },
      assignedStoreIds: ["manager-store", "other-role-store"],
    })).toEqual(["manager-store"]);
  });

  it("preserves the Super Admin's independent action scope", () => {
    expect(resolveRegionManagerAssignedStoreIds({
      roleCodes: ["REGION_MANAGER", "SUPER_ADMIN"],
      assignedStoreIds: ["admin-store"],
    })).toEqual(["admin-store"]);
  });

  it("does not use a legacy region or another role's store as manager read authority", () => {
    expect(resolveReportingReadScope({
      roleCodes: ["REGION_MANAGER", "STORE_MANAGER"],
      scope: { companyIds: [], regionIds: ["legacy-region"], storeIds: ["other-store"] },
      roleScopes: { REGION_MANAGER: { companyIds: [], regionIds: [], storeIds: ["manager-store"] } },
      actionScope: { assignedStoreIds: ["manager-store", "other-store"] },
    })).toEqual({ companyIds: [], regionIds: [], storeIds: ["manager-store"] });
  });
});
