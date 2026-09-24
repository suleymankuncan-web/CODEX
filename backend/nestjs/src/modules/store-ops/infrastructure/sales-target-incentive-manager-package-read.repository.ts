import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import type { SalesTargetIncentiveRegionPackageStatus } from "./sales-target-incentive-approval.types";

export type IncentiveManagerPackageSummaryRow = {
  company_id: string;
  manager_user_id: string;
  manager_name: string;
  package_id: string | null;
  package_scope: "legacy_region" | "manager_assignment" | null;
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
export class SalesTargetIncentiveManagerPackageReadRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async list(input: { periodKey: string; companyIds: string[] }): Promise<IncentiveManagerPackageSummaryRow[]> {
    if (!input.companyIds.length) return [];
    const result = await this.databaseService.query<IncentiveManagerPackageSummaryRow>(`
      WITH cutoff AS (
        SELECT LEAST(
          clock_timestamp(),
          ((($1::text || '-01')::date + INTERVAL '1 month') AT TIME ZONE 'Europe/Istanbul') - INTERVAL '1 microsecond'
        ) AS at_time
      ), assigned AS (
        SELECT store.company_id, role_assignment.user_id AS manager_user_id,
          COUNT(DISTINCT store.store_id)::text AS store_count,
          COUNT(DISTINCT review.store_id) FILTER (WHERE review.review_status = 'reviewed')::text AS reviewed_store_count
        FROM ops.user_role_assignment role_assignment
        JOIN ops.role role ON role.role_id = role_assignment.role_id AND role.role_code = 'REGION_MANAGER'
        JOIN ops.user_account account ON account.user_id = role_assignment.user_id AND account.is_active = TRUE
        JOIN ops.user_action_store_assignment assignment ON assignment.user_id = account.user_id
        JOIN ops.store store ON store.store_id = assignment.store_id AND store.store_type = 'company'
          AND store.status = 'active' AND store.company_id = ANY($2::uuid[])
        CROSS JOIN cutoff
        LEFT JOIN ops.sales_target_incentive_store_review review
          ON review.store_id = store.store_id AND review.period_key = $1
        WHERE role_assignment.start_at <= cutoff.at_time
          AND (role_assignment.end_at IS NULL OR role_assignment.end_at > cutoff.at_time)
          AND assignment.start_at <= cutoff.at_time
          AND (assignment.end_at IS NULL OR assignment.end_at > cutoff.at_time)
        GROUP BY store.company_id, role_assignment.user_id
      ), packages AS (
        SELECT package.*,
          COALESCE(package.manager_user_id, package.submitted_by_user_id) AS owner_user_id,
          COUNT(DISTINCT snapshot.store_id)::text AS submitted_store_count,
          COUNT(DISTINCT correction.sales_target_incentive_region_correction_id)
            FILTER (WHERE correction.correction_status = 'draft')::text AS draft_correction_count,
          COUNT(DISTINCT correction.sales_target_incentive_region_correction_id)
            FILTER (WHERE correction.correction_status = 'submitted')::text AS submitted_correction_count
        FROM ops.sales_target_incentive_region_package package
        LEFT JOIN ops.sales_target_incentive_region_package_store snapshot
          ON snapshot.region_package_id = package.sales_target_incentive_region_package_id
        LEFT JOIN ops.sales_target_incentive_region_correction correction
          ON correction.region_package_id = package.sales_target_incentive_region_package_id
        WHERE package.period_key = $1 AND package.company_id = ANY($2::uuid[])
        GROUP BY package.sales_target_incentive_region_package_id
      ), entries AS (
        SELECT package.company_id, package.owner_user_id AS manager_user_id,
          package.sales_target_incentive_region_package_id AS package_id,
          package.package_scope, package.package_status,
          package.submitted_by_user_id, package.submitted_at,
          package.reviewed_by_user_id, package.reviewed_at, package.review_note,
          COALESCE(package.submitted_store_count, '0') AS submitted_store_count,
          package.draft_correction_count, package.submitted_correction_count,
          COALESCE(assigned.store_count, package.submitted_store_count, '0') AS store_count,
          COALESCE(assigned.reviewed_store_count, '0') AS reviewed_store_count
        FROM packages package
        LEFT JOIN assigned ON assigned.company_id = package.company_id
          AND assigned.manager_user_id = package.owner_user_id
        UNION ALL
        SELECT assigned.company_id, assigned.manager_user_id, NULL::uuid, NULL::text,
          NULL::text, NULL::uuid, NULL::timestamptz, NULL::uuid, NULL::timestamptz,
          NULL::text, '0', '0', '0', assigned.store_count, assigned.reviewed_store_count
        FROM assigned
        WHERE NOT EXISTS (
          SELECT 1 FROM packages package WHERE package.company_id = assigned.company_id
            AND package.owner_user_id = assigned.manager_user_id
        )
      )
      SELECT entries.company_id::text AS company_id,
        entries.manager_user_id::text AS manager_user_id,
        COALESCE(NULLIF(TRIM(CONCAT(manager_employee.first_name, ' ', manager_employee.last_name)), ''),
          manager.username, manager.email, entries.manager_user_id::text) AS manager_name,
        entries.package_id::text AS package_id, entries.package_scope, entries.package_status,
        entries.submitted_by_user_id::text AS submitted_by_user_id,
        COALESCE(NULLIF(TRIM(CONCAT(submitted_employee.first_name, ' ', submitted_employee.last_name)), ''),
          submitted_account.username, submitted_account.email) AS submitted_by_name,
        entries.submitted_at, entries.reviewed_by_user_id::text AS reviewed_by_user_id,
        COALESCE(NULLIF(TRIM(CONCAT(reviewed_employee.first_name, ' ', reviewed_employee.last_name)), ''),
          reviewed_account.username, reviewed_account.email) AS reviewed_by_name,
        entries.reviewed_at, entries.review_note,
        entries.store_count, entries.reviewed_store_count, entries.submitted_store_count,
        entries.draft_correction_count, entries.submitted_correction_count
      FROM entries
      JOIN ops.user_account manager ON manager.user_id = entries.manager_user_id
      LEFT JOIN ops.employee manager_employee ON manager_employee.employee_id = manager.employee_id
      LEFT JOIN ops.user_account submitted_account ON submitted_account.user_id = entries.submitted_by_user_id
      LEFT JOIN ops.employee submitted_employee ON submitted_employee.employee_id = submitted_account.employee_id
      LEFT JOIN ops.user_account reviewed_account ON reviewed_account.user_id = entries.reviewed_by_user_id
      LEFT JOIN ops.employee reviewed_employee ON reviewed_employee.employee_id = reviewed_account.employee_id
      ORDER BY manager_name ASC, entries.submitted_at DESC NULLS LAST, entries.package_id
    `, [input.periodKey, input.companyIds]);
    return result.rows;
  }
}
