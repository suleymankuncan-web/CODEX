import { BadRequestException, Injectable } from "@nestjs/common";
import {
  normalizeRosterReconciliationRow,
  normalizeRosterKey,
  type NormalizedRosterReconciliationRow,
  type RawRosterReconciliationInput,
  type RosterRoleClassification,
} from "./pilot-roster-reconciliation.contract";

export type PilotRosterApplyReviewSeverity = "blocked" | "review_required";

export type PilotRosterApplyReviewItem = {
  sourceFile: string;
  sourceSheet: string;
  rowNumber: number;
  sourceKind: string;
  sourcePeriod: string | null;
  rawStoreName: string | null;
  rawEmployeeName: string | null;
  reason: string;
  severity: PilotRosterApplyReviewSeverity;
};

export type PilotRosterActiveAssignmentCandidate = {
  normalizedStoreKey: string;
  normalizedEmployeeKey: string;
  rawStoreCode: string | null;
  rawEmployeeCode: string | null;
  rawEmployeeName: string;
  rawPositionName: string | null;
  roleClassification: RosterRoleClassification;
};

export type PilotRosterTargetReferenceCandidate = {
  sourcePeriod: string;
  normalizedStoreKey: string;
  normalizedEmployeeKey: string;
  rawEmployeeName: string;
  targetAmount: number;
};

export type PilotRosterTurnoverCandidate = {
  sourcePeriod: string;
  normalizedStoreKey: string;
  normalizedEmployeeKey: string;
  rawEmployeeName: string;
};

export type PilotRosterApplyPlan = {
  canApplyWithoutApproval: boolean;
  approvalRequiredReasons: string[];
  activeAssignments: PilotRosterActiveAssignmentCandidate[];
  targetReferences: PilotRosterTargetReferenceCandidate[];
  turnoverEvents: PilotRosterTurnoverCandidate[];
  snapshotPeriodsToRefresh: string[];
  excludedTargets: PilotRosterApplyReviewItem[];
  reviewItems: PilotRosterApplyReviewItem[];
  totals: {
    inputRows: number;
    activeAssignments: number;
    targetReferences: number;
    turnoverEvents: number;
    excludedTargets: number;
    reviewItems: number;
  };
};

const VALID_PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/u;

function lookupKeys(row: Pick<NormalizedRosterReconciliationRow, "rawEmployeeCode" | "rawEmployeeName">) {
  return [
    normalizeRosterKey(row.rawEmployeeCode),
    normalizeRosterKey(row.rawEmployeeName),
  ].filter(Boolean);
}

function reviewItem(
  row: NormalizedRosterReconciliationRow,
  reason: string,
  severity: PilotRosterApplyReviewSeverity = "review_required",
): PilotRosterApplyReviewItem {
  return {
    sourceFile: row.sourceFile,
    sourceSheet: row.sourceSheet,
    rowNumber: row.rowNumber,
    sourceKind: row.sourceKind,
    sourcePeriod: row.sourcePeriod ?? null,
    rawStoreName: row.rawStoreName ?? null,
    rawEmployeeName: row.rawEmployeeName ?? null,
    reason,
    severity,
  };
}

function isValidPeriod(value: string | undefined): value is string {
  return value !== undefined && VALID_PERIOD_PATTERN.test(value);
}

@Injectable()
export class PilotRosterReconciliationService {
  buildApplyPlan(input: { rows: RawRosterReconciliationInput[] }): PilotRosterApplyPlan {
    const rows = input.rows.map(normalizeRosterReconciliationRow);
    const reviewItems: PilotRosterApplyReviewItem[] = [];
    const excludedTargets: PilotRosterApplyReviewItem[] = [];
    const activeAssignments: PilotRosterActiveAssignmentCandidate[] = [];
    const targetReferences: PilotRosterTargetReferenceCandidate[] = [];
    const turnoverEvents: PilotRosterTurnoverCandidate[] = [];
    const activeByLookup = new Map<string, NormalizedRosterReconciliationRow>();
    const activeStoreKeys = new Set<string>();

    for (const row of rows.filter((item) => item.sourceKind === "current_roster")) {
      const reasons = this.activeRosterBlockReasons(row);
      if (reasons.length > 0) {
        reasons.forEach((reason) => reviewItems.push(reviewItem(row, reason, "blocked")));
        continue;
      }

      const candidate: PilotRosterActiveAssignmentCandidate = {
        normalizedStoreKey: row.normalizedStoreKey,
        normalizedEmployeeKey: row.normalizedEmployeeKey,
        rawStoreCode: row.rawStoreCode ?? null,
        rawEmployeeCode: row.rawEmployeeCode ?? null,
        rawEmployeeName: row.rawEmployeeName ?? "",
        rawPositionName: row.rawPositionName ?? null,
        roleClassification: row.roleClassification,
      };
      activeAssignments.push(candidate);
      activeStoreKeys.add(row.normalizedStoreKey);
      lookupKeys(row).forEach((lookupKey) => activeByLookup.set(lookupKey, row));
    }

    for (const row of rows.filter((item) => item.sourceKind === "target")) {
      const period = row.sourcePeriod;
      if (!isValidPeriod(period)) {
        reviewItems.push(reviewItem(row, "invalid_target_period", "blocked"));
        continue;
      }

      if (row.targetAmount === null || row.targetAmount === undefined || row.targetAmount <= 0) {
        reviewItems.push(reviewItem(row, "invalid_target_amount", "blocked"));
        continue;
      }

      const activeMatch = lookupKeys(row)
        .map((lookupKey) => activeByLookup.get(lookupKey))
        .find((match): match is NormalizedRosterReconciliationRow => Boolean(match));

      if (!activeMatch) {
        reviewItems.push(reviewItem(row, "target_employee_not_in_june_active_roster"));
        continue;
      }

      if (activeMatch.normalizedStoreKey !== row.normalizedStoreKey) {
        reviewItems.push(reviewItem(row, "target_store_differs_from_active_assignment", "blocked"));
        continue;
      }

      if (
        activeMatch.roleClassification === "store_manager" ||
        activeMatch.roleClassification === "cashier"
      ) {
        excludedTargets.push(
          reviewItem(row, `target_excluded_role:${activeMatch.roleClassification}`),
        );
        continue;
      }

      targetReferences.push({
        sourcePeriod: period,
        normalizedStoreKey: row.normalizedStoreKey,
        normalizedEmployeeKey: normalizeRosterKey(
          activeMatch.rawEmployeeCode || activeMatch.rawEmployeeName,
        ),
        rawEmployeeName: row.rawEmployeeName ?? "",
        targetAmount: row.targetAmount,
      });
    }

    for (const row of rows.filter((item) => item.sourceKind === "sales_kpi")) {
      const period = row.sourcePeriod;
      if (!isValidPeriod(period)) {
        reviewItems.push(reviewItem(row, "invalid_sales_kpi_period", "blocked"));
        continue;
      }

      if (lookupKeys(row).some((lookupKey) => activeByLookup.has(lookupKey))) {
        continue;
      }

      if (!row.normalizedStoreKey || !activeStoreKeys.has(row.normalizedStoreKey)) {
        reviewItems.push(reviewItem(row, "sales_kpi_store_not_in_june_active_roster"));
        continue;
      }

      if (!row.normalizedStoreKey || !row.normalizedEmployeeKey) {
        reviewItems.push(reviewItem(row, "sales_kpi_leaver_missing_store_or_employee", "blocked"));
        continue;
      }

      turnoverEvents.push({
        sourcePeriod: period,
        normalizedStoreKey: row.normalizedStoreKey,
        normalizedEmployeeKey: row.normalizedEmployeeKey,
        rawEmployeeName: row.rawEmployeeName ?? "",
      });
    }

    rows
      .filter((row) => row.matchStatus === "review_required")
      .forEach((row) => {
        reviewItems.push(
          reviewItem(row, row.matchNotes.join(",") || "source_requires_review"),
        );
      });

    const snapshotPeriodsToRefresh = Array.from(
      new Set([
        ...targetReferences.map((row) => row.sourcePeriod),
        ...turnoverEvents.map((row) => row.sourcePeriod),
      ]),
    ).sort();
    return {
      canApplyWithoutApproval: reviewItems.length === 0,
      approvalRequiredReasons: Array.from(new Set(reviewItems.map((item) => item.reason))).sort(),
      activeAssignments,
      targetReferences,
      turnoverEvents,
      snapshotPeriodsToRefresh,
      excludedTargets,
      reviewItems,
      totals: {
        inputRows: rows.length,
        activeAssignments: activeAssignments.length,
        targetReferences: targetReferences.length,
        turnoverEvents: turnoverEvents.length,
        excludedTargets: excludedTargets.length,
        reviewItems: reviewItems.length,
      },
    };
  }

  assertPlanCanApply(input: { plan: PilotRosterApplyPlan; approvalToken?: string }) {
    if (input.plan.reviewItems.length === 0) {
      return;
    }

    if (input.approvalToken === "APPROVE_SAFE_ROWS_WITH_REVIEW_ITEMS") {
      return;
    }

    throw new BadRequestException(
      `Roster reconciliation has ${input.plan.reviewItems.length} review items: ${input.plan.approvalRequiredReasons.join(", ")}`,
    );
  }

  private activeRosterBlockReasons(row: NormalizedRosterReconciliationRow) {
    const reasons: string[] = [];
    if (row.matchStatus !== "matched") {
      reasons.push(`active_roster_${row.matchStatus}`);
    }
    if (!row.normalizedStoreKey) {
      reasons.push("active_roster_missing_store");
    }
    if (!row.normalizedEmployeeKey) {
      reasons.push("active_roster_missing_employee");
    }
    if (row.employeeCodeFamily !== "company_or_operator") {
      reasons.push(`active_roster_invalid_code_family:${row.employeeCodeFamily}`);
    }
    if (row.roleClassification === "unknown") {
      reasons.push("active_roster_unknown_role");
    }
    return reasons;
  }
}
