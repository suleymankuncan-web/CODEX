import { assertDepartureTargets, targetDepartureSql, type TargetDeparture } from "./target-departure-contract";
import { ForbiddenException, Injectable } from "@nestjs/common";
import { RequestContextStore } from "../../../shared/request-context";
import { DatabaseService } from "../../../shared/database/database.service";
import {
  reconcileTargetRevision,
  isValidNextDayPrimaryRotation,
  TargetRevisionConflict,
} from "./target-reference-lifecycle";
import {
  parseTargetDistributionAllocations,
  parseTargetRevisionEvidence,
  throwTargetRevisionError,
  type TargetCoverageRow,
  type TargetDistributionAllocation,
  type TargetDistributionRow,
  type TargetRevisionInput,
} from "./target-distribution-contract";
import { mapTargetDistributionRow } from "./target-distribution-row-mapper";

export type { TargetRevisionInput } from "./target-distribution-contract";

@Injectable()
export class TargetDistributionRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async getRequestScope(requestId: string) {
    const result = await this.databaseService.query<{
      target_distribution_request_id: string;
      company_id: string;
      region_id: string;
      store_id: string;
      request_month: string;
    }>(
      `
        SELECT
          target_distribution_request_id,
          company_id,
          region_id,
          store_id,
          request_month::text
        FROM ops.target_distribution_request
        WHERE target_distribution_request_id = $1::uuid
      `,
      [requestId],
    );

    const row = result.rows[0];
    return row
      ? {
          requestId: row.target_distribution_request_id,
          companyId: row.company_id,
          regionId: row.region_id,
          storeId: row.store_id,
          requestMonth: row.request_month,
        }
      : null;
  }

  async getRevisionBasis(input: {
    companyId: string;
    storeId: string;
    requestMonth: string;
  }) {
    const [closedResult, referencesResult] = await Promise.all([
      this.databaseService.query<{ exists: boolean }>(
        `
          SELECT EXISTS (
            SELECT 1
            FROM rpt.snapshot_run
            WHERE snapshot_type = 'monthly'
              AND period_start = $1::date
              AND period_end = ($1::date + INTERVAL '1 month' - INTERVAL '1 day')::date
              AND run_status = 'completed'
              AND (company_ids = '{}'::uuid[] OR $2::uuid = ANY(company_ids))
          ) AS exists
        `,
        [input.requestMonth, input.companyId],
      ),
      this.databaseService.query<{
        employee_id: string;
        first_name: string;
        last_name: string;
        personnel_target_reference_id: string;
        target_value: string;
      }>(
        `
          SELECT
            ptr.employee_id,
            employee.first_name,
            employee.last_name,
            ptr.personnel_target_reference_id,
            ptr.target_value
          FROM ops.personnel_target_reference ptr
          INNER JOIN ops.employee employee ON employee.employee_id = ptr.employee_id
          WHERE ptr.company_id = $1::uuid
            AND (
              ptr.store_id = $2::uuid
              OR EXISTS (
                SELECT 1
                FROM ops.employee_assignment_history current_primary
                WHERE current_primary.employee_id = ptr.employee_id
                  AND current_primary.store_id = $2::uuid
                  AND current_primary.is_primary_assignment = TRUE
                  AND current_primary.assignment_status = 'active'
                  AND current_primary.start_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date
                  AND (current_primary.end_date IS NULL OR current_primary.end_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date)
              )
            )
            AND ptr.period_start = $3::date
            AND ptr.period_end = ($3::date + INTERVAL '1 month' - INTERVAL '1 day')::date
            AND ptr.target_type = 'monthly_sales_target'
            AND ptr.status = 'approved'
          ORDER BY employee.first_name, employee.last_name, ptr.employee_id
        `,
        [input.companyId, input.storeId, input.requestMonth],
      ),
    ]);

    return {
      periodClosed: closedResult.rows[0]?.exists === true,
      rows: referencesResult.rows,
    };
  }

  async getDepartureTargets(input: { employeeIds: string[]; storeId: string; requestMonth: string }) {
    const result = await this.databaseService.query<TargetDeparture>(targetDepartureSql, [input.employeeIds, input.storeId, input.requestMonth]);
    return result.rows;
  }

  async createRequest(input: {
    companyId: string;
    regionId: string;
    storeId: string;
    requestMonth: string;
    targetLabel: string;
    totalTargetValue: number;
    requestReason?: string;
    allocations: Array<{
      employeeId: string;
      assigneeLabel: string;
      targetValue: number;
      distributionDays?: number;
      note?: string;
    }>;
    revision?: TargetRevisionInput;
    submittedByUserId: string;
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<TargetDistributionRow>(
        `
          INSERT INTO ops.target_distribution_request (
            company_id,
            region_id,
            store_id,
            request_month,
            target_label,
            total_target_value,
            allocation_count,
            request_reason,
            allocation_json,
            approval_evidence_json,
            submitted_by_user_id
          )
          VALUES (
            $1::uuid,
            $2::uuid,
            $3::uuid,
            $4::date,
            $5,
            $6::numeric,
            $7::integer,
            $8,
            $9::jsonb,
            $10::jsonb,
            $11
          )
          RETURNING
            target_distribution_request_id,
            company_id,
            region_id,
            store_id,
            request_month,
            target_label,
            total_target_value,
            allocation_count,
            request_status,
            request_reason,
            allocation_json,
            submitted_by_user_id,
            approved_by_user_id,
            approved_at,
            approval_note,
            created_at,
            updated_at
        `,
        [
          input.companyId,
          input.regionId,
          input.storeId,
          input.requestMonth,
          input.targetLabel,
          input.totalTargetValue,
          input.allocations.length,
          input.requestReason ?? null,
          JSON.stringify(input.allocations),
          JSON.stringify({
            targetRevision: {
              mode: input.revision ? "revision" : "initial",
              baseReferenceIds: input.revision?.baseReferenceIds ?? [],
              removedEmployeeIds: input.revision?.removedEmployeeIds ?? [],
              reasonPresent: Boolean(input.requestReason?.trim()),
              predecessorSuccessorLinks: [],
            },
          }),
          input.submittedByUserId,
        ],
      );

      const request = result.rows[0];

      await client.query(
        `
          INSERT INTO audit.event_log (
            actor_user_id,
            event_type,
            entity_name,
            entity_id,
            scope_type,
            company_id,
            region_id,
            store_id,
            metadata_json
          )
          VALUES (
            $1::uuid,
            'target_distribution_request.created',
            'ops.target_distribution_request',
            $2::uuid,
            'store',
            $3::uuid,
            $4::uuid,
            $5::uuid,
            $6::jsonb
          )
        `,
        [
          input.submittedByUserId,
          request.target_distribution_request_id,
          input.companyId,
          input.regionId,
          input.storeId,
          JSON.stringify({
            correlationId: RequestContextStore.getCorrelationId(),
            actorUserId: input.submittedByUserId,
            requestMonth: input.requestMonth,
            targetLabel: input.targetLabel,
            allocationCount: input.allocations.length,
          }),
        ],
      );

      return mapTargetDistributionRow({ ...request, store_name: "" });
    });
  }

  async listRequests(input: {
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    statuses?: string[];
    requestMonth?: string;
    storeId?: string;
    limit?: number;
    offset?: number;
  }) {
    const params: unknown[] = [];
    const clauses: string[] = [];

    if (input.storeIds.length > 0) {
      params.push(input.storeIds);
      clauses.push(`tdr.store_id = ANY($${params.length}::uuid[])`);
    } else if (input.regionIds.length > 0) {
      params.push(input.regionIds);
      clauses.push(`tdr.region_id = ANY($${params.length}::uuid[])`);
    } else if (input.companyIds.length > 0) {
      params.push(input.companyIds);
      clauses.push(`tdr.company_id = ANY($${params.length}::uuid[])`);
    } else {
      clauses.push("FALSE");
    }

    if (input.statuses && input.statuses.length > 0) {
      params.push(input.statuses);
      clauses.push(`tdr.request_status = ANY($${params.length}::text[])`);
    }

    if (input.requestMonth) {
      params.push(input.requestMonth);
      clauses.push(`tdr.request_month = $${params.length}::date`);
    }

    if (input.storeId) {
      params.push(input.storeId);
      clauses.push(`tdr.store_id = $${params.length}::uuid`);
    }

    const whereClause = `WHERE ${clauses.join(" AND ")}`;
    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;
    const countResult = await this.databaseService.query<{ total_count: string }>(
      `
        SELECT COUNT(*)::text AS total_count
        FROM ops.target_distribution_request tdr
        INNER JOIN ops.store s
          ON s.store_id = tdr.store_id
        ${whereClause}
      `,
      [...params],
    );

    params.push(limit);
    params.push(offset);

    const result = await this.databaseService.query<TargetDistributionRow>(
      `
        SELECT
          tdr.target_distribution_request_id,
          tdr.company_id,
          tdr.region_id,
          tdr.store_id,
          s.store_name,
          tdr.request_month,
          tdr.target_label,
          tdr.total_target_value,
          tdr.allocation_count,
          tdr.request_status,
          tdr.request_reason,
          tdr.allocation_json,
          tdr.submitted_by_user_id,
          tdr.approved_by_user_id,
          tdr.approved_at,
          tdr.approval_note,
          tdr.approval_evidence_json,
          tdr.created_at,
          tdr.updated_at
        FROM ops.target_distribution_request tdr
        INNER JOIN ops.store s
          ON s.store_id = tdr.store_id
        ${whereClause}
        ORDER BY tdr.created_at DESC
        LIMIT $${params.length - 1}::int
        OFFSET $${params.length}::int
      `,
      params,
    );

    return {
      items: result.rows.map(mapTargetDistributionRow),
      total: Number(countResult.rows[0]?.total_count ?? 0),
      limit,
      offset,
    };
  }

  async listTargetCoverage(input: {
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    requestMonth: string;
    storeId?: string;
  }) {
    const params: unknown[] = [input.requestMonth];
    const clauses: string[] = [];

    if (input.storeIds.length > 0) {
      params.push(input.storeIds);
      clauses.push(`eah.store_id = ANY($${params.length}::uuid[])`);
    } else if (input.regionIds.length > 0) {
      params.push(input.regionIds);
      clauses.push(`eah.region_id = ANY($${params.length}::uuid[])`);
    } else if (input.companyIds.length > 0) {
      params.push(input.companyIds);
      clauses.push(`s.company_id = ANY($${params.length}::uuid[])`);
    } else {
      clauses.push("FALSE");
    }

    if (input.storeId) {
      params.push(input.storeId);
      clauses.push(`eah.store_id = $${params.length}::uuid`);
    }

    const result = await this.databaseService.query<TargetCoverageRow>(
      `
        WITH active_personnel AS (
          SELECT DISTINCT ON (eah.employee_id, eah.store_id)
            eah.store_id,
            s.store_name,
            e.employee_id,
            e.first_name,
            e.last_name,
            e.external_employee_ref
          FROM ops.employee_assignment_history eah
          INNER JOIN ops.employee e
            ON e.employee_id = eah.employee_id
          INNER JOIN ops.store s
            ON s.store_id = eah.store_id
          WHERE eah.assignment_status = 'active'
            AND eah.end_date IS NULL
            AND e.employment_status = 'active'
            AND ${clauses.join(" AND ")}
          ORDER BY eah.employee_id, eah.store_id, eah.start_date DESC
        ),
        pending_allocations AS (
          SELECT DISTINCT ON (tdr.store_id, (allocation.value ->> 'employeeId'))
            tdr.target_distribution_request_id::text AS pending_request_id,
            tdr.store_id,
            (allocation.value ->> 'employeeId')::uuid AS employee_id,
            NULLIF(allocation.value ->> 'targetValue', '')::numeric AS pending_target_value
          FROM ops.target_distribution_request tdr
          CROSS JOIN LATERAL jsonb_array_elements(tdr.allocation_json) AS allocation(value)
          WHERE tdr.request_status = 'pending_region_approval'
            AND tdr.request_month = $1::date
          ORDER BY
            tdr.store_id,
            (allocation.value ->> 'employeeId'),
            tdr.created_at DESC,
            tdr.target_distribution_request_id DESC
        ),
        stale_targets AS (
          SELECT DISTINCT ON (ptr.employee_id)
            ptr.employee_id,
            ptr.store_id,
            ptr.personnel_target_reference_id::text AS personnel_target_reference_id
          FROM ops.personnel_target_reference ptr
          WHERE ptr.period_start = $1::date
            AND ptr.period_end = ($1::date + INTERVAL '1 month' - INTERVAL '1 day')::date
            AND ptr.target_type = 'monthly_sales_target'
            AND ptr.status = 'approved'
          ORDER BY ptr.employee_id, ptr.approved_at DESC NULLS LAST, ptr.created_at DESC
        )
        SELECT
          ap.store_id,
          ap.store_name,
          ap.employee_id,
          ap.first_name,
          ap.last_name,
          ap.external_employee_ref,
          ptr.personnel_target_reference_id::text AS personnel_target_reference_id,
          ptr.target_value::text AS target_value,
          pa.pending_request_id,
          pa.pending_target_value::text AS pending_target_value,
          stale_targets.personnel_target_reference_id AS stale_target_reference_id,
          CASE
            WHEN ptr.personnel_target_reference_id IS NOT NULL
              AND pa.pending_request_id IS NOT NULL
              THEN 'pending_change_conflict'
            WHEN ptr.personnel_target_reference_id IS NOT NULL
              THEN 'approved'
            WHEN pa.pending_request_id IS NOT NULL
              THEN 'pending_region_approval'
            WHEN stale_targets.personnel_target_reference_id IS NOT NULL
              THEN 'stale_reference'
            ELSE 'missing'
          END AS target_status
        FROM active_personnel ap
        LEFT JOIN ops.personnel_target_reference ptr
          ON ptr.employee_id = ap.employee_id
         AND ptr.store_id = ap.store_id
         AND ptr.period_start = $1::date
         AND ptr.period_end = ($1::date + INTERVAL '1 month' - INTERVAL '1 day')::date
         AND ptr.target_type = 'monthly_sales_target'
         AND ptr.status = 'approved'
        LEFT JOIN pending_allocations pa
          ON pa.employee_id = ap.employee_id
         AND pa.store_id = ap.store_id
        LEFT JOIN stale_targets
          ON stale_targets.employee_id = ap.employee_id
         AND stale_targets.store_id <> ap.store_id
        ORDER BY ap.store_name ASC, ap.first_name ASC, ap.last_name ASC, ap.employee_id ASC
      `,
      params,
    );

    return result.rows;
  }

  async approveRequest(input: {
    requestId: string;
    approverUserId: string;
    approvalNote?: string;
    approvedTotalTargetValue?: number;
    approvedAllocations?: TargetDistributionAllocation[];
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const approvedAllocationJson =
        input.approvedAllocations !== undefined
          ? JSON.stringify(input.approvedAllocations)
          : null;
      const result = await client.query<TargetDistributionRow>(
        `
          WITH existing AS (
            SELECT
              allocation_json AS original_allocation_json,
              total_target_value AS original_total_target_value
            FROM ops.target_distribution_request
            WHERE target_distribution_request_id = $1::uuid
              AND request_status = 'pending_region_approval'
            FOR UPDATE
          ),
          merged AS (
            SELECT existing.*, (
              SELECT jsonb_agg(item.value || CASE WHEN NOT (item.value ? 'distributionDays') AND original.value ? 'distributionDays'
                THEN jsonb_build_object('distributionDays', original.value->'distributionDays')
                ELSE '{}'::jsonb END ORDER BY item.ordinality)
              FROM jsonb_array_elements($6::jsonb) WITH ORDINALITY item(value, ordinality)
              LEFT JOIN LATERAL (
                SELECT value FROM jsonb_array_elements(existing.original_allocation_json)
                WHERE value->>'employeeId' = item.value->>'employeeId' LIMIT 1
              ) original ON TRUE
            ) AS final_allocation_json FROM existing
          ),
          updated AS (
            UPDATE ops.target_distribution_request AS tdr
            SET
              request_status = 'approved',
              approved_by_user_id = $2,
              approved_at = NOW(),
              approval_note = $3,
              total_target_value = COALESCE($4::numeric, tdr.total_target_value),
              allocation_count = COALESCE($5::int, tdr.allocation_count),
              allocation_json = COALESCE(existing.final_allocation_json, tdr.allocation_json),
              approval_evidence_json = COALESCE(tdr.approval_evidence_json, '{}'::jsonb) || jsonb_build_object(
                'approvalMode',
                CASE WHEN $6::jsonb IS NULL THEN 'direct' ELSE 'adjusted' END,
                'originalTotalTargetValue',
                COALESCE(existing.original_total_target_value, tdr.total_target_value),
                'approvedTotalTargetValue',
                COALESCE($4::numeric, tdr.total_target_value),
                'originalAllocations',
                existing.original_allocation_json,
                'approvedAllocations',
                COALESCE(existing.final_allocation_json, tdr.allocation_json)
              ),
              updated_at = NOW()
            FROM merged existing
            WHERE tdr.target_distribution_request_id = $1::uuid
              AND tdr.request_status = 'pending_region_approval'
            RETURNING
              tdr.target_distribution_request_id,
              tdr.company_id,
              tdr.region_id,
              tdr.store_id,
              tdr.request_month,
              tdr.target_label,
              tdr.total_target_value,
              tdr.allocation_count,
              tdr.request_status,
              tdr.request_reason,
              tdr.allocation_json,
              tdr.submitted_by_user_id,
              tdr.approved_by_user_id,
              tdr.approved_at,
              tdr.approval_note,
              tdr.approval_evidence_json,
              tdr.created_at,
              tdr.updated_at,
              existing.original_allocation_json,
              existing.original_total_target_value
          )
          SELECT * FROM updated
        `,
        [
          input.requestId,
          input.approverUserId,
          input.approvalNote ?? null,
          input.approvedTotalTargetValue ?? null,
          input.approvedAllocations?.length ?? null,
          approvedAllocationJson,
        ],
      );

      const request = result.rows[0];
      if (!request) {
        throwTargetRevisionError("target_revision_active_conflict");
      }
      const authority = await client.query<{ exists: boolean }>(
        `
          SELECT EXISTS (
            SELECT 1
            FROM ops.user_account account
            INNER JOIN ops.user_action_store_assignment assignment
              ON assignment.user_id = account.user_id
            WHERE account.user_id = $1::uuid
              AND account.is_active = TRUE
              AND assignment.store_id = $2::uuid
              AND assignment.start_at <= NOW()
              AND (assignment.end_at IS NULL OR assignment.end_at >= NOW())
          ) AS exists
        `,
        [input.approverUserId, request.store_id],
      );
      if (authority.rows[0]?.exists === false) {
        throw new ForbiddenException("Target distribution request is outside assigned action stores");
      }
      const allocations = parseTargetDistributionAllocations(request.allocation_json);
      const originalAllocations = parseTargetDistributionAllocations(
        request.original_allocation_json,
      );
      const isAdjustedApproval = input.approvedAllocations !== undefined;
      const revision = parseTargetRevisionEvidence(request.approval_evidence_json);
      const allocationTotal = allocations.reduce(
        (sum, allocation) => sum + allocation.targetValue,
        0,
      );
      if (
        !Array.isArray(request.allocation_json) ||
        allocations.length !== request.allocation_count ||
        Math.abs(allocationTotal - Number(request.total_target_value)) > 0.0001
      ) {
        throwTargetRevisionError("target_revision_incomplete");
      }
      const predecessorSuccessorLinks: Array<{
        predecessorId: string;
        successorId: string | null;
      }> = [];

      let predecessorsByEmployeeId = new Map<string, string>();
      let removedPredecessors: Array<{ employeeId: string; targetReferenceId: string }> = [];
      const sortedEmployeeIds = [...new Set([
        ...allocations.map((allocation) => allocation.employeeId),
        ...(revision?.removedEmployeeIds ?? []),
      ])].sort();
      const employeeLock = await client.query<{ employee_id: string }>(
        `SELECT employee_id FROM ops.employee WHERE employee_id = ANY($1::uuid[]) ORDER BY employee_id FOR UPDATE`,
        [sortedEmployeeIds],
      );
      const departed = revision?.mode === "revision"
        ? await client.query<TargetDeparture>(targetDepartureSql, [sortedEmployeeIds, request.store_id, request.request_month])
        : { rows: [] as TargetDeparture[] };
      assertDepartureTargets(departed.rows, allocations);
      const departedIds = new Set(departed.rows.map(row => row.employee_id));
      const activeAllocationIds = allocations.filter(a => !departedIds.has(a.employeeId)).map(a => a.employeeId);
      const eligibleResult = await client.query<{ eligible_count: string }>(
        `
          SELECT COUNT(*)::text AS eligible_count
          FROM (
            SELECT eah.employee_id
            FROM ops.employee_assignment_history eah
            WHERE eah.employee_id = ANY($1::uuid[])
              AND eah.store_id = $2::uuid
              AND eah.is_primary_assignment = TRUE
              AND eah.assignment_status = 'active'
              AND eah.start_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date
              AND (eah.end_date IS NULL OR eah.end_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date)
              AND NOT EXISTS (
                SELECT 1
                FROM ops.employee_assignment_history overlapping_primary
                WHERE overlapping_primary.employee_id = eah.employee_id
                  AND overlapping_primary.assignment_id <> eah.assignment_id
                  AND overlapping_primary.is_primary_assignment = TRUE
                  AND overlapping_primary.assignment_status = 'active'
                  AND overlapping_primary.start_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date
                  AND (overlapping_primary.end_date IS NULL OR overlapping_primary.end_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date)
              )
            GROUP BY eah.employee_id
            HAVING COUNT(*) = 1
          ) eligible
        `,
        [activeAllocationIds, request.store_id],
      );
      if (
        eligibleResult.rows[0] &&
        Number(eligibleResult.rows[0].eligible_count) !== activeAllocationIds.length
      ) {
        throwTargetRevisionError("target_revision_active_conflict");
      }
      const closedPeriod = await client.query<{ exists: boolean }>(
        `
          SELECT EXISTS (
            SELECT 1
            FROM rpt.snapshot_run
            WHERE snapshot_type = 'monthly'
              AND period_start = $1::date
              AND period_end = ($1::date + INTERVAL '1 month' - INTERVAL '1 day')::date
              AND run_status = 'completed'
              AND (company_ids = '{}'::uuid[] OR $2::uuid = ANY(company_ids))
          ) AS exists
        `,
        [request.request_month, request.company_id],
      );
      if (closedPeriod.rows[0]?.exists) {
        throwTargetRevisionError("target_revision_period_closed");
      }
      if (revision?.mode === "revision") {
        const originalEmployeeIds = originalAllocations
          .map((allocation) => allocation.employeeId.toLowerCase())
          .sort();
        const finalEmployeeIds = allocations
          .map((allocation) => allocation.employeeId.toLowerCase())
          .sort();
        if (
          originalEmployeeIds.length !== finalEmployeeIds.length ||
          originalEmployeeIds.some((employeeId, index) => employeeId !== finalEmployeeIds[index])
        ) {
          throwTargetRevisionError("target_revision_incomplete");
        }
        if (employeeLock.rows.length !== sortedEmployeeIds.length) {
          throwTargetRevisionError("target_revision_active_conflict");
        }
        const activeResult = await client.query<{
          employee_id: string;
          personnel_target_reference_id: string;
          store_id: string;
        }>(
          `
            SELECT ptr.employee_id, ptr.personnel_target_reference_id, ptr.store_id
            FROM ops.personnel_target_reference ptr
            WHERE ptr.company_id = $1::uuid
              AND (
                ptr.store_id = $2::uuid
                OR EXISTS (
                  SELECT 1
                  FROM ops.employee_assignment_history current_primary
                  WHERE current_primary.employee_id = ptr.employee_id
                    AND current_primary.store_id = $2::uuid
                    AND current_primary.is_primary_assignment = TRUE
                    AND current_primary.assignment_status = 'active'
                    AND current_primary.start_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date
                    AND (current_primary.end_date IS NULL OR current_primary.end_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date)
                )
              )
              AND ptr.period_start = $3::date
              AND ptr.period_end = ($3::date + INTERVAL '1 month' - INTERVAL '1 day')::date
              AND ptr.target_type = 'monthly_sales_target'
              AND ptr.status = 'approved'
            ORDER BY ptr.employee_id, ptr.personnel_target_reference_id
            FOR UPDATE
          `,
          [request.company_id, request.store_id, request.request_month],
        );

        const rotatedPredecessors = activeResult.rows
          .filter((row) => row.store_id !== request.store_id)
          .map((row) => ({
            employeeId: row.employee_id,
          }));
        if (rotatedPredecessors.length > 0) {
          const rotationResult = await client.query<{
            employee_id: string;
            predecessor_end_date: string | null;
            successor_start_date: string;
          }>(
            `
              SELECT
                candidate.employee_id,
                previous_primary.end_date::text AS predecessor_end_date,
                current_primary.start_date::text AS successor_start_date
              FROM jsonb_to_recordset($1::jsonb) AS candidate(
                employee_id uuid
              )
              INNER JOIN ops.employee_assignment_history current_primary
                ON current_primary.employee_id = candidate.employee_id
               AND current_primary.store_id = $2::uuid
               AND current_primary.is_primary_assignment = TRUE
               AND current_primary.assignment_status = 'active'
               AND current_primary.start_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date
               AND (current_primary.end_date IS NULL OR current_primary.end_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date)
              INNER JOIN LATERAL (
                SELECT predecessor.end_date
                FROM ops.employee_assignment_history predecessor
                WHERE predecessor.employee_id = candidate.employee_id
                  AND predecessor.is_primary_assignment = TRUE
                  AND predecessor.start_date < current_primary.start_date
                ORDER BY predecessor.start_date DESC, predecessor.end_date DESC NULLS FIRST
                LIMIT 1
              ) previous_primary ON TRUE
            `,
            [JSON.stringify(rotatedPredecessors), request.store_id],
          );
          if (
            rotationResult.rows.length !== rotatedPredecessors.length ||
            rotationResult.rows.some((row) => !isValidNextDayPrimaryRotation({
              predecessorEndDate: row.predecessor_end_date,
              successorStartDate: row.successor_start_date,
            }))
          ) {
            throwTargetRevisionError("target_revision_active_conflict");
          }
        }

        try {
          const reconciliation = reconcileTargetRevision({
            activeReferences: activeResult.rows.map((row) => ({
              employeeId: row.employee_id,
              targetReferenceId: row.personnel_target_reference_id,
            })),
            allocationEmployeeIds: allocations.map((allocation) => allocation.employeeId),
            baseReferenceIds: revision.baseReferenceIds,
            removedEmployeeIds: revision.removedEmployeeIds,
          });
          predecessorsByEmployeeId = reconciliation.predecessorsByEmployeeId;
          removedPredecessors = reconciliation.removedPredecessors;
        } catch (error) {
          if (error instanceof TargetRevisionConflict) {
            throwTargetRevisionError(error.code);
          }
          throw error;
        }

        for (const reference of [
          ...removedPredecessors,
          ...[...predecessorsByEmployeeId].map(([employeeId, targetReferenceId]) => ({
            employeeId,
            targetReferenceId,
          })),
        ]) {
          const superseded = await client.query<{ personnel_target_reference_id: string }>(
            `
              UPDATE ops.personnel_target_reference
              SET status = 'superseded'
              WHERE personnel_target_reference_id = $1::uuid
                AND status = 'approved'
              RETURNING personnel_target_reference_id
            `,
            [reference.targetReferenceId],
          );
          if (superseded.rows.length !== 1) {
            throwTargetRevisionError("target_revision_chain_conflict");
          }
        }
        predecessorSuccessorLinks.push(
          ...removedPredecessors.map((reference) => ({
            predecessorId: reference.targetReferenceId,
            successorId: null,
          })),
        );
      }

      for (const allocation of allocations) {
        let inserted: { rows: Array<{ personnel_target_reference_id: string }> };
        try {
          inserted = await client.query<{ personnel_target_reference_id: string }>(
          `
            INSERT INTO ops.personnel_target_reference (
              source_request_id,
              company_id,
              region_id,
              store_id,
              employee_id,
              period_start,
              period_end,
              target_value,
              target_type,
              status,
              approved_by_user_id,
              approved_at,
              supersedes_target_reference_id
            )
            VALUES (
              $1::uuid,
              $2::uuid,
              $3::uuid,
              $4::uuid,
              $5::uuid,
              $6::date,
              ($6::date + INTERVAL '1 month' - INTERVAL '1 day')::date,
              $7::numeric,
              'monthly_sales_target',
              'approved',
              $8,
              $9::timestamptz,
              $10::uuid
            )
            RETURNING personnel_target_reference_id
          `,
          [
            request.target_distribution_request_id,
            request.company_id,
            request.region_id,
            request.store_id,
            allocation.employeeId,
            request.request_month,
            allocation.targetValue,
            input.approverUserId,
            request.approved_at,
            predecessorsByEmployeeId.get(allocation.employeeId.toLowerCase()) ?? null,
          ],
          );
        } catch (error) {
          if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            (error as { code?: unknown }).code === "23505"
          ) {
            throwTargetRevisionError("target_revision_active_conflict");
          }
          throw error;
        }
        const predecessorId = predecessorsByEmployeeId.get(allocation.employeeId.toLowerCase());
        if (predecessorId) {
          predecessorSuccessorLinks.push({
            predecessorId,
            successorId: inserted.rows[0]?.personnel_target_reference_id ?? null,
          });
        }
      }

      await client.query(
        `
          UPDATE ops.target_distribution_request
          SET approval_evidence_json = jsonb_set(
            COALESCE(approval_evidence_json, '{}'::jsonb),
            '{targetRevision,predecessorSuccessorLinks}',
            $2::jsonb,
            TRUE
          )
          WHERE target_distribution_request_id = $1::uuid
            AND request_status = 'approved'
        `,
        [request.target_distribution_request_id, JSON.stringify(predecessorSuccessorLinks)],
      );

      await client.query(
        `
          INSERT INTO audit.event_log (
            actor_user_id,
            event_type,
            entity_name,
            entity_id,
            scope_type,
            company_id,
            region_id,
            store_id,
            metadata_json
          )
          VALUES (
            $1::uuid,
            'target_distribution_request.approved',
            'ops.target_distribution_request',
            $2::uuid,
            'store',
            $3::uuid,
            $4::uuid,
            $5::uuid,
            $6::jsonb
          )
        `,
        [
          input.approverUserId,
          request.target_distribution_request_id,
          request.company_id,
          request.region_id,
          request.store_id,
          JSON.stringify({
            correlationId: RequestContextStore.getCorrelationId(),
            actorUserId: input.approverUserId,
            approvalMode: isAdjustedApproval ? "adjusted" : "direct",
            approvalNote: input.approvalNote ?? null,
            promotedTargetReferenceCount: allocations.length,
            originalAllocationCount:
              originalAllocations.length > 0 ? originalAllocations.length : allocations.length,
            finalAllocationCount: allocations.length,
            originalTargetValue:
              request.original_total_target_value !== undefined &&
              request.original_total_target_value !== null
                ? Number(request.original_total_target_value)
                : Number(request.total_target_value),
            finalTargetValue: Number(request.total_target_value),
            targetRevision: {
              mode: revision?.mode ?? "initial",
              reasonClass: revision?.mode === "revision" ? "monthly_target_revision" : "initial_approval",
              reasonPresent: Boolean(request.request_reason?.trim()),
              predecessorSuccessorLinks,
            },
          }),
        ],
      );

      return mapTargetDistributionRow({ ...request, store_name: "" });
    });
  }
}
