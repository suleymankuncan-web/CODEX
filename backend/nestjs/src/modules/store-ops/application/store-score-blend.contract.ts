export type StoreScoreBlendConfig = {
  kpiPerformanceWeight: number;
  bmChecklistWeight: number;
  vmChecklistWeight: number;
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

export type StoreScoreBlendInput = {
  monthlyKpiScore: number | null;
  bmChecklist: StoreChecklistScoreInput | null;
  config: StoreScoreBlendConfig;
};

export type StoreScoreBlendResult = {
  totalScore: number | null;
  components: {
    kpi: {
      included: boolean;
      score: number | null;
      weight: number;
      contribution: number | null;
      status: StoreScoreComponentStatus;
      missingReason?: string;
    };
    bmChecklist: {
      included: boolean;
      score: number | null;
      weight: number;
      contribution: number | null;
      visitCount: number;
      status: StoreScoreComponentStatus;
      missingReason?: string;
    };
    vmChecklist: {
      included: false;
      score: null;
      weight: number;
      contribution: null;
      visitCount: 0;
      status: "future_inactive";
    };
  };
};
