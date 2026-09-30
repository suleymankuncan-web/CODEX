import type { AuthenticatedUser, AuthReadScope } from "../../auth/auth-context.service";
import { resolveStoreReportViewerRole, storeReportViewerCompanyIds } from "./store-report-viewer-role";

export function resolveStoreReturnsScope(actor: AuthenticatedUser): AuthReadScope {
  const reportRole = resolveStoreReportViewerRole(actor.roleCodes);
  if (reportRole) return {
    companyIds: storeReportViewerCompanyIds({
      actorRoleCodes: actor.roleCodes, actorReadScope: actor.readScope, roleScopes: actor.roleScopes,
    }, reportRole), regionIds: [], storeIds: [],
  };
  const assigned = new Set(actor.actionScope.assignedStoreIds);
  const authorized = ["REGION_MANAGER", "STORE_MANAGER"].flatMap(role =>
    actor.roleCodes.includes(role) ? actor.roleScopes?.[role]?.storeIds ?? [] : [],
  );
  return { companyIds: [], regionIds: [], storeIds: [...new Set(authorized)].filter(id => assigned.has(id)) };
}
