import type { AuthReadScope } from "../../auth/auth-context.service";
import {
  resolveStoreReportViewerRole,
  storeReportViewerCompanyIds,
} from "./store-report-viewer-role";

export type ChecklistOperationalHistoryView =
  | "report_viewer"
  | "region_manager"
  | "store_manager";

export type ChecklistOperationalHistoryScope = AuthReadScope & {
  view: ChecklistOperationalHistoryView;
};

type ResolveInput = {
  actorRoleCodes: readonly string[];
  actorReadScope: AuthReadScope;
  roleScopes?: Record<string, AuthReadScope>;
};

export function resolveChecklistOperationalHistoryScope(
  input: ResolveInput,
): ChecklistOperationalHistoryScope | null {
  const reportRole = resolveStoreReportViewerRole(input.actorRoleCodes);
  if (reportRole) {
    return {
      view: "report_viewer",
      companyIds: storeReportViewerCompanyIds(input, reportRole),
      regionIds: [],
      storeIds: [],
    };
  }
  if (input.actorRoleCodes.includes("REGION_MANAGER")) {
    return scoped("region_manager", input.roleScopes?.REGION_MANAGER, "region_store");
  }
  if (input.actorRoleCodes.includes("STORE_MANAGER")) {
    return scoped("store_manager", input.roleScopes?.STORE_MANAGER, "store");
  }
  return null;
}
function scoped(
  view: ChecklistOperationalHistoryView,
  scope: AuthReadScope | undefined,
  mode: "region_store" | "store",
): ChecklistOperationalHistoryScope {
  return {
    view,
    companyIds: [],
    regionIds: mode === "region_store" ? unique(scope?.regionIds ?? []) : [],
    storeIds: mode === "region_store" || mode === "store" ? unique(scope?.storeIds ?? []) : [],
  };
}

function unique(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))];
}
