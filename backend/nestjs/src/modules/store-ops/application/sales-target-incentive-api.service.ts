import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/auth-context.service";
import {
  SALES_TARGET_INCENTIVE_RULE_VERSION,
  SALES_TARGET_INCENTIVE_TIMEZONE,
  type SalesTargetIncentiveCalculationStatus,
} from "./sales-target-incentive-calculator.service";
import {
  SalesTargetIncentiveReadModelService,
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
  rows: SalesTargetIncentiveApiRow[];
};

export type SalesTargetIncentiveApiResponse = {
  data: {
    period: string;
    periodStart: string;
    periodEnd: string;
    periodTimezone: typeof SALES_TARGET_INCENTIVE_TIMEZONE;
    roleScope: SalesTargetIncentiveRoleScope;
    projections: SalesTargetIncentiveApiProjection[];
  };
};

@Injectable()
export class SalesTargetIncentiveApiService {
  constructor(
    private readonly readModelService: SalesTargetIncentiveReadModelService,
    private readonly correctionRepository: SalesTargetIncentiveCorrectionRepository,
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

    return this.toApiResponse({
      projection,
      stores: projection.stores,
      roleScope: "admin",
    });
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
      });
    } catch (error) {
      if (error instanceof SalesTargetIncentiveClosedPeriodTargetError) {
        throw new BadRequestException("Correction target is closed for this period");
      }

      throw error;
    }

    return { data: result };
  }

  private async toApiResponse(input: {
    projection: SalesTargetIncentiveProjectionReadModel;
    stores: SalesTargetIncentiveProjectionStore[];
    roleScope: SalesTargetIncentiveRoleScope;
  }): Promise<SalesTargetIncentiveApiResponse> {
    const adjustmentSummaries =
      await this.correctionRepository.listApprovedAdjustmentSummaries({
        periodKey: input.projection.periodKey,
        storeIds: input.stores.map((store) => store.storeId),
      });

    return {
      data: {
        period: input.projection.periodKey,
        periodStart: input.projection.periodStart,
        periodEnd: input.projection.periodEnd,
        periodTimezone: input.projection.timezone,
        roleScope: input.roleScope,
        projections: input.stores.map((store) =>
          this.toApiProjection(
            store,
            input.projection.periodKey,
            input.roleScope,
            adjustmentSummaries,
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
  ): SalesTargetIncentiveApiProjection {
    const rows = [
      ...(store.manager ? [store.manager] : []),
      ...store.personnel,
    ].map((participant) =>
      this.toApiRow(
        participant,
        adjustmentSummaries.find(
          (summary) =>
            summary.store_id === store.storeId &&
            summary.employee_id === participant.employeeId &&
            summary.participant_type === participant.participantType,
        ) ?? null,
      ),
    );
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
      calculationState: this.resolveProjectionStatus(rows),
      blockedReason: rows.find((row) => row.blockedReason)?.blockedReason ?? null,
      lastImportAt: store.storeNetSalesLastSyncedAt,
      rows,
    };
  }

  private toApiRow(
    participant: SalesTargetIncentiveParticipantProjection,
    adjustmentSummary: SalesTargetIncentiveAdjustmentSummaryRow | null,
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
    const finalAmount = resolveFinalAmount({
      payableAmount: calculation.payableAmount,
      correctionAmount,
      adjustmentAmount,
      persistedFinalAmount: adjustmentSummary?.final_amount ?? null,
    });
    const status: SalesTargetIncentiveApiRow["status"] = adjustmentAmount
      ? "adjusted"
      : correctionAmount
        ? "corrected"
        : calculation.status;

    return {
      employeeId: participant.employeeId,
      displayName: participant.displayName,
      participantType: participant.participantType,
      positionCode: participant.positionCode,
      normalizedFromPositionCode: participant.normalizedFromPositionCode,
      target: participant.targetAmount,
      actualPositiveSales: participant.actualAmount,
      achievementPct: calculation.achievementPct,
      storeAchievementPct: calculation.storeAchievementPct,
      storeGatePassed: calculation.storeGatePassed,
      rate: calculation.rate,
      rawEarnedAmount: calculation.rawEarnedAmount,
      payableAmount: calculation.payableAmount,
      correctionAmount,
      adjustmentAmount,
      finalAmount,
      status,
      blockedReason: calculation.blockedReason,
      rateTableVersion: calculation.rateTableVersion,
      explanation: this.resolveExplanation(calculation.status, calculation.blockedReason),
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

  private resolvePeriodKey(periodKey?: string) {
    if (periodKey) {
      return periodKey;
    }

    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: SALES_TARGET_INCENTIVE_TIMEZONE,
      year: "numeric",
      month: "2-digit",
    }).formatToParts(new Date());
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;

    if (!year || !month) {
      throw new Error("Unable to resolve incentive period");
    }

    return `${year}-${month}`;
  }
}

function isZeroMoney(value: string) {
  return parseMoneyCents(value) === 0n;
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

  const base = input.payableAmount ? parseMoneyCents(input.payableAmount) : 0n;
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
