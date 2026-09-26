import { resolveReportViewerCompanyScope } from "./report-viewer-company-scope";

type RoleScope = { storeIds: readonly string[] };
type ReadScope = { companyIds: string[]; regionIds: string[]; storeIds: string[] };

export function resolveRegionManagerAssignedStoreIds(input: {
  roleCodes: readonly string[];
  roleScopes?: Record<string, RoleScope>;
  assignedStoreIds: readonly string[];
}) {
  const assigned = [...new Set(input.assignedStoreIds.filter(Boolean))];
  if (!input.roleCodes.includes("REGION_MANAGER") ||
      input.roleCodes.includes("SUPER_ADMIN")) return assigned;
  const managerStores = new Set(input.roleScopes?.REGION_MANAGER?.storeIds ?? []);
  return assigned.filter((storeId) => managerStores.has(storeId));
}

export function resolveReportingReadScope(input: {
  roleCodes: string[];
  scope: ReadScope;
  roleScopes?: Record<string, ReadScope>;
  actionScope?: { assignedStoreIds: string[] };
}): ReadScope {
  if (input.roleCodes.includes("REGION_MANAGER") &&
      !input.roleCodes.some((role) => ["REPORT_VIEWER", "SUPER_ADMIN"].includes(role))) {
    return { companyIds: [], regionIds: [], storeIds: resolveRegionManagerAssignedStoreIds({
      roleCodes: input.roleCodes, roleScopes: input.roleScopes,
      assignedStoreIds: input.actionScope?.assignedStoreIds ?? [],
    }) };
  }
  return resolveReportViewerCompanyScope({
    actorRoleCodes: input.roleCodes, actorScope: input.scope, roleScopes: input.roleScopes,
  });
}
