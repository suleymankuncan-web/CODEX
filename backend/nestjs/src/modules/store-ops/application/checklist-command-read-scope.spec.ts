import { resolveChecklistCommandReadScope } from "./checklist-command-read-scope";

describe("resolveChecklistCommandReadScope", () => {
  it("keeps a mixed Report Viewer session inside the Report Viewer company role scope", () => {
    expect(
      resolveChecklistCommandReadScope({
        actorRoleCodes: ["REPORT_VIEWER", "REGION_MANAGER"],
        actorReadScope: {
          companyIds: ["aggregate-company"],
          regionIds: ["aggregate-region"],
          storeIds: ["aggregate-store"],
        },
        roleScopes: {
          REPORT_VIEWER: {
            companyIds: ["viewer-company"],
            regionIds: ["viewer-region-must-not-leak"],
            storeIds: ["viewer-store-must-not-leak"],
          },
          REGION_MANAGER: {
            companyIds: ["manager-company"],
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
      allowedTemplateTypes: ["BM_STORE_VISIT", "VM_STORE_VISIT"],
    });
  });

  it("uses only the Region Manager role scope for a Region Manager view", () => {
    expect(
      resolveChecklistCommandReadScope({
        actorRoleCodes: ["REGION_MANAGER"],
        actorReadScope: {
          companyIds: ["aggregate-company"],
          regionIds: ["aggregate-region"],
          storeIds: ["aggregate-store"],
        },
        roleScopes: {
          REGION_MANAGER: {
            companyIds: ["manager-company"],
            regionIds: ["manager-region"],
            storeIds: ["manager-store"],
          },
        },
      }),
    ).toEqual({
      view: "region_manager",
      companyIds: [],
      regionIds: ["manager-region"],
      storeIds: ["manager-store"],
      allowedTemplateTypes: ["BM_STORE_VISIT", "VM_STORE_VISIT"],
    });
  });

  it.each([
    ["STORE_MANAGER", "store_manager", ["BM_STORE_VISIT", "VM_STORE_VISIT"]],
    ["VISUAL_MERCHANDISER", "visual_merchandiser", ["VM_STORE_VISIT"]],
  ] as const)("uses the %s role scope without widening it", (role, view, templateTypes) => {
    expect(
      resolveChecklistCommandReadScope({
        actorRoleCodes: [role],
        actorReadScope: {
          companyIds: ["aggregate-company"],
          regionIds: ["aggregate-region"],
          storeIds: ["aggregate-store"],
        },
        roleScopes: {
          [role]: {
            companyIds: ["role-company"],
            regionIds: ["role-region"],
            storeIds: ["role-store"],
          },
        },
      }),
    ).toEqual({
      view,
      companyIds: [],
      regionIds: role === "VISUAL_MERCHANDISER" ? ["role-region"] : [],
      storeIds: ["role-store"],
      allowedTemplateTypes: templateTypes,
    });
  });

  it("uses the authenticated read scope for a Super Admin-only session", () => {
    expect(
      resolveChecklistCommandReadScope({
        actorRoleCodes: ["SUPER_ADMIN"],
        actorReadScope: {
          companyIds: ["admin-company"],
          regionIds: [],
          storeIds: [],
        },
      }),
    ).toEqual({
      view: "super_admin",
      companyIds: ["admin-company"],
      regionIds: [],
      storeIds: [],
      allowedTemplateTypes: ["BM_STORE_VISIT", "VM_STORE_VISIT"],
    });
  });

  it("keeps a mixed Super Admin and Store Manager session in the Super Admin view", () => {
    expect(
      resolveChecklistCommandReadScope({
        actorRoleCodes: ["SUPER_ADMIN", "STORE_MANAGER"],
        actorReadScope: {
          companyIds: ["admin-company"],
          regionIds: ["admin-region"],
          storeIds: ["admin-store"],
        },
        roleScopes: {
          STORE_MANAGER: {
            companyIds: [],
            regionIds: [],
            storeIds: ["manager-store-must-not-win"],
          },
        },
      }),
    ).toEqual({
      view: "super_admin",
      companyIds: ["admin-company"],
      regionIds: ["admin-region"],
      storeIds: ["admin-store"],
      allowedTemplateTypes: ["BM_STORE_VISIT", "VM_STORE_VISIT"],
    });
  });
});
