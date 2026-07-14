import type { AuthReadScope } from "../../auth/auth-context.service";

export type ChecklistOperationalHistoryView =
  | "report_viewer"
  | "region_manager"
  | "store_manager";

export type ChecklistOperationalHistoryScope = AuthReadScope & {
  view: ChecklistOperationalHistoryView;
};

type ResolveInput = {
  actorRoleCodes: readonly string[];
  roleScopes?: Record<string, AuthReadScope>;
};

export function resolveChecklistOperationalHistoryScope(
  input: ResolveInput,
): ChecklistOperationalHistoryScope | null {
  if (input.actorRoleCodes.includes("REPORT_VIEWER")) {
    return scoped("report_viewer", input.roleScopes?.REPORT_VIEWER, "company");
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
  mode: "company" | "region_store" | "store",
): ChecklistOperationalHistoryScope {
  return {
    view,
    companyIds: mode === "company" ? unique(scope?.companyIds ?? []) : [],
    regionIds: mode === "region_store" ? unique(scope?.regionIds ?? []) : [],
    storeIds: mode === "region_store" || mode === "store" ? unique(scope?.storeIds ?? []) : [],
  };
}

function unique(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))];
}
