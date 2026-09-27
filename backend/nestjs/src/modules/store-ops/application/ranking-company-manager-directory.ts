import type { RankingFilters, RankedStoreRankingRow } from "./ranking-list.helpers";
import { applyStoreFilters } from "./ranking-list.helpers";

export type RegionManagerDirectoryEntry = {
  id: string;
  label: string;
  storeIds: string[];
};

export function scopeManagerDirectory(input: {
  directory: RegionManagerDirectoryEntry[] | undefined;
  canReadCompanyHierarchy: boolean;
  assignedStoreIds: readonly string[];
}) {
  if (input.canReadCompanyHierarchy) return input.directory;
  const assignedStoreIds = new Set(input.assignedStoreIds);
  return input.directory
    ?.map((manager) => ({
      ...manager,
      storeIds: manager.storeIds.filter((storeId) => assignedStoreIds.has(storeId)),
    }))
    .filter((manager) => manager.storeIds.length > 0);
}

export function withoutStoreAndRegionFilters(filters: RankingFilters): RankingFilters {
  return {
    ...filters,
    enforceAssignedReadScope: false,
    regionId: undefined,
    regionIds: [],
    storeId: undefined,
    storeIds: [],
    assignedStoreIds: [],
  };
}

export function buildCompanyManagerStoreView(input: {
  rows: RankedStoreRankingRow[];
  filters: RankingFilters;
  directory: RegionManagerDirectoryEntry[] | undefined;
  canReadCompanyHierarchy: boolean;
  isPrivileged: boolean;
  enforceAssignedReadScope: boolean;
}) {
  const selectedManager = input.directory?.find(
    (manager) => manager.id === input.filters.regionManagerUserId,
  );
  const managerStoreIds = input.isPrivileged && input.filters.regionManagerUserId
    ? selectedManager?.storeIds ?? []
    : null;
  const companyFilters = input.canReadCompanyHierarchy
    ? {
        ...input.filters,
        regionManagerUserId: undefined,
      }
    : { ...input.filters, regionManagerUserId: undefined, regionManagerUnassigned: false };
  companyFilters.enforceAssignedReadScope = input.enforceAssignedReadScope;
  const displayRows = input.isPrivileged
    ? applyStoreFilters(input.rows, companyFilters)
    : input.rows;

  return {
    companyFilters,
    managerStoreIds,
    filteredStoreRows: managerStoreIds
      ? displayRows.filter((row) => managerStoreIds.includes(row.storeId))
      : displayRows,
  };
}

export function replaceManagerFilterOptions(
  filters: { regionManagers: Array<{ id: string; label: string }> },
  directory: RegionManagerDirectoryEntry[] | undefined,
) {
  if (!directory) return;
  filters.regionManagers = directory.map(({ id, label }) => ({ id, label }));
}
