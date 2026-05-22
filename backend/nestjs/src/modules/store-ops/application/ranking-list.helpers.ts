import type { resolveRankingAccess } from "./ranking-access.policy";
import {
  PersonnelRankingRow,
  RankingMetricValue,
  RankingResponse,
  RankingSortDirection,
  RankingSortKey,
  RankingVisibility,
  StoreRankingRow,
} from "./ranking.contract";

export type RankingPeriodRow = {
  period_type: string;
  period_start: string;
  period_end: string;
};

export type RankingFilters = {
  regionManagerUserId?: string;
  regionId?: string;
  storeId?: string;
  search?: string;
};

export type UnrankedStoreRankingRow = Omit<
  StoreRankingRow,
  "rank" | "population" | "visibility"
> & {
  metrics: RankingMetricValue[];
};

export type RankedStoreRankingRow = StoreRankingRow & {
  metrics: RankingMetricValue[];
};

export type UnrankedPersonnelRankingRow = Omit<
  PersonnelRankingRow,
  "rank" | "population" | "storeRank" | "storePopulation" | "visibility"
> & {
  metrics: RankingMetricValue[];
};

export type RankedPersonnelRankingRow = PersonnelRankingRow & {
  metrics: RankingMetricValue[];
};

type RankingAccess = ReturnType<typeof resolveRankingAccess>;

export function sortRowsForList<
  Row extends { rank: number; scoreValue: number; metrics: RankingMetricValue[] },
>(
  rows: Row[],
  sortKey: RankingSortKey,
  sortDirection: RankingSortDirection,
  stableId: (row: Row) => string,
) {
  const direction = sortDirection === "desc" ? -1 : 1;

  return [...rows].sort((left, right) => {
    const leftValue = getSortValue(left, sortKey);
    const rightValue = getSortValue(right, sortKey);

    if (leftValue === null && rightValue === null) {
      return left.rank - right.rank || stableId(left).localeCompare(stableId(right));
    }

    if (leftValue === null) {
      return 1;
    }

    if (rightValue === null) {
      return -1;
    }

    return (
      (leftValue - rightValue) * direction ||
      left.rank - right.rank ||
      stableId(left).localeCompare(stableId(right))
    );
  });
}

export function average(values: Array<number | null>) {
  const numericValues = values.filter(
    (value): value is number => value !== null && Number.isFinite(value),
  );

  if (!numericValues.length) {
    return null;
  }

  return Number(
    (
      numericValues.reduce((total, value) => total + value, 0) /
      numericValues.length
    ).toFixed(4),
  );
}

export function getMetricComparableValue(metrics: RankingMetricValue[], code: string) {
  const metric = metrics.find((candidate) => candidate.code === code);

  if (!metric || metric.actualValue === null || !Number.isFinite(metric.actualValue)) {
    return null;
  }

  if (code !== "TARGET_ACHIEVEMENT") {
    return metric.actualValue;
  }

  if (
    metric.targetValue === null ||
    metric.targetValue === undefined ||
    !Number.isFinite(metric.targetValue) ||
    metric.targetValue === 0
  ) {
    return metric.actualValue;
  }

  return metric.actualValue / Math.abs(metric.targetValue);
}

export function rankStoreRows(rows: UnrankedStoreRankingRow[]): RankedStoreRankingRow[] {
  const sorted = [...rows].sort(
    (left, right) =>
      right.scoreValue - left.scoreValue || left.storeId.localeCompare(right.storeId),
  );
  const population = sorted.length;

  return sorted.map((row, index) => ({
    ...row,
    rank: index + 1,
    population,
    visibility: "detail",
  }));
}

export function rankPersonnelRows(
  rows: UnrankedPersonnelRankingRow[],
): RankedPersonnelRankingRow[] {
  const sorted = [...rows].sort(
    (left, right) =>
      right.scoreValue - left.scoreValue ||
      left.employeeId.localeCompare(right.employeeId),
  );
  const storeRanks = buildStoreRanks(sorted);
  const population = sorted.length;

  return sorted.map((row, index) => {
    const storeRank = storeRanks.get(row.employeeId);

    return {
      ...row,
      rank: index + 1,
      population,
      storeRank: storeRank?.rank ?? null,
      storePopulation: storeRank?.population ?? 0,
      visibility: "detail",
    };
  });
}

export function applyStoreFilters(
  rows: RankedStoreRankingRow[],
  filters: RankingFilters,
) {
  const normalizedSearch = normalizeSearch(filters.search);

  return rows.filter((row) => {
    if (
      filters.regionManagerUserId &&
      row.regionManagerUserId !== filters.regionManagerUserId
    ) {
      return false;
    }

    if (filters.regionId && row.regionId !== filters.regionId) {
      return false;
    }

    if (filters.storeId && row.storeId !== filters.storeId) {
      return false;
    }

    if (normalizedSearch && !matchesSearch(normalizedSearch, [
      row.storeName,
      row.regionName,
      row.regionManagerName,
    ])) {
      return false;
    }

    return true;
  });
}

export function applyPersonnelFilters(
  rows: RankedPersonnelRankingRow[],
  filters: RankingFilters,
) {
  const normalizedSearch = normalizeSearch(filters.search);

  return rows.filter((row) => {
    if (
      filters.regionManagerUserId &&
      row.regionManagerUserId !== filters.regionManagerUserId
    ) {
      return false;
    }

    if (filters.regionId && row.regionId !== filters.regionId) {
      return false;
    }

    if (filters.storeId && row.storeId !== filters.storeId) {
      return false;
    }

    if (normalizedSearch && !matchesSearch(normalizedSearch, [
      row.displayName,
      row.storeName,
      row.regionName,
      row.regionManagerName,
    ])) {
      return false;
    }

    return true;
  });
}

export function selectGlobalRows<Row>(
  rows: Row[],
  access: { globalLimit: number; globalOffset: number; isPrivileged: boolean },
) {
  if (!access.isPrivileged) {
    return rows.slice(0, access.globalLimit);
  }

  return rows.slice(access.globalOffset, access.globalOffset + access.globalLimit);
}

export function maskStoreRow(
  row: StoreRankingRow & { metrics?: RankingMetricValue[] },
  visibility: RankingVisibility,
): StoreRankingRow {
  if (visibility === "detail") {
    return {
      ...row,
      visibility,
      metrics: row.metrics ?? [],
    };
  }

  const { metrics: _metrics, ...summary } = row;
  return {
    ...summary,
    visibility,
  };
}

export function maskPersonnelRow(
  row: PersonnelRankingRow & { metrics?: RankingMetricValue[] },
  visibility: RankingVisibility,
): PersonnelRankingRow {
  if (visibility === "detail") {
    return {
      ...row,
      visibility,
      metrics: row.metrics ?? [],
    };
  }

  const { metrics: _metrics, ...summary } = row;
  return {
    ...summary,
    visibility,
  };
}

export function resolveCurrentStoreId(
  input: { assignedStoreIds: string[]; storeIds: string[] },
  currentEmployee: PersonnelRankingRow | null,
) {
  return (
    input.assignedStoreIds[0] ??
    input.storeIds[0] ??
    currentEmployee?.storeId ??
    null
  );
}

export function mapAvailablePeriods(periods: RankingPeriodRow[]) {
  return periods.map((period) => ({
    periodType: "monthly" as const,
    periodStart: period.period_start,
    periodEnd: period.period_end,
  }));
}

export function getEmptyRankingResponse(input: {
  access: RankingAccess;
  availablePeriods: RankingPeriodRow[];
  periodStart: string | null;
  periodEnd: string | null;
}): RankingResponse {
  return {
    source: {
      mode: "live",
      periodType: "monthly",
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
    },
    access: {
      globalMode: input.access.globalMode,
      canSeeGlobalDetails: input.access.canSeeGlobalDetails,
      canSeeManagedStorePersonnelDetails:
        input.access.canSeeManagedStorePersonnelDetails,
    },
    filters: {
      regionManagers: [],
      regions: [],
      stores: [],
    },
    reference: {
      store: {
        averageScore: null,
        metrics: [],
      },
      personnel: {
        averageScore: null,
        metrics: [],
      },
    },
    storeLeaderboard: {
      items: [],
      currentStore: null,
      meta: {
        total: 0,
        limit: input.access.globalLimit,
        offset: input.access.globalOffset,
      },
    },
    personnelLeaderboard: {
      items: [],
      currentEmployee: null,
      managedStorePersonnel: [],
      meta: {
        total: 0,
        limit: input.access.globalLimit,
        offset: input.access.globalOffset,
      },
    },
    availablePeriods: mapAvailablePeriods(input.availablePeriods),
  };
}

export function toFiniteNumber(value: string | null) {
  if (value === null) {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

export function uniqueIds(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export function resolveMonthEnd(periodStart: string) {
  const [year, month] = periodStart.split("-").map(Number);

  if (!year || !month) {
    return null;
  }

  const monthEnd = new Date(Date.UTC(year, month, 0));
  return monthEnd.toISOString().slice(0, 10);
}

function getSortValue(
  row: { scoreValue: number; metrics: RankingMetricValue[] },
  sortKey: RankingSortKey,
) {
  if (sortKey === "score") {
    return row.scoreValue;
  }

  return getMetricComparableValue(row.metrics, sortKey);
}

function buildStoreRanks(
  rows: Array<{
    employeeId: string;
    storeId: string | null;
    scoreValue: number;
  }>,
) {
  const byStore = rows.reduce((map, row) => {
    const key = row.storeId ?? "__no_store__";
    const current = map.get(key) ?? [];
    current.push(row);
    map.set(key, current);
    return map;
  }, new Map<string, Array<{ employeeId: string; storeId: string | null; scoreValue: number }>>());
  const ranks = new Map<string, { rank: number; population: number }>();

  byStore.forEach((storeRows) => {
    const sorted = [...storeRows].sort(
      (left, right) =>
        right.scoreValue - left.scoreValue ||
        left.employeeId.localeCompare(right.employeeId),
    );
    sorted.forEach((row, index) => {
      ranks.set(row.employeeId, {
        rank: index + 1,
        population: sorted.length,
      });
    });
  });

  return ranks;
}

function normalizeSearch(value?: string) {
  const normalized = value?.trim().toLocaleLowerCase("tr-TR");
  return normalized ? normalized : null;
}

function matchesSearch(search: string, candidates: Array<string | null>) {
  return candidates.some((candidate) =>
    candidate?.toLocaleLowerCase("tr-TR").includes(search),
  );
}
