import {
  StoreScoreBlendInput,
  StoreScoreBlendResult,
} from "./store-score-blend.contract";

export class StoreScoreBlendService {
  calculateMonthlyStoreScore(input: StoreScoreBlendInput): StoreScoreBlendResult {
    const monthlyKpiScore = input.monthlyKpiScore;
    const hasKpiScore =
      typeof monthlyKpiScore === "number" && Number.isFinite(monthlyKpiScore);
    const hasBmChecklist =
      input.bmChecklist !== null &&
      Number.isFinite(input.bmChecklist.score) &&
      input.bmChecklist.visitCount > 0;

    if (!hasKpiScore) {
      return {
        totalScore: null,
        components: {
          kpi: {
            included: false,
            score: null,
            weight: 0,
            contribution: null,
            status: "missing_reference",
            missingReason: "monthly_kpi_score_missing",
          },
          bmChecklist: {
            included: hasBmChecklist,
            score: hasBmChecklist ? input.bmChecklist!.score : null,
            weight: hasBmChecklist ? input.config.bmChecklistWeight : 0,
            contribution: hasBmChecklist ? 0 : null,
            visitCount: hasBmChecklist ? input.bmChecklist!.visitCount : 0,
            status: hasBmChecklist ? "included" : "not_included",
          },
          vmChecklist: this.futureInactiveVm(input.config.vmChecklistWeight),
        },
      };
    }

    if (!hasBmChecklist) {
      return {
        totalScore: this.round(monthlyKpiScore),
        components: {
          kpi: {
            included: true,
            score: monthlyKpiScore,
            weight: 100,
            contribution: this.round(monthlyKpiScore),
            status: "included",
          },
          bmChecklist: {
            included: false,
            score: null,
            weight: 0,
            contribution: null,
            visitCount: 0,
            status: "not_included",
            missingReason: "bm_checklist_not_completed_for_period",
          },
          vmChecklist: this.futureInactiveVm(input.config.vmChecklistWeight),
        },
      };
    }

    const kpiContribution =
      monthlyKpiScore * (input.config.kpiPerformanceWeight / 100);
    const bmContribution =
      input.bmChecklist!.score * (input.config.bmChecklistWeight / 100);

    return {
      totalScore: this.round(kpiContribution + bmContribution),
      components: {
        kpi: {
          included: true,
          score: monthlyKpiScore,
          weight: input.config.kpiPerformanceWeight,
          contribution: this.round(kpiContribution),
          status: "included",
        },
        bmChecklist: {
          included: true,
          score: input.bmChecklist!.score,
          weight: input.config.bmChecklistWeight,
          contribution: this.round(bmContribution),
          visitCount: input.bmChecklist!.visitCount,
          status: "included",
        },
        vmChecklist: this.futureInactiveVm(input.config.vmChecklistWeight),
      },
    };
  }

  private futureInactiveVm(
    weight: number,
  ): StoreScoreBlendResult["components"]["vmChecklist"] {
    return {
      included: false,
      score: null,
      weight,
      contribution: null,
      visitCount: 0,
      status: "future_inactive",
    };
  }

  private round(value: number) {
    return Number(value.toFixed(2));
  }
}
