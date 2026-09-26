import { resolveChecklistOperationalHistoryScope } from "./checklist-operational-history-scope";

describe("resolveChecklistOperationalHistoryScope", () => {
  const empty = { companyIds: [], regionIds: [], storeIds: [] };
  const actorReadScope = { companyIds: ["aggregate-company"], regionIds: ["aggregate-region"], storeIds: ["aggregate-store"] };

  it("keeps mixed Report Viewer sessions inside the explicit company role scope", () => {
    expect(resolveChecklistOperationalHistoryScope({
      actorRoleCodes: ["REGION_MANAGER", "REPORT_VIEWER"],
      actorReadScope,
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

  it("uses the Super Admin company scope for the Report Viewer presentation", () => {
    expect(resolveChecklistOperationalHistoryScope({
      actorRoleCodes: ["SUPER_ADMIN"],
      actorReadScope: { ...empty, companyIds: ["company-admin"] },
      roleScopes: { SUPER_ADMIN: { ...empty, companyIds: ["company-admin"] } },
    })).toEqual({
      view: "report_viewer",
      companyIds: ["company-admin"],
      regionIds: [],
      storeIds: [],
    });
  });

  it("uses only Region Manager assigned stores, never the legacy region scope", () => {
    expect(resolveChecklistOperationalHistoryScope({
      actorRoleCodes: ["REGION_MANAGER"],
      actorReadScope,
      roleScopes: { REGION_MANAGER: { companyIds: ["ignored"], regionIds: ["region-a"], storeIds: ["store-a"] } },
    })).toEqual({ view: "region_manager", companyIds: [], regionIds: [], storeIds: ["store-a"] });
  });

  it("uses only Store Manager stores and rejects unsupported personas", () => {
    expect(resolveChecklistOperationalHistoryScope({
      actorRoleCodes: ["STORE_MANAGER"],
      actorReadScope,
      roleScopes: { STORE_MANAGER: { companyIds: ["ignored"], regionIds: ["ignored"], storeIds: ["store-a"] } },
    })).toEqual({ view: "store_manager", companyIds: [], regionIds: [], storeIds: ["store-a"] });
    expect(resolveChecklistOperationalHistoryScope({ actorRoleCodes: ["VISUAL_MERCHANDISER"], actorReadScope })).toBeNull();
    expect(resolveChecklistOperationalHistoryScope({ actorRoleCodes: ["HR_ADMIN"], actorReadScope })).toBeNull();
  });
});
