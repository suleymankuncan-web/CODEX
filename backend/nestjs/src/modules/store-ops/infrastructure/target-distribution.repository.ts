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
};

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
            NULL,
            'target_distribution_request.created',
            'ops.target_distribution_request',
            $1::uuid,
            'store',
            $2::uuid,
            $3::uuid,
            $4::uuid,
            $5::jsonb
          )
        `,
        [
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

    const whereClause = `WHERE ${clauses.join(" AND ")}`;
    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;
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

    return result.rows.map((row) => this.mapRequest(row));
  }

  async approveRequest(input: {
    requestId: string;
    approverUserId: string;
    approvalNote?: string;
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<TargetDistributionRow>(
        `
          UPDATE ops.target_distribution_request
          SET
            request_status = 'approved',
            approved_by_user_id = $2,
            approved_at = NOW(),
            approval_note = $3,
            updated_at = NOW()
          WHERE target_distribution_request_id = $1::uuid
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
        [input.requestId, input.approverUserId, input.approvalNote ?? null],
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
            NULL,
            'target_distribution_request.approved',
            'ops.target_distribution_request',
            $1::uuid,
            'store',
            $2::uuid,
            $3::uuid,
            $4::uuid,
            $5::jsonb
          )
        `,
        [
          request.target_distribution_request_id,
          request.company_id,
          request.region_id,
          request.store_id,
          JSON.stringify({
            correlationId: RequestContextStore.getCorrelationId(),
            actorUserId: input.approverUserId,
            approvalNote: input.approvalNote ?? null,
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
