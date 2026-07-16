import { resolveRankingScopePolicy } from "./ranking-scope-policy";
import { applyStoreFilters } from "./ranking-list.helpers";

describe("ranking scope policy", () => {
  const base = {
    companyIds: [] as string[],
    regionIds: [] as string[],
    storeIds: [] as string[],
    assignedStoreIds: [] as string[],
  };

  it("EC-002 fails a Report Viewer without company scope closed", () => {
    expect(resolveRankingScopePolicy({ ...base, roleCodes: ["REPORT_VIEWER"] })).toEqual({
      enforceAssignedReadScope: false,
      failClosed: true,
    });
  });

  it("EC-001 keeps Report Viewer precedence for mixed-role identities", () => {
    expect(resolveRankingScopePolicy({
      ...base,
      roleCodes: ["REPORT_VIEWER", "SUPER_ADMIN"],
    }).failClosed).toBe(true);
  });

  it("EC-002 fails a Region Manager without an authenticated assignment closed", () => {
    expect(resolveRankingScopePolicy({ ...base, roleCodes: ["REGION_MANAGER"] })).toEqual({
      enforceAssignedReadScope: true,
      failClosed: true,
    });
  });

  it("allows global Super Admin reads and enforces assigned Region Manager reads", () => {
    expect(resolveRankingScopePolicy({ ...base, roleCodes: ["SUPER_ADMIN"] })).toEqual({
      enforceAssignedReadScope: false,
      failClosed: false,
    });
    expect(resolveRankingScopePolicy({
      ...base,
      roleCodes: ["REGION_MANAGER"],
      assignedStoreIds: ["store-1"],
    })).toEqual({
      enforceAssignedReadScope: true,
      failClosed: false,
    });
  });

  it("enforces assigned stores without requiring a manager query parameter", () => {
    const row = (storeId: string) => ({
      subject: "store" as const, storeId, storeName: storeId, regionId: "region-1",
      regionName: "Region", regionManagerUserId: "manager-1", regionManagerName: "Manager",
      rank: 1, population: 2, scoreValue: 80, visibility: "detail" as const, metrics: [],
    });

    expect(applyStoreFilters([row("store-1"), row("store-2")], {
      assignedStoreIds: ["store-2"], enforceAssignedReadScope: true,
    }).map((candidate) => candidate.storeId)).toEqual(["store-2"]);
  });
});
