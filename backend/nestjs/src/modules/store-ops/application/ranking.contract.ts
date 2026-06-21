export type RankingSubject = "store" | "personnel";
export type RankingPeriodType = "daily" | "monthly";
export type RankingVisibility = "summary" | "detail";
export type RankingSortKey =
  | "score"
  | "UPT"
  | "ATV"
  | "CR"
  | "TARGET_ACHIEVEMENT"
  | "BM_CHECKLIST"
  | "VM_CHECKLIST"
  | "gsm_approval";
export type RankingSortDirection = "asc" | "desc";

export type RankingMetricValue = {
  code: string;
  label: string;
  actualValue: number | null;
  targetValue?: number | null;
  benchmarkValue?: number | null;
  contributionValue?: number | null;
};

export type StoreRankingRow = {
  subject: "store";
  storeId: string;
  storeName: string | null;
  regionId: string | null;
  regionName: string | null;
  regionManagerUserId: string | null;
  regionManagerName: string | null;
  rank: number;
  population: number;
  scoreValue: number;
  visibility: RankingVisibility;
  metrics?: RankingMetricValue[];
};

export type PersonnelRankingRow = {
  subject: "personnel";
  employeeId: string;
  displayName: string;
  storeId: string | null;
  storeName: string | null;
  regionId: string | null;
  regionName: string | null;
  regionManagerUserId: string | null;
  regionManagerName: string | null;
  rank: number;
  population: number;
  storeRank: number | null;
  storePopulation: number;
  scoreValue: number;
  canOpenProfile: boolean;
  visibility: RankingVisibility;
  metrics?: RankingMetricValue[];
};

export type RankingFilterOption = {
  id: string;
  label: string;
};

export type RankingReferenceMetric = {
  code: string;
  label: string;
  value: number | null;
};

export type RankingReferenceGroup = {
  averageScore: number | null;
  metrics: RankingReferenceMetric[];
};

export type RankingResponse = {
  source: {
    mode: "live";
    periodType: RankingPeriodType;
    periodStart: string | null;
    periodEnd: string | null;
  };
  access: {
    globalMode: "top100" | "full";
    canSeeGlobalDetails: boolean;
    canSeeManagedStorePersonnelDetails: boolean;
  };
  filters: {
    regionManagers: RankingFilterOption[];
    regions: RankingFilterOption[];
    stores: RankingFilterOption[];
  };
  reference: {
    store: RankingReferenceGroup;
    personnel: RankingReferenceGroup;
  };
  storeLeaderboard: {
    items: StoreRankingRow[];
    currentStore: StoreRankingRow | null;
    meta: {
      total: number;
      limit: number;
      offset: number;
    };
  };
  personnelLeaderboard: {
    items: PersonnelRankingRow[];
    currentEmployee: PersonnelRankingRow | null;
    managedStorePersonnel: PersonnelRankingRow[];
    meta: {
      total: number;
      limit: number;
      offset: number;
    };
  };
  availablePeriods: Array<{
    periodType: RankingPeriodType;
    periodStart: string;
    periodEnd: string;
  }>;
};
