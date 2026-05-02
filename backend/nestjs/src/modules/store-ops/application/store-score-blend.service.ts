import {
  StoreChecklistScoreInput,
  StoreScoreBlendConfig,
  StoreScoreBlendInput,
  StoreScoreBlendResult,
} from "./store-score-blend.contract";

export class StoreScoreBlendService {
  calculateMonthlyStoreScore(input: StoreScoreBlendInput): StoreScoreBlendResult {
    const monthlyKpiScore = input.monthlyKpiScore;
    const hasKpiScore =
      typeof monthlyKpiScore === "number" && Number.isFinite(monthlyKpiScore);
    const hasBmChecklist = this.hasChecklist(input.bmChecklist);
    const hasVmChecklist = this.hasChecklist(input.vmChecklist);
    const configuredWeights = this.configuredWeights(input.config);
    const effectiveWeights = this.effectiveWeights({
      config: input.config,
      hasBmChecklist,
      hasVmChecklist,
    });
    const bmChecklist = this.checklistComponent({
      checklist: input.bmChecklist,
      configuredWeight: configuredWeights.bmChecklistWeight,
      effectiveWeight: effectiveWeights.bmChecklistWeight,
      hasKpiScore,
      missingReason: "bm_checklist_not_completed_for_period",
    });
    const vmChecklist = this.checklistComponent({
      checklist: input.vmChecklist,
      configuredWeight: configuredWeights.vmChecklistWeight,
      effectiveWeight: effectiveWeights.vmChecklistWeight,
      hasKpiScore,
      missingReason: "vm_checklist_not_completed_for_period",
    });

    if (!hasKpiScore) {
      return {
        totalScore: null,
        missingWeightPolicy: input.config.missingWeightPolicy ?? "return_missing_weight_to_kpi",
        configuredWeights,
        effectiveWeights,
        components: {
          kpi: {
            included: false,
            score: null,
            weight: 0,
            contribution: null,
            status: "missing_reference",
            missingReason: "monthly_kpi_score_missing",
          },
          bmChecklist,
          vmChecklist,
        },
      };
    }

    const kpiContribution = this.round(
      monthlyKpiScore * (effectiveWeights.kpiPerformanceWeight / 100),
    );
    const totalScore = this.round(
      kpiContribution +
        (bmChecklist.contribution ?? 0) +
        (vmChecklist.contribution ?? 0),
    );

    return {
      totalScore,
      missingWeightPolicy: input.config.missingWeightPolicy ?? "return_missing_weight_to_kpi",
      configuredWeights,
      effectiveWeights,
      components: {
        kpi: {
          included: true,
          score: monthlyKpiScore,
          weight: effectiveWeights.kpiPerformanceWeight,
          contribution: kpiContribution,
          status: "included",
        },
        bmChecklist,
        vmChecklist,
      },
    };
  }

  private hasChecklist(input: StoreChecklistScoreInput | null) {
    return (
      input !== null && Number.isFinite(input.score) && input.visitCount > 0
    );
  }

  private configuredWeights(config: StoreScoreBlendConfig) {
    return {
      kpiPerformanceWeight: config.kpiPerformanceWeight,
      bmChecklistWeight: config.bmChecklistWeight,
      vmChecklistWeight: config.vmChecklistWeight,
    };
  }

  private effectiveWeights(input: {
    config: StoreScoreBlendConfig;
    hasBmChecklist: boolean;
    hasVmChecklist: boolean;
  }) {
    const weights = this.configuredWeights(input.config);

    if (!input.hasBmChecklist) {
      weights.kpiPerformanceWeight += weights.bmChecklistWeight;
      weights.bmChecklistWeight = 0;
    }

    if (!input.hasVmChecklist) {
      weights.kpiPerformanceWeight += weights.vmChecklistWeight;
      weights.vmChecklistWeight = 0;
    }

    return weights;
  }

  private checklistComponent(input: {
    checklist: StoreChecklistScoreInput | null;
    configuredWeight: number;
    effectiveWeight: number;
    hasKpiScore: boolean;
    missingReason: string;
  }): StoreScoreBlendResult["components"]["bmChecklist"] {
    const hasChecklist = this.hasChecklist(input.checklist);

    if (!hasChecklist) {
      return {
        included: false,
        score: null,
        weight: 0,
        contribution: null,
        visitCount: 0,
        status: "not_included",
        missingReason: input.missingReason,
      };
    }

    const contribution = input.hasKpiScore
      ? this.round(input.checklist!.score * (input.effectiveWeight / 100))
      : null;

    return {
      included: true,
      score: input.checklist!.score,
      weight: input.hasKpiScore ? input.effectiveWeight : input.configuredWeight,
      contribution,
      visitCount: input.checklist!.visitCount,
      status: "included",
    };
  }

  private round(value: number) {
    return Number(value.toFixed(2));
  }
}
