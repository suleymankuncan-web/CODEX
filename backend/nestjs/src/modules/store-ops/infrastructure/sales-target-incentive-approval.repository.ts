import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { PoolClient } from "pg";
import { DatabaseService } from "../../../shared/database/database.service";
import { SALES_TARGET_INCENTIVE_TIMEZONE } from "../application/sales-target-incentive-calculator.service";

type ApprovalClient = Pick<PoolClient, "query">;

const latestFinalSnapshotCte = `
  WITH latest_final_snapshot AS (
    SELECT DISTINCT ON (snapshot.period_key, snapshot.store_id)
      snapshot.sales_target_incentive_final_snapshot_id, snapshot.period_key, snapshot.store_id
    FROM rpt.sales_target_incentive_final_snapshot snapshot
    WHERE snapshot.period_key = $1 AND snapshot.store_id = ANY($2::uuid[])
    ORDER BY snapshot.period_key, snapshot.store_id, snapshot.close_cutoff_at DESC,
      snapshot.sales_target_incentive_final_snapshot_id DESC
  )
`;

export type SalesTargetIncentiveStoreReviewStatus =
  | "pending_review"
  | "reviewed";

export type SalesTargetIncentiveRegionPackageStatus =
  | "submitted"
  | "admin_approved"
  | "admin_returned";

export type SalesTargetIncentiveRegionCorrectionStatus =
  | "draft"
  | "submitted"
  | "admin_approved"
  | "admin_returned"
  | "voided";

export type SalesTargetIncentiveParticipantType =
  | "store_manager"
  | "personnel";

export type SalesTargetIncentiveApprovalStore = {
  companyId: string;
  regionId: string;
  storeId: string;
};

export type SalesTargetIncentiveWorkflowState = {
  reviews: SalesTargetIncentiveStoreReviewRow[];
  corrections: SalesTargetIncentiveRegionCorrectionRow[];
  packages: SalesTargetIncentiveRegionPackageRow[];
};

export type SalesTargetIncentiveStoreReviewRow = {
  sales_target_incentive_store_review_id: string;
  company_id: string;
  region_id: string;
  store_id: string;
  period_key: string;
  review_status: SalesTargetIncentiveStoreReviewStatus;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  updated_at: string;
};

export type SalesTargetIncentiveRegionPackageRow = {
  sales_target_incentive_region_package_id: string;
  company_id: string;
  region_id: string;
  period_key: string;
  package_status: SalesTargetIncentiveRegionPackageStatus;
  submitted_by_user_id: string;
  submitted_at: string;
  submission_note: string | null;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  store_count?: string;
  correction_count?: string;
};

export type SalesTargetIncentiveRegionCorrectionRow = {
  sales_target_incentive_region_correction_id: string;
  region_package_id: string | null;
  company_id: string;
  region_id: string;
  store_id: string;
  employee_id: string;
  participant_type: SalesTargetIncentiveParticipantType;
  final_row_id: string;
  period_key: string;
  before_amount: string;
  final_amount: string;
  adjustment_amount: string;
  reason_note: string;
  correction_status: SalesTargetIncentiveRegionCorrectionStatus;
  created_by_user_id: string;
  submitted_by_user_id: string | null;
  submitted_at: string | null;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  approved_adjustment_id: string | null;
  updated_at: string;
};

export type SalesTargetIncentiveClosedFinalSnapshotTargetRow = {
  final_row_id: string;
  company_id: string;
  region_id: string;
  store_id: string;
  store_name: string;
  employee_id: string;
  user_id: string | null;
  participant_type: SalesTargetIncentiveParticipantType;
  position_code: string;
  target_amount: string | null;
  actual_sales_amount: string | null;
  achievement_pct: string | null;
  applied_rate: string | null;
  payable_amount: string;
  final_amount: string;
  approved_adjustment_amount: string;
  current_amount: string;
};

@Injectable()
export class SalesTargetIncentiveApprovalRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listWorkflowState(input: {
    periodKey: string;
    storeIds: string[];
  }): Promise<SalesTargetIncentiveWorkflowState> {
    if (input.storeIds.length === 0) {
      return { reviews: [], corrections: [], packages: [] };
    }

    const [reviews, corrections, packages] = await Promise.all([
      this.databaseService.query<SalesTargetIncentiveStoreReviewRow>(
        `
          SELECT
            sales_target_incentive_store_review_id,
            company_id,
            region_id,
            store_id,
            period_key,
            review_status,
            reviewed_by_user_id,
            reviewed_at,
            updated_at
          FROM ops.sales_target_incentive_store_review
          WHERE period_key = $1
            AND store_id = ANY($2::uuid[])
        `,
        [input.periodKey, input.storeIds],
      ),
      this.databaseService.query<SalesTargetIncentiveRegionCorrectionRow>(
        `
          SELECT *
          FROM ops.sales_target_incentive_region_correction
          WHERE period_key = $1
            AND store_id = ANY($2::uuid[])
            AND correction_status <> 'voided'
        `,
        [input.periodKey, input.storeIds],
      ),
      this.databaseService.query<SalesTargetIncentiveRegionPackageRow>(
        `
          SELECT DISTINCT package.*
          FROM ops.sales_target_incentive_region_package package
          INNER JOIN ops.sales_target_incentive_region_package_store package_store
            ON package_store.region_package_id = package.sales_target_incentive_region_package_id
          WHERE package.period_key = $1
            AND package_store.store_id = ANY($2::uuid[])
        `,
        [input.periodKey, input.storeIds],
      ),
    ]);

    return {
      reviews: reviews.rows,
      corrections: corrections.rows,
      packages: packages.rows,
    };
  }

  async markStoreReview(input: {
    periodKey: string;
    store: SalesTargetIncentiveApprovalStore;
    actorUserId: string;
    reviewStatus: SalesTargetIncentiveStoreReviewStatus;
  }): Promise<SalesTargetIncentiveStoreReviewRow> {
    return this.databaseService.withTransaction(async (client) => {
      await this.lockStoreReview(client, {
        periodKey: input.periodKey,
        storeId: input.store.storeId,
      });
      await this.ensureStorePeriodEditable(client, {
        periodKey: input.periodKey,
        regionId: input.store.regionId,
      });

      const result = await client.query<SalesTargetIncentiveStoreReviewRow>(
        `
          INSERT INTO ops.sales_target_incentive_store_review (
            company_id,
            region_id,
            store_id,
            period_key,
            period_timezone,
            review_status,
            reviewed_by_user_id,
            reviewed_at
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            CASE WHEN $6 = 'reviewed' THEN $7::uuid ELSE NULL END,
            CASE WHEN $6 = 'reviewed' THEN NOW() ELSE NULL END
          )
          ON CONFLICT (store_id, period_key) DO UPDATE SET
            company_id = EXCLUDED.company_id,
            region_id = EXCLUDED.region_id,
            review_status = EXCLUDED.review_status,
            reviewed_by_user_id = EXCLUDED.reviewed_by_user_id,
            reviewed_at = EXCLUDED.reviewed_at,
            updated_at = NOW()
          RETURNING
            sales_target_incentive_store_review_id,
            company_id,
            region_id,
            store_id,
            period_key,
            review_status,
            reviewed_by_user_id,
            reviewed_at,
            updated_at
        `,
        [
          input.store.companyId,
          input.store.regionId,
          input.store.storeId,
          input.periodKey,
          SALES_TARGET_INCENTIVE_TIMEZONE,
          input.reviewStatus,
          input.actorUserId,
        ],
      );

      const row = result.rows[0];
      if (!row) {
        throw new Error("Store review was not persisted");
      }
      return row;
    });
  }

  async createOrReplaceDraftCorrection(input: {
    periodKey: string;
    store: SalesTargetIncentiveApprovalStore;
    employeeId: string;
    participantType: SalesTargetIncentiveParticipantType;
    finalAmount: string;
    reasonNote: string;
    actorUserId: string;
  }): Promise<SalesTargetIncentiveRegionCorrectionRow> {
    return this.databaseService.withTransaction(async (client) => {
      await this.ensureStorePeriodEditable(client, {
        periodKey: input.periodKey,
        regionId: input.store.regionId,
      });
      await this.lockCorrectionTarget(client, {
        periodKey: input.periodKey,
        storeId: input.store.storeId,
        employeeId: input.employeeId,
        participantType: input.participantType,
      });

      const target = await this.findClosedFinalSnapshotTarget(client, {
        periodKey: input.periodKey,
        storeId: input.store.storeId,
        employeeId: input.employeeId,
        participantType: input.participantType,
      });
      if (!target) {
        throw new NotFoundException("Closed incentive target was not found");
      }
      if (this.isSameAmount(target.current_amount, input.finalAmount)) {
        throw new BadRequestException("Correction amount must change the final amount");
      }

      const result = await client.query<SalesTargetIncentiveRegionCorrectionRow>(
        `
          INSERT INTO ops.sales_target_incentive_region_correction (
            company_id,
            region_id,
            store_id,
            employee_id,
            participant_type,
            target_scope,
            final_row_id,
            period_key,
            period_timezone,
            before_amount,
            final_amount,
            reason_note,
            correction_status,
            created_by_user_id
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            'final_snapshot',
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            'draft',
            $12
          )
          ON CONFLICT (store_id, employee_id, participant_type, period_key)
          WHERE correction_status IN ('draft', 'submitted', 'admin_returned')
          DO UPDATE SET
            company_id = EXCLUDED.company_id,
            region_id = EXCLUDED.region_id,
            target_scope = 'final_snapshot',
            final_row_id = EXCLUDED.final_row_id,
            before_amount = EXCLUDED.before_amount,
            final_amount = EXCLUDED.final_amount,
            reason_note = EXCLUDED.reason_note,
            correction_status = 'draft',
            region_package_id = NULL,
            submitted_by_user_id = NULL,
            submitted_at = NULL,
            reviewed_by_user_id = NULL,
            reviewed_at = NULL,
            review_note = NULL,
            approved_adjustment_id = NULL,
            updated_at = NOW()
          RETURNING *
        `,
        [
          input.store.companyId,
          input.store.regionId,
          input.store.storeId,
          input.employeeId,
          input.participantType,
          target.final_row_id,
          input.periodKey,
          SALES_TARGET_INCENTIVE_TIMEZONE,
          target.current_amount,
          input.finalAmount,
          input.reasonNote,
          input.actorUserId,
        ],
      );

      const row = result.rows[0];
      if (!row) {
        throw new Error("Draft correction was not persisted");
      }
      return row;
    });
  }

  async voidDraftCorrection(input: {
    periodKey: string;
    storeId: string;
    employeeId: string;
    participantType: SalesTargetIncentiveParticipantType;
    actorUserId: string;
  }): Promise<SalesTargetIncentiveRegionCorrectionRow> {
    return this.databaseService.withTransaction(async (client) => {
      await this.lockCorrectionTarget(client, input);
      const result = await client.query<SalesTargetIncentiveRegionCorrectionRow>(
        `
          UPDATE ops.sales_target_incentive_region_correction
          SET
            correction_status = 'voided',
            region_package_id = NULL,
            submitted_by_user_id = NULL,
            submitted_at = NULL,
            reviewed_by_user_id = NULL,
            reviewed_at = NULL,
            review_note = NULL,
            updated_at = NOW()
          WHERE period_key = $1
            AND store_id = $2
            AND employee_id = $3
            AND participant_type = $4
            AND correction_status IN ('draft', 'admin_returned')
          RETURNING *
        `,
        [
          input.periodKey,
          input.storeId,
          input.employeeId,
          input.participantType,
        ],
      );

      const row = result.rows[0];
      if (!row) {
        throw new ConflictException("Only draft or returned corrections can be voided");
      }
      return row;
    });
  }

  async submitRegionPackage(input: {
    companyId: string;
    regionId: string;
    periodKey: string;
    storeIds: string[];
    actorUserId: string;
    submissionNote?: string | null;
  }): Promise<SalesTargetIncentiveRegionPackageRow> {
    if (input.storeIds.length === 0) {
      throw new BadRequestException("Package must include at least one store");
    }

    return this.databaseService.withTransaction(async (client) => {
      await this.lockRegionPackage(client, {
        periodKey: input.periodKey,
        regionId: input.regionId,
      });
      await this.ensurePackageNotApproved(client, {
        periodKey: input.periodKey,
        regionId: input.regionId,
      });
      await this.ensureClosedSnapshotsExist(client, input);
      await this.ensureStoresReviewed(client, input);

      const packageResult = await client.query<SalesTargetIncentiveRegionPackageRow>(
        `
          INSERT INTO ops.sales_target_incentive_region_package (
            company_id,
            region_id,
            period_key,
            period_timezone,
            package_status,
            submitted_by_user_id,
            submitted_at,
            submission_note
          )
          VALUES ($1, $2, $3, $4, 'submitted', $5, NOW(), $6)
          ON CONFLICT (region_id, period_key) DO UPDATE SET
            company_id = EXCLUDED.company_id,
            package_status = 'submitted',
            submitted_by_user_id = EXCLUDED.submitted_by_user_id,
            submitted_at = NOW(),
            submission_note = EXCLUDED.submission_note,
            reviewed_by_user_id = NULL,
            reviewed_at = NULL,
            review_note = NULL,
            updated_at = NOW()
          WHERE ops.sales_target_incentive_region_package.package_status <> 'admin_approved'
          RETURNING *
        `,
        [
          input.companyId,
          input.regionId,
          input.periodKey,
          SALES_TARGET_INCENTIVE_TIMEZONE,
          input.actorUserId,
          input.submissionNote ?? null,
        ],
      );
      const packageRow = packageResult.rows[0];
      if (!packageRow) {
        throw new ConflictException("Approved packages cannot be resubmitted");
      }

      await client.query(
        `
          DELETE FROM ops.sales_target_incentive_region_package_store
          WHERE region_package_id = $1
        `,
        [packageRow.sales_target_incentive_region_package_id],
      );
      await client.query(
        `
          INSERT INTO ops.sales_target_incentive_region_package_store (
            region_package_id,
            store_review_id,
            company_id,
            region_id,
            store_id,
            period_key,
            reviewed_by_user_id,
            reviewed_at
          )
          SELECT
            $1,
            review.sales_target_incentive_store_review_id,
            review.company_id,
            review.region_id,
            review.store_id,
            review.period_key,
            review.reviewed_by_user_id,
            review.reviewed_at
          FROM ops.sales_target_incentive_store_review review
          WHERE review.period_key = $2
            AND review.region_id = $3
            AND review.store_id = ANY($4::uuid[])
            AND review.review_status = 'reviewed'
        `,
        [
          packageRow.sales_target_incentive_region_package_id,
          input.periodKey,
          input.regionId,
          input.storeIds,
        ],
      );
      await client.query(
        `
          UPDATE ops.sales_target_incentive_region_correction
          SET
            region_package_id = $1,
            correction_status = 'submitted',
            submitted_by_user_id = $2,
            submitted_at = NOW(),
            reviewed_by_user_id = NULL,
            reviewed_at = NULL,
            review_note = NULL,
            updated_at = NOW()
          WHERE period_key = $3
            AND region_id = $4
            AND store_id = ANY($5::uuid[])
            AND correction_status IN ('draft', 'admin_returned')
        `,
        [
          packageRow.sales_target_incentive_region_package_id,
          input.actorUserId,
          input.periodKey,
          input.regionId,
          input.storeIds,
        ],
      );

      return packageRow;
    });
  }

  async reviewRegionPackage(input: {
    periodKey: string;
    regionId: string;
    actorUserId: string;
    packageStatus: Extract<
      SalesTargetIncentiveRegionPackageStatus,
      "admin_approved" | "admin_returned"
    >;
    reviewNote?: string | null;
  }): Promise<SalesTargetIncentiveRegionPackageRow> {
    return this.databaseService.withTransaction(async (client) => {
      await this.lockRegionPackage(client, {
        periodKey: input.periodKey,
        regionId: input.regionId,
      });
      const packageRow = await this.findSubmittedPackage(client, input);
      if (!packageRow) {
        throw new NotFoundException("Submitted package was not found");
      }

      if (input.packageStatus === "admin_returned") {
        if (!input.reviewNote?.trim()) {
          throw new BadRequestException("Return note is required");
        }
        await client.query(
          `
            UPDATE ops.sales_target_incentive_region_correction
            SET
              correction_status = 'admin_returned',
              reviewed_by_user_id = $1,
              reviewed_at = NOW(),
              review_note = $2,
              updated_at = NOW()
            WHERE region_package_id = $3
              AND correction_status = 'submitted'
          `,
          [
            input.actorUserId,
            input.reviewNote,
            packageRow.sales_target_incentive_region_package_id,
          ],
        );
      } else {
        await this.approveSubmittedCorrections(client, {
          packageId: packageRow.sales_target_incentive_region_package_id,
          actorUserId: input.actorUserId,
        });
      }

      const result = await client.query<SalesTargetIncentiveRegionPackageRow>(
        `
          UPDATE ops.sales_target_incentive_region_package
          SET
            package_status = $1,
            reviewed_by_user_id = $2,
            reviewed_at = NOW(),
            review_note = $3,
            updated_at = NOW()
          WHERE sales_target_incentive_region_package_id = $4
          RETURNING *
        `,
        [
          input.packageStatus,
          input.actorUserId,
          input.reviewNote ?? null,
          packageRow.sales_target_incentive_region_package_id,
        ],
      );

      const reviewedPackage = result.rows[0];
      if (!reviewedPackage) {
        throw new Error("Package review was not persisted");
      }
      return reviewedPackage;
    });
  }

  async listClosedFinalSnapshotTargets(input: {
    periodKey: string;
    storeIds: string[];
  }): Promise<SalesTargetIncentiveClosedFinalSnapshotTargetRow[]> {
    if (input.storeIds.length === 0) {
      return [];
    }
    const result =
      await this.databaseService.query<SalesTargetIncentiveClosedFinalSnapshotTargetRow>(
        `
          ${latestFinalSnapshotCte}
          SELECT
            final_row.sales_target_incentive_final_row_id AS final_row_id,
            snapshot.company_id,
            snapshot.region_id,
            snapshot.store_id,
            store.store_name,
            final_row.employee_id,
            final_row.user_id,
            final_row.participant_type,
            final_row.position_code,
            final_row.target_amount,
            final_row.actual_sales_amount,
            final_row.achievement_pct,
            final_row.applied_rate,
            final_row.payable_amount,
            final_row.final_amount,
            COALESCE(SUM(adjustment.adjustment_amount) FILTER (WHERE adjustment.status = 'approved'), 0)::numeric(18,2) AS approved_adjustment_amount,
            (final_row.final_amount + COALESCE(SUM(adjustment.adjustment_amount) FILTER (WHERE adjustment.status = 'approved'), 0))::numeric(18,2) AS current_amount
          FROM rpt.sales_target_incentive_final_row final_row
          INNER JOIN latest_final_snapshot latest_snapshot
            ON latest_snapshot.sales_target_incentive_final_snapshot_id = final_row.final_snapshot_id
          INNER JOIN rpt.sales_target_incentive_final_snapshot snapshot
            ON snapshot.sales_target_incentive_final_snapshot_id = final_row.final_snapshot_id
          INNER JOIN ops.store store
            ON store.store_id = snapshot.store_id
          LEFT JOIN ops.sales_target_incentive_adjustment adjustment
            ON adjustment.final_row_id = final_row.sales_target_incentive_final_row_id
            AND adjustment.adjustment_scope = 'final_snapshot'
          GROUP BY
            final_row.sales_target_incentive_final_row_id,
            snapshot.company_id,
            snapshot.region_id,
            snapshot.store_id,
            store.store_name
          ORDER BY store.store_name ASC, final_row.participant_type ASC, final_row.position_code ASC
        `,
        [input.periodKey, input.storeIds],
      );
    return result.rows;
  }

  async listRegionPackagesForAdmin(input: {
    periodKey: string;
    companyIds?: string[];
    regionIds?: string[];
    storeIds?: string[];
  }): Promise<SalesTargetIncentiveRegionPackageRow[]> {
    const result = await this.databaseService.query<SalesTargetIncentiveRegionPackageRow>(
      `
        SELECT
          package.*,
          COUNT(DISTINCT package_store.store_id)::text AS store_count,
          COUNT(DISTINCT correction.sales_target_incentive_region_correction_id)::text AS correction_count
        FROM ops.sales_target_incentive_region_package package
        LEFT JOIN ops.sales_target_incentive_region_package_store package_store
          ON package_store.region_package_id = package.sales_target_incentive_region_package_id
        LEFT JOIN ops.sales_target_incentive_region_correction correction
          ON correction.region_package_id = package.sales_target_incentive_region_package_id
          AND correction.correction_status <> 'voided'
        WHERE package.period_key = $1
          AND ($2::uuid[] IS NULL OR package.company_id = ANY($2::uuid[]))
          AND ($3::uuid[] IS NULL OR package.region_id = ANY($3::uuid[]))
          AND ($4::uuid[] IS NULL OR package_store.store_id = ANY($4::uuid[]))
        GROUP BY package.sales_target_incentive_region_package_id
        ORDER BY package.submitted_at DESC
      `,
      [
        input.periodKey,
        input.companyIds?.length ? input.companyIds : null,
        input.regionIds?.length ? input.regionIds : null,
        input.storeIds?.length ? input.storeIds : null,
      ],
    );
    return result.rows;
  }

  private async ensureStorePeriodEditable(
    client: ApprovalClient,
    input: { periodKey: string; regionId: string },
  ): Promise<void> {
    const result = await client.query<{ package_status: string }>(
      `
        SELECT package_status
        FROM ops.sales_target_incentive_region_package
        WHERE period_key = $1
          AND region_id = $2
          AND package_status IN ('submitted', 'admin_approved')
        FOR UPDATE
      `,
      [input.periodKey, input.regionId],
    );

    if (result.rows.length > 0) {
      throw new ConflictException("Submitted or approved packages are locked");
    }
  }

  private async ensurePackageNotApproved(
    client: ApprovalClient,
    input: { periodKey: string; regionId: string },
  ): Promise<void> {
    const result = await client.query<{ package_status: string }>(
      `
        SELECT package_status
        FROM ops.sales_target_incentive_region_package
        WHERE period_key = $1
          AND region_id = $2
          AND package_status = 'admin_approved'
        FOR UPDATE
      `,
      [input.periodKey, input.regionId],
    );

    if (result.rows.length > 0) {
      throw new ConflictException("Approved packages cannot be changed");
    }
  }

  private async ensureClosedSnapshotsExist(
    client: ApprovalClient,
    input: { periodKey: string; regionId: string; storeIds: string[] },
  ): Promise<void> {
    const result = await client.query<{ closed_store_count: string }>(
      `
        SELECT COUNT(DISTINCT store_id)::text AS closed_store_count
        FROM rpt.sales_target_incentive_final_snapshot
        WHERE period_key = $1
          AND region_id = $2
          AND store_id = ANY($3::uuid[])
      `,
      [input.periodKey, input.regionId, input.storeIds],
    );
    const closedStoreCount = Number(result.rows[0]?.closed_store_count ?? 0);
    if (closedStoreCount !== input.storeIds.length) {
      throw new BadRequestException("All package stores must have a closed final snapshot");
    }
  }

  private async ensureStoresReviewed(
    client: ApprovalClient,
    input: { periodKey: string; regionId: string; storeIds: string[] },
  ): Promise<void> {
    const result = await client.query<{ reviewed_store_count: string }>(
      `
        SELECT COUNT(DISTINCT store_id)::text AS reviewed_store_count
        FROM ops.sales_target_incentive_store_review
        WHERE period_key = $1
          AND region_id = $2
          AND store_id = ANY($3::uuid[])
          AND review_status = 'reviewed'
      `,
      [input.periodKey, input.regionId, input.storeIds],
    );
    const reviewedStoreCount = Number(result.rows[0]?.reviewed_store_count ?? 0);
    if (reviewedStoreCount !== input.storeIds.length) {
      throw new BadRequestException("All package stores must be reviewed before submit");
    }
  }

  private async findClosedFinalSnapshotTarget(
    client: ApprovalClient,
    input: {
      periodKey: string;
      storeId: string;
      employeeId: string;
      participantType: SalesTargetIncentiveParticipantType;
    },
  ): Promise<SalesTargetIncentiveClosedFinalSnapshotTargetRow | null> {
    const result =
      await client.query<SalesTargetIncentiveClosedFinalSnapshotTargetRow>(
        `
          ${latestFinalSnapshotCte}
          SELECT
            final_row.sales_target_incentive_final_row_id AS final_row_id,
            snapshot.company_id,
            snapshot.region_id,
            snapshot.store_id,
            store.store_name,
            final_row.employee_id,
            final_row.user_id,
            final_row.participant_type,
            final_row.position_code,
            final_row.target_amount,
            final_row.actual_sales_amount,
            final_row.achievement_pct,
            final_row.applied_rate,
            final_row.payable_amount,
            final_row.final_amount,
            COALESCE(SUM(adjustment.adjustment_amount) FILTER (WHERE adjustment.status = 'approved'), 0)::numeric(18,2) AS approved_adjustment_amount,
            (final_row.final_amount + COALESCE(SUM(adjustment.adjustment_amount) FILTER (WHERE adjustment.status = 'approved'), 0))::numeric(18,2) AS current_amount
          FROM rpt.sales_target_incentive_final_row final_row
          INNER JOIN latest_final_snapshot latest_snapshot
            ON latest_snapshot.sales_target_incentive_final_snapshot_id = final_row.final_snapshot_id
          INNER JOIN rpt.sales_target_incentive_final_snapshot snapshot
            ON snapshot.sales_target_incentive_final_snapshot_id = final_row.final_snapshot_id
          INNER JOIN ops.store store
            ON store.store_id = snapshot.store_id
          LEFT JOIN ops.sales_target_incentive_adjustment adjustment
            ON adjustment.final_row_id = final_row.sales_target_incentive_final_row_id
            AND adjustment.adjustment_scope = 'final_snapshot'
          WHERE final_row.employee_id = $3
            AND final_row.participant_type = $4
          GROUP BY
            final_row.sales_target_incentive_final_row_id,
            snapshot.company_id,
            snapshot.region_id,
            snapshot.store_id,
            store.store_name
        `,
        [input.periodKey, [input.storeId], input.employeeId, input.participantType],
      );
    return result.rows[0] ?? null;
  }

  private async findSubmittedPackage(
    client: ApprovalClient,
    input: { periodKey: string; regionId: string },
  ): Promise<SalesTargetIncentiveRegionPackageRow | null> {
    const result = await client.query<SalesTargetIncentiveRegionPackageRow>(
      `
        SELECT *
        FROM ops.sales_target_incentive_region_package
        WHERE period_key = $1
          AND region_id = $2
          AND package_status = 'submitted'
        FOR UPDATE
      `,
      [input.periodKey, input.regionId],
    );
    return result.rows[0] ?? null;
  }

  private async approveSubmittedCorrections(
    client: ApprovalClient,
    input: { packageId: string; actorUserId: string },
  ): Promise<void> {
    await client.query(
      `
        WITH inserted_adjustment AS (
          INSERT INTO ops.sales_target_incentive_adjustment (
            company_id,
            region_id,
            store_id,
            employee_id,
            final_row_id,
            rule_version_id,
            period_key,
            period_timezone,
            adjustment_scope,
            adjustment_type,
            adjustment_amount,
            before_amount,
            after_amount,
            reason_code,
            reason_note,
            status,
            created_by_user_id,
            approved_by_user_id,
            approved_at,
            evidence
          )
          SELECT
            correction.company_id,
            correction.region_id,
            correction.store_id,
            correction.employee_id,
            correction.final_row_id,
            final_snapshot.rule_version_id,
            correction.period_key,
            correction.period_timezone,
            'final_snapshot',
            'manual_adjustment',
            correction.adjustment_amount,
            correction.before_amount,
            correction.final_amount,
            'region_manager_package',
            correction.reason_note,
            'approved',
            correction.created_by_user_id,
            $2,
            NOW(),
            jsonb_build_object(
              'source', 'region_manager_approval_package',
              'regionPackageId', correction.region_package_id,
              'regionCorrectionId', correction.sales_target_incentive_region_correction_id
            )
          FROM ops.sales_target_incentive_region_correction correction
          INNER JOIN rpt.sales_target_incentive_final_row final_row
            ON final_row.sales_target_incentive_final_row_id = correction.final_row_id
          INNER JOIN rpt.sales_target_incentive_final_snapshot final_snapshot
            ON final_snapshot.sales_target_incentive_final_snapshot_id = final_row.final_snapshot_id
          WHERE correction.region_package_id = $1
            AND correction.correction_status = 'submitted'
          RETURNING
            sales_target_incentive_adjustment_id,
            final_row_id,
            employee_id,
            evidence ->> 'regionCorrectionId' AS region_correction_id
        )
        UPDATE ops.sales_target_incentive_region_correction correction
        SET
          correction_status = 'admin_approved',
          reviewed_by_user_id = $2,
          reviewed_at = NOW(),
          review_note = NULL,
          approved_adjustment_id = inserted_adjustment.sales_target_incentive_adjustment_id,
          updated_at = NOW()
        FROM inserted_adjustment
        WHERE correction.sales_target_incentive_region_correction_id::text = inserted_adjustment.region_correction_id
      `,
      [input.packageId, input.actorUserId],
    );
  }

  private async lockStoreReview(
    client: ApprovalClient,
    input: { periodKey: string; storeId: string },
  ): Promise<void> {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)", [
      `sales-target-incentive-store-review:${input.periodKey}:${input.storeId}`,
    ]);
  }

  private async lockRegionPackage(
    client: ApprovalClient,
    input: { periodKey: string; regionId: string },
  ): Promise<void> {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)", [
      `sales-target-incentive-region-package:${input.periodKey}:${input.regionId}`,
    ]);
  }

  private async lockCorrectionTarget(
    client: ApprovalClient,
    input: {
      periodKey: string;
      storeId: string;
      employeeId: string;
      participantType: SalesTargetIncentiveParticipantType;
    },
  ): Promise<void> {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)", [
      [
        "sales-target-incentive-region-correction",
        input.periodKey,
        input.storeId,
        input.employeeId,
        input.participantType,
      ].join(":"),
    ]);
  }

  private isSameAmount(left: string, right: string): boolean {
    return Number(left).toFixed(2) === Number(right).toFixed(2);
  }
}
