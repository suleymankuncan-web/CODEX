import { ForbiddenException, Injectable, Logger } from "@nestjs/common";
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
  SalesTargetIncentiveWorkspaceRegion,
  SalesTargetIncentiveWorkspaceResult,
  SalesTargetIncentiveWorkspaceRow,
} from "./sales-target-incentive-workspace.contract";
import type { SalesTargetIncentiveRegionCorrectionRow } from "../infrastructure/sales-target-incentive-approval.repository";
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
  }): Promise<SalesTargetIncentiveWorkspaceResult> {
    const scope = resolveSalesTargetIncentiveWorkspaceScope({
      actorRoleCodes: input.actor.roleCodes,
      actorReadScope: input.actor.readScope,
      roleScopes: input.actor.roleScopes,
    });
    if (!scope) {
      throw new ForbiddenException("Incentive workspace is not available for this role");
    }

    const period = monthlyBounds(input.periodKey ?? currentPeriod());
    if (scope.companyIds.length + scope.regionIds.length + scope.storeIds.length === 0) {
      return emptyWorkspace(period, scope.view, scope.capabilities);
    }

    const projection = await this.readModelService.buildCurrentProjection({
      periodKey: period.period,
      companyIds: scope.companyIds,
      regionIds: scope.regionIds,
      storeIds: scope.storeIds,
      allowGlobalScope: false,
    });
    const storeIds = projection.stores.map((store) => store.storeId);
    if (storeIds.length === 0) {
      return emptyWorkspace(
        { period: projection.periodKey, periodStart: projection.periodStart, periodEnd: projection.periodEnd },
        scope.view,
        scope.capabilities,
      );
    }
    const [metadataResult, closedSnapshots, workflow, adjustmentSummaries] = await Promise.all([
      optionalSection(this.repository.listStoreMetadata({ storeIds, periodEnd: projection.periodEnd }), [], "store_metadata", this.logger),
      this.repository.listClosedRateSnapshots({ periodKey: projection.periodKey, storeIds }),
      this.repository.listWorkflowAudit({ periodKey: projection.periodKey, storeIds }),
      this.correctionRepository.listApprovedAdjustmentSummaries({
        periodKey: projection.periodKey,
        storeIds,
        includeFinalRows: true,
      }),
    ]);
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
    const regions = new Map<string, SalesTargetIncentiveWorkspaceRegion>();
    const visibleStoreIds = new Set(storeIds);
    const actionableStoreIds = new Set(
      scope.view === "region_manager"
        ? input.actor.actionScope.assignedStoreIds.filter((storeId) => visibleStoreIds.has(storeId))
        : [],
    );
    const capabilities = workspaceCapabilities(false);

    for (const store of projection.stores) {
      const storeMetadata = metadataByStoreId.get(store.storeId);
      const packageState = toPackage(
        workflow.packages.find((item) => item.region_id === store.regionId) ?? null,
      );
      const region = regions.get(store.regionId) ?? {
        regionId: store.regionId,
        regionName: storeMetadata?.region_name ?? null,
        regionManager: { displayName: storeMetadata?.region_manager_name ?? null },
        capabilities: { canSubmitPackage: false },
        package: packageState,
        stores: [],
      };
      const canAct = actionableStoreIds.has(store.storeId);
      const workspaceStore = toWorkspaceStore({
        store,
        canAct,
        storeCode: storeMetadata?.store_code ?? null,
        finalSnapshotId: closedSnapshotByStoreId.get(store.storeId) ?? null,
        reviews: workflow.reviews,
        corrections: correctionRowsByStore.get(store.storeId) ?? [],
        adjustmentSummaries: adjustmentsByStore.get(store.storeId) ?? [],
        actorByCorrectionId,
        packageStatus: packageState.status,
      });
      region.stores.push(workspaceStore);
      const packageEditable = packageState.status !== "submitted" && packageState.status !== "admin_approved";
      if (canAct && packageEditable) region.capabilities.canSubmitPackage = true;
      capabilities.canMarkStoreReview ||= workspaceStore.capabilities.canMarkStoreReview;
      capabilities.canCreateCorrection ||= workspaceStore.capabilities.canCreateCorrection;
      capabilities.canVoidCorrection ||= workspaceStore.capabilities.canVoidCorrection;
      capabilities.canSubmitPackage ||= region.capabilities.canSubmitPackage;
      regions.set(store.regionId, region);
    }

    return {
      period: projection.periodKey,
      periodStart: projection.periodStart,
      periodEnd: projection.periodEnd,
      periodTimezone: projection.timezone,
      view: scope.view,
      capabilities,
      sections: {
        core: { status: "complete" },
        storeMetadata: { status: metadataResult.status },
        rateMetadata: { status: exactRateRowsResult.status },
        correctionActors: { status: actorRowsResult.status },
      },
      rateMetadata,
      regions: [...regions.values()]
        .map((region) => ({
          ...region,
          stores: region.stores.sort((left, right) => left.storeName.localeCompare(right.storeName, "tr")),
        }))
        .sort((left, right) => (left.regionName ?? "").localeCompare(right.regionName ?? "", "tr")),
    };
  }
}

function toWorkspaceStore(input: {
  store: SalesTargetIncentiveProjectionStore;
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
  const currentCorrection = records.find((record) => record.status !== "voided") ?? null;
  const calculatedAmount = input.adjustmentSummary?.payable_amount ?? input.participant.calculation.payableAmount;
  const persistedFinal = input.adjustmentSummary?.final_amount ?? null;
  const adminAdjustment = input.adjustmentSummary?.adjustment_amount ?? "0";
  const finalAmount = persistedFinal !== null
    ? addMoney(persistedFinal, adminAdjustment)
    : currentCorrection?.finalAmount ?? calculatedAmount;
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
  const currentCorrection = records.find((record) => record.status !== "voided") ?? null;
  const calculatedAmount = summary.payable_amount ?? null;
  const finalAmount = summary.final_amount === null ? currentCorrection?.finalAmount ?? calculatedAmount : addMoney(summary.final_amount, summary.adjustment_amount);
  const difference = calculatedAmount !== null && finalAmount !== null ? subtractMoney(finalAmount, calculatedAmount) : null;
  return {
    employeeId: summary.employee_id,
    displayName: summary.employee_display_name ?? "Kayıt sahibi bilgisi yok",
    participantType: summary.participant_type,
    positionCode: summary.position_code ?? (summary.participant_type === "store_manager" ? "STORE_MANAGER" : "SALES_ASSOCIATE"),
    target: summary.target_amount ?? null,
    actual: summary.actual_sales_amount ?? null,
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
): SalesTargetIncentiveWorkspaceResult {
  return {
    ...period,
    periodTimezone: SALES_TARGET_INCENTIVE_TIMEZONE,
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
    regions: [],
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
