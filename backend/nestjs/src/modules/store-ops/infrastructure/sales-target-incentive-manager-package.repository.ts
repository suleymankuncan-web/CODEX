import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { PoolClient } from "pg";
import { DatabaseService } from "../../../shared/database/database.service";
import { RequestContextStore } from "../../../shared/request-context";
import { SALES_TARGET_INCENTIVE_TIMEZONE } from "../application/sales-target-incentive-calculator.service";
import {
  approveSubmittedCorrectionsSql,
  ensurePackageStoresCurrentSql,
  ensureSubmittedCorrectionsApprovableSql,
} from "./sales-target-incentive-approval.sql";
import type { SalesTargetIncentiveRegionPackageRow } from "./sales-target-incentive-approval.types";

type Client = Pick<PoolClient, "query">;
type Decision = "admin_approved" | "admin_returned";

@Injectable()
export class SalesTargetIncentiveManagerPackageRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findOwnerPackage(input: { companyId: string; periodKey: string; managerUserId: string }) {
    const result = await this.databaseService.query<SalesTargetIncentiveRegionPackageRow>(`
      SELECT * FROM ops.sales_target_incentive_region_package
      WHERE package_scope = 'manager_assignment' AND company_id = $1::uuid
        AND period_key = $2 AND manager_user_id = $3::uuid
    `, [input.companyId, input.periodKey, input.managerUserId]);
    return result.rows[0] ?? null;
  }

  async submit(input: {
    companyId: string;
    periodKey: string;
    managerUserId: string;
    storeIds: string[];
    submissionNote: string | null;
  }): Promise<SalesTargetIncentiveRegionPackageRow> {
    const storeIds = [...new Set(input.storeIds)].sort();
    if (!storeIds.length) throw new BadRequestException("Package must include at least one store");
    return this.databaseService.withTransaction(async (client) => {
      await lock(client, `incentive-manager-package:${input.companyId}:${input.periodKey}:${input.managerUserId}`);
      for (const storeId of storeIds) await lock(client, `incentive-store-package:${input.periodKey}:${storeId}`);
      const assignments = await client.query<{ store_id: string }>(`
        SELECT store.store_id::text AS store_id
        FROM ops.user_role_assignment role_assignment
        JOIN ops.role role ON role.role_id = role_assignment.role_id AND role.role_code = 'REGION_MANAGER'
        JOIN ops.user_account account ON account.user_id = role_assignment.user_id AND account.is_active = TRUE
        JOIN ops.user_action_store_assignment assigned ON assigned.user_id = account.user_id
        JOIN ops.store store ON store.store_id = assigned.store_id
        WHERE account.user_id = $1::uuid AND store.company_id = $2::uuid
          AND store.store_type = 'company' AND store.status = 'active'
          AND role_assignment.start_at <= clock_timestamp()
          AND (role_assignment.end_at IS NULL OR role_assignment.end_at > clock_timestamp())
          AND assigned.start_at <= clock_timestamp()
          AND (assigned.end_at IS NULL OR assigned.end_at > clock_timestamp())
        FOR SHARE OF role_assignment, assigned
      `, [input.managerUserId, input.companyId]);
      const assigned = new Set(assignments.rows.map((row) => row.store_id));
      if (storeIds.some((storeId) => !assigned.has(storeId)) || assigned.size !== storeIds.length) {
        throw new ForbiddenException("The package must contain exactly the manager's currently assigned company stores");
      }
      const ambiguous = await client.query<{ store_id: string }>(`
        SELECT assignment.store_id::text AS store_id
        FROM ops.user_action_store_assignment assignment
        JOIN ops.user_account account ON account.user_id = assignment.user_id AND account.is_active = TRUE
        JOIN ops.user_role_assignment role_assignment ON role_assignment.user_id = account.user_id
        JOIN ops.role role ON role.role_id = role_assignment.role_id AND role.role_code = 'REGION_MANAGER'
        WHERE assignment.store_id = ANY($1::uuid[])
          AND assignment.start_at <= clock_timestamp()
          AND (assignment.end_at IS NULL OR assignment.end_at > clock_timestamp())
          AND role_assignment.start_at <= clock_timestamp()
          AND (role_assignment.end_at IS NULL OR role_assignment.end_at > clock_timestamp())
        GROUP BY assignment.store_id
        HAVING COUNT(DISTINCT account.user_id) > 1
      `, [storeIds]);
      if (ambiguous.rows.length) throw new ConflictException("A store has multiple active region manager assignments");

      const existing = await client.query<SalesTargetIncentiveRegionPackageRow>(`
        SELECT * FROM ops.sales_target_incentive_region_package
        WHERE package_scope = 'manager_assignment' AND company_id = $1::uuid
          AND period_key = $2 AND manager_user_id = $3::uuid
        FOR UPDATE
      `, [input.companyId, input.periodKey, input.managerUserId]);
      if (existing.rows[0]?.package_status === "admin_approved") throw new ConflictException("Approved packages cannot be changed");
      if (existing.rows[0]?.package_status === "submitted") return existing.rows[0];

      const overlap = await client.query<{ store_id: string }>(`
        SELECT DISTINCT package_store.store_id::text AS store_id
        FROM ops.sales_target_incentive_region_package_store package_store
        JOIN ops.sales_target_incentive_region_package package
          ON package.sales_target_incentive_region_package_id = package_store.region_package_id
        WHERE package_store.period_key = $1 AND package_store.store_id = ANY($2::uuid[])
          AND package.package_status IN ('submitted', 'admin_approved')
          AND package.sales_target_incentive_region_package_id IS DISTINCT FROM $3::uuid
      `, [input.periodKey, storeIds, existing.rows[0]?.sales_target_incentive_region_package_id ?? null]);
      if (overlap.rows.length) throw new ConflictException("A store is already in a submitted or approved package");

      const ready = await client.query<{ store_id: string }>(`
        WITH latest AS (
          SELECT DISTINCT ON (store_id) store_id, sales_target_incentive_final_snapshot_id AS snapshot_id
          FROM rpt.sales_target_incentive_final_snapshot
          WHERE period_key = $1 AND company_id = $2::uuid AND store_id = ANY($3::uuid[])
          ORDER BY store_id, close_cutoff_at DESC, sales_target_incentive_final_snapshot_id DESC
        )
        SELECT latest.store_id::text AS store_id
        FROM latest JOIN ops.sales_target_incentive_store_review review
          ON review.store_id = latest.store_id AND review.period_key = $1
          AND review.final_snapshot_id = latest.snapshot_id AND review.review_status = 'reviewed'
      `, [input.periodKey, input.companyId, storeIds]);
      if (ready.rows.length !== storeIds.length) throw new BadRequestException("All assigned stores must have a reviewed closed snapshot");

      const inserted = await client.query<SalesTargetIncentiveRegionPackageRow>(`
        INSERT INTO ops.sales_target_incentive_region_package
          (company_id, region_id, package_scope, manager_user_id, period_key, period_timezone,
           package_status, submitted_by_user_id, submitted_at, submission_note)
        VALUES ($1::uuid, NULL, 'manager_assignment', $2::uuid, $3, $4, 'submitted', $2::uuid, NOW(), $5)
        ON CONFLICT (company_id, period_key, manager_user_id)
          WHERE package_scope = 'manager_assignment'
        DO UPDATE SET package_status = 'submitted', submitted_at = NOW(),
          submitted_by_user_id = EXCLUDED.submitted_by_user_id,
          submission_note = EXCLUDED.submission_note, reviewed_by_user_id = NULL,
          reviewed_at = NULL, review_note = NULL, updated_at = NOW()
        WHERE ops.sales_target_incentive_region_package.package_status = 'admin_returned'
        RETURNING *
      `, [input.companyId, input.managerUserId, input.periodKey, SALES_TARGET_INCENTIVE_TIMEZONE, input.submissionNote]);
      const packageRow = inserted.rows[0];
      if (!packageRow) throw new ConflictException("Package changed while submitting");

      await client.query(`
        UPDATE ops.sales_target_incentive_region_correction
        SET region_package_id = NULL, submitted_by_user_id = NULL, submitted_at = NULL,
          correction_status = 'draft', updated_at = NOW()
        WHERE region_package_id = $1::uuid AND store_id <> ALL($2::uuid[])
          AND correction_status = 'admin_returned'
      `, [packageRow.sales_target_incentive_region_package_id, storeIds]);
      await client.query(`DELETE FROM ops.sales_target_incentive_region_package_store WHERE region_package_id = $1::uuid`, [packageRow.sales_target_incentive_region_package_id]);
      const snapshots = await client.query<{ store_id: string }>(`
        WITH latest AS (
          SELECT DISTINCT ON (store_id) store_id, sales_target_incentive_final_snapshot_id AS snapshot_id
          FROM rpt.sales_target_incentive_final_snapshot
          WHERE period_key = $2 AND company_id = $3::uuid AND store_id = ANY($4::uuid[])
          ORDER BY store_id, close_cutoff_at DESC, sales_target_incentive_final_snapshot_id DESC
        )
        INSERT INTO ops.sales_target_incentive_region_package_store
          (region_package_id, store_review_id, company_id, region_id, store_id,
           final_snapshot_id, period_key, reviewed_by_user_id, reviewed_at)
        SELECT $1::uuid, review.sales_target_incentive_store_review_id, review.company_id,
          review.region_id, review.store_id, review.final_snapshot_id, review.period_key,
          review.reviewed_by_user_id, review.reviewed_at
        FROM latest JOIN ops.sales_target_incentive_store_review review
          ON review.store_id = latest.store_id AND review.final_snapshot_id = latest.snapshot_id
          AND review.period_key = $2 AND review.review_status = 'reviewed'
        RETURNING store_id::text
      `, [packageRow.sales_target_incentive_region_package_id, input.periodKey, input.companyId, storeIds]);
      if (snapshots.rows.length !== storeIds.length) throw new ConflictException("Submitted package store snapshot is incomplete");
      await client.query(`
        UPDATE ops.sales_target_incentive_region_correction
        SET region_package_id = $1::uuid, correction_status = 'submitted',
          submitted_by_user_id = $2::uuid, submitted_at = NOW(),
          reviewed_by_user_id = NULL, reviewed_at = NULL, review_note = NULL, updated_at = NOW()
        WHERE period_key = $3 AND store_id = ANY($4::uuid[])
          AND correction_status IN ('draft', 'admin_returned')
      `, [packageRow.sales_target_incentive_region_package_id, input.managerUserId, input.periodKey, storeIds]);
      return packageRow;
    });
  }

  async review(input: {
    periodKey: string;
    packageId: string;
    submittedAt: string | null;
    actorUserId: string;
    companyIds: string[];
    decision: Decision;
    reviewNote: string | null;
  }): Promise<SalesTargetIncentiveRegionPackageRow> {
    return this.databaseService.withTransaction(async (client) => {
      const found = await client.query<SalesTargetIncentiveRegionPackageRow>(`
        SELECT * FROM ops.sales_target_incentive_region_package
        WHERE sales_target_incentive_region_package_id = $1::uuid
          AND period_key = $2 AND package_status = 'submitted'
        FOR UPDATE
      `, [input.packageId, input.periodKey]);
      const row = found.rows[0];
      if (!row) throw new NotFoundException("Submitted package was not found");
      if (!input.companyIds.includes(row.company_id) || row.submitted_by_user_id === input.actorUserId) {
        throw new ForbiddenException("Package is outside the approval scope or was submitted by the approver");
      }
      if (input.submittedAt && new Date(row.submitted_at).getTime() !== new Date(input.submittedAt).getTime()) {
        throw new ConflictException("The package changed; refresh before approving");
      }
      const grant = await client.query(`
        SELECT role_assignment.user_role_assignment_id
        FROM ops.user_role_assignment role_assignment
        JOIN ops.role role ON role.role_id = role_assignment.role_id
        JOIN ops.user_account account ON account.user_id = role_assignment.user_id
        JOIN ops.company company ON company.company_id = role_assignment.company_id
        WHERE role_assignment.user_id = $1::uuid AND role_assignment.company_id = $2::uuid
          AND role.role_code = 'REPORT_VIEWER' AND role.role_scope_type = 'company'
          AND role_assignment.scope_type = 'company' AND role_assignment.incentive_approval
          AND account.is_active = TRUE AND company.status = 'active'
          AND role_assignment.start_at <= clock_timestamp()
          AND (role_assignment.end_at IS NULL OR role_assignment.end_at > clock_timestamp())
        FOR SHARE OF role_assignment
      `, [input.actorUserId, row.company_id]);
      if (!grant.rows.length) throw new ForbiddenException("Prim approval permission is no longer active");
      if (row.package_scope === "manager_assignment" && input.decision === "admin_approved") {
        const assignment = await client.query<{ stale: boolean }>(`
          WITH package_stores AS (
            SELECT store_id FROM ops.sales_target_incentive_region_package_store
            WHERE region_package_id = $1::uuid
          ), assigned_stores AS (
            SELECT DISTINCT store.store_id
            FROM ops.user_action_store_assignment assignment
            JOIN ops.store store ON store.store_id = assignment.store_id
              AND store.company_id = $3::uuid AND store.store_type = 'company' AND store.status = 'active'
            JOIN ops.user_account account ON account.user_id = assignment.user_id AND account.is_active = TRUE
            JOIN ops.user_role_assignment role_assignment ON role_assignment.user_id = account.user_id
            JOIN ops.role role ON role.role_id = role_assignment.role_id AND role.role_code = 'REGION_MANAGER'
            WHERE account.user_id = $2::uuid AND assignment.start_at <= clock_timestamp()
              AND (assignment.end_at IS NULL OR assignment.end_at > clock_timestamp())
              AND role_assignment.start_at <= clock_timestamp()
              AND (role_assignment.end_at IS NULL OR role_assignment.end_at > clock_timestamp())
          ), ambiguous AS (
            SELECT assignment.store_id
            FROM ops.user_action_store_assignment assignment
            JOIN ops.user_account account ON account.user_id = assignment.user_id AND account.is_active = TRUE
            JOIN ops.user_role_assignment role_assignment ON role_assignment.user_id = account.user_id
            JOIN ops.role role ON role.role_id = role_assignment.role_id AND role.role_code = 'REGION_MANAGER'
            WHERE assignment.store_id IN (SELECT store_id FROM package_stores)
              AND assignment.start_at <= clock_timestamp()
              AND (assignment.end_at IS NULL OR assignment.end_at > clock_timestamp())
              AND role_assignment.start_at <= clock_timestamp()
              AND (role_assignment.end_at IS NULL OR role_assignment.end_at > clock_timestamp())
            GROUP BY assignment.store_id HAVING COUNT(DISTINCT account.user_id) > 1
          )
          SELECT EXISTS(SELECT store_id FROM package_stores EXCEPT SELECT store_id FROM assigned_stores)
            OR EXISTS(SELECT store_id FROM assigned_stores EXCEPT SELECT store_id FROM package_stores)
            OR EXISTS(SELECT 1 FROM ambiguous) AS stale
        `, [input.packageId, row.manager_user_id, row.company_id]);
        if (assignment.rows[0]?.stale) throw new ConflictException("Manager assignments changed after submission; return and resubmit the package");
      }
      if (input.decision === "admin_returned") {
        if (!input.reviewNote?.trim()) throw new BadRequestException("Return note is required");
        await client.query(`
          UPDATE ops.sales_target_incentive_region_correction
          SET correction_status = 'admin_returned', reviewed_by_user_id = $1::uuid,
            reviewed_at = NOW(), review_note = $2, updated_at = NOW()
          WHERE region_package_id = $3::uuid AND correction_status = 'submitted'
        `, [input.actorUserId, input.reviewNote, input.packageId]);
      } else {
        const current = await client.query<{ stale_store_count: string }>(ensurePackageStoresCurrentSql, [input.packageId]);
        if (Number(current.rows[0]?.stale_store_count ?? 0) > 0) throw new ConflictException("Submitted package stores must target the latest closed snapshot");
        const corrections = await client.query<{ stale_snapshot_count: string; already_current_count: string }>(ensureSubmittedCorrectionsApprovableSql, [input.packageId]);
        if (Number(corrections.rows[0]?.stale_snapshot_count ?? 0) > 0) throw new ConflictException("Submitted corrections must target the latest closed snapshot");
        if (Number(corrections.rows[0]?.already_current_count ?? 0) > 0) throw new ConflictException("Submitted corrections must change the current final amount");
        await client.query(approveSubmittedCorrectionsSql, [input.packageId, input.actorUserId, RequestContextStore.getCorrelationId()]);
      }
      const updated = await client.query<SalesTargetIncentiveRegionPackageRow>(`
        UPDATE ops.sales_target_incentive_region_package
        SET package_status = $1, reviewed_by_user_id = $2::uuid, reviewed_at = NOW(),
          review_note = $3, updated_at = NOW()
        WHERE sales_target_incentive_region_package_id = $4::uuid
        RETURNING *
      `, [input.decision, input.actorUserId, input.reviewNote, input.packageId]);
      await client.query(`
        INSERT INTO audit.event_log
          (actor_user_id, event_type, entity_name, entity_id, scope_type, company_id, region_id, metadata_json)
        VALUES ($1::uuid, $2, 'ops.sales_target_incentive_region_package', $3::uuid,
          'company', $4::uuid, NULL, $5::jsonb)
      `, [input.actorUserId,
        input.decision === "admin_returned" ? "incentive_package.final_returned" : "incentive_package.final_approved",
        input.packageId, row.company_id,
        JSON.stringify({ period: input.periodKey, managerUserId: row.manager_user_id ?? row.submitted_by_user_id,
          submittedAt: row.submitted_at, permissionCode: "INCENTIVE_FINAL_APPROVAL",
          correlationId: RequestContextStore.getCorrelationId() }),
      ]);
      return updated.rows[0];
    });
  }
}

async function lock(client: Client, key: string) {
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)", [key]);
}
