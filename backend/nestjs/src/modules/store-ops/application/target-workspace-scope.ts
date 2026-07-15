import type { AuthActionScope, AuthReadScope } from "../../auth/auth-context.service";

export type TargetWorkspaceView = "report_viewer" | "region_manager" | "store_manager";

export type TargetWorkspaceCapabilities = {
  canCreateRequest: boolean;
  canApproveRequest: boolean;
};

export type TargetWorkspaceScope = {
  view: TargetWorkspaceView;
  readScope: AuthReadScope;
  actionableStoreIds: string[];
  capabilities: TargetWorkspaceCapabilities;
};

export function resolveTargetWorkspaceScope(input: {
  actorRoleCodes: readonly string[];
  actorReadScope: AuthReadScope;
  actorActionScope: AuthActionScope;
  roleScopes?: Record<string, AuthReadScope>;
}): TargetWorkspaceScope | null {
  // TGT-FR-005 / EC-017: a mixed Report Viewer session is always company-read-only.
  if (input.actorRoleCodes.includes("REPORT_VIEWER")) {
    return {
      view: "report_viewer",
      readScope: {
        companyIds: unique(input.roleScopes?.REPORT_VIEWER?.companyIds ?? []),
        regionIds: [],
        storeIds: [],
      },
      actionableStoreIds: [],
      capabilities: { canCreateRequest: false, canApproveRequest: false },
    };
  }

  if (input.actorRoleCodes.includes("REGION_MANAGER")) {
    const roleScope = input.roleScopes?.REGION_MANAGER;
    if (!roleScope) return emptyTargetScope("region_manager");
    const actionStoreIds = unique(input.actorActionScope.assignedStoreIds);
    const explicitRoleStores = new Set(unique(roleScope.storeIds));
    const storeIds = explicitRoleStores.size > 0
      ? actionStoreIds.filter((storeId) => explicitRoleStores.has(storeId))
      : actionStoreIds;
    if (storeIds.length === 0) return emptyTargetScope("region_manager");
    return {
      view: "region_manager",
      readScope: {
        companyIds: unique(roleScope.companyIds),
        regionIds: unique(roleScope.regionIds),
        storeIds,
      },
      actionableStoreIds: storeIds,
      capabilities: { canCreateRequest: false, canApproveRequest: storeIds.length > 0 },
    };
  }

  if (input.actorRoleCodes.includes("STORE_MANAGER")) {
    const assigned = new Set(unique(input.actorActionScope.assignedStoreIds));
    const storeIds = unique(input.roleScopes?.STORE_MANAGER?.storeIds ?? [])
      .filter((storeId) => assigned.has(storeId));
    return {
      view: "store_manager",
      readScope: { companyIds: [], regionIds: [], storeIds },
      actionableStoreIds: storeIds,
      capabilities: { canCreateRequest: storeIds.length > 0, canApproveRequest: false },
    };
  }

  return null;
}

function emptyTargetScope(view: "region_manager"): TargetWorkspaceScope {
  return {
    view,
    readScope: { companyIds: [], regionIds: [], storeIds: [] },
    actionableStoreIds: [],
    capabilities: { canCreateRequest: false, canApproveRequest: false },
  };
}

function unique(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))].sort();
}
