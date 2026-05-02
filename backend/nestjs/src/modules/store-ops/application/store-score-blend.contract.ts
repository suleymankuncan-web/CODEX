export type MissingWeightPolicy = "return_missing_weight_to_kpi";

export type StoreScoreBlendConfig = {
  kpiPerformanceWeight: number;
  bmChecklistWeight: number;
  vmChecklistWeight: number;
  missingWeightPolicy?: MissingWeightPolicy;
};

export type StoreChecklistScoreInput = {
  score: number;
  visitCount: number;
};

export type StoreScoreComponentStatus =
  | "included"
  | "not_included"
  | "missing_reference"
  | "future_inactive";

export type StoreScoreWeights = {
  kpiPerformanceWeight: number;
  bmChecklistWeight: number;
  vmChecklistWeight: number;
};

export type StoreScoreComponent = {
  included: boolean;
  score: number | null;
  weight: number;
  contribution: number | null;
  status: StoreScoreComponentStatus;
  missingReason?: string;
};

export type StoreChecklistScoreComponent = StoreScoreComponent & {
  visitCount: number;
};

export type StoreScoreBlendInput = {
  monthlyKpiScore: number | null;
  bmChecklist: StoreChecklistScoreInput | null;
  vmChecklist: StoreChecklistScoreInput | null;
  config: StoreScoreBlendConfig;
};

export type StoreScoreBlendResult = {
  totalScore: number | null;
  missingWeightPolicy: MissingWeightPolicy;
  configuredWeights: StoreScoreWeights;
  effectiveWeights: StoreScoreWeights;
  components: {
    kpi: StoreScoreComponent;
    bmChecklist: StoreChecklistScoreComponent;
    vmChecklist: StoreChecklistScoreComponent;
  };
};
