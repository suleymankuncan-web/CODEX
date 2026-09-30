import type { SALES_TARGET_INCENTIVE_TIMEZONE, SalesTargetIncentiveCalculationStatus } from "./sales-target-incentive-calculator.service";
import type { SalesTargetIncentiveCloseReadiness } from "./sales-target-incentive-read-model.service";
import type { SalesTargetIncentiveAdjustmentSummaryRow } from "../infrastructure/incentive-adjustment-summary.contract";
import type { SalesTargetIncentiveCloseRunSummary } from "../infrastructure/sales-target-incentive-close.repository";
import type { SalesTargetIncentiveRegionCorrectionApiState, SalesTargetIncentiveRegionWorkflowApiState, SalesTargetIncentiveStoreReviewApiState } from "./sales-target-incentive-region-workflow.service";
import type { SalesTargetIncentiveAdminRegionPackageSummary } from "./sales-target-incentive-admin-package-workflow.service";

export type SalesTargetIncentiveRoleScope =
  | "own"
  | "store"
  | "region"
  | "admin";

export type SalesTargetIncentiveApiRow = {
  employeeId: string;
  displayName: string;
  participantType: "store_manager" | "personnel";
  positionCode: "STORE_MANAGER" | "ASSISTANT_MANAGER" | "SENIOR_SALES_CONSULTANT" | "SALES_ASSOCIATE";
  normalizedFromPositionCode: "SHIFT_LEAD" | null;
  target: string | null;
  actualPositiveSales: string | null;
  achievementPct: string | null;
  storeAchievementPct: string | null;
  storeGatePassed: boolean | null;
  rate: string | null;
  rawEarnedAmount: string | null;
  payableAmount: string | null;
  correctionAmount: string | null;
  adjustmentAmount: string | null;
  finalAmount: string | null;
  calculatedFinalAmount?: string | null;
  participation?: SalesTargetIncentiveAdjustmentSummaryRow["participation"];
  status: Exclude<SalesTargetIncentiveCalculationStatus, "excluded"> | "corrected" | "adjusted";
  blockedReason: string | null;
  rateTableVersion: string;
  explanation: string;
  regionCorrection: SalesTargetIncentiveRegionCorrectionApiState | null;
};

export type SalesTargetIncentiveApiProjection = {
  period: string;
  periodTimezone: typeof SALES_TARGET_INCENTIVE_TIMEZONE;
  closeCutoffAt: string | null;
  ruleVersionId: string;
  regionId: string;
  storeId: string;
  storeName: string;
  storeOwnershipType: "company";
  roleScope: SalesTargetIncentiveRoleScope;
  storeTarget: string | null;
  storeActualNetSales: string | null;
  storeAchievementPct: string | null;
  storeGatePassed: boolean | null;
  calculationState: Exclude<SalesTargetIncentiveCalculationStatus, "excluded">;
  blockedReason: string | null;
  lastImportAt: string | null;
  review: SalesTargetIncentiveStoreReviewApiState | null;
  rows: SalesTargetIncentiveApiRow[];
};

export type SalesTargetIncentiveApiResponse = {
  data: {
    period: string;
    periodStart: string;
    periodEnd: string;
    periodTimezone: typeof SALES_TARGET_INCENTIVE_TIMEZONE;
    roleScope: SalesTargetIncentiveRoleScope;
    regionWorkflow: SalesTargetIncentiveRegionWorkflowApiState | null;
    regionPackages?: SalesTargetIncentiveAdminRegionPackageSummary[];
    projections: SalesTargetIncentiveApiProjection[];
  };
};

export type SalesTargetIncentiveCloseStatusResponse = {
  data: {
    period: string;
    periodStart: string;
    periodEnd: string;
    periodTimezone: typeof SALES_TARGET_INCENTIVE_TIMEZONE;
    closeCutoffAt: string;
    readiness: SalesTargetIncentiveCloseReadiness;
    closeRuns: SalesTargetIncentiveCloseRunSummary[];
  };
};

export type SalesTargetIncentiveCloseRunResponse = {
  data: {
    period: string;
    periodStart: string;
    periodEnd: string;
    periodTimezone: typeof SALES_TARGET_INCENTIVE_TIMEZONE;
    closeCutoffAt: string;
    readiness: SalesTargetIncentiveCloseReadiness;
    closeRuns: SalesTargetIncentiveCloseRunSummary[];
    finalSnapshotCount: number;
    finalRowCount: number;
  };
};

