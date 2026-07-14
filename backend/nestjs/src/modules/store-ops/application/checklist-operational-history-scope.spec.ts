import { resolveChecklistOperationalHistoryScope } from "./checklist-operational-history-scope";

describe("resolveChecklistOperationalHistoryScope", () => {
  const empty = { companyIds: [], regionIds: [], storeIds: [] };

  it("keeps mixed Report Viewer sessions inside the explicit company role scope", () => {
    expect(resolveChecklistOperationalHistoryScope({
      actorRoleCodes: ["REGION_MANAGER", "REPORT_VIEWER"],
      roleScopes: {
        REPORT_VIEWER: { ...empty, companyIds: ["company-a", "company-a"] },
        REGION_MANAGER: { ...empty, regionIds: ["region-b"], storeIds: ["store-b"] },
      },
    })).toEqual({
      view: "report_viewer",
      companyIds: ["company-a"],
      regionIds: [],
      storeIds: [],
    });
  });

  it("uses only Region Manager region and store scope", () => {
    expect(resolveChecklistOperationalHistoryScope({
      actorRoleCodes: ["REGION_MANAGER"],
      roleScopes: { REGION_MANAGER: { companyIds: ["ignored"], regionIds: ["region-a"], storeIds: ["store-a"] } },
    })).toEqual({ view: "region_manager", companyIds: [], regionIds: ["region-a"], storeIds: ["store-a"] });
  });

  it("uses only Store Manager stores and rejects unsupported personas", () => {
    expect(resolveChecklistOperationalHistoryScope({
      actorRoleCodes: ["STORE_MANAGER"],
      roleScopes: { STORE_MANAGER: { companyIds: ["ignored"], regionIds: ["ignored"], storeIds: ["store-a"] } },
    })).toEqual({ view: "store_manager", companyIds: [], regionIds: [], storeIds: ["store-a"] });
    expect(resolveChecklistOperationalHistoryScope({ actorRoleCodes: ["VISUAL_MERCHANDISER"] })).toBeNull();
    expect(resolveChecklistOperationalHistoryScope({ actorRoleCodes: ["SUPER_ADMIN"] })).toBeNull();
  });
});
