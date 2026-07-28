import { createHash } from "node:crypto";

type ScopeIds = {
  companyIds?: string[];
  regionIds?: string[];
  storeIds?: string[];
};

export function buildAuthorizationContextVersion(
  roleScopes?: Record<string, ScopeIds>,
  permissionScopes?: Record<string, ScopeIds>,
) {
  const canonicalize = (scopes: Record<string, ScopeIds> | undefined) => Object.fromEntries(
    Object.entries(scopes ?? {})
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([roleCode, scope]) => [
        roleCode,
        {
          companyIds: sortedUnique(scope.companyIds),
          regionIds: sortedUnique(scope.regionIds),
          storeIds: sortedUnique(scope.storeIds),
        },
      ]),
  );

  const canonical = {
    roleScopes: canonicalize(roleScopes),
    permissionScopes: canonicalize(permissionScopes),
  };

  return `v1:${createHash("sha256").update(JSON.stringify(canonical)).digest("hex")}`;
}

function sortedUnique(values: string[] | undefined) {
  return [...new Set(values ?? [])].sort();
}
