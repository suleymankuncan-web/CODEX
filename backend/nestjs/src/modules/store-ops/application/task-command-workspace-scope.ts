import { resolveStoreReportViewerRole } from "./store-report-viewer-role";
type ReadScope = {
  companyIds: readonly string[];
  regionIds: readonly string[];
  storeIds: readonly string[];
};

type ActionScope = {
  assignedStoreIds: readonly string[];
};

export type TaskCommandWorkspaceScope = {
  view: "report_viewer" | "region_manager" | "store_manager";
  companyIds: string[];
  regionIds: string[];
  storeIds: string[];
  capabilities: {
    canStart: boolean;
    canUpdate: boolean;
    canComplete: boolean;
    canCancel: boolean;
    canReview: boolean;
  };
};

const readOnlyCapabilities = {
  canStart: false,
  canUpdate: false,
  canComplete: false,
  canCancel: false,
  canReview: false,
} as const;

const storeManagerCapabilities = {
  canStart: true,
  canUpdate: true,
  canComplete: true,
  canCancel: true,
  canReview: false,
} as const;

export function resolveTaskCommandWorkspaceScope(input: {
  actorRoleCodes: readonly string[];
  actorReadScope: ReadScope;
  actorActionScope: ActionScope;
  roleScopes?: Record<string, ReadScope>;
}): TaskCommandWorkspaceScope | null {
  const reportRole = resolveStoreReportViewerRole(input.actorRoleCodes);
  if (reportRole) {
    const scope = roleScope(input, reportRole);
    if (!scope) return null;
    const companyIds = unique(scope.companyIds);
    return companyIds.length > 0
      ? {
          view: "report_viewer",
          companyIds,
          regionIds: [],
          storeIds: [],
          capabilities: { ...readOnlyCapabilities },
        }
      : null;
  }

  if (input.actorRoleCodes.includes("REGION_MANAGER")) {
    const scope = input.roleScopes?.REGION_MANAGER;
    if (!scope) return null;
    const actionStores = unique(input.actorActionScope.assignedStoreIds);
    const scopedStores = new Set(unique(scope.storeIds));
    const storeIds = actionStores.filter((storeId) => scopedStores.has(storeId));
    if (storeIds.length === 0) return null;
    return {
      view: "region_manager",
      companyIds: [],
      regionIds: [],
      storeIds,
      capabilities: { ...readOnlyCapabilities, canReview: true },
    };
  }

  if (input.actorRoleCodes.includes("STORE_MANAGER")) {
    const storeIds = unique(input.actorActionScope.assignedStoreIds);
    return storeIds.length > 0
      ? {
          view: "store_manager",
          companyIds: [],
          regionIds: [],
          storeIds,
          capabilities: { ...storeManagerCapabilities },
        }
      : null;
  }

  return null;
}

function unique(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))];
}

function roleScope(
  input: {
    actorRoleCodes: readonly string[];
    actorReadScope: ReadScope;
    roleScopes?: Record<string, ReadScope>;
  },
  roleCode: string,
) {
  const scoped = input.roleScopes?.[roleCode];
  if (scoped) return scoped;
  return input.actorRoleCodes.length === 1 && input.actorRoleCodes[0] === roleCode
    ? input.actorReadScope
    : null;
}
