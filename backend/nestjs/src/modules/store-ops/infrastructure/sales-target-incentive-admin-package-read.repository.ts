import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import type { SalesTargetIncentiveRegionPackageStatus } from "./sales-target-incentive-approval.repository";

export type SalesTargetIncentiveAdminRegionPackageSummaryRow = {
  company_id: string;
  region_id: string;
  region_name: string | null;
  region_manager_user_id: string | null;
  region_manager_name: string | null;
  region_package_id: string | null;
  package_status: SalesTargetIncentiveRegionPackageStatus | null;
  submitted_by_user_id: string | null;
  submitted_by_name: string | null;
  submitted_at: string | null;
  reviewed_by_user_id: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  store_count: string;
  reviewed_store_count: string;
  submitted_store_count: string;
  draft_correction_count: string;
  submitted_correction_count: string;
};

@Injectable()
export class SalesTargetIncentiveAdminPackageReadRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listRegionPackageSummaries(input: {
    periodKey: string;
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    allowGlobalScope: boolean;
  }): Promise<SalesTargetIncentiveAdminRegionPackageSummaryRow[]> {
    const result =
      await this.databaseService.query<SalesTargetIncentiveAdminRegionPackageSummaryRow>(
        `
          WITH scoped_current_store AS (
            SELECT DISTINCT
              store.company_id,
              store.region_id,
              store.store_id
            FROM ops.store store
            WHERE store.store_type = 'company'
              AND store.status = 'active'
              AND store.region_id IS NOT NULL
              AND (
                $5::boolean
                OR store.company_id = ANY($2::uuid[])
                OR store.region_id = ANY($3::uuid[])
                OR store.store_id = ANY($4::uuid[])
              )
          ),
          package_scope AS (
            SELECT DISTINCT
              package.company_id,
              package.region_id
            FROM ops.sales_target_incentive_region_package package
            WHERE package.period_key = $1
              AND (
                $5::boolean
                OR package.company_id = ANY($2::uuid[])
                OR package.region_id = ANY($3::uuid[])
                OR EXISTS (
                  SELECT 1
                  FROM ops.sales_target_incentive_region_package_store scoped_store
                  WHERE scoped_store.region_package_id = package.sales_target_incentive_region_package_id
                    AND scoped_store.store_id = ANY($4::uuid[])
                )
              )
          ),
          base_region AS (
            SELECT company_id, region_id FROM scoped_current_store
            UNION
            SELECT company_id, region_id FROM package_scope
          ),
          current_store_summary AS (
            SELECT company_id, region_id, COUNT(DISTINCT store_id)::text AS store_count
            FROM scoped_current_store
            GROUP BY company_id, region_id
          ),
          latest_final_snapshot AS (
            SELECT DISTINCT ON (snapshot.period_key, snapshot.store_id)
              snapshot.sales_target_incentive_final_snapshot_id,
              snapshot.period_key,
              snapshot.store_id
            FROM rpt.sales_target_incentive_final_snapshot snapshot
            INNER JOIN scoped_current_store store_scope
              ON store_scope.store_id = snapshot.store_id
            WHERE snapshot.period_key = $1
            ORDER BY snapshot.period_key, snapshot.store_id, snapshot.close_cutoff_at DESC,
              snapshot.sales_target_incentive_final_snapshot_id DESC
          ),
          review_summary AS (
            SELECT
              review.company_id,
              review.region_id,
              COUNT(DISTINCT review.store_id) FILTER (WHERE review.review_status = 'reviewed')::text AS reviewed_store_count
            FROM ops.sales_target_incentive_store_review review
            INNER JOIN latest_final_snapshot latest_snapshot
              ON latest_snapshot.period_key = review.period_key
              AND latest_snapshot.store_id = review.store_id
              AND latest_snapshot.sales_target_incentive_final_snapshot_id = review.final_snapshot_id
            WHERE review.period_key = $1
            GROUP BY review.company_id, review.region_id
          ),
          package_row AS (
            SELECT package.*
            FROM ops.sales_target_incentive_region_package package
            INNER JOIN base_region
              ON base_region.company_id = package.company_id
              AND base_region.region_id = package.region_id
            WHERE package.period_key = $1
          ),
          package_store_summary AS (
            SELECT
              package_store.region_package_id,
              COUNT(DISTINCT package_store.store_id)::text AS submitted_store_count,
              COUNT(DISTINCT package_store.store_id) FILTER (WHERE package_store.reviewed_at IS NOT NULL)::text AS reviewed_store_count
            FROM ops.sales_target_incentive_region_package_store package_store
            INNER JOIN package_row package
              ON package.sales_target_incentive_region_package_id = package_store.region_package_id
            GROUP BY package_store.region_package_id
          ),
          correction_summary AS (
            SELECT
              correction.company_id,
              correction.region_id,
              COUNT(*) FILTER (WHERE correction.correction_status = 'draft')::text AS draft_correction_count,
              COUNT(*) FILTER (WHERE correction.correction_status = 'submitted')::text AS submitted_correction_count
            FROM ops.sales_target_incentive_region_correction correction
            INNER JOIN base_region
              ON base_region.company_id = correction.company_id
              AND base_region.region_id = correction.region_id
            WHERE correction.period_key = $1
              AND correction.correction_status <> 'voided'
            GROUP BY correction.company_id, correction.region_id
          )
          SELECT
            base_region.company_id::text AS company_id,
            base_region.region_id::text AS region_id,
            region.region_name,
            region_manager.user_id AS region_manager_user_id,
            region_manager.display_name AS region_manager_name,
            package.sales_target_incentive_region_package_id::text AS region_package_id,
            package.package_status,
            package.submitted_by_user_id::text AS submitted_by_user_id,
            submitted_by.display_name AS submitted_by_name,
            package.submitted_at,
            package.reviewed_by_user_id::text AS reviewed_by_user_id,
            reviewed_by.display_name AS reviewed_by_name,
            package.reviewed_at,
            package.review_note,
            COALESCE(package_store.submitted_store_count, current_store.store_count, '0') AS store_count,
            COALESCE(package_store.reviewed_store_count, review_summary.reviewed_store_count, '0') AS reviewed_store_count,
            COALESCE(package_store.submitted_store_count, '0') AS submitted_store_count,
            COALESCE(correction_summary.draft_correction_count, '0') AS draft_correction_count,
            COALESCE(correction_summary.submitted_correction_count, '0') AS submitted_correction_count
          FROM base_region
          LEFT JOIN ops.region region
            ON region.region_id = base_region.region_id
          LEFT JOIN current_store_summary current_store
            ON current_store.company_id = base_region.company_id
            AND current_store.region_id = base_region.region_id
          LEFT JOIN review_summary
            ON review_summary.company_id = base_region.company_id
            AND review_summary.region_id = base_region.region_id
          LEFT JOIN package_row package
            ON package.company_id = base_region.company_id
            AND package.region_id = base_region.region_id
          LEFT JOIN package_store_summary package_store
            ON package_store.region_package_id = package.sales_target_incentive_region_package_id
          LEFT JOIN correction_summary
            ON correction_summary.company_id = base_region.company_id
            AND correction_summary.region_id = base_region.region_id
          LEFT JOIN LATERAL (${userDisplayNameSql("package", "submitted_by_user_id")}) submitted_by ON TRUE
          LEFT JOIN LATERAL (${userDisplayNameSql("package", "reviewed_by_user_id")}) reviewed_by ON TRUE
          LEFT JOIN LATERAL (
            SELECT
              user_account.user_id::text AS user_id,
              COALESCE(
                NULLIF(TRIM(CONCAT(employee.first_name, ' ', employee.last_name)), ''),
                user_account.username,
                user_account.email,
                user_account.user_id::text
              ) AS display_name
            FROM ops.user_role_assignment role_assignment
            INNER JOIN ops.role role
              ON role.role_id = role_assignment.role_id
              AND role.role_code = 'REGION_MANAGER'
            INNER JOIN ops.user_action_store_assignment manager_store
              ON manager_store.user_id = role_assignment.user_id
              AND manager_store.start_at <= NOW()
              AND (manager_store.end_at IS NULL OR manager_store.end_at > NOW())
            INNER JOIN ops.store assigned_store
              ON assigned_store.store_id = manager_store.store_id
              AND assigned_store.company_id = base_region.company_id
              AND assigned_store.region_id = base_region.region_id
              AND assigned_store.store_type = 'company'
              AND assigned_store.status = 'active'
            INNER JOIN ops.user_account user_account
              ON user_account.user_id = role_assignment.user_id
              AND user_account.is_active = TRUE
            LEFT JOIN ops.employee employee
              ON employee.employee_id = user_account.employee_id
            WHERE role_assignment.start_at <= NOW()
              AND (role_assignment.end_at IS NULL OR role_assignment.end_at >= NOW())
            ORDER BY user_account.username ASC, user_account.user_id ASC
            LIMIT 1
          ) region_manager ON TRUE
          ORDER BY region.region_name ASC NULLS LAST, base_region.region_id ASC
        `,
        [
          input.periodKey,
          input.companyIds,
          input.regionIds,
          input.storeIds,
          input.allowGlobalScope,
        ],
      );
    return result.rows;
  }
}

function userDisplayNameSql(tableAlias: string, columnName: string) {
  return `
    SELECT
      user_account.user_id::text AS user_id,
      COALESCE(
        NULLIF(TRIM(CONCAT(employee.first_name, ' ', employee.last_name)), ''),
        user_account.username,
        user_account.email,
        user_account.user_id::text
      ) AS display_name
    FROM ops.user_account user_account
    LEFT JOIN ops.employee employee
      ON employee.employee_id = user_account.employee_id
    WHERE user_account.user_id = ${tableAlias}.${columnName}
    LIMIT 1
  `;
}
