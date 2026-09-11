// Select a read-only Store presentation without adding a role to the actor.
// Existing mixed Report Viewer sessions retain their own company boundary.
export function resolveStoreReportViewerRole(roleCodes: readonly string[]) {
  if (roleCodes.includes("REPORT_VIEWER")) return "REPORT_VIEWER";
  if (roleCodes.includes("SUPER_ADMIN")) return "SUPER_ADMIN";
  return null;
}

export function storeReportViewerCompanyIds(input: {
  actorRoleCodes: readonly string[];
  actorReadScope: { companyIds: readonly string[] };
  roleScopes?: Record<string, { companyIds: readonly string[] }>;
}, role: "REPORT_VIEWER" | "SUPER_ADMIN") {
  const ownScope = input.roleScopes?.[role];
  const fallback = role === "SUPER_ADMIN" && input.actorRoleCodes.length === 1
    ? input.actorReadScope : undefined;
  return [...new Set((ownScope ?? fallback)?.companyIds.filter(Boolean) ?? [])];
}
