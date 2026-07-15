import type { AuthReadScope } from "../../auth/auth-context.service";

export type ChecklistCommandView =
  | "report_viewer"
  | "region_manager"
  | "store_manager"
  | "visual_merchandiser"
  | "super_admin";

export type ChecklistCommandReadScope = AuthReadScope & {
  view: ChecklistCommandView;
  allowedTemplateTypes: Array<"BM_STORE_VISIT" | "VM_STORE_VISIT">;
};

type ResolveChecklistCommandReadScopeInput = {
  actorRoleCodes: readonly string[];
  actorReadScope: AuthReadScope;
  roleScopes?: Record<string, AuthReadScope>;
};

const BOTH_VISIT_TYPES = ["BM_STORE_VISIT", "VM_STORE_VISIT"] as const;

export function resolveChecklistCommandReadScope(
  input: ResolveChecklistCommandReadScopeInput,
): ChecklistCommandReadScope | null {
  if (input.actorRoleCodes.includes("REPORT_VIEWER")) {
    const roleScope = input.roleScopes?.REPORT_VIEWER;
    return {
      view: "report_viewer",
      companyIds: unique(roleScope?.companyIds ?? []),
      regionIds: [],
      storeIds: [],
      allowedTemplateTypes: [...BOTH_VISIT_TYPES],
    };
  }

  if (input.actorRoleCodes.includes("REGION_MANAGER")) {
    const roleScope = input.roleScopes?.REGION_MANAGER;
    return {
      view: "region_manager",
      companyIds: [],
      regionIds: unique(roleScope?.regionIds ?? []),
      storeIds: unique(roleScope?.storeIds ?? []),
      allowedTemplateTypes: [...BOTH_VISIT_TYPES],
    };
  }

  if (input.actorRoleCodes.includes("SUPER_ADMIN")) {
    return {
      view: "super_admin",
      companyIds: unique(input.actorReadScope.companyIds),
      regionIds: unique(input.actorReadScope.regionIds),
      storeIds: unique(input.actorReadScope.storeIds),
      allowedTemplateTypes: [...BOTH_VISIT_TYPES],
    };
  }

  if (input.actorRoleCodes.includes("STORE_MANAGER")) {
    const roleScope = input.roleScopes?.STORE_MANAGER;
    return {
      view: "store_manager",
      companyIds: [],
      regionIds: [],
      storeIds: unique(roleScope?.storeIds ?? []),
      allowedTemplateTypes: [...BOTH_VISIT_TYPES],
    };
  }

  if (input.actorRoleCodes.includes("VISUAL_MERCHANDISER")) {
    const roleScope = input.roleScopes?.VISUAL_MERCHANDISER;
    return {
      view: "visual_merchandiser",
      companyIds: [],
      regionIds: unique(roleScope?.regionIds ?? []),
      storeIds: unique(roleScope?.storeIds ?? []),
      allowedTemplateTypes: ["VM_STORE_VISIT"],
    };
  }

  return null;
}

function unique(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))];
}
