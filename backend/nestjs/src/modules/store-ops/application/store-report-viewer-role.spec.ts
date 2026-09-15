import { resolveChecklistCommandReadScope } from "./checklist-command-read-scope";
import { resolveChecklistOperationalHistoryScope } from "./checklist-operational-history-scope";
import { resolveTargetWorkspaceScope } from "./target-workspace-scope";
import { resolveTaskCommandWorkspaceScope } from "./task-command-workspace-scope";
import { resolveWorkforceWorkspaceScope } from "./workforce-workspace-scope";

const readScope = { companyIds: ["admin-company"], regionIds: [], storeIds: [] };
const input = {
  actorRoleCodes: ["SUPER_ADMIN"], actorReadScope: readScope,
  actorActionScope: { assignedStoreIds: ["assigned-store"], assignedStoreTypes: ["company"] },
  roleScopes: { SUPER_ADMIN: readScope },
};
const resolvers = {
  checklist: resolveChecklistCommandReadScope,
  checklistHistory: resolveChecklistOperationalHistoryScope,
  targets: resolveTargetWorkspaceScope,
  tasks: resolveTaskCommandWorkspaceScope,
  workforce: resolveWorkforceWorkspaceScope,
};

describe.each(Object.entries(resolvers))("Admin Store %s read presentation", (_name, resolve) => {
  it("uses the same view and company data as Report Viewer without adding a role", () => {
    const admin = resolve(input);
    const viewer = resolve({ ...input, actorRoleCodes: ["REPORT_VIEWER"], roleScopes: { REPORT_VIEWER: readScope } });
    expect(admin).toEqual(viewer);
    expect(admin?.view).toBe("report_viewer");
    if (admin && "capabilities" in admin) expect(Object.values(admin.capabilities).every(value => value === false)).toBe(true);
    expect(input.actorRoleCodes).toEqual(["SUPER_ADMIN"]);
  });

  it("keeps a mixed operational role out of the admin company boundary", () => {
    expect(resolve({ ...input, actorRoleCodes: ["SUPER_ADMIN", "REGION_MANAGER"], roleScopes: {
      SUPER_ADMIN: readScope,
      REGION_MANAGER: { companyIds: ["other-company"], regionIds: ["other-region"], storeIds: ["assigned-store"] },
    } })).toEqual(resolve(input));
  });

  it("preserves the Report Viewer role scope when both roles exist", () => {
    const viewerScope = { companyIds: ["viewer-company"], regionIds: [], storeIds: [] };
    expect(resolve({ ...input, actorRoleCodes: ["SUPER_ADMIN", "REPORT_VIEWER"], roleScopes: {
      SUPER_ADMIN: readScope, REPORT_VIEWER: viewerScope,
    } })).toEqual(resolve({ ...input, actorRoleCodes: ["REPORT_VIEWER"], roleScopes: { REPORT_VIEWER: viewerScope } }));
  });

  it("fails closed for a mixed admin whose own scope is missing", () => {
    const result = resolve({ ...input, actorRoleCodes: ["SUPER_ADMIN", "STORE_MANAGER"], roleScopes: {
      STORE_MANAGER: { companyIds: ["other-company"], regionIds: [], storeIds: ["assigned-store"] },
    } });
    if (result) {
      expect(result.view).toBe("report_viewer");
      expect("readScope" in result ? result.readScope.companyIds : result.companyIds).toEqual([]);
    } else expect(result).toBeNull();
  });

  it("does not treat HR Admin as Super Admin", () => {
    expect(resolve({ ...input, actorRoleCodes: ["HR_ADMIN"] })).toBeNull();
  });
});
