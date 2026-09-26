import type { AuthReadScope } from "../../auth/auth-context.service";
import { resolveSalesTargetIncentiveWorkspaceScope } from "./sales-target-incentive-workspace-scope";

// Traceability: INC-FR-001/002/009, NFR-005/006, AC-INC-005/007, EC-001/017/022.

const aggregateScope: AuthReadScope = {
  companyIds: ["aggregate-company"],
  regionIds: ["aggregate-region"],
  storeIds: ["aggregate-store"],
};

describe("resolveSalesTargetIncentiveWorkspaceScope", () => {
  it("uses the Report Viewer company role scope and removes aggregate role leakage", () => {
    expect(
      resolveSalesTargetIncentiveWorkspaceScope({
        actorRoleCodes: ["REPORT_VIEWER", "REGION_MANAGER"],
        actorReadScope: aggregateScope,
        roleScopes: {
          REPORT_VIEWER: {
            companyIds: ["viewer-company", "viewer-company"],
            regionIds: ["viewer-region"],
            storeIds: ["viewer-store"],
          },
          REGION_MANAGER: {
            companyIds: [],
            regionIds: ["manager-region"],
            storeIds: ["manager-store"],
          },
        },
      }),
    ).toEqual({
      view: "report_viewer",
      companyIds: ["viewer-company"],
      regionIds: [],
      storeIds: [],
      capabilities: {
        canMarkStoreReview: false,
        canCreateCorrection: false,
        canVoidCorrection: false,
        canSubmitPackage: false,
      },
    });
  });

  it("fails closed when Report Viewer has no dedicated company role scope", () => {
    expect(
      resolveSalesTargetIncentiveWorkspaceScope({
        actorRoleCodes: ["REPORT_VIEWER"],
        actorReadScope: aggregateScope,
      }),
    ).toEqual({
      view: "report_viewer",
      companyIds: [],
      regionIds: [],
      storeIds: [],
      capabilities: {
        canMarkStoreReview: false,
        canCreateCorrection: false,
        canVoidCorrection: false,
        canSubmitPackage: false,
      },
    });
  });

  it("uses only Region Manager role-scoped stores and leaves action truth to the scoped projection", () => {
    expect(
      resolveSalesTargetIncentiveWorkspaceScope({
        actorRoleCodes: ["REGION_MANAGER"],
        actorReadScope: aggregateScope,
        roleScopes: {
          REGION_MANAGER: {
            companyIds: ["manager-company"],
            regionIds: ["manager-region"],
            storeIds: ["manager-store", "manager-store"],
          },
        },
      }),
    ).toEqual({
      view: "region_manager",
      companyIds: [],
      regionIds: [],
      storeIds: ["manager-store"],
      capabilities: {
        canMarkStoreReview: false,
        canCreateCorrection: false,
        canVoidCorrection: false,
        canSubmitPackage: false,
      },
    });
  });

  it("rejects roles outside the Incentives workspace", () => {
    expect(
      resolveSalesTargetIncentiveWorkspaceScope({
        actorRoleCodes: ["STORE_MANAGER"],
        actorReadScope: aggregateScope,
      }),
    ).toBeNull();
  });

});
