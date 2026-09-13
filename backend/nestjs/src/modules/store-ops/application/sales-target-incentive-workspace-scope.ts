import { resolveStoreReportViewerRole, storeReportViewerCompanyIds } from "./store-report-viewer-role";
import type { AuthReadScope } from "../../auth/auth-context.service";

export type SalesTargetIncentiveWorkspaceCapabilities = {
  canMarkStoreReview: boolean;
  canCreateCorrection: boolean;
  canVoidCorrection: boolean;
  canSubmitPackage: boolean;
};

export type SalesTargetIncentiveWorkspaceScope = AuthReadScope & {
  view: "report_viewer" | "region_manager";
  capabilities: SalesTargetIncentiveWorkspaceCapabilities;
};

type ResolveWorkspaceScopeInput = {
  actorRoleCodes: readonly string[];
  actorReadScope: AuthReadScope;
  roleScopes?: Record<string, AuthReadScope>;
};

const readOnlyCapabilities = (): SalesTargetIncentiveWorkspaceCapabilities => ({
  canMarkStoreReview: false,
  canCreateCorrection: false,
  canVoidCorrection: false,
  canSubmitPackage: false,
});

export function resolveSalesTargetIncentiveWorkspaceScope(
  input: ResolveWorkspaceScopeInput,
): SalesTargetIncentiveWorkspaceScope | null {
  const reportRole = resolveStoreReportViewerRole(input.actorRoleCodes);
  if (reportRole) {
    return {
      view: "report_viewer",
      companyIds: storeReportViewerCompanyIds(input, reportRole),
      regionIds: [],
      storeIds: [],
      capabilities: readOnlyCapabilities(),
    };
  }

  if (input.actorRoleCodes.includes("REGION_MANAGER")) {
    const roleScope = input.roleScopes?.REGION_MANAGER;
    return {
      view: "region_manager",
      companyIds: [],
      regionIds: unique(roleScope?.regionIds ?? []),
      storeIds: unique(roleScope?.storeIds ?? []),
      capabilities: readOnlyCapabilities(),
    };
  }

  return null;
}

function unique(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))];
}
