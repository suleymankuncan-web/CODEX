// Trace: FR-03..11; NFR-02, NFR-03, NFR-05; AC-02..05; EC-01..12.
export const authorityFamilies = ["ASSIGN-01", "ORG-02", "ORG-04"] as const;
export type AuthorityFamily = typeof authorityFamilies[number];

export const authorityReasons = [
  "assign01.rotation_authority_source_absent",
  "org02.rotation_authority_source_absent",
  "org04.scope_hierarchy_mismatch",
  "org04.role_assignment_never_configured",
  "org04.role_assignment_not_effective",
  "org04.region_portfolio_not_effective",
  "org04.duplicate_rows_same_manager",
  "org04.mixed_scope_multiple_managers",
  "org04.multiple_distinct_managers",
  "org04.unique_manager_region_mismatch",
] as const;
export type AuthorityReason = typeof authorityReasons[number];

export const authoritySources = [
  "authority.assignment_lifecycle_contract",
  "authority.rbac_role_assignment",
  "authority.action_store_portfolio",
  "authority.scope_hierarchy",
] as const;
export type AuthoritySource = typeof authoritySources[number];

export function reasonBelongsToAuthorityFamily(
  family: AuthorityFamily,
  reason: AuthorityReason,
) {
  if (family === "ASSIGN-01") return reason === "assign01.rotation_authority_source_absent";
  if (family === "ORG-02") return reason === "org02.rotation_authority_source_absent";
  return reason.startsWith("org04.");
}

export function sourceBelongsToAuthorityReason(
  reason: AuthorityReason,
  source: AuthoritySource,
) {
  if (reason === "assign01.rotation_authority_source_absent"
    || reason === "org02.rotation_authority_source_absent") {
    return source === "authority.assignment_lifecycle_contract";
  }
  if (reason === "org04.scope_hierarchy_mismatch") {
    return source === "authority.scope_hierarchy";
  }
  if (reason === "org04.region_portfolio_not_effective") {
    return source === "authority.action_store_portfolio";
  }
  return source === "authority.rbac_role_assignment";
}
