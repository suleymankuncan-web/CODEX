import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import type {
  SalesTargetIncentiveRegionCorrectionRow,
  SalesTargetIncentiveRegionPackageRow,
  SalesTargetIncentiveStoreReviewRow,
} from "./sales-target-incentive-approval.repository";

export type SalesTargetIncentiveWorkspaceStoreMetadataRow = {
  company_id: string;
  region_id: string;
  region_name: string | null;
  region_manager_name: string | null;
  store_id: string;
  store_code: string;
};

export type SalesTargetIncentiveWorkspaceRateRow = {
  rule_version_code: string;
  effective_from: string;
  period_timezone: string;
  bracket_boundary_policy: "lower_inclusive_upper_exclusive";
  audience: "manager" | "personnel";
  rate_table_version: string;
  min_achievement_pct: string | null;
  max_achievement_pct: string | null;
  rate: string;
  display_label: string;
  sort_order: number;
};

export type SalesTargetIncentiveWorkspaceClosedRateSnapshotRow = {
  store_id: string;
  final_snapshot_id: string;
  rule_version_code: string;
  period_timezone: string;
  rate_table_versions: string[];
  rate_brackets_json: unknown;
};

export type SalesTargetIncentiveWorkspaceCorrectionActorRow = {
  correction_id: string;
  display_name: string | null;
  role_code: "REGION_MANAGER" | "HR_ADMIN" | "SUPER_ADMIN" | null;
};

@Injectable()
export class SalesTargetIncentiveWorkspaceReadRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listStoreMetadata(input: {
    storeIds: string[];
    periodEnd: string;
  }): Promise<SalesTargetIncentiveWorkspaceStoreMetadataRow[]> {
    if (input.storeIds.length === 0) return [];

    const result = await this.databaseService.query<SalesTargetIncentiveWorkspaceStoreMetadataRow>(
      `
        SELECT
          store.company_id::text AS company_id,
          store.region_id::text AS region_id,
          region.region_name,
          region_manager.display_name AS region_manager_name,
          store.store_id::text AS store_id,
          store.store_code
        FROM ops.store store
        LEFT JOIN ops.region region
          ON region.region_id = store.region_id
        LEFT JOIN LATERAL (
          SELECT NULLIF(TRIM(CONCAT(employee.first_name, ' ', employee.last_name)), '') AS display_name
          FROM ops.user_role_assignment role_assignment
          INNER JOIN ops.role role
            ON role.role_id = role_assignment.role_id
            AND role.role_code = 'REGION_MANAGER'
          INNER JOIN ops.user_account user_account
            ON user_account.user_id = role_assignment.user_id
          LEFT JOIN ops.employee employee
            ON employee.employee_id = user_account.employee_id
          WHERE role_assignment.region_id = store.region_id
            AND role_assignment.start_at <= (
              (($2::date + INTERVAL '1 day') AT TIME ZONE 'Europe/Istanbul')
              - INTERVAL '1 microsecond'
            )
            AND (
              role_assignment.end_at IS NULL
              OR role_assignment.end_at >= (
                (($2::date + INTERVAL '1 day') AT TIME ZONE 'Europe/Istanbul')
                - INTERVAL '1 microsecond'
              )
            )
          ORDER BY display_name ASC NULLS LAST, role_assignment.start_at DESC
          LIMIT 1
        ) region_manager ON TRUE
        WHERE store.store_id = ANY($1::uuid[])
        ORDER BY region.region_name ASC NULLS LAST, store.store_name ASC, store.store_id ASC
      `,
      [input.storeIds, input.periodEnd],
    );

    return result.rows;
  }

  async listClosedRateSnapshots(input: {
    periodKey: string;
    storeIds: string[];
  }): Promise<SalesTargetIncentiveWorkspaceClosedRateSnapshotRow[]> {
    if (input.storeIds.length === 0) return [];

    const result = await this.databaseService.query<SalesTargetIncentiveWorkspaceClosedRateSnapshotRow>(
      `
        WITH scoped_store AS (
          SELECT store_id, company_id, region_id
          FROM ops.store
          WHERE store_id = ANY($2::uuid[])
        ),
        latest_snapshot AS (
          SELECT DISTINCT ON (snapshot.store_id)
            snapshot.store_id,
            snapshot.sales_target_incentive_final_snapshot_id,
            snapshot.close_run_id,
            snapshot.close_cutoff_at
          FROM rpt.sales_target_incentive_final_snapshot snapshot
          INNER JOIN scoped_store
            ON snapshot.company_id = scoped_store.company_id
            AND snapshot.region_id = scoped_store.region_id
            AND snapshot.store_id = scoped_store.store_id
          WHERE snapshot.period_key = $1
          ORDER BY snapshot.store_id, snapshot.close_cutoff_at DESC,
            snapshot.sales_target_incentive_final_snapshot_id DESC
        )
        SELECT
          latest_snapshot.store_id::text AS store_id,
          latest_snapshot.sales_target_incentive_final_snapshot_id::text AS final_snapshot_id,
          rule_snapshot.rule_version_code,
          rule_snapshot.period_timezone,
          rule_snapshot.rate_table_versions,
          rule_snapshot.rate_brackets_json
        FROM latest_snapshot
        INNER JOIN rpt.sales_target_incentive_rule_snapshot rule_snapshot
          ON rule_snapshot.close_run_id = latest_snapshot.close_run_id
        ORDER BY latest_snapshot.store_id ASC
      `,
      [input.periodKey, input.storeIds],
    );

    return result.rows;
  }

  async listExactRateTables(input: {
    ruleVersionCode: string;
    rateTableVersions: string[];
    periodEnd: string;
  }): Promise<SalesTargetIncentiveWorkspaceRateRow[]> {
    if (input.rateTableVersions.length === 0) return [];

    const result = await this.databaseService.query<SalesTargetIncentiveWorkspaceRateRow>(
      `
        SELECT
          rule.rule_version_code,
          rule.effective_from,
          rule.period_timezone,
          rule.bracket_boundary_policy,
          bracket.audience,
          bracket.rate_table_version,
          bracket.min_achievement_pct,
          bracket.max_achievement_pct,
          bracket.rate,
          bracket.display_label,
          bracket.sort_order
        FROM ops.sales_target_incentive_rule_version rule
        INNER JOIN ops.sales_target_incentive_rate_bracket bracket
          ON bracket.rule_version_id = rule.sales_target_incentive_rule_version_id
        WHERE rule.rule_version_code = $1
          AND bracket.rate_table_version = ANY($2::text[])
          AND rule.effective_from <= $3::date
        ORDER BY bracket.audience ASC, bracket.sort_order ASC
      `,
      [input.ruleVersionCode, input.rateTableVersions, input.periodEnd],
    );

    return result.rows;
  }

  async listWorkflowAudit(input: {
    periodKey: string;
    storeIds: string[];
  }): Promise<{
    reviews: SalesTargetIncentiveStoreReviewRow[];
    corrections: SalesTargetIncentiveRegionCorrectionRow[];
    packages: SalesTargetIncentiveRegionPackageRow[];
  }> {
    if (input.storeIds.length === 0) {
      return { reviews: [], corrections: [], packages: [] };
    }

    const scopedStoreCte = `
      WITH scoped_store AS (
        SELECT store_id, company_id, region_id
        FROM ops.store
        WHERE store_id = ANY($2::uuid[])
      )
    `;
    const [reviews, corrections, packages] = await Promise.all([
      this.databaseService.query<SalesTargetIncentiveStoreReviewRow>(
        `${scopedStoreCte}
        SELECT review.*
        FROM ops.sales_target_incentive_store_review review
        INNER JOIN scoped_store
          ON review.company_id = scoped_store.company_id
          AND review.region_id = scoped_store.region_id
          AND review.store_id = scoped_store.store_id
        WHERE review.period_key = $1`,
        [input.periodKey, input.storeIds],
      ),
      this.databaseService.query<SalesTargetIncentiveRegionCorrectionRow>(
        `${scopedStoreCte}
        SELECT correction.*
        FROM ops.sales_target_incentive_region_correction correction
        INNER JOIN scoped_store
          ON correction.company_id = scoped_store.company_id
          AND correction.region_id = scoped_store.region_id
          AND correction.store_id = scoped_store.store_id
        WHERE correction.period_key = $1
        ORDER BY correction.created_at ASC,
          correction.sales_target_incentive_region_correction_id ASC`,
        [input.periodKey, input.storeIds],
      ),
      this.databaseService.query<SalesTargetIncentiveRegionPackageRow>(
        `${scopedStoreCte}
        SELECT DISTINCT package.*
        FROM ops.sales_target_incentive_region_package package
        INNER JOIN ops.sales_target_incentive_region_package_store package_store
          ON package_store.region_package_id = package.sales_target_incentive_region_package_id
        INNER JOIN scoped_store
          ON package.company_id = scoped_store.company_id
          AND package.region_id = scoped_store.region_id
          AND package_store.store_id = scoped_store.store_id
        WHERE package.period_key = $1`,
        [input.periodKey, input.storeIds],
      ),
    ]);

    return {
      reviews: reviews.rows,
      corrections: corrections.rows,
      packages: packages.rows,
    };
  }

  async listCorrectionActors(input: {
    events: Array<{
      correctionId: string;
      actorUserId: string;
      occurredAt: string;
    }>;
  }): Promise<SalesTargetIncentiveWorkspaceCorrectionActorRow[]> {
    if (input.events.length === 0) return [];

    const result = await this.databaseService.query<SalesTargetIncentiveWorkspaceCorrectionActorRow>(
      `
        WITH requested AS (
          SELECT *
          FROM UNNEST(
            $1::uuid[],
            $2::uuid[],
            $3::timestamptz[]
          ) AS requested(correction_id, user_id, occurred_at)
        )
        SELECT
          requested.correction_id::text AS correction_id,
          NULLIF(TRIM(CONCAT(employee.first_name, ' ', employee.last_name)), '') AS display_name,
          actor_role.role_code
        FROM requested
        LEFT JOIN ops.user_account user_account
          ON user_account.user_id = requested.user_id
        LEFT JOIN ops.employee employee
          ON employee.employee_id = user_account.employee_id
        LEFT JOIN LATERAL (
          SELECT role.role_code
          FROM ops.user_role_assignment role_assignment
          INNER JOIN ops.role role
            ON role.role_id = role_assignment.role_id
          WHERE role_assignment.user_id = requested.user_id
            AND role_assignment.start_at <= requested.occurred_at
            AND (
              role_assignment.end_at IS NULL
              OR role_assignment.end_at >= requested.occurred_at
            )
            AND role.role_code IN ('REGION_MANAGER', 'HR_ADMIN', 'SUPER_ADMIN')
          ORDER BY
            CASE role.role_code
              WHEN 'REGION_MANAGER' THEN 1
              WHEN 'HR_ADMIN' THEN 2
              WHEN 'SUPER_ADMIN' THEN 3
              ELSE 4
            END,
            role_assignment.start_at DESC
          LIMIT 1
        ) actor_role ON TRUE
      `,
      [
        input.events.map((event) => event.correctionId),
        input.events.map((event) => event.actorUserId),
        input.events.map((event) => event.occurredAt),
      ],
    );

    return result.rows;
  }
}
