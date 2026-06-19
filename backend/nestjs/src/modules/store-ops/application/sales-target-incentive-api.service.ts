import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/auth-context.service";
import {
  SALES_TARGET_INCENTIVE_RULE_VERSION,
  SALES_TARGET_INCENTIVE_TIMEZONE,
  type SalesTargetIncentiveCalculationStatus,
} from "./sales-target-incentive-calculator.service";
import {
  SalesTargetIncentiveReadModelService,
  type SalesTargetIncentiveCloseReadiness,
  type SalesTargetIncentiveParticipantProjection,
  type SalesTargetIncentiveProjectionReadModel,
  type SalesTargetIncentiveProjectionStore,
} from "./sales-target-incentive-read-model.service";
import {
  SalesTargetIncentiveClosedPeriodTargetError,
  SalesTargetIncentiveCorrectionRepository,
  type SalesTargetIncentiveAdjustmentSummaryRow,
  type SalesTargetIncentiveCorrectionResult,
} from "../infrastructure/sales-target-incentive-correction.repository";
import {
  SalesTargetIncentiveCloseRepository,
  type SalesTargetIncentiveCloseRunSummary,
} from "../infrastructure/sales-target-incentive-close.repository";
import {
  correctionKey,
  SalesTargetIncentiveRegionWorkflowService,
  type SalesTargetIncentiveRegionCorrectionApiState,
  type SalesTargetIncentiveRegionWorkflowApiState,
  type SalesTargetIncentiveRegionWorkflowContext,
  type SalesTargetIncentiveStoreReviewApiState,
} from "./sales-target-incentive-region-workflow.service";
import {
  SalesTargetIncentiveAdminPackageWorkflowService,
  resolveSalesTargetIncentivePeriodKey,
  type SalesTargetIncentiveAdminRegionPackageSummary,
} from "./sales-target-incentive-admin-package-workflow.service";

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
  ruleVersionId: typeof SALES_TARGET_INCENTIVE_RULE_VERSION;
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

@Injectable()
export class SalesTargetIncentiveApiService {
  constructor(
    private readonly readModelService: SalesTargetIncentiveReadModelService,
    private readonly correctionRepository: SalesTargetIncentiveCorrectionRepository,
    private readonly closeRepository: SalesTargetIncentiveCloseRepository,
    private readonly regionWorkflowService: SalesTargetIncentiveRegionWorkflowService,
    private readonly adminPackageWorkflowService: SalesTargetIncentiveAdminPackageWorkflowService,
  ) {}

  async getOwnStoreMeProjection(input: {
    actor: AuthenticatedUser;
    periodKey?: string;
  }): Promise<SalesTargetIncentiveApiResponse> {
    if (!input.actor.employeeId) {
      throw new NotFoundException("Incentive projection is not available");
    }

    const projection = await this.readModelService.buildCurrentProjection({
      periodKey: this.resolvePeriodKey(input.periodKey),
      companyIds: input.actor.readScope.companyIds,
      regionIds: [],
      storeIds: this.resolveAssignedOrReadStores(input.actor),
    });
    const stores = projection.stores
      .map((store) => ({
        ...store,
        manager: null,
        personnel: store.personnel.filter(
          (participant) => participant.employeeId === input.actor.employeeId,
        ),
      }))
      .filter((store) => store.personnel.length > 0);

    if (stores.length === 0) {
      throw new NotFoundException("Incentive projection is not available");
    }

    return this.toApiResponse({
      projection,
      stores,
      roleScope: "own",
    });
  }

  async getStoreProjection(input: {
    actor: AuthenticatedUser;
    periodKey?: string;
  }): Promise<SalesTargetIncentiveApiResponse> {
    const roleScope = input.actor.roleCodes.includes("REGION_MANAGER")
      ? "region"
      : "store";
    const storeIds = input.actor.roleCodes.includes("REGION_MANAGER")
      ? input.actor.assignedStoreIds
      : this.resolveAssignedOrReadStores(input.actor);
    const projection = await this.readModelService.buildCurrentProjection({
      periodKey: this.resolvePeriodKey(input.periodKey),
      companyIds: [],
      regionIds: [],
      storeIds,
    });

    return this.toApiResponse({
      projection,
      stores: projection.stores,
      roleScope,
    });
  }

  async getAdminProjection(input: {
    actor: AuthenticatedUser;
    periodKey?: string;
  }): Promise<SalesTargetIncentiveApiResponse> {
    const adminScope = this.resolveSuperAdminReadScope(input.actor);
    const periodKey = this.resolvePeriodKey(input.periodKey);
    const [projection, regionPackages] = await Promise.all([
      this.readModelService.buildCurrentProjection({
        periodKey,
        companyIds: adminScope.companyIds,
        regionIds: adminScope.companyIds.length
          ? []
          : adminScope.regionIds,
        storeIds:
          adminScope.companyIds.length || adminScope.regionIds.length
            ? []
            : adminScope.storeIds,
        allowGlobalScope: this.hasNoReadScope({ readScope: adminScope }),
      }),
      this.adminPackageWorkflowService.listRegionPackages({
        actor: input.actor,
        periodKey,
      }),
    ]);

    return this.toApiResponse({
      projection,
      stores: projection.stores,
      roleScope: "admin",
      regionPackages,
    });
  }

  async reviewRegionPackage(input: {
    actor: AuthenticatedUser;
    periodKey: string;
    regionId: string;
    decision: "approve" | "return";
    reviewNote?: string | null;
  }) {
    return this.adminPackageWorkflowService.reviewRegionPackage({
      ...input,
      periodKey: this.resolvePeriodKey(input.periodKey),
    });
  }

  async getAdminCloseStatus(input: {
    actor: AuthenticatedUser;
    periodKey?: string;
    closeCutoffAt?: string;
  }): Promise<SalesTargetIncentiveCloseStatusResponse> {
    if (!input.actor.roleCodes.includes("SUPER_ADMIN")) {
      throw new ForbiddenException("Incentive close is not available");
    }

    const periodKey = this.resolvePeriodKey(input.periodKey);
    const closeCutoffAt = input.closeCutoffAt ?? new Date().toISOString();
    const companyIds = this.resolveCloseCompanyIds(input.actor);
    const [readiness, closeRuns] = await Promise.all([
      this.readModelService.getCloseReadiness({
        periodKey,
        companyIds,
        nowIso: closeCutoffAt,
        closeCutoffAt,
      }),
      this.closeRepository.listCloseRuns({
        periodKey,
        companyIds,
      }),
    ]);

    return {
      data: {
        period: periodKey,
        periodStart: readiness.periodStart,
        periodEnd: readiness.periodEnd,
        periodTimezone: SALES_TARGET_INCENTIVE_TIMEZONE,
        closeCutoffAt,
        readiness,
        closeRuns,
      },
    };
  }

  async runAdminClose(input: {
    actor: AuthenticatedUser;
    periodKey: string;
    closeCutoffAt?: string;
  }): Promise<SalesTargetIncentiveCloseRunResponse> {
    if (!input.actor.roleCodes.includes("SUPER_ADMIN")) {
      throw new ForbiddenException("Incentive close is not available");
    }

    const periodKey = this.resolvePeriodKey(input.periodKey);
    const closeCutoffAt = input.closeCutoffAt ?? new Date().toISOString();
    const companyIds = this.resolveCloseCompanyIds(input.actor);
    const readiness = await this.readModelService.getCloseReadiness({
      periodKey,
      companyIds,
      nowIso: closeCutoffAt,
      closeCutoffAt,
    });

    if (!readiness.canClose) {
      throw new BadRequestException(`Incentive close is ${readiness.status}`);
    }

    const projection = await this.readModelService.buildCurrentProjection({
      periodKey,
      companyIds,
      regionIds: [],
      storeIds: [],
      assignmentAsOfDate: readiness.periodEnd,
      closeCutoffAt,
    });
    const storesByCompany = groupStoresByCompany(projection.stores);

    if (storesByCompany.size === 0) {
      throw new BadRequestException("No company-store incentive projections are available to close");
    }

    const closeRuns: SalesTargetIncentiveCloseRunSummary[] = [];
    for (const [companyId, stores] of storesByCompany) {
      closeRuns.push(
        await this.closeRepository.createSucceededCloseRun({
          companyId,
          periodKey: projection.periodKey,
          periodStart: projection.periodStart,
          periodEnd: projection.periodEnd,
          closeCutoffAt,
          actorUserId: input.actor.userId,
          stores,
        }),
      );
    }

    return {
      data: {
        period: projection.periodKey,
        periodStart: projection.periodStart,
        periodEnd: projection.periodEnd,
        periodTimezone: projection.timezone,
        closeCutoffAt,
        readiness,
        closeRuns,
        finalSnapshotCount: closeRuns.reduce(
          (total, run) => total + run.finalSnapshotCount,
          0,
        ),
        finalRowCount: closeRuns.reduce(
          (total, run) => total + run.finalRowCount,
          0,
        ),
      },
    };
  }

  async applyAdminCorrection(input: {
    actor: AuthenticatedUser;
    periodKey: string;
    storeId: string;
    employeeId: string;
    participantType: "store_manager" | "personnel";
    adjustmentAmount: string;
    reasonCode: string;
    reasonNote: string;
  }): Promise<{ data: SalesTargetIncentiveCorrectionResult }> {
    if (!input.actor.roleCodes.includes("SUPER_ADMIN")) {
      throw new ForbiddenException("Incentive correction is not available");
    }

    if (isZeroMoney(input.adjustmentAmount)) {
      throw new BadRequestException("Correction amount must not be zero");
    }

    const adminScope = this.resolveSuperAdminReadScope(input.actor);
    const projection = await this.readModelService.buildCurrentProjection({
      periodKey: this.resolvePeriodKey(input.periodKey),
      companyIds: adminScope.companyIds,
      regionIds: adminScope.companyIds.length
        ? []
        : adminScope.regionIds,
      storeIds:
        adminScope.companyIds.length || adminScope.regionIds.length
          ? []
          : adminScope.storeIds,
      allowGlobalScope: this.hasNoReadScope({ readScope: adminScope }),
    });
    const store = projection.stores.find((candidate) => candidate.storeId === input.storeId);
    const participant = store
      ? [
          ...(store.manager ? [store.manager] : []),
          ...store.personnel,
        ].find(
          (row) =>
            row.employeeId === input.employeeId &&
            row.participantType === input.participantType,
        )
      : null;

    if (!store || !participant || participant.calculation.payableAmount === null) {
      const finalRowResult = await this.correctionRepository.applyAdminFinalRowCorrection({
        periodKey: projection.periodKey,
        storeId: input.storeId,
        employeeId: input.employeeId,
        participantType: input.participantType,
        adjustmentAmount: input.adjustmentAmount,
        reasonCode: input.reasonCode,
        reasonNote: input.reasonNote,
        actorUserId: input.actor.userId,
        readScope: {
          companyIds: adminScope.companyIds,
          regionIds: adminScope.regionIds,
          storeIds: adminScope.storeIds,
          allowGlobalScope: this.hasNoReadScope({ readScope: adminScope }),
        },
      });

      if (finalRowResult) {
        return { data: finalRowResult };
      }

      if (!store || !participant) {
        throw new NotFoundException("Incentive projection is not available");
      }

      throw new BadRequestException("Correction target is not payable");
    }

    let result: SalesTargetIncentiveCorrectionResult;
    try {
      result = await this.correctionRepository.applyAdminCorrection({
        periodKey: projection.periodKey,
        periodStart: projection.periodStart,
        periodEnd: projection.periodEnd,
        store,
        participant,
        adjustmentAmount: input.adjustmentAmount,
        reasonCode: input.reasonCode,
        reasonNote: input.reasonNote,
        actorUserId: input.actor.userId,
        readScope: {
          companyIds: adminScope.companyIds,
          regionIds: adminScope.regionIds,
          storeIds: adminScope.storeIds,
          allowGlobalScope: this.hasNoReadScope({ readScope: adminScope }),
        },
      });
    } catch (error) {
      if (error instanceof SalesTargetIncentiveClosedPeriodTargetError) {
        throw new BadRequestException("Correction target is closed for this period");
      }

      throw error;
    }

    return { data: result };
  }

  async markStoreReview(input: {
    actor: AuthenticatedUser;
    periodKey: string;
    storeId: string;
    reviewStatus: "pending_review" | "reviewed";
  }) {
    return this.regionWorkflowService.markStoreReview({
      ...input,
      periodKey: this.resolvePeriodKey(input.periodKey),
    });
  }

  async createRegionCorrection(input: {
    actor: AuthenticatedUser;
    periodKey: string;
    storeId: string;
    employeeId: string;
    participantType: "store_manager" | "personnel";
    finalAmount: string;
    reasonNote: string;
  }) {
    return this.regionWorkflowService.createRegionCorrection({
      ...input,
      periodKey: this.resolvePeriodKey(input.periodKey),
    });
  }

  async voidRegionCorrection(input: {
    actor: AuthenticatedUser;
    periodKey: string;
    correctionId: string;
  }) {
    return this.regionWorkflowService.voidRegionCorrection({
      ...input,
      periodKey: this.resolvePeriodKey(input.periodKey),
    });
  }

  async submitRegionPackage(input: {
    actor: AuthenticatedUser;
    periodKey: string;
    regionId: string;
    submissionNote?: string | null;
  }) {
    return this.regionWorkflowService.submitRegionPackage({
      ...input,
      periodKey: this.resolvePeriodKey(input.periodKey),
    });
  }

  private async toApiResponse(input: {
    projection: SalesTargetIncentiveProjectionReadModel;
    stores: SalesTargetIncentiveProjectionStore[];
    roleScope: SalesTargetIncentiveRoleScope;
    regionPackages?: SalesTargetIncentiveAdminRegionPackageSummary[];
  }): Promise<SalesTargetIncentiveApiResponse> {
    const [adjustmentSummaries, workflowContext] = await Promise.all([
      this.correctionRepository.listApprovedAdjustmentSummaries({
        periodKey: input.projection.periodKey,
        storeIds: input.stores.map((store) => store.storeId),
        includeFinalRows: input.roleScope === "admin" || input.roleScope === "region",
      }),
      this.regionWorkflowService.getWorkflowContext({
        periodKey: input.projection.periodKey,
        stores: input.stores,
        roleScope: input.roleScope,
      }),
    ]);

    return {
      data: {
        period: input.projection.periodKey,
        periodStart: input.projection.periodStart,
        periodEnd: input.projection.periodEnd,
        periodTimezone: input.projection.timezone,
        roleScope: input.roleScope,
        regionWorkflow: workflowContext.regionWorkflow,
        ...(input.regionPackages ? { regionPackages: input.regionPackages } : {}),
        projections: input.stores.map((store) =>
          this.toApiProjection(
            store,
            input.projection.periodKey,
            input.roleScope,
            adjustmentSummaries,
            workflowContext,
          ),
        ),
      },
    };
  }

  private toApiProjection(
    store: SalesTargetIncentiveProjectionStore,
    period: string,
    roleScope: SalesTargetIncentiveRoleScope,
    adjustmentSummaries: SalesTargetIncentiveAdjustmentSummaryRow[],
    workflowContext: SalesTargetIncentiveRegionWorkflowContext,
  ): SalesTargetIncentiveApiProjection {
    const rows = [
      ...(store.manager ? [store.manager] : []),
      ...store.personnel,
    ].map((participant) =>
      this.toApiRow(
        store.storeId,
        participant,
        adjustmentSummaries.find(
          (summary) =>
            summary.store_id === store.storeId &&
            summary.employee_id === participant.employeeId &&
            summary.participant_type === participant.participantType,
        ) ?? null,
        workflowContext,
      ),
    );
    const visibleRowKeys = new Set(
      rows.map((row) => `${row.employeeId}:${row.participantType}`),
    );
    const finalOnlyRows = roleScope === "admin" || roleScope === "region"
      ? adjustmentSummaries
          .filter(
            (summary) =>
              summary.store_id === store.storeId &&
              summary.final_amount !== null &&
              !visibleRowKeys.has(`${summary.employee_id}:${summary.participant_type}`),
          )
          .map((summary) => this.toFinalOnlyApiRow(summary, workflowContext))
      : [];
    const allRows = [...rows, ...finalOnlyRows];
    const primaryCalculation = store.manager?.calculation ?? store.personnel[0]?.calculation;

    return {
      period,
      periodTimezone: SALES_TARGET_INCENTIVE_TIMEZONE,
      closeCutoffAt: null,
      ruleVersionId: SALES_TARGET_INCENTIVE_RULE_VERSION,
      storeId: store.storeId,
      storeName: store.storeName,
      storeOwnershipType: "company",
      roleScope,
      storeTarget: store.storeTargetAmount,
      storeActualNetSales: store.storeNetSalesAmount,
      storeAchievementPct: primaryCalculation?.storeAchievementPct ??
        primaryCalculation?.achievementPct ??
        null,
      storeGatePassed: store.personnel[0]?.calculation.storeGatePassed ?? null,
      calculationState: this.resolveProjectionStatus(allRows),
      blockedReason: allRows.find((row) => row.blockedReason)?.blockedReason ?? null,
      lastImportAt: store.storeNetSalesLastSyncedAt,
      review: workflowContext.reviewsByStoreId.get(store.storeId) ?? null,
      rows: allRows,
    };
  }

  private toApiRow(
    storeId: string,
    participant: SalesTargetIncentiveParticipantProjection,
    adjustmentSummary: SalesTargetIncentiveAdjustmentSummaryRow | null,
    workflowContext: SalesTargetIncentiveRegionWorkflowContext,
  ): SalesTargetIncentiveApiRow {
    const calculation = participant.calculation;

    if (calculation.status === "excluded") {
      throw new NotFoundException("Incentive projection is not available");
    }

    const correctionAmount =
      adjustmentSummary && !isZeroMoney(adjustmentSummary.correction_amount)
        ? formatMoney2(adjustmentSummary.correction_amount)
        : null;
    const adjustmentAmount =
      adjustmentSummary && !isZeroMoney(adjustmentSummary.adjustment_amount)
        ? formatMoney2(adjustmentSummary.adjustment_amount)
        : null;
    const usesFinalSnapshot = adjustmentSummary?.final_amount != null;
    const finalAmount = resolveFinalAmount({
      payableAmount: calculation.payableAmount,
      correctionAmount,
      adjustmentAmount,
      persistedFinalAmount: adjustmentSummary?.final_amount ?? null,
    });
    const canApplyCorrectionStatus =
      calculation.payableAmount !== null || adjustmentSummary?.final_amount != null;
    const baseStatus = usesFinalSnapshot
      ? resolveFinalSnapshotApiStatus(adjustmentSummary?.calculation_status)
      : calculation.status;
    const status: SalesTargetIncentiveApiRow["status"] = canApplyCorrectionStatus && adjustmentAmount
      ? "adjusted"
      : canApplyCorrectionStatus && correctionAmount
        ? "corrected"
        : baseStatus;
    const snapshotPositionCode = resolveApiPositionCode(
      adjustmentSummary?.position_code,
      participant.positionCode,
    );
    const snapshotNormalizedFromPositionCode =
      adjustmentSummary?.normalized_from_position_code === "SHIFT_LEAD" ? "SHIFT_LEAD" : null;

    return {
      employeeId: participant.employeeId,
      displayName: usesFinalSnapshot
        ? adjustmentSummary?.employee_display_name ?? participant.displayName
        : participant.displayName,
      participantType: participant.participantType,
      positionCode: usesFinalSnapshot ? snapshotPositionCode : participant.positionCode,
      normalizedFromPositionCode: usesFinalSnapshot
        ? snapshotNormalizedFromPositionCode
        : participant.normalizedFromPositionCode,
      target: usesFinalSnapshot ? adjustmentSummary?.target_amount ?? null : participant.targetAmount,
      actualPositiveSales: usesFinalSnapshot
        ? adjustmentSummary?.actual_sales_amount ?? null
        : participant.actualAmount,
      achievementPct: usesFinalSnapshot
        ? adjustmentSummary?.achievement_pct ?? null
        : calculation.achievementPct,
      storeAchievementPct: usesFinalSnapshot ? null : calculation.storeAchievementPct,
      storeGatePassed: usesFinalSnapshot ? null : calculation.storeGatePassed,
      rate: usesFinalSnapshot ? adjustmentSummary?.applied_rate ?? null : calculation.rate,
      rawEarnedAmount: usesFinalSnapshot
        ? adjustmentSummary?.raw_earned_amount ?? null
        : calculation.rawEarnedAmount,
      payableAmount: usesFinalSnapshot ? adjustmentSummary?.payable_amount ?? null : calculation.payableAmount,
      correctionAmount,
      adjustmentAmount,
      finalAmount,
      status,
      blockedReason: usesFinalSnapshot ? null : calculation.blockedReason,
      rateTableVersion: usesFinalSnapshot
        ? adjustmentSummary?.rate_table_version ?? calculation.rateTableVersion
        : calculation.rateTableVersion,
      explanation: usesFinalSnapshot
        ? "Kapali donem final satirina gore gosteriliyor."
        : this.resolveExplanation(calculation.status, calculation.blockedReason),
      regionCorrection: workflowContext.correctionsByRowKey.get(
        correctionKey(
          adjustmentSummary?.store_id ?? storeId,
          participant.employeeId,
          participant.participantType,
        ),
      ) ?? null,
    };
  }

  private toFinalOnlyApiRow(
    adjustmentSummary: SalesTargetIncentiveAdjustmentSummaryRow,
    workflowContext: SalesTargetIncentiveRegionWorkflowContext,
  ): SalesTargetIncentiveApiRow {
    const correctionAmount =
      !isZeroMoney(adjustmentSummary.correction_amount)
        ? formatMoney2(adjustmentSummary.correction_amount)
        : null;
    const adjustmentAmount =
      !isZeroMoney(adjustmentSummary.adjustment_amount)
        ? formatMoney2(adjustmentSummary.adjustment_amount)
        : null;
    const finalAmount = resolveFinalAmount({
      payableAmount: adjustmentSummary.payable_amount ?? null,
      correctionAmount,
      adjustmentAmount,
      persistedFinalAmount: adjustmentSummary.final_amount,
    });

    return {
      employeeId: adjustmentSummary.employee_id,
      displayName: adjustmentSummary.employee_display_name ?? adjustmentSummary.employee_id,
      participantType: adjustmentSummary.participant_type,
      positionCode: resolveApiPositionCode(
        adjustmentSummary.position_code,
        adjustmentSummary.participant_type === "store_manager" ? "STORE_MANAGER" : "SALES_ASSOCIATE",
      ),
      normalizedFromPositionCode:
        adjustmentSummary.normalized_from_position_code === "SHIFT_LEAD"
          ? "SHIFT_LEAD"
          : null,
      target: adjustmentSummary.target_amount ?? null,
      actualPositiveSales: adjustmentSummary.actual_sales_amount ?? null,
      achievementPct: adjustmentSummary.achievement_pct ?? null,
      storeAchievementPct: null,
      storeGatePassed: null,
      rate: adjustmentSummary.applied_rate ?? null,
      rawEarnedAmount: adjustmentSummary.raw_earned_amount ?? null,
      payableAmount: adjustmentSummary.payable_amount ?? null,
      correctionAmount,
      adjustmentAmount,
      finalAmount,
      status: adjustmentAmount ? "adjusted" : correctionAmount ? "corrected" : "projected",
      blockedReason: null,
      rateTableVersion: adjustmentSummary.rate_table_version ?? SALES_TARGET_INCENTIVE_RULE_VERSION,
      explanation: "Kapali donem final satirina gore gosteriliyor.",
      regionCorrection: workflowContext.correctionsByRowKey.get(
        correctionKey(
          adjustmentSummary.store_id,
          adjustmentSummary.employee_id,
          adjustmentSummary.participant_type,
        ),
      ) ?? null,
    };
  }

  private resolveProjectionStatus(rows: SalesTargetIncentiveApiRow[]) {
    if (rows.some((row) => row.status === "blocked")) {
      return "blocked" as const;
    }

    if (rows.some((row) => row.status === "no_source")) {
      return "no_source" as const;
    }

    return "projected" as const;
  }

  private resolveExplanation(
    status: Exclude<SalesTargetIncentiveCalculationStatus, "excluded">,
    blockedReason: string | null,
  ) {
    if (status === "projected") {
      return "Guncel hedef ve satis kaynagina gore hesaplandi.";
    }

    if (status === "no_source") {
      return "Satis kaynagi tamamlanmadan prim hesaplanmaz.";
    }

    return blockedReason
      ? "Hedef veya kaynak eksigi nedeniyle hesaplama bloke."
      : "Prim hesaplama bloke.";
  }

  private resolveAssignedOrReadStores(actor: AuthenticatedUser) {
    return actor.assignedStoreIds.length
      ? actor.assignedStoreIds
      : actor.readScope.storeIds;
  }

  private hasNoReadScope(actor: { readScope: AuthenticatedUser["readScope"] }) {
    return (
      actor.readScope.companyIds.length === 0 &&
      actor.readScope.regionIds.length === 0 &&
      actor.readScope.storeIds.length === 0
    );
  }

  private resolveSuperAdminReadScope(actor: AuthenticatedUser) {
    return actor.roleScopes?.SUPER_ADMIN ?? actor.readScope;
  }

  private resolveCloseCompanyIds(actor: AuthenticatedUser) {
    const adminScope = this.resolveSuperAdminReadScope(actor);

    if (adminScope.companyIds.length === 0) {
      throw new BadRequestException("Incentive close requires company scope");
    }

    return adminScope.companyIds;
  }

  private resolvePeriodKey(periodKey?: string) {
    return resolveSalesTargetIncentivePeriodKey(periodKey);
  }
}

function groupStoresByCompany(stores: SalesTargetIncentiveProjectionStore[]) {
  const grouped = new Map<string, SalesTargetIncentiveProjectionStore[]>();

  for (const store of stores) {
    grouped.set(store.companyId, [...(grouped.get(store.companyId) ?? []), store]);
  }

  return grouped;
}

function isZeroMoney(value: string) {
  return parseMoneyCents(value) === 0n;
}

function resolveApiPositionCode(
  value: string | null | undefined,
  fallback: SalesTargetIncentiveApiRow["positionCode"],
) {
  return value === "STORE_MANAGER" ||
    value === "ASSISTANT_MANAGER" ||
    value === "SENIOR_SALES_CONSULTANT" ||
    value === "SALES_ASSOCIATE"
    ? value
    : fallback;
}

function resolveFinalSnapshotApiStatus(
  status: string | null | undefined,
): Exclude<SalesTargetIncentiveCalculationStatus, "excluded"> {
  return status === "blocked" || status === "no_source" ? status : "projected";
}

function resolveFinalAmount(input: {
  payableAmount: string | null;
  correctionAmount: string | null;
  adjustmentAmount: string | null;
  persistedFinalAmount: string | null;
}) {
  if (input.persistedFinalAmount !== null) {
    const adjusted = input.adjustmentAmount
      ? parseMoneyCents(input.persistedFinalAmount) + parseMoneyCents(input.adjustmentAmount)
      : parseMoneyCents(input.persistedFinalAmount);
    return formatCents(adjusted);
  }

  if (!input.correctionAmount && !input.adjustmentAmount) {
    return null;
  }

  if (input.payableAmount === null) {
    return null;
  }

  const base = parseMoneyCents(input.payableAmount);
  const correction = input.correctionAmount ? parseMoneyCents(input.correctionAmount) : 0n;
  const adjustment = input.adjustmentAmount ? parseMoneyCents(input.adjustmentAmount) : 0n;
  return formatCents(base + correction + adjustment);
}

function formatMoney2(value: string) {
  return formatCents(parseMoneyCents(value));
}

function parseMoneyCents(value: string) {
  const trimmed = value.trim();
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed);

  if (!match) {
    throw new Error("Invalid money value");
  }

  const [, sign, whole, fraction = ""] = match;
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return sign === "-" ? -cents : cents;
}

function formatCents(cents: bigint) {
  const sign = cents < 0n ? "-" : "";
  const absolute = cents < 0n ? -cents : cents;
  const whole = absolute / 100n;
  const fraction = absolute % 100n;
  return `${sign}${whole.toString()}.${fraction.toString().padStart(2, "0")}`;
}
