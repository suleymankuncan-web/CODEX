export type ClosedRankingPeriodType = "daily" | "monthly";
export type ClosedRankingState = "closed" | "live" | "not_closed" | "no_data";
export type ClosedRankingStatus = "official" | "preview_only";
export type ClosedRankingEligibilityReason = "eligible" | "needs_more_closed_days";

export type ClosedRankingMetricRank = {
  code: string;
  label: string;
  actualValue: number | null;
  storeRank: number | null;
  storePopulation: number;
  regionRank: number | null;
  regionPopulation: number;
  turkeyRank: number | null;
  turkeyPopulation: number;
};

export type ClosedRankingCoverage = {
  closedDaysInPeriod: number;
  daysWithPerformance: number;
  minimumRequiredDays: number;
  isEligibleForRanking: boolean;
};

export type ClosedRankingEmployee = {
  employeeId: string;
  displayName: string;
  storeId: string | null;
  storeName: string | null;
  scoreValue: number;
  rankingStatus: ClosedRankingStatus;
  eligibilityReason: ClosedRankingEligibilityReason;
  neededPerformanceDays: number;
  rankings: {
    turkeyRank: number | null;
    turkeyPopulation: number;
    regionRank: number | null;
    regionPopulation: number;
    storeRank: number | null;
    storePopulation: number;
  };
  coverage: ClosedRankingCoverage;
  metricRanks: ClosedRankingMetricRank[];
};

export type ClosedRankingIncludedSnapshotRun = {
  snapshotRunId: string;
  snapshotDate: string;
  snapshotType: string;
  periodStart: string;
  periodEnd: string;
  runStatus: string;
  generatedAt: string;
  generatedBy: string;
};

export type ClosedRankingSummary = {
  source: {
    mode: "closed" | "live";
    periodType: ClosedRankingPeriodType;
    state: ClosedRankingState;
    snapshotRunId: string | null;
    snapshotDate: string | null;
    periodStart: string | null;
    periodEnd: string | null;
  };
  includedSnapshotRuns: ClosedRankingIncludedSnapshotRun[];
  currentEmployee: ClosedRankingEmployee | null;
  personnelTop: ClosedRankingEmployee[];
  availablePeriods?: Array<{
    periodType: string;
    periodStart: string;
    periodEnd: string;
  }>;
};

export type ClosedRankingInput = {
  userId: string;
  employeeId?: string;
  companyIds: string[];
  regionIds: string[];
  storeIds: string[];
  roleCodes: string[];
  assignedStoreIds: string[];
  periodType?: ClosedRankingPeriodType;
  periodStart?: string;
  snapshotDate?: string;
  storeId?: string;
  limit?: number;
};

export type ClosedRankingSnapshotRunRow = {
  snapshot_run_id: string;
  snapshot_date: string;
  snapshot_type: string;
  period_start: string;
  period_end: string;
  run_status: string;
  generated_at: string;
  generated_by: string;
};

export type ClosedRankingPersonnelRankRow = {
  employee_id: string;
  first_name: string;
  last_name: string;
  store_id: string | null;
  store_name: string | null;
  score_value: string;
  turkey_rank: number | null;
  turkey_population: number;
  store_rank: number | null;
  store_population: number;
  days_with_performance?: string | number;
};

export type ClosedRankingMetricRankRow = {
  employee_id: string;
  kpi_code: string;
  kpi_name: string;
  actual_value: string | null;
  store_rank: number | null;
  store_population: number;
  turkey_rank: number | null;
  turkey_population: number;
};
