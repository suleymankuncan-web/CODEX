import type { AuthReadScope } from "../../auth/auth-context.service";

export type ReportViewerScopeInput = {
  actorRoleCodes: readonly string[];
  actorScope: AuthReadScope;
  roleScopes?: Record<string, AuthReadScope>;
};

const emptyScope = (): AuthReadScope => ({
  companyIds: [],
  regionIds: [],
  storeIds: [],
});

/**
 * Resolves the read boundary for a request that may be made by Report Viewer.
 *
 * Report Viewer is company-scoped by its own role assignment.  The aggregate
 * user scope is intentionally not used for that role because it can contain
 * stores/regions contributed by another role on the same session.  The
 * development fallback exists only for the mock provider, whose headers predate
 * roleScopes; production JWT/browser sessions fail closed when the role scope
 * is absent.
 */
export function resolveReportViewerCompanyScope(input: ReportViewerScopeInput): AuthReadScope {
  if (!input.actorRoleCodes.includes("REPORT_VIEWER")) {
    return input.actorScope;
  }

  const roleScope = input.roleScopes?.REPORT_VIEWER;
  if (roleScope) {
    return {
      companyIds: unique(roleScope.companyIds),
      regionIds: [],
      storeIds: [],
    };
  }

  if (isMockDevelopment()) {
    return {
      companyIds: unique(input.actorScope.companyIds),
      regionIds: [],
      storeIds: [],
    };
  }

  return emptyScope();
}

export function hasCompanyReadScope(scope: AuthReadScope) {
  return scope.companyIds.length > 0;
}

function isMockDevelopment() {
  return (
    (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") &&
    (process.env.AUTH_MODE === undefined || process.env.AUTH_MODE === "mock")
  );
}

function unique(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))];
}
