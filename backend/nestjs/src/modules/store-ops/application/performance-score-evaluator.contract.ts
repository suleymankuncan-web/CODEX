import type { KpiScoreProfile } from "./kpi-config.contract";

export type PerformanceScoreMetricValue = {
  label: string;
  actualValue: number | null;
  targetValue: number | null;
};

export type PerformanceScoreBenchmarkFallback =
  | "matched-only"
  | "matched-or-canonical";

export type PerformanceScoreEvaluationInput = {
  values: Map<string, PerformanceScoreMetricValue>;
  profile: KpiScoreProfile;
  benchmarkLookup: Map<string, number | null>;
  benchmarkFallback: PerformanceScoreBenchmarkFallback;
  useStoreChecklistFallback: boolean;
};

export type PerformanceScoreEvaluationMetric = {
  code: string;
  label: string;
  actualValue: number | null;
  targetValue: number | null;
  benchmarkValue: number | null;
  contributionValue: number | null;
};

export type PerformanceScoreEvaluationResult = {
  scoreValue: number;
  metrics: PerformanceScoreEvaluationMetric[];
};
