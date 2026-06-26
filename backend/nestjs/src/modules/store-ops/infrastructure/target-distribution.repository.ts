import { Injectable } from "@nestjs/common";
import { RequestContextStore } from "../../../shared/request-context";
import { DatabaseService } from "../../../shared/database/database.service";

type TargetDistributionRow = {
  target_distribution_request_id: string;
  company_id: string;
  region_id: string;
  store_id: string;
  store_name: string;
  request_month: string;
  target_label: string;
  total_target_value: string;
  allocation_count: number;
  request_status: string;
  request_reason: string | null;
  allocation_json: unknown;
  submitted_by_user_id: string;
  approved_by_user_id: string | null;
  approved_at: string | null;
  approval_note: string | null;
  created_at: string;
  updated_at: string;
  total_count?: string | number;
  original_allocation_json?: unknown;
  original_total_target_value?: string | null;
};

type TargetDistributionAllocation = {
  employeeId: string;
  assigneeLabel: string;
  targetValue: number;
  note?: string;
};

type TargetCoverageRow = {
  store_id: string;
  store_name: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  external_employee_ref: string | null;
  personnel_target_reference_id: string | null;
  target_value: string | null;
  pending_request_id: string | null;
  pending_target_value: string | null;
  stale_target_reference_id: string | null;
  target_status:
    | "approved"
    | "pending_region_approval"
    | "pending_change_conflict"
    | "stale_reference"
    | "missing";
};

function parseTargetDistributionAllocations(
  value: unknown,
): TargetDistributionAllocation[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const allocation = item as Record<string, unknown>;
      const employeeId =
        typeof allocation.employeeId === "string" ? allocation.employeeId : "";
      const assigneeLabel =
        typeof allocation.assigneeLabel === "string"
          ? allocation.assigneeLabel
          : "";
      const targetValue = Number(allocation.targetValue);
      const note = typeof allocation.note === "string" ? allocation.note : undefined;

      if (
        !employeeId ||
        !assigneeLabel ||
        !Number.isFinite(targetValue) ||
        targetValue <= 0
      ) {
        return null;
      }

      const parsed: TargetDistributionAllocation = {
        employeeId,
        assigneeLabel,
        targetValue,
      };

      if (note !== undefined) {
        parsed.note = note;
      }

      return parsed;
    })
    .filter((item): item is TargetDistributionAllocation => item !== null);
}

@Injectable()
export class TargetDistributionRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async getRequestScope(requestId: string) {
    const result = await this.databaseService.query<{
      target_distribution_request_id: string;
      company_id: string;
      region_id: string;
      store_id: string;
    }>(
      `
        SELECT
          target_distribution_request_id,
          company_id,
          region_id,
          store_id
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
        }
      : null;
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
      note?: string;
    }>;
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
            $10
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

      return this.mapRequest({ ...request, store_name: "" });
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
      items: result.rows.map((row) => this.mapRequest(row)),
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
            FOR UPDATE
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
              allocation_json = COALESCE($6::jsonb, tdr.allocation_json),
              updated_at = NOW()
            FROM existing
            WHERE tdr.target_distribution_request_id = $1::uuid
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
      const allocations = parseTargetDistributionAllocations(request.allocation_json);
      const originalAllocations = parseTargetDistributionAllocations(
        request.original_allocation_json,
      );
      const isAdjustedApproval = input.approvedAllocations !== undefined;

      for (const allocation of allocations) {
        await client.query(
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
              approved_at
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
              $9::timestamptz
            )
            ON CONFLICT (employee_id, period_start, period_end, target_type)
            WHERE status = 'approved'
            DO UPDATE SET
              source_request_id = EXCLUDED.source_request_id,
              company_id = EXCLUDED.company_id,
              region_id = EXCLUDED.region_id,
              store_id = EXCLUDED.store_id,
              target_value = EXCLUDED.target_value,
              approved_by_user_id = EXCLUDED.approved_by_user_id,
              approved_at = EXCLUDED.approved_at
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
          ],
        );
      }

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
          }),
        ],
      );

      return this.mapRequest({ ...request, store_name: "" });
    });
  }

  private mapRequest(row: TargetDistributionRow) {
    return {
      requestId: row.target_distribution_request_id,
      companyId: row.company_id,
      regionId: row.region_id,
      storeId: row.store_id,
      storeName: row.store_name,
      requestMonth: row.request_month,
      targetLabel: row.target_label,
      totalTargetValue: Number(row.total_target_value),
      allocationCount: row.allocation_count,
      status: row.request_status,
      requestReason: row.request_reason,
      allocations: Array.isArray(row.allocation_json) ? row.allocation_json : [],
      submittedByUserId: row.submitted_by_user_id,
      approvedByUserId: row.approved_by_user_id,
      approvedAt: row.approved_at,
      approvalNote: row.approval_note,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
