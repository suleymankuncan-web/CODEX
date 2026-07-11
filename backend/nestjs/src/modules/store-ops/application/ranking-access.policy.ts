export type RankingGlobalMode = "top100" | "full";

export type RankingAccess = {
  isPrivileged: boolean;
  canSeeGlobalDetails: boolean;
  globalLimit: number;
  globalOffset: number;
  globalMode: RankingGlobalMode;
  canSeeManagedStorePersonnelDetails: boolean;
};

const privilegedRoles = new Set(["REGION_MANAGER", "REPORT_VIEWER", "SUPER_ADMIN"]);

export function sanitizeRankingPagination(input: {
  limit?: number;
  offset?: number;
}) {
  const requestedLimit =
    Number.isInteger(input.limit) && input.limit && input.limit > 0
      ? input.limit
      : 100;
  const requestedOffset =
    Number.isInteger(input.offset) && input.offset && input.offset > 0
      ? input.offset
      : 0;

  return {
    limit: Math.min(requestedLimit, 500),
    offset: requestedOffset,
  };
}

export function resolveRankingAccess(input: {
  roleCodes: string[];
  requestedLimit?: number;
  requestedOffset?: number;
}): RankingAccess {
  const isPrivileged = input.roleCodes.some((role) => privilegedRoles.has(role));
  const hasStoreManagerRole = input.roleCodes.includes("STORE_MANAGER");
  const pagination = sanitizeRankingPagination({
    limit: input.requestedLimit,
    offset: input.requestedOffset,
  });

  if (!isPrivileged) {
    return {
      isPrivileged: false,
      canSeeGlobalDetails: false,
      globalLimit: 100,
      globalOffset: 0,
      globalMode: "top100",
      canSeeManagedStorePersonnelDetails: hasStoreManagerRole,
    };
  }

  return {
    isPrivileged: true,
    canSeeGlobalDetails: true,
    globalLimit: pagination.limit,
    globalOffset: pagination.offset,
    globalMode: "full",
    canSeeManagedStorePersonnelDetails: true,
  };
}
