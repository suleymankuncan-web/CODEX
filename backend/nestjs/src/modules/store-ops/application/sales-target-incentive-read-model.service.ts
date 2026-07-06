import { Injectable } from "@nestjs/common";
import {
  SalesTargetIncentiveCalculatorService,
  SALES_TARGET_INCENTIVE_TIMEZONE,
  canCloseSalesTargetIncentivePeriod,
  type SalesTargetIncentiveCalculationResult,
  type SalesTargetIncentiveEligiblePositionCode,
  type SalesTargetIncentiveInputPositionCode,
} from "./sales-target-incentive-calculator.service";
import {
  SalesTargetIncentiveReadRepository,
  type SalesTargetIncentiveCloseBlockingImportRow,
  type SalesTargetIncentiveCloseBlockingTargetRevisionRow,
  type SalesTargetIncentivePersonnelSourceRow,
  type SalesTargetIncentiveStoreSourceRow,
} from "../infrastructure/sales-target-incentive-read.repository";

export type SalesTargetIncentiveReadModelScope = {
  periodKey?: string;
  companyIds: string[];
  regionIds: string[];
  storeIds: string[];
  allowGlobalScope?: boolean;
  assignmentAsOfDate?: string;
  closeCutoffAt?: string;
};

export type SalesTargetIncentiveReadModelPeriodScope = {
  companyIds: string[];
  regionIds: string[];
  storeIds: string[];
  allowGlobalScope?: boolean;
};

export type SalesTargetIncentiveParticipantProjection = {
  participantType: "store_manager" | "personnel";
  employeeId: string;
  userId: string | null;
  assignmentId: string | null;
  assignmentStartedOn: string | null;
  assignmentEndedOn: string | null;
  positionId: string | null;
  displayName: string;
  positionCode: SalesTargetIncentiveEligiblePositionCode;
  normalizedFromPositionCode: "SHIFT_LEAD" | null;
  targetReferenceId: string | null;
  targetAmount: string | null;
  actualAmount: string | null;
  calculation: SalesTargetIncentiveCalculationResult;
  source: {
    storeTargetRequestId: string | null;
    storeNetSalesSourceBatchId: string | null;
    storeNetSalesImportBatchId: string | null;
    personnelSalesSourceBatchId: string | null;
    personnelSalesImportBatchId: string | null;
  };
};

export type SalesTargetIncentiveProjectionStore = {
  companyId: string;
  regionId: string;
  storeId: string;
  storeName: string;
  storeType: "company";
  storeTargetRequestId: string | null;
  storeTargetAmount: string | null;
  storeNetSalesAmount: string | null;
  storeNetSalesSourceBatchId: string | null;
  storeNetSalesImportBatchId: string | null;
  storeNetSalesLastSyncedAt: string | null;
  manager: SalesTargetIncentiveParticipantProjection | null;
  personnel: SalesTargetIncentiveParticipantProjection[];
};

export type SalesTargetIncentiveProjectionReadModel = {
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  timezone: typeof SALES_TARGET_INCENTIVE_TIMEZONE;
  stores: SalesTargetIncentiveProjectionStore[];
};

export type SalesTargetIncentiveCloseReadiness = {
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  canClose: boolean;
  status:
    | "ready"
    | "not_due"
    | "blocked_by_imports"
    | "blocked_by_target_revision"
    | "blocked_by_calculation";
  blockingImports: SalesTargetIncentiveCloseBlockingImportRow[];
  blockingTargetRevisions: SalesTargetIncentiveCloseBlockingTargetRevisionRow[];
};

const READ_MODEL_PERSONNEL_POSITIONS = new Set<SalesTargetIncentiveInputPositionCode>([
  "ASSISTANT_MANAGER",
  "SENIOR_SALES_CONSULTANT",
  "SALES_ASSOCIATE",
  "SHIFT_LEAD",
]);

@Injectable()
export class SalesTargetIncentiveReadModelService {
  constructor(
    private readonly repository: SalesTargetIncentiveReadRepository,
    private readonly calculator: SalesTargetIncentiveCalculatorService,
  ) {}

  async resolveDefaultPeriodKey(
    input: SalesTargetIncentiveReadModelPeriodScope,
  ) {
    const [latestPeriodKey] = await this.repository.listAvailablePeriodKeys({
      companyIds: input.companyIds,
      regionIds: input.regionIds,
      storeIds: input.storeIds,
      allowGlobalScope: input.allowGlobalScope ?? false,
      limit: 1,
    });

    return latestPeriodKey ?? resolveCurrentSalesTargetIncentivePeriodKey();
  }

  async buildCurrentProjection(
    input: SalesTargetIncentiveReadModelScope,
  ): Promise<SalesTargetIncentiveProjectionReadModel> {
    const periodKey = input.periodKey ?? await this.resolveDefaultPeriodKey(input);
    const period = resolveSalesTargetIncentiveMonthlyBounds(periodKey);
    const assignmentAsOfDate =
      input.assignmentAsOfDate ??
      resolveCurrentProjectionAssignmentAsOfDate(period.periodStart, period.periodEnd);
    const repositoryInput = {
      companyIds: input.companyIds,
      regionIds: input.regionIds,
      storeIds: input.storeIds,
      allowGlobalScope: input.allowGlobalScope ?? false,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      assignmentAsOfDate,
    };
    if (input.closeCutoffAt) {
      Object.assign(repositoryInput, { closeCutoffAt: input.closeCutoffAt });
    }
    const [storeRows, personnelRows] = await Promise.all([
      this.repository.listStoreProjectionSources(repositoryInput),
      this.repository.listPersonnelProjectionSources(repositoryInput),
    ]);
    const personnelByStore = this.groupPersonnelByStore(personnelRows);

    return {
      periodKey,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      timezone: SALES_TARGET_INCENTIVE_TIMEZONE,
      stores: storeRows
        .filter((row) => row.store_type === "company")
        .map((row) => {
          const manager = this.mapManager(row);
          const personnel = personnelByStore
            .get(row.store_id)
            ?.filter((participant) => participant.employeeId !== manager?.employeeId) ?? [];

          return {
            companyId: row.company_id,
            regionId: row.region_id,
            storeId: row.store_id,
            storeName: row.store_name,
            storeType: "company" as const,
            storeTargetRequestId: row.store_target_request_id,
            storeTargetAmount: row.store_target_amount,
            storeNetSalesAmount: row.store_net_sales_amount,
            storeNetSalesSourceBatchId: row.store_net_sales_source_batch_id,
            storeNetSalesImportBatchId: row.store_net_sales_import_batch_id,
            storeNetSalesLastSyncedAt: row.store_net_sales_last_synced_at,
            manager,
            personnel,
          };
        }),
    };
  }

  async getCloseReadiness(input: {
    periodKey: string;
    companyIds: string[];
    nowIso: string;
    closeCutoffAt: string;
  }): Promise<SalesTargetIncentiveCloseReadiness> {
    const period = resolveSalesTargetIncentiveMonthlyBounds(input.periodKey);
    const isDue = canCloseSalesTargetIncentivePeriod(
      input.periodKey,
      input.nowIso,
    );
    const blockingImports = await this.repository.listCloseBlockingKpiImports({
      companyIds: input.companyIds,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      closeCutoffAt: input.closeCutoffAt,
    });

    if (!isDue) {
      return {
        periodKey: input.periodKey,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        canClose: false,
        status: "not_due",
        blockingImports,
        blockingTargetRevisions: [],
      };
    }

    if (blockingImports.length > 0) {
      return {
        periodKey: input.periodKey,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        canClose: false,
        status: "blocked_by_imports",
        blockingImports,
        blockingTargetRevisions: [],
      };
    }

    const blockingTargetRevisions =
      await this.repository.listCloseBlockingTargetRevisions({
        companyIds: input.companyIds,
        periodStart: period.periodStart,
      });

    if (blockingTargetRevisions.length > 0) {
      return {
        periodKey: input.periodKey,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        canClose: false,
        status: "blocked_by_target_revision",
        blockingImports,
        blockingTargetRevisions,
      };
    }

    const projection = await this.buildCurrentProjection({
      periodKey: input.periodKey,
      companyIds: input.companyIds,
      regionIds: [],
      storeIds: [],
      assignmentAsOfDate: period.periodEnd,
      closeCutoffAt: input.closeCutoffAt,
    });

    const closeCandidateStores = projection.stores.filter(isCloseReadinessStoreCandidate);
    if (
      closeCandidateStores.length === 0 ||
      hasIncompleteCloseCalculation({ ...projection, stores: closeCandidateStores })
    ) {
      return {
        periodKey: input.periodKey,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        canClose: false,
        status: "blocked_by_calculation",
        blockingImports,
        blockingTargetRevisions,
      };
    }

    return {
      periodKey: input.periodKey,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      canClose: true,
      status: "ready",
      blockingImports,
      blockingTargetRevisions,
    };
  }

  private mapManager(
    row: SalesTargetIncentiveStoreSourceRow,
  ): SalesTargetIncentiveParticipantProjection | null {
    if (!row.manager_employee_id || row.store_type !== "company") {
      return null;
    }

    const calculation = this.calculator.calculateManager({
      storeOwnershipType: row.store_type,
      storeTarget: row.store_target_amount,
      storeActualNetSales: row.store_net_sales_amount,
    });

    return {
      participantType: "store_manager",
      employeeId: row.manager_employee_id,
      userId: row.manager_user_id,
      assignmentId: row.manager_assignment_id,
      assignmentStartedOn: row.manager_assignment_started_on,
      assignmentEndedOn: row.manager_assignment_ended_on,
      positionId: row.manager_position_id,
      displayName: formatDisplayName(row.manager_first_name, row.manager_last_name),
      positionCode: "STORE_MANAGER",
      normalizedFromPositionCode: null,
      targetReferenceId: null,
      targetAmount: row.store_target_amount,
      actualAmount: row.store_net_sales_amount,
      calculation,
      source: {
        storeTargetRequestId: row.store_target_request_id,
        storeNetSalesSourceBatchId: row.store_net_sales_source_batch_id,
        storeNetSalesImportBatchId: row.store_net_sales_import_batch_id,
        personnelSalesSourceBatchId: null,
        personnelSalesImportBatchId: null,
      },
    };
  }

  private mapPersonnel(
    row: SalesTargetIncentivePersonnelSourceRow,
  ): SalesTargetIncentiveParticipantProjection | null {
    if (!this.isEligiblePersonnelRow(row)) {
      return null;
    }

    const calculation = this.calculator.calculatePersonnel({
      storeOwnershipType: row.store_type,
      positionCode: row.position_code,
      storeTarget: row.store_target_amount,
      storeActualNetSales: row.store_net_sales_amount,
      personnelTarget: row.personnel_target_amount,
      personnelActualPositiveSales: row.personnel_positive_sales_amount,
    });

    if (calculation.positionCode === null) {
      return null;
    }

    return {
      participantType: "personnel",
      employeeId: row.employee_id,
      userId: row.user_id,
      assignmentId: row.assignment_id,
      assignmentStartedOn: row.assignment_started_on,
      assignmentEndedOn: row.assignment_ended_on,
      positionId: row.position_id,
      displayName: formatDisplayName(row.first_name, row.last_name),
      positionCode: calculation.positionCode,
      normalizedFromPositionCode: calculation.normalizedFromPositionCode,
      targetReferenceId: row.personnel_target_reference_id,
      targetAmount: row.personnel_target_amount,
      actualAmount: row.personnel_positive_sales_amount,
      calculation,
      source: {
        storeTargetRequestId: row.store_target_request_id,
        storeNetSalesSourceBatchId: row.store_net_sales_source_batch_id,
        storeNetSalesImportBatchId: row.store_net_sales_import_batch_id,
        personnelSalesSourceBatchId: row.personnel_sales_source_batch_id,
        personnelSalesImportBatchId: row.personnel_sales_import_batch_id,
      },
    };
  }

  private isEligiblePersonnelRow(row: SalesTargetIncentivePersonnelSourceRow) {
    return (
      row.store_type === "company" &&
      READ_MODEL_PERSONNEL_POSITIONS.has(row.position_code)
    );
  }

  private groupPersonnelByStore(rows: SalesTargetIncentivePersonnelSourceRow[]) {
    const grouped = new Map<string, SalesTargetIncentiveParticipantProjection[]>();

    for (const row of rows) {
      const mapped = this.mapPersonnel(row);
      if (!mapped) {
        continue;
      }

      const current = grouped.get(row.store_id) ?? [];
      current.push(mapped);
      grouped.set(row.store_id, current);
    }

    return grouped;
  }
}

function resolveSalesTargetIncentiveMonthlyBounds(periodKey: string) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(periodKey);

  if (!match) {
    throw new Error(`Invalid incentive period key: ${periodKey}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return {
    periodStart: `${periodKey}-01`,
    periodEnd: `${periodKey}-${String(lastDay).padStart(2, "0")}`,
  };
}

function resolveCurrentSalesTargetIncentivePeriodKey() {
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

function resolveCurrentProjectionAssignmentAsOfDate(
  periodStart: string,
  periodEnd: string,
) {
  const today = formatDateInSalesTargetIncentiveTimezone(new Date());

  if (today < periodStart) {
    return periodStart;
  }

  if (today > periodEnd) {
    return periodEnd;
  }

  return today;
}

function formatDateInSalesTargetIncentiveTimezone(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SALES_TARGET_INCENTIVE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to resolve incentive assignment date");
  }

  return `${year}-${month}-${day}`;
}

function formatDisplayName(firstName: string | null, lastName: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ").trim();
}

function hasIncompleteCloseCalculation(
  projection: SalesTargetIncentiveProjectionReadModel,
) {
  return projection.stores.some((store) => {
    if (!store.storeNetSalesImportBatchId) {
      return false;
    }

    if (!store.storeTargetAmount) {
      return true;
    }

    const participants = [
      ...(store.manager ? [store.manager] : []),
      ...store.personnel,
    ];

    return participants.some(
      (participant) =>
        isCloseBlockingParticipantCalculation(participant),
    );
  });
}

function isCloseReadinessStoreCandidate(
  store: SalesTargetIncentiveProjectionStore,
) {
  return Boolean(store.storeNetSalesImportBatchId);
}

function isCloseBlockingParticipantCalculation(
  participant: SalesTargetIncentiveParticipantProjection,
) {
  if (participant.calculation.status === "projected") {
    return false;
  }

  if (
    participant.participantType === "personnel" &&
    participant.calculation.status === "blocked" &&
    participant.calculation.blockedReason === "missing_personnel_target" &&
    hasHistoricalPersonnelSalesEvidence(participant)
  ) {
    return false;
  }

  if (!hasParticipantSalesEvidence(participant)) {
    return false;
  }

  return (
    participant.calculation.status === "blocked" ||
    participant.calculation.status === "no_source"
  );
}

function hasHistoricalPersonnelSalesEvidence(
  participant: SalesTargetIncentiveParticipantProjection,
) {
  return (
    participant.actualAmount !== null &&
    participant.source.personnelSalesSourceBatchId !== null &&
    participant.source.personnelSalesImportBatchId !== null
  );
}

function hasParticipantSalesEvidence(
  participant: SalesTargetIncentiveParticipantProjection,
) {
  if (participant.participantType === "store_manager") {
    return (
      participant.actualAmount !== null &&
      participant.source.storeNetSalesSourceBatchId !== null &&
      participant.source.storeNetSalesImportBatchId !== null
    );
  }

  return hasHistoricalPersonnelSalesEvidence(participant);
}
