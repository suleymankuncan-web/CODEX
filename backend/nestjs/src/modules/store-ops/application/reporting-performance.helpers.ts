import type { ClosedRankingMetricRank, ClosedRankingMetricRankRow } from "./closed-ranking.contract";
import type { KpiScoreProfile } from "./kpi-config.contract";

type BenchmarkRow = {
  benchmark_value: string | null;
};

type EmployeeAvailablePeriodRow = {
  period_type: string;
  period_start: string;
  period_end: string;
};

type EmployeeFallbackPeriod = {
  period_type?: string | null;
  period_start: string;
  period_end: string;
};

type EmployeeAssignmentIdentityRow = {
  first_name?: string | null;
  last_name?: string | null;
  store_id?: string | null;
  store_name?: string | null;
};

type LiveMetricRankRow = {
  employee_id: string;
  store_id: string | null;
  kpi_code: string;
  kpi_name: string;
  actual_value: string;
};

export function hasUsableBenchmarkRows(rows: BenchmarkRow[]) {
  return rows.some((row) => {
    if (row.benchmark_value === null) {
      return false;
    }

    const value = Number(row.benchmark_value);
    return Number.isFinite(value) && value !== 0;
  });
}

export function mapEmployeeAvailablePeriods(
  periods: EmployeeAvailablePeriodRow[],
  fallbackPeriod?: EmployeeFallbackPeriod | null,
  fallbackPeriodType?: string,
) {
  const seenPeriodKeys = new Set<string>();
  const mappedPeriods: Array<{
    periodType: string;
    periodStart: string;
    periodEnd: string;
  }> = [];

  const addPeriod = (periodType: string | null | undefined, periodStart: string, periodEnd: string) => {
    if (!periodStart || !periodEnd) {
      return;
    }

    const normalizedPeriodType = normalizeEmployeeLivePeriodType(
      periodType,
      periodStart,
      periodEnd,
      fallbackPeriodType,
    );
    if (!normalizedPeriodType) {
      return;
    }

    const periodKey = `${normalizedPeriodType}:${periodStart}`;
    if (seenPeriodKeys.has(periodKey)) {
      return;
    }

    seenPeriodKeys.add(periodKey);
    mappedPeriods.push({
      periodType: normalizedPeriodType,
      periodStart,
      periodEnd,
    });
  };

  periods.forEach((period) => addPeriod(period.period_type, period.period_start, period.period_end));

  if (fallbackPeriod) {
    addPeriod(
      fallbackPeriod.period_type ?? fallbackPeriodType ?? "monthly",
      fallbackPeriod.period_start,
      fallbackPeriod.period_end,
    );
  }

  return mappedPeriods;
}

export function mapEmployeeAssignmentIdentity(
  employeeId: string,
  assignment: EmployeeAssignmentIdentityRow | null,
) {
  return {
    employeeId,
    displayName: formatEmployeeAssignmentName(assignment),
    storeId: assignment?.store_id ?? null,
    storeName: assignment?.store_name ?? null,
  };
}

export function formatEmployeeAssignmentName(
  assignment: Pick<EmployeeAssignmentIdentityRow, "first_name" | "last_name"> | null,
) {
  return assignment
    ? `${assignment.first_name ?? ""} ${assignment.last_name ?? ""}`.trim() || "Unknown employee"
    : "Unknown employee";
}

export function getProfileMetricCodes(profile: KpiScoreProfile) {
  return [
    ...new Set(profile.metrics.flatMap((metric) => [metric.code, ...(metric.aliases ?? [])])),
  ];
}

export function buildLiveMetricRanks(input: {
  employeeId: string;
  metricCodes: string[];
  rows: LiveMetricRankRow[];
  storeId: string | null;
}): ClosedRankingMetricRank[] {
  const metricRanks: Array<ClosedRankingMetricRank | null> = input.metricCodes
    .map((code): ClosedRankingMetricRank | null => {
      const metricRows = input.rows.filter(
        (row) => row.kpi_code === code && Number.isFinite(Number(row.actual_value)),
      );
      const currentRow = metricRows.find((row) => row.employee_id === input.employeeId);

      if (!currentRow) {
        return null;
      }

      const storeMetricRows = input.storeId
        ? metricRows.filter((row) => row.store_id === input.storeId)
        : [];

      return {
        code,
        label: currentRow.kpi_name,
        actualValue: Number(currentRow.actual_value),
        storeRank: rankMetricRow(storeMetricRows, input.employeeId),
        storePopulation: storeMetricRows.length,
        turkeyRank: rankMetricRow(metricRows, input.employeeId),
        turkeyPopulation: metricRows.length,
      };
    });

  return metricRanks.filter((row): row is ClosedRankingMetricRank => row !== null);
}

export function mapClosedMetricRankRows(rows: ClosedRankingMetricRankRow[]): ClosedRankingMetricRank[] {
  return rows.map((row) => ({
    code: row.kpi_code,
    label: row.kpi_name,
    actualValue: row.actual_value !== null ? Number(row.actual_value) : null,
    storeRank: row.store_rank,
    storePopulation: row.store_population,
    turkeyRank: row.turkey_rank,
    turkeyPopulation: row.turkey_population,
  }));
}

function normalizeEmployeeLivePeriodType(
  periodType: string | null | undefined,
  periodStart: string,
  periodEnd: string,
  fallbackPeriodType?: string,
) {
  if (periodType === "custom") {
    return periodStart === periodEnd ? "daily" : "monthly";
  }

  return periodType ?? fallbackPeriodType ?? "monthly";
}

function rankMetricRow(
  rows: Array<{ employee_id: string; actual_value: string }>,
  employeeId: string,
) {
  const sortedRows = [...rows].sort((left, right) => {
    const valueDelta = Number(right.actual_value) - Number(left.actual_value);
    return valueDelta !== 0 ? valueDelta : left.employee_id.localeCompare(right.employee_id);
  });
  let previousValue: number | null = null;
  let previousRank = 0;

  for (const [index, row] of sortedRows.entries()) {
    const value = Number(row.actual_value);
    const rank = previousValue === value ? previousRank : index + 1;

    if (row.employee_id === employeeId) {
      return rank;
    }

    previousValue = value;
    previousRank = rank;
  }

  return null;
}
