import type { RankingFilters, RankedStoreRankingRow } from "./ranking-list.helpers";
import { applyStoreFilters } from "./ranking-list.helpers";

export type RegionManagerDirectoryEntry = {
  id: string;
  label: string;
  storeIds: string[];
};

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
  const companyFilters = input.canReadCompanyHierarchy
    ? {
        ...input.filters,
        regionManagerUserId: selectedManager ? undefined : input.filters.regionManagerUserId,
      }
    : { ...input.filters, regionManagerUnassigned: false };
  companyFilters.enforceAssignedReadScope = input.enforceAssignedReadScope;
  const displayRows = input.isPrivileged
    ? applyStoreFilters(input.rows, companyFilters)
    : input.rows;

  return {
    companyFilters,
    filteredStoreRows: selectedManager
      ? displayRows.filter((row) => selectedManager.storeIds.includes(row.storeId))
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
