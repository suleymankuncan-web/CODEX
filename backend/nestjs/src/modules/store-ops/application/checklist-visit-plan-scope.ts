import type { AuthReadScope } from "../../auth/auth-context.service";
import type { ChecklistVisitPlanView } from "./checklist-visit-plan.contract";

export type ChecklistVisitPlanScope = AuthReadScope & {
  view: ChecklistVisitPlanView;
  canMaintain: boolean;
};

type Input = {
  actorRoleCodes: readonly string[];
  actorReadScope: AuthReadScope;
  roleScopes?: Record<string, AuthReadScope>;
};

export function resolveChecklistVisitPlanScope(input: Input): ChecklistVisitPlanScope | null {
  if (input.actorRoleCodes.includes("REPORT_VIEWER")) {
    return scope("report_viewer", input.roleScopes?.REPORT_VIEWER, false, "company");
  }
  if (input.actorRoleCodes.includes("REGION_MANAGER")) {
    // Region Manager planning is authorized by the direct action-store
    // portfolio. Legacy/route region ids are only selectors and must never
    // become a grant through this scope resolver.
    return scope("region_manager", input.roleScopes?.REGION_MANAGER, true, "store");
  }
  if (input.actorRoleCodes.includes("STORE_MANAGER")) {
    return scope("store_manager", input.roleScopes?.STORE_MANAGER, false, "store");
  }
  return null;
}

function scope(
  view: ChecklistVisitPlanView,
  source: AuthReadScope | undefined,
  canMaintain: boolean,
  boundary: "company" | "store",
): ChecklistVisitPlanScope {
  return {
    view,
    companyIds: boundary === "company" ? unique(source?.companyIds ?? []) : [],
    regionIds: [],
    storeIds: boundary === "store" ? unique(source?.storeIds ?? []) : [],
    canMaintain,
  };
}

function unique(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))];
}
