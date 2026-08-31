import { resolveChecklistVisitPlanScope } from "./checklist-visit-plan-scope";

describe("resolveChecklistVisitPlanScope", () => {
  const empty = { companyIds: [], regionIds: [], storeIds: [] };

  it("keeps Report Viewer company-wide and read-only", () => {
    expect(
      resolveChecklistVisitPlanScope({
        actorRoleCodes: ["REPORT_VIEWER", "REGION_MANAGER"],
        actorReadScope: empty,
        roleScopes: {
          REPORT_VIEWER: { ...empty, companyIds: ["company-1"] },
          REGION_MANAGER: { ...empty, regionIds: ["region-1"] },
        },
      }),
    ).toEqual({
      view: "report_viewer",
      companyIds: ["company-1"],
      regionIds: [],
      storeIds: [],
      canMaintain: false,
    });
  });

  it("allows a Region Manager to maintain only direct assigned stores", () => {
    expect(
      resolveChecklistVisitPlanScope({
        actorRoleCodes: ["REGION_MANAGER"],
        actorReadScope: empty,
        roleScopes: {
          REGION_MANAGER: { ...empty, regionIds: ["forged-region"], storeIds: ["store-1", "store-1"] },
        },
      }),
    ).toEqual({
      view: "region_manager",
      companyIds: [],
      regionIds: [],
      storeIds: ["store-1"],
      canMaintain: true,
    });
  });

  it("keeps Store Manager own-store read-only and rejects unsupported roles", () => {
    expect(
      resolveChecklistVisitPlanScope({
        actorRoleCodes: ["STORE_MANAGER"],
        actorReadScope: empty,
        roleScopes: { STORE_MANAGER: { ...empty, storeIds: ["store-1"] } },
      }),
    ).toMatchObject({ view: "store_manager", storeIds: ["store-1"], canMaintain: false });
    expect(
      resolveChecklistVisitPlanScope({
        actorRoleCodes: ["VISUAL_MERCHANDISER"],
        actorReadScope: empty,
      }),
    ).toBeNull();
  });
});
