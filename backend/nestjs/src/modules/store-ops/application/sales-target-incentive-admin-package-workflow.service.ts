import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/auth-context.service";
import {
  SalesTargetIncentiveAdminPackageReadRepository,
  type SalesTargetIncentiveAdminRegionPackageSummaryRow,
} from "../infrastructure/sales-target-incentive-admin-package-read.repository";
import { SalesTargetIncentiveApprovalRepository } from "../infrastructure/sales-target-incentive-approval.repository";
import { SALES_TARGET_INCENTIVE_TIMEZONE } from "./sales-target-incentive-calculator.service";

export type SalesTargetIncentiveAdminRegionPackageSummary = {
  regionId: string;
  regionName: string | null;
  regionManagerUserId: string | null;
  regionManagerName: string | null;
  submittedByUserId: string | null;
  submittedByName: string | null;
  submittedAt: string | null;
  reviewedByUserId: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  status: "not_submitted" | "submitted" | "admin_approved" | "admin_returned";
  storeCount: number;
  reviewedStoreCount: number;
  submittedStoreCount: number;
  draftCorrectionCount: number;
  submittedCorrectionCount: number;
};

@Injectable()
export class SalesTargetIncentiveAdminPackageWorkflowService {
  constructor(
    private readonly adminPackageReadRepository: SalesTargetIncentiveAdminPackageReadRepository,
    private readonly approvalRepository: SalesTargetIncentiveApprovalRepository,
  ) {}

  async listRegionPackages(input: {
    actor: AuthenticatedUser;
    periodKey: string;
  }): Promise<SalesTargetIncentiveAdminRegionPackageSummary[]> {
    this.assertSuperAdmin(input.actor);
    const adminScope = this.resolveSuperAdminReadScope(input.actor);
    const rows = await this.adminPackageReadRepository.listRegionPackageSummaries({
      periodKey: input.periodKey,
      companyIds: adminScope.companyIds,
      regionIds: adminScope.regionIds,
      storeIds: adminScope.storeIds,
      allowGlobalScope: this.hasNoReadScope(adminScope),
    });
    return rows.map(toAdminRegionPackageSummary);
  }

  async reviewRegionPackage(input: {
    actor: AuthenticatedUser;
    periodKey: string;
    regionId: string;
    decision: "approve" | "return";
    reviewNote?: string | null;
  }) {
    this.assertSuperAdmin(input.actor);
    const reviewNote = input.reviewNote?.trim() || null;
    if (input.decision === "return" && !reviewNote) {
      throw new BadRequestException("Return note is required");
    }

    const visiblePackages = await this.listRegionPackages({
      actor: input.actor,
      periodKey: input.periodKey,
    });
    if (!visiblePackages.some((item) => item.regionId === input.regionId)) {
      throw new ForbiddenException("Incentive package review is not available");
    }

    const packageRow = await this.approvalRepository.reviewRegionPackage({
      periodKey: input.periodKey,
      regionId: input.regionId,
      actorUserId: input.actor.userId,
      packageStatus: input.decision === "approve" ? "admin_approved" : "admin_returned",
      reviewNote,
    });

    return {
      data: {
        period: packageRow.period_key,
        regionId: packageRow.region_id,
        regionPackageId: packageRow.sales_target_incentive_region_package_id,
        status: packageRow.package_status,
        reviewedByUserId: packageRow.reviewed_by_user_id,
        reviewedAt: packageRow.reviewed_at,
        reviewNote: packageRow.review_note,
      },
    };
  }

  private assertSuperAdmin(actor: AuthenticatedUser) {
    if (!actor.roleCodes.includes("SUPER_ADMIN")) {
      throw new ForbiddenException("Incentive package review is not available");
    }
  }

  private resolveSuperAdminReadScope(actor: AuthenticatedUser) {
    return actor.roleScopes?.SUPER_ADMIN ?? actor.readScope;
  }

  private hasNoReadScope(readScope: AuthenticatedUser["readScope"]) {
    return (
      readScope.companyIds.length === 0 &&
      readScope.regionIds.length === 0 &&
      readScope.storeIds.length === 0
    );
  }
}

function toAdminRegionPackageSummary(
  row: SalesTargetIncentiveAdminRegionPackageSummaryRow,
): SalesTargetIncentiveAdminRegionPackageSummary {
  return {
    regionId: row.region_id,
    regionName: row.region_name,
    regionManagerUserId: row.region_manager_user_id,
    regionManagerName: row.region_manager_name,
    submittedByUserId: row.submitted_by_user_id,
    submittedByName: row.submitted_by_name,
    submittedAt: row.submitted_at,
    reviewedByUserId: row.reviewed_by_user_id,
    reviewedByName: row.reviewed_by_name,
    reviewedAt: row.reviewed_at,
    reviewNote: row.review_note,
    status: row.package_status ?? "not_submitted",
    storeCount: Number(row.store_count),
    reviewedStoreCount: Number(row.reviewed_store_count),
    submittedStoreCount: Number(row.submitted_store_count),
    draftCorrectionCount: Number(row.draft_correction_count),
    submittedCorrectionCount: Number(row.submitted_correction_count),
  };
}

export function resolveSalesTargetIncentivePeriodKey(periodKey?: string) {
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
