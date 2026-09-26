import { resolveStoreReportViewerRole, storeReportViewerCompanyIds } from "./store-report-viewer-role";
import type { AuthActionScope, AuthReadScope } from "../../auth/auth-context.service";

export type WorkforceWorkspaceView = "report_viewer" | "region_manager" | "store_manager";

export type WorkforceWorkspaceScope = {
  view: WorkforceWorkspaceView;
  readScope: AuthReadScope;
  actionableStoreIds: string[];
  capabilities: {
    canCreateSellerCodeRequest: boolean;
    canCreateOffboardingRequest: boolean;
  };
};

export function resolveWorkforceWorkspaceScope(input: {
  actorRoleCodes: readonly string[];
  actorReadScope: AuthReadScope;
  actorActionScope: AuthActionScope;
  roleScopes?: Record<string, AuthReadScope>;
}): WorkforceWorkspaceScope | null {
  const reportRole = resolveStoreReportViewerRole(input.actorRoleCodes);
  if (reportRole) {
    return scope("report_viewer", {
      companyIds: storeReportViewerCompanyIds(input, reportRole),
      regionIds: [],
      storeIds: [],
    }, []);
  }

  if (input.actorRoleCodes.includes("REGION_MANAGER")) {
    const roleScope = input.roleScopes?.REGION_MANAGER;
    if (!roleScope) return scope("region_manager", emptyReadScope(), []);
    const assigned = unique(input.actorActionScope.assignedStoreIds);
    const explicitStores = new Set(unique(roleScope.storeIds));
    const storeIds = assigned.filter((storeId) => explicitStores.has(storeId));
    return scope("region_manager", {
      companyIds: [],
      regionIds: [],
      storeIds,
    }, []);
  }

  if (input.actorRoleCodes.includes("STORE_MANAGER")) {
    const assigned = new Set(unique(input.actorActionScope.assignedStoreIds));
    const storeIds = unique(input.roleScopes?.STORE_MANAGER?.storeIds ?? input.actorReadScope.storeIds)
      .filter((storeId) => assigned.has(storeId));
    return scope("store_manager", { companyIds: [], regionIds: [], storeIds }, storeIds);
  }

  return null;
}

function scope(
  view: WorkforceWorkspaceView,
  readScope: AuthReadScope,
  actionableStoreIds: string[],
): WorkforceWorkspaceScope {
  const canAct = view === "store_manager" && actionableStoreIds.length > 0;
  return {
    view,
    readScope,
    actionableStoreIds,
    capabilities: {
      canCreateSellerCodeRequest: canAct,
      canCreateOffboardingRequest: canAct,
    },
  };
}

function emptyReadScope(): AuthReadScope {
  return { companyIds: [], regionIds: [], storeIds: [] };
}

function unique(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))].sort();
}
