export type KpiMetricDirection =
  | "HIGHER_IS_BETTER"
  | "LOWER_IS_BETTER"
  | "TARGET_BAND";

export type KpiBenchmarkSource =
  | "TARGET"
  | "TURKEY_AVERAGE"
  | "CHECKLIST_SCORE";

export type KpiMetricScoreStatus =
  | "scored"
  | "missing_reference"
  | "missing_actual";

export type KpiBenchmarkMetricInput = {
  metricCode: string;
  actualValue: number | null;
  benchmarkValue: number | null;
  targetValue: number | null;
  weightPercent: number;
  direction: KpiMetricDirection;
  benchmarkSource: KpiBenchmarkSource;
  capRatio: number;
};

export type KpiBenchmarkMetricResult = {
  metricCode: string;
  actualValue: number | null;
  benchmarkValue: number | null;
  targetValue: number | null;
  actualRatio: number | null;
  scoredRatio: number | null;
  capRatio: number;
  isCapped: boolean;
  weightPercent: number;
  scoreContribution: number | null;
  scoreStatus: KpiMetricScoreStatus;
  missingReason?: string;
};
