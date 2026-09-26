import { BadRequestException, ForbiddenException, Injectable, Logger } from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/auth-context.service";
import {
  MANAGER_RATE_TABLE_VERSION,
  PERSONNEL_RATE_TABLE_VERSION,
  SALES_TARGET_INCENTIVE_RULE_VERSION,
  SALES_TARGET_INCENTIVE_TIMEZONE,
} from "./sales-target-incentive-calculator.service";
import { SalesTargetIncentiveReadModelService } from "./sales-target-incentive-read-model.service";
import type {
  SalesTargetIncentiveParticipantProjection,
  SalesTargetIncentiveProjectionStore,
} from "./sales-target-incentive-read-model.service";
import {
  SalesTargetIncentiveCorrectionRepository,
  type SalesTargetIncentiveAdjustmentSummaryRow,
} from "../infrastructure/sales-target-incentive-correction.repository";
import { SalesTargetIncentiveWorkspaceReadRepository } from "../infrastructure/sales-target-incentive-workspace-read.repository";
import type {
  SalesTargetIncentiveWorkspaceCorrection,
  SalesTargetIncentiveWorkspaceManagerGroup,
  SalesTargetIncentiveWorkspaceResult,
  SalesTargetIncentiveWorkspaceRow,
} from "./sales-target-incentive-workspace.contract";
import type { SalesTargetIncentiveRegionCorrectionRow } from "../infrastructure/sales-target-incentive-approval.repository";
import type { SalesTargetIncentiveDailySalesRow } from "../infrastructure/sales-target-incentive-read.repository";
import { resolveSalesTargetIncentiveRateMetadata } from "./sales-target-incentive-rate-metadata";
import { resolveSalesTargetIncentiveWorkspaceScope } from "./sales-target-incentive-workspace-scope";

@Injectable()
export class SalesTargetIncentiveWorkspaceReadService {
  private readonly logger = new Logger(SalesTargetIncentiveWorkspaceReadService.name);

  constructor(
    private readonly readModelService: SalesTargetIncentiveReadModelService,
    private readonly correctionRepository: SalesTargetIncentiveCorrectionRepository,
    private readonly repository: SalesTargetIncentiveWorkspaceReadRepository,
  ) {}

  async getWorkspace(input: {
    actor: AuthenticatedUser;
    periodKey?: string;
    throughDate?: string;
  }): Promise<SalesTargetIncentiveWorkspaceResult> {
    const scope = resolveSalesTargetIncentiveWorkspaceScope({
      actorRoleCodes: input.actor.roleCodes,
      actorReadScope: input.actor.readScope,
      roleScopes: input.actor.roleScopes,
    });
    if (!scope) {
      throw new ForbiddenException("Incentive workspace is not available for this role");
    }
    const projectionScope = scope.view === "region_manager"
      ? { companyIds: [], regionIds: [], storeIds: scope.storeIds.filter((storeId) => input.actor.actionScope.assignedStoreIds.includes(storeId)) }
      : scope;

    const period = monthlyBounds(input.periodKey ?? currentPeriod());
    const throughDate = input.throughDate ?? clampDate(currentBusinessDate(), period.periodStart, period.periodEnd);
    if (!isValidBusinessDate(throughDate) || throughDate < period.periodStart || throughDate > period.periodEnd) {
      throw new BadRequestException("throughDate must be a day in the selected incentive period");
    }
    if (projectionScope.companyIds.length + projectionScope.regionIds.length + projectionScope.storeIds.length === 0) {
      return emptyWorkspace(period, scope.view, scope.capabilities, throughDate);
    }

    const projection = await this.readModelService.buildCurrentProjection({
      periodKey: period.period,
      companyIds: projectionScope.companyIds,
      regionIds: projectionScope.regionIds,
      storeIds: projectionScope.storeIds,
      allowGlobalScope: false,
    });
    const storeIds = projection.stores.map((store) => store.storeId);
    if (storeIds.length === 0) {
      return emptyWorkspace(
        { period: projection.periodKey, periodStart: projection.periodStart, periodEnd: projection.periodEnd },
        scope.view,
        scope.capabilities,
        throughDate,
      );
    }
    const [metadataResult, closedSnapshots, workflow, adjustmentSummaries, dailyResult] = await Promise.all([
      optionalSection(this.repository.listStoreMetadata({ storeIds, periodEnd: projection.periodEnd }), [], "store_metadata", this.logger),
      this.repository.listClosedRateSnapshots({ periodKey: projection.periodKey, storeIds }),
      this.repository.listWorkflowAudit({ periodKey: projection.periodKey, storeIds }),
      this.correctionRepository.listApprovedAdjustmentSummaries({
        periodKey: projection.periodKey,
        storeIds,
        includeFinalRows: true,
      }),
      optionalSection(this.readModelService.listDailySalesTracking({ storeIds, periodStart: period.periodStart, throughDate }), [], "daily_sales", this.logger),
    ]);
    const dailyStoreById = new Map(dailyResult.value.filter(row => row.scope_type === "store").map(row => [row.store_id, row]));
    const dailyEmployeeByKey = new Map(dailyResult.value.filter(row => row.scope_type === "employee" && row.employee_id).map(row => [`${row.store_id}:${row.employee_id}`, row]));
    const exactRateRowsResult = closedSnapshots.length === 0
      ? await optionalSection(this.repository.listExactRateTables({
          ruleVersionCode: SALES_TARGET_INCENTIVE_RULE_VERSION,
          rateTableVersions: [MANAGER_RATE_TABLE_VERSION, PERSONNEL_RATE_TABLE_VERSION],
          periodEnd: projection.periodEnd,
        }), [], "rate_metadata", this.logger)
      : completeSection([]);
    const metadata = metadataResult.value;
    const exactRateRows = exactRateRowsResult.value;
    const rateMetadata = resolveSalesTargetIncentiveRateMetadata({
      periodTimezone: projection.timezone,
      scopedStoreCount: projection.stores.length,
      closedSnapshots,
      exactRateRows,
      expectedOpenVersions: {
        ruleVersionCode: SALES_TARGET_INCENTIVE_RULE_VERSION,
        manager: MANAGER_RATE_TABLE_VERSION,
        personnel: PERSONNEL_RATE_TABLE_VERSION,
      },
    });
    const actorRowsResult = await optionalSection(this.repository.listCorrectionActors({
      events: workflow.corrections.map((correction) => ({
        correctionId: correction.sales_target_incentive_region_correction_id,
        actorUserId: correction.created_by_user_id,
        occurredAt: correction.created_at,
      })),
    }), [], "correction_actors", this.logger);
    const actorRows = actorRowsResult.value;
    const actorByCorrectionId = new Map(actorRows.map((row) => [row.correction_id, row]));
    const metadataByStoreId = new Map(metadata.map((row) => [row.store_id, row]));
    const closedSnapshotByStoreId = new Map(
      closedSnapshots.map((row) => [row.store_id, row.final_snapshot_id]),
    );
    const correctionRowsByStore = groupBy(workflow.corrections, (row) => row.store_id);
    const adjustmentsByStore = groupBy(adjustmentSummaries, (row) => row.store_id);
    const managerGroups = new Map<string, SalesTargetIncentiveWorkspaceManagerGroup>();
    const visibleStoreIds = new Set(storeIds);
    const actionableStoreIds = new Set(
      scope.view === "region_manager"
        ? input.actor.actionScope.assignedStoreIds.filter((storeId) => visibleStoreIds.has(storeId))
        : [],
    );
    const capabilities = workspaceCapabilities(false);

    for (const store of projection.stores) {
      const storeMetadata = metadataByStoreId.get(store.storeId);
      const managerUserId = storeMetadata?.region_manager_user_id ?? null;
      const groupKey = `${store.companyId}:${managerUserId ?? "unassigned"}`;
      const ownerPackage = workflow.packages.find((item) =>
        item.package_scope === "manager_assignment" &&
        item.company_id === store.companyId && item.manager_user_id === managerUserId,
      ) ?? null;
      const legacyPackage = workflow.packages.find((item) =>
        item.package_scope === "legacy_region" && item.company_id === store.companyId &&
        item.store_ids?.includes(store.storeId),
      ) ?? null;
      const packageState = toPackage(ownerPackage ?? legacyPackage);
      const managerGroup = managerGroups.get(groupKey) ?? {
        companyId: store.companyId,
        managerUserId,
        managerName: storeMetadata?.region_manager_name ?? null,
        capabilities: { canSubmitPackage: false },
        package: toPackage(ownerPackage),
        stores: [],
      };
      const canAct = actionableStoreIds.has(store.storeId);
      const workspaceStore = toWorkspaceStore({
        store,
        dailyStore: dailyStoreById.get(store.storeId) ?? null,
        dailyEmployees: dailyEmployeeByKey,
        canAct,
        storeCode: storeMetadata?.store_code ?? null,
        finalSnapshotId: closedSnapshotByStoreId.get(store.storeId) ?? null,
        reviews: workflow.reviews,
        corrections: correctionRowsByStore.get(store.storeId) ?? [],
        adjustmentSummaries: adjustmentsByStore.get(store.storeId) ?? [],
        actorByCorrectionId,
        packageStatus: packageState.status,
      });
      managerGroup.stores.push(workspaceStore);
      capabilities.canMarkStoreReview ||= workspaceStore.capabilities.canMarkStoreReview;
      capabilities.canCreateCorrection ||= workspaceStore.capabilities.canCreateCorrection;
      capabilities.canVoidCorrection ||= workspaceStore.capabilities.canVoidCorrection;
      managerGroups.set(groupKey, managerGroup);
    }

    const resolvedGroups = [...managerGroups.values()].map((group) => {
      const packageEditable = group.package.status !== "submitted" && group.package.status !== "admin_approved";
      return {
        ...group,
        capabilities: {
          canSubmitPackage: packageEditable
            && group.managerUserId === input.actor.userId
            && group.stores.length > 0
            && group.stores.every((store) => actionableStoreIds.has(store.storeId) && store.capabilities.canMarkStoreReview),
        },
        stores: group.stores.sort((left, right) => left.storeName.localeCompare(right.storeName, "tr")),
      };
    });
    capabilities.canSubmitPackage = resolvedGroups.some((group) => group.capabilities.canSubmitPackage);

    return {
      period: projection.periodKey,
      periodStart: projection.periodStart,
      periodEnd: projection.periodEnd,
      periodTimezone: projection.timezone,
      salesTracking: { throughDate, lastLoadedDate: dailyResult.value.reduce<string | null>((latest, row) => latest === null || row.last_day > latest ? row.last_day : latest, null), status: dailyResult.status },
      view: scope.view,
      capabilities,
      sections: {
        core: { status: "complete" },
        storeMetadata: { status: metadataResult.status },
        rateMetadata: { status: exactRateRowsResult.status },
        correctionActors: { status: actorRowsResult.status },
      },
      rateMetadata,
      managerGroups: resolvedGroups
        .sort((left, right) => (left.managerName ?? "").localeCompare(right.managerName ?? "", "tr")),
    };
  }
}

function toWorkspaceStore(input: {
  store: SalesTargetIncentiveProjectionStore;
  dailyStore: SalesTargetIncentiveDailySalesRow | null;
  dailyEmployees: Map<string, SalesTargetIncentiveDailySalesRow>;
  canAct: boolean;
  storeCode: string | null;
  finalSnapshotId: string | null;
  reviews: Array<{ store_id: string; final_snapshot_id: string; review_status: "pending_review" | "reviewed"; reviewed_at: string | null }>;
  corrections: SalesTargetIncentiveRegionCorrectionRow[];
  adjustmentSummaries: SalesTargetIncentiveAdjustmentSummaryRow[];
  actorByCorrectionId: Map<string, { display_name: string | null; role_code: "REGION_MANAGER" | "HR_ADMIN" | "SUPER_ADMIN" | null }>;
  packageStatus: "not_submitted" | "submitted" | "admin_approved" | "admin_returned";
}) {
  const review = input.finalSnapshotId
    ? input.reviews.find((row) => row.store_id === input.store.storeId && row.final_snapshot_id === input.finalSnapshotId)
    : null;
  const participants = [
    ...(input.store.manager ? [input.store.manager] : []),
    ...input.store.personnel,
  ];
  const participantKeys = new Set(participants.map(participantKey));
  const rows = participants.map((participant) => toWorkspaceRow({
    participant,
    correctionRows: input.corrections.filter((row) => row.employee_id === participant.employeeId && row.participant_type === participant.participantType),
    adjustmentSummary: input.adjustmentSummaries.find((row) => row.employee_id === participant.employeeId && row.participant_type === participant.participantType) ?? null,
    actorByCorrectionId: input.actorByCorrectionId,
  }));
  for (const summary of input.adjustmentSummaries) {
    if (!participantKeys.has(`${summary.employee_id}:${summary.participant_type}`)) {
      rows.push(toFinalOnlyWorkspaceRow(summary, input.corrections, input.actorByCorrectionId));
    }
  }
  for (const row of rows) {
    const dailyAmount = row.participantType === "store_manager"
      ? input.dailyStore?.actual_amount ?? null
      : input.dailyEmployees.get(`${input.store.storeId}:${row.employeeId}`)?.actual_amount ?? null;
    row.dailyActualNetSales = dailyAmount;
    row.dailyAchievementPct = dailyAchievement(dailyAmount, row.target);
  }
  const primary = input.store.manager?.calculation ?? input.store.personnel[0]?.calculation;
  const periodClosed = input.finalSnapshotId !== null;
  const packageEditable = input.packageStatus !== "submitted" && input.packageStatus !== "admin_approved";
  const canEdit = input.canAct && periodClosed && packageEditable;
  const hasVoidableCorrection = rows.some(
    (row) => row.correction?.status === "draft" || row.correction?.status === "admin_returned",
  );
  return {
    storeId: input.store.storeId,
    storeCode: input.storeCode,
    storeName: input.store.storeName,
    city: null as null,
    storeTarget: input.store.storeTargetAmount,
    storeActualNetSales: input.store.storeNetSalesAmount,
    storeAchievementPct: primary?.storeAchievementPct ?? primary?.achievementPct ?? null,
    dailyActualNetSales: input.dailyStore?.actual_amount ?? null,
    dailyAchievementPct: dailyAchievement(input.dailyStore?.actual_amount ?? null, input.store.storeTargetAmount),
    capabilities: {
      canMarkStoreReview: canEdit,
      canCreateCorrection: canEdit,
      canVoidCorrection: canEdit && hasVoidableCorrection,
    },
    review: {
      status: review?.review_status ?? "pending_review",
      reviewedAt: review?.reviewed_at ?? null,
      periodCloseStatus: input.finalSnapshotId ? "closed" as const : "projection_only" as const,
    },
    rows,
  };
}

function workspaceCapabilities(canAct: boolean) {
  return {
    canMarkStoreReview: canAct,
    canCreateCorrection: canAct,
    canVoidCorrection: canAct,
    canSubmitPackage: canAct,
  };
}

function toWorkspaceRow(input: {
  participant: SalesTargetIncentiveParticipantProjection;
  correctionRows: SalesTargetIncentiveRegionCorrectionRow[];
  adjustmentSummary: SalesTargetIncentiveAdjustmentSummaryRow | null;
  actorByCorrectionId: Map<string, { display_name: string | null; role_code: "REGION_MANAGER" | "HR_ADMIN" | "SUPER_ADMIN" | null }>;
}): SalesTargetIncentiveWorkspaceRow {
  const records = toCorrectionRecords(input.correctionRows, input.actorByCorrectionId);
  const currentCorrectionRow = currentOpenCorrectionRow(input.correctionRows);
  const currentCorrection = records.find((record) => record.status !== "voided") ?? null;
  const openCorrection = currentCorrectionRow
    ? records.find((record) => record.correctionId === currentCorrectionRow.sales_target_incentive_region_correction_id) ?? null
    : null;
  const calculatedAmount = input.adjustmentSummary?.payable_amount ?? input.participant.calculation.payableAmount;
  const persistedFinal = input.adjustmentSummary?.final_amount ?? null;
  const adminAdjustment = input.adjustmentSummary?.adjustment_amount ?? "0";
  const finalAmount = resolveWorkspaceFinalAmount({
    calculatedAmount,
    persistedFinal,
    adminAdjustment,
    approvedAdjustmentCount: input.adjustmentSummary?.approved_adjustment_count ?? 0,
    latestApprovedAdjustmentAt: input.adjustmentSummary?.latest_approved_adjustment_at ?? null,
    openCorrection,
    openCorrectionUpdatedAt: currentCorrectionRow?.updated_at ?? null,
  });
  const difference = calculatedAmount !== null && finalAmount !== null
    ? subtractMoney(finalAmount, calculatedAmount)
    : null;
  return {
    employeeId: input.participant.employeeId,
    displayName: input.participant.displayName,
    participantType: input.participant.participantType,
    positionCode: input.participant.positionCode,
    target: input.adjustmentSummary?.target_amount ?? input.participant.targetAmount,
    actual: input.adjustmentSummary?.actual_sales_amount ?? input.participant.actualAmount,
    dailyActualNetSales: null,
    dailyAchievementPct: null,
    achievementPct: input.adjustmentSummary?.achievement_pct ?? input.participant.calculation.achievementPct,
    rate: input.adjustmentSummary?.applied_rate ?? input.participant.calculation.rate,
    calculatedAmount,
    finalAmount,
    signedDifferenceAmount: difference,
    status: resolveRowStatus(input.participant.calculation.status, difference, adminAdjustment),
    correction: currentCorrection,
    correctionRecords: records,
  };
}

function toFinalOnlyWorkspaceRow(
  summary: SalesTargetIncentiveAdjustmentSummaryRow,
  corrections: SalesTargetIncentiveRegionCorrectionRow[],
  actorByCorrectionId: Map<string, { display_name: string | null; role_code: "REGION_MANAGER" | "HR_ADMIN" | "SUPER_ADMIN" | null }>,
): SalesTargetIncentiveWorkspaceRow {
  const records = toCorrectionRecords(
    corrections.filter((row) => row.employee_id === summary.employee_id && row.participant_type === summary.participant_type),
    actorByCorrectionId,
  );
  const matchingCorrectionRows = corrections.filter((row) => row.employee_id === summary.employee_id && row.participant_type === summary.participant_type);
  const currentCorrectionRow = currentOpenCorrectionRow(matchingCorrectionRows);
  const currentCorrection = records.find((record) => record.status !== "voided") ?? null;
  const openCorrection = currentCorrectionRow
    ? records.find((record) => record.correctionId === currentCorrectionRow.sales_target_incentive_region_correction_id) ?? null
    : null;
  const calculatedAmount = summary.payable_amount ?? null;
  const finalAmount = resolveWorkspaceFinalAmount({
    calculatedAmount,
    persistedFinal: summary.final_amount,
    adminAdjustment: summary.adjustment_amount,
    approvedAdjustmentCount: summary.approved_adjustment_count ?? 0,
    latestApprovedAdjustmentAt: summary.latest_approved_adjustment_at ?? null,
    openCorrection,
    openCorrectionUpdatedAt: currentCorrectionRow?.updated_at ?? null,
  });
  const difference = calculatedAmount !== null && finalAmount !== null ? subtractMoney(finalAmount, calculatedAmount) : null;
  return {
    employeeId: summary.employee_id,
    displayName: summary.employee_display_name ?? "Kayıt sahibi bilgisi yok",
    participantType: summary.participant_type,
    positionCode: summary.position_code ?? (summary.participant_type === "store_manager" ? "STORE_MANAGER" : "SALES_ASSOCIATE"),
    target: summary.target_amount ?? null,
    actual: summary.actual_sales_amount ?? null,
    dailyActualNetSales: null,
    dailyAchievementPct: null,
    achievementPct: summary.achievement_pct ?? null,
    rate: summary.applied_rate ?? null,
    calculatedAmount,
    finalAmount,
    signedDifferenceAmount: difference,
    status: resolveRowStatus(summary.calculation_status ?? "projected", difference, summary.adjustment_amount),
    correction: currentCorrection,
    correctionRecords: records,
  };
}

function toCorrectionRecords(
  rows: SalesTargetIncentiveRegionCorrectionRow[],
  actorByCorrectionId: Map<string, { display_name: string | null; role_code: "REGION_MANAGER" | "HR_ADMIN" | "SUPER_ADMIN" | null }>,
): SalesTargetIncentiveWorkspaceCorrection[] {
  return [...rows]
    .sort((left, right) => right.created_at.localeCompare(left.created_at) || right.sales_target_incentive_region_correction_id.localeCompare(left.sales_target_incentive_region_correction_id))
    .map((row) => {
      const actor = actorByCorrectionId.get(row.sales_target_incentive_region_correction_id);
      return {
        correctionId: row.sales_target_incentive_region_correction_id,
        status: row.correction_status,
        beforeAmount: row.before_amount,
        adjustmentAmount: row.adjustment_amount,
        finalAmount: row.final_amount,
        reasonNote: row.reason_note,
        createdAt: row.created_at,
        submittedAt: row.submitted_at,
        reviewedAt: row.reviewed_at,
        reviewNote: row.review_note,
        actor: {
          displayName: actor?.display_name ?? null,
          roleCode: actor?.role_code ?? null,
          identityStatus: actor?.display_name ? "resolved" as const : "unavailable" as const,
        },
      };
    });
}

function toPackage(row: { package_status: "submitted" | "admin_approved" | "admin_returned"; submitted_at: string; reviewed_at: string | null; review_note: string | null } | null) {
  return {
    status: row?.package_status ?? "not_submitted" as const,
    submittedAt: row?.submitted_at ?? null,
    reviewedAt: row?.reviewed_at ?? null,
    reviewNote: row?.review_note ?? null,
  };
}

function participantKey(participant: SalesTargetIncentiveParticipantProjection) {
  return `${participant.employeeId}:${participant.participantType}`;
}

function resolveRowStatus(status: string, difference: string | null, adjustment: string) {
  if (!isZeroMoney(adjustment)) return "adjusted" as const;
  if (difference !== null && !isZeroMoney(difference)) return "corrected" as const;
  return status === "blocked" || status === "no_source" ? status : "projected" as const;
}

function resolveWorkspaceFinalAmount(input: {
  calculatedAmount: string | null;
  persistedFinal: string | null;
  adminAdjustment: string;
  approvedAdjustmentCount: number;
  latestApprovedAdjustmentAt: string | null;
  openCorrection: SalesTargetIncentiveWorkspaceCorrection | null;
  openCorrectionUpdatedAt: string | null;
}) {
  const effectiveClosedFinal = input.persistedFinal === null
    ? null
    : addMoney(input.persistedFinal, input.adminAdjustment);
  const hasApprovedAdjustment = input.approvedAdjustmentCount > 0 || !isZeroMoney(input.adminAdjustment);
  const approvedAdjustmentSupersedesOpenCorrection = hasApprovedAdjustment && (
    !input.latestApprovedAdjustmentAt
    || !input.openCorrectionUpdatedAt
    || input.latestApprovedAdjustmentAt >= input.openCorrectionUpdatedAt
  );

  if (input.openCorrection && !approvedAdjustmentSupersedesOpenCorrection) {
    return input.openCorrection.finalAmount;
  }
  if (effectiveClosedFinal !== null) {
    return effectiveClosedFinal;
  }
  return input.openCorrection?.finalAmount ?? input.calculatedAmount;
}

function currentOpenCorrectionRow(rows: SalesTargetIncentiveRegionCorrectionRow[]) {
  return [...rows]
    .filter((row) => row.correction_status === "draft" || row.correction_status === "submitted" || row.correction_status === "admin_returned")
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at)
      || right.created_at.localeCompare(left.created_at)
      || right.sales_target_incentive_region_correction_id.localeCompare(left.sales_target_incentive_region_correction_id))[0] ?? null;
}

function groupBy<T>(rows: T[], key: (row: T) => string) {
  const grouped = new Map<string, T[]>();
  for (const row of rows) grouped.set(key(row), [...(grouped.get(key(row)) ?? []), row]);
  return grouped;
}

function addMoney(left: string, right: string) {
  return formatCents(parseMoneyCents(left) + parseMoneyCents(right));
}

function subtractMoney(left: string, right: string) {
  return formatCents(parseMoneyCents(left) - parseMoneyCents(right));
}

function isZeroMoney(value: string) {
  return parseMoneyCents(value) === 0n;
}

function parseMoneyCents(value: string) {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) throw new Error("Invalid money value");
  const cents = BigInt(match[2]) * 100n + BigInt((match[3] ?? "").padEnd(2, "0"));
  return match[1] === "-" ? -cents : cents;
}

function formatCents(value: bigint) {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  return `${sign}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, "0")}`;
}

function emptyWorkspace(
  period: { period: string; periodStart: string; periodEnd: string },
  view: "report_viewer" | "region_manager",
  capabilities: SalesTargetIncentiveWorkspaceResult["capabilities"],
  throughDate: string,
): SalesTargetIncentiveWorkspaceResult {
  return {
    ...period,
    periodTimezone: SALES_TARGET_INCENTIVE_TIMEZONE,
    salesTracking: { throughDate, lastLoadedDate: null, status: "complete" },
    view,
    capabilities,
    sections: completeWorkspaceSections(),
    rateMetadata: {
      status: "unresolved",
      ruleVersionCode: null,
      effectiveFrom: null,
      periodTimezone: SALES_TARGET_INCENTIVE_TIMEZONE,
      bracketBoundaryPolicy: null,
      tables: [],
    },
    managerGroups: [],
  };
}

function completeWorkspaceSections() {
  return {
    core: { status: "complete" as const },
    storeMetadata: { status: "complete" as const },
    rateMetadata: { status: "complete" as const },
    correctionActors: { status: "complete" as const },
  };
}

function completeSection<T>(value: T) {
  return { status: "complete" as const, value };
}

async function optionalSection<T>(promise: Promise<T>, fallback: T, section: string, logger: Pick<Logger, "warn">) {
  try {
    return completeSection(await promise);
  } catch {
    logger.warn(JSON.stringify({ event: "sales_target_incentive.workspace_optional_section.unavailable", section }));
    return { status: "unavailable" as const, value: fallback };
  }
}

function monthlyBounds(period: string) {
  const [year, month] = period.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    period,
    periodStart: `${period}-01`,
    periodEnd: `${period}-${String(lastDay).padStart(2, "0")}`,
  };
}

function currentPeriod() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SALES_TARGET_INCENTIVE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`;
}

function currentBusinessDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SALES_TARGET_INCENTIVE_TIMEZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

function clampDate(value: string, start: string, end: string) {
  return value < start ? start : value > end ? end : value;
}

function isValidBusinessDate(value: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)) return false;
  return new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

function dailyAchievement(actual: string | null, target: string | null) {
  if (actual === null || target === null) return null;
  const numerator = Number(actual);
  const denominator = Number(target);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return (numerator / denominator * 100).toFixed(2);
}
