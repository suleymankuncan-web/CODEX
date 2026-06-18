import { Injectable, NotFoundException } from "@nestjs/common";
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
  status: Exclude<SalesTargetIncentiveCalculationStatus, "excluded">;
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
    const projection = await this.readModelService.buildCurrentProjection({
      periodKey: this.resolvePeriodKey(input.periodKey),
      companyIds: input.actor.readScope.companyIds,
      regionIds: input.actor.readScope.companyIds.length
        ? []
        : input.actor.readScope.regionIds,
      storeIds:
        input.actor.readScope.companyIds.length || input.actor.readScope.regionIds.length
          ? []
          : input.actor.readScope.storeIds,
      allowGlobalScope: this.hasNoReadScope(input.actor),
    });

    return this.toApiResponse({
      projection,
      stores: projection.stores,
      roleScope: "admin",
    });
  }

  private toApiResponse(input: {
    projection: SalesTargetIncentiveProjectionReadModel;
    stores: SalesTargetIncentiveProjectionStore[];
    roleScope: SalesTargetIncentiveRoleScope;
  }): SalesTargetIncentiveApiResponse {
    return {
      data: {
        period: input.projection.periodKey,
        periodStart: input.projection.periodStart,
        periodEnd: input.projection.periodEnd,
        periodTimezone: input.projection.timezone,
        roleScope: input.roleScope,
        projections: input.stores.map((store) =>
          this.toApiProjection(store, input.projection.periodKey, input.roleScope),
        ),
      },
    };
  }

  private toApiProjection(
    store: SalesTargetIncentiveProjectionStore,
    period: string,
    roleScope: SalesTargetIncentiveRoleScope,
  ): SalesTargetIncentiveApiProjection {
    const rows = [
      ...(store.manager ? [store.manager] : []),
      ...store.personnel,
    ].map((participant) => this.toApiRow(participant));
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
  ): SalesTargetIncentiveApiRow {
    const calculation = participant.calculation;

    if (calculation.status === "excluded") {
      throw new NotFoundException("Incentive projection is not available");
    }

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
      correctionAmount: null,
      adjustmentAmount: null,
      finalAmount: null,
      status: calculation.status,
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

  private hasNoReadScope(actor: AuthenticatedUser) {
    return (
      actor.readScope.companyIds.length === 0 &&
      actor.readScope.regionIds.length === 0 &&
      actor.readScope.storeIds.length === 0
    );
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
