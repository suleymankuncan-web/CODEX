/** Descriptive allocation, not a change to scoring or a causal impact estimate.
 * Compute over every candidate in a store before search, sorting or pagination.
 */
export function personnelStoreScoreShares(rows: ReadonlyArray<{
  employeeId: string;
  storeId: string | null;
  allocationWeight: number | null;
}>) {
  const stores = new Map<string, { total: number; complete: boolean }>();
  for (const row of rows) {
    if (!row.storeId) continue;
    const group = stores.get(row.storeId) ?? { total: 0, complete: true };
    const valid = row.allocationWeight !== null && Number.isFinite(row.allocationWeight) && row.allocationWeight >= 0;
    group.complete &&= valid;
    if (valid) group.total += row.allocationWeight!;
    stores.set(row.storeId, group);
  }
  return new Map(rows.map(row => {
    const group = row.storeId ? stores.get(row.storeId) : undefined;
    const share = group?.complete && Number.isFinite(group.total) && group.total > 0 && row.allocationWeight !== null
      ? row.allocationWeight / group.total : null;
    return [row.employeeId, share] as const;
  }));
}
