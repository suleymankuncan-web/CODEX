import type { StoreRankingRow } from "./ranking.contract";
import {
  applyStoreFilters,
  type RankedStoreRankingRow,
  uniqueIds,
} from "./ranking-list.helpers";

export function selectScopedRankingFilterRows(input: {
  rows: RankedStoreRankingRow[];
  isPrivileged: boolean;
  assignedStoreIds: string[];
  enforceAssignedReadScope: boolean;
  regionIds: string[];
  storeIds: string[];
}) {
  if (input.isPrivileged) {
    return applyStoreFilters(input.rows, {
      assignedStoreIds: input.assignedStoreIds,
      enforceAssignedReadScope: input.enforceAssignedReadScope,
      regionIds: input.regionIds,
      storeIds: input.storeIds,
    });
  }

  const scopedStoreIds = uniqueIds([...input.assignedStoreIds, ...input.storeIds]);
  return input.rows.filter((row) => scopedStoreIds.includes(row.storeId));
}

export function buildScopedRankingFilterOptions(rows: StoreRankingRow[]) {
  const toOptions = (
    select: (row: StoreRankingRow) => { id: string | null; label: string | null },
  ) => {
    const options = new Map<string, string>();

    for (const row of rows) {
      const option = select(row);
      if (option.id) options.set(option.id, option.label?.trim() || option.id);
    }

    return Array.from(options, ([id, label]) => ({ id, label })).sort(
      (left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id),
    );
  };

  return {
    regionManagers: toOptions((row) => ({
      id: row.regionManagerUserId,
      label: row.regionManagerName,
    })),
    regions: toOptions((row) => ({ id: row.regionId, label: row.regionName })),
    stores: toOptions((row) => ({ id: row.storeId, label: row.storeName })),
  };
}
