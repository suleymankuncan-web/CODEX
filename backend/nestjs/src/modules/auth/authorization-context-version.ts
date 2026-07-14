import { createHash } from "node:crypto";

type ScopeIds = {
  companyIds?: string[];
  regionIds?: string[];
  storeIds?: string[];
};

export function buildAuthorizationContextVersion(roleScopes?: Record<string, ScopeIds>) {
  const canonical = Object.fromEntries(
    Object.entries(roleScopes ?? {})
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

  return `v1:${createHash("sha256").update(JSON.stringify(canonical)).digest("hex")}`;
}

function sortedUnique(values: string[] | undefined) {
  return [...new Set(values ?? [])].sort();
}
