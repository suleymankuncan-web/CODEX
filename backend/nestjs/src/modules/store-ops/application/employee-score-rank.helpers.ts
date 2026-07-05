import type { KpiScoreProfile } from "./kpi-config.contract";
import type { KpiBenchmarkScoringService } from "./kpi-benchmark-scoring.service";
import {
  resolvePersonnelRankingEligibility,
  type PersonnelRankingEligibilityResult,
} from "./personnel-ranking-eligibility.contract";

type EmployeePerformanceRankRow = {
  employee_id: string;
  store_id?: string | null;
  region_id?: string | null;
  kpi_code: string;
  actual_value: string;
  target_value: string | null;
  position_code?: string | null;
  net_sales_value?: string | null;
  store_net_sales_value?: string | null;
};

type EmployeeScoreRankRow = {
  employeeId: string;
  score: number;
  rankingEligibility: PersonnelRankingEligibilityResult;
};

type ScoredEmployeeRow = EmployeeScoreRankRow & {
  tieBreakValues: Array<number | null>;
};

export function buildEmployeeScoreRankRows<Row extends EmployeePerformanceRankRow>(input: {
  rows: Row[];
  profile: KpiScoreProfile;
  benchmarkLookup: Map<string, number | null>;
  scoringService: KpiBenchmarkScoringService;
}): EmployeeScoreRankRow[] {
  const byEmployee = new Map<
    string,
    {
      positionCode: string | null;
      netSalesValue: number | null;
      storeNetSalesValue: number | null;
      values: Record<string, { actualValue: number; targetValue: number | null }>;
    }
  >();

  input.rows.forEach((row) => {
    const current = byEmployee.get(row.employee_id) ?? {
      positionCode: row.position_code ?? null,
      netSalesValue: parseFiniteNumber(row.net_sales_value),
      storeNetSalesValue: parseFiniteNumber(row.store_net_sales_value),
      values: {},
    };
    current.positionCode = current.positionCode ?? row.position_code ?? null;
    current.netSalesValue = current.netSalesValue ?? parseFiniteNumber(row.net_sales_value);
    current.storeNetSalesValue =
      current.storeNetSalesValue ?? parseFiniteNumber(row.store_net_sales_value);
    current.values[row.kpi_code] = {
      actualValue: Number(row.actual_value),
      targetValue: row.target_value !== null ? Number(row.target_value) : null,
    };
    byEmployee.set(row.employee_id, current);
  });

  const scoreRows: ScoredEmployeeRow[] = [...byEmployee.entries()].map(([peerEmployeeId, row]) => {
    const score = input.profile.metrics.reduce((sum, metric) => {
      const matchingCodes = [metric.code, ...(metric.aliases ?? [])];
      const matchedCode = matchingCodes.find((code) => row.values[code]);
      const matchedMetric = matchingCodes
        .map((code) => row.values[code])
        .find((value) => typeof value?.actualValue === "number");

      if (!matchedMetric) return sum;

      const benchmarkSource = metric.code === "TARGET_ACHIEVEMENT" ? "TARGET" : metric.benchmarkSource ?? (matchedMetric.targetValue !== null ? "TARGET" : "TURKEY_AVERAGE");
      const benchmarkValue =
        benchmarkSource === "TURKEY_AVERAGE" && matchedCode
          ? input.benchmarkLookup.get(matchedCode) ?? null
          : null;
      const metricScore = input.scoringService.scoreMetric({
        metricCode: metric.code,
        actualValue: matchedMetric.actualValue,
        benchmarkValue,
        targetValue: matchedMetric.targetValue,
        weightPercent: metric.weightPercent,
        direction: metric.direction ?? "HIGHER_IS_BETTER",
        benchmarkSource,
        capRatio: metric.capRatio ?? 1.2,
      });

      return metricScore.scoreContribution === null
        ? sum
        : sum + metricScore.scoreContribution;
    }, 0);

    return {
      employeeId: peerEmployeeId,
      score: Number(score.toFixed(2)),
      tieBreakValues: input.profile.metrics.map((metric) => {
        const matchingCodes = [metric.code, ...(metric.aliases ?? [])];
        return getMetricComparableValue(row.values, metric.code, matchingCodes);
      }),
      rankingEligibility: resolvePersonnelRankingEligibility({
        positionCode: row.positionCode,
        netSalesValue: row.netSalesValue,
        storeNetSalesValue: row.storeNetSalesValue,
      }),
    };
  });

  scoreRows.sort(compareScoredEmployeeRows);
  return scoreRows.map(({ tieBreakValues: _tieBreakValues, ...row }) => row);
}

export function buildOfficialEmployeeScoreRankContext<Row extends EmployeePerformanceRankRow>(input: {
  rows: Row[];
  profile: KpiScoreProfile;
  benchmarkLookup: Map<string, number | null>;
  scoringService: KpiBenchmarkScoringService;
  storeId?: string | null;
  regionId?: string | null;
}) {
  const turkeyScores = buildEmployeeScoreRankRows(input).filter(
    (row) => row.rankingEligibility.isEligible,
  );
  const officialEmployeeIds = new Set(turkeyScores.map((row) => row.employeeId));
  const officialRows = input.rows.filter((row) => officialEmployeeIds.has(row.employee_id));
  const storeScores = input.storeId
    ? filterScoresBySourceScope(turkeyScores, officialRows, "store_id", input.storeId)
    : [];
  const regionScores = input.regionId
    ? filterScoresBySourceScope(turkeyScores, officialRows, "region_id", input.regionId)
    : [];

  return {
    turkeyScores,
    storeScores,
    regionScores,
    officialRows,
  };
}

function filterScoresBySourceScope(
  scores: EmployeeScoreRankRow[],
  rows: Array<Pick<EmployeePerformanceRankRow, "employee_id" | "store_id" | "region_id">>,
  field: "store_id" | "region_id",
  scopeId: string,
) {
  const employeeIds = new Set(
    rows.filter((row) => row[field] === scopeId).map((row) => row.employee_id),
  );

  return scores.filter((row) => employeeIds.has(row.employeeId));
}

function parseFiniteNumber(value: string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function compareScoredEmployeeRows(left: ScoredEmployeeRow, right: ScoredEmployeeRow) {
  return (
    right.score - left.score ||
    compareTieBreakValues(left.tieBreakValues, right.tieBreakValues) ||
    left.employeeId.localeCompare(right.employeeId)
  );
}

function compareTieBreakValues(
  preferredValues: Array<number | null>,
  fallbackValues: Array<number | null>,
) {
  const maxLength = Math.max(preferredValues.length, fallbackValues.length);
  for (let index = 0; index < maxLength; index += 1) {
    const preferredValue = preferredValues[index] ?? null;
    const fallbackValue = fallbackValues[index] ?? null;

    if (preferredValue === null && fallbackValue === null) {
      continue;
    }

    if (preferredValue === null) {
      return 1;
    }

    if (fallbackValue === null) {
      return -1;
    }

    const delta = preferredValue - fallbackValue;
    if (delta !== 0) {
      return -delta;
    }
  }

  return 0;
}

function getMetricComparableValue(
  values: Record<string, { actualValue: number; targetValue: number | null }>,
  code: string,
  matchingCodes: string[],
) {
  const metric = matchingCodes.map((matchingCode) => values[matchingCode]).find(Boolean);
  if (!metric || !Number.isFinite(metric.actualValue)) {
    return null;
  }

  if (code !== "TARGET_ACHIEVEMENT") {
    return metric.actualValue;
  }

  if (
    metric.targetValue === null ||
    !Number.isFinite(metric.targetValue) ||
    metric.targetValue === 0
  ) {
    return null;
  }

  return metric.actualValue / Math.abs(metric.targetValue);
}
