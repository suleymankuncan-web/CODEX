import { resolveReportViewerCompanyScope } from "./report-viewer-company-scope";

describe("resolveReportViewerCompanyScope", () => {
  const actorScope = {
    companyIds: ["company-from-manager"],
    regionIds: ["region-from-manager"],
    storeIds: ["store-from-manager"],
  };

  it("uses only the Report Viewer role company assignment", () => {
    expect(
      resolveReportViewerCompanyScope({
        actorRoleCodes: ["STORE_MANAGER", "REPORT_VIEWER"],
        actorScope,
        roleScopes: {
          REPORT_VIEWER: {
            companyIds: ["company-a", "company-a"],
            regionIds: ["region-should-not-apply"],
            storeIds: ["store-should-not-apply"],
          },
        },
      }),
    ).toEqual({
      companyIds: ["company-a"],
      regionIds: [],
      storeIds: [],
    });
  });

  it("fails closed when the role-specific company scope is empty", () => {
    expect(
      resolveReportViewerCompanyScope({
        actorRoleCodes: ["REPORT_VIEWER"],
        actorScope,
        roleScopes: {
          REPORT_VIEWER: {
            companyIds: [],
            regionIds: ["region-1"],
            storeIds: ["store-1"],
          },
        },
      }),
    ).toEqual({ companyIds: [], regionIds: [], storeIds: [] });
  });

  it("does not change non-Report-Viewer scope resolution", () => {
    expect(
      resolveReportViewerCompanyScope({
        actorRoleCodes: ["REGION_MANAGER"],
        actorScope,
        roleScopes: {
          REPORT_VIEWER: {
            companyIds: ["company-a"],
            regionIds: [],
            storeIds: [],
          },
        },
      }),
    ).toBe(actorScope);
  });
});
