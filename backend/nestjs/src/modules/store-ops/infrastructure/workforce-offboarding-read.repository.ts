import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";

export type EmployeeOffboardingRequestRow = {
  offboarding_request_id: string;
  company_id: string;
  region_id: string;
  store_id: string;
  store_code: string;
  store_name: string;
  employee_id: string;
  external_employee_ref: string | null;
  first_name: string;
  last_name: string;
  position_code: string | null;
  position_name: string | null;
  request_status: string;
  requested_termination_date: string;
  termination_reason: string;
  request_reason: string | null;
  submitted_by_user_id: string;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
};

export type EmployeeOffboardingRequestListResult = {
  items: EmployeeOffboardingRequestRow[];
  total: number;
};

@Injectable()
export class WorkforceOffboardingReadRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listOffboardingRequests(input: {
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    status?: string;
    limit: number;
    offset: number;
  }) {
    const params: unknown[] = [];
    const clauses: string[] = [];

    if (input.storeIds.length > 0) {
      params.push(input.storeIds);
      clauses.push(`eor.store_id = ANY($${params.length}::uuid[])`);
    } else if (input.regionIds.length > 0) {
      params.push(input.regionIds);
      clauses.push(`eor.region_id = ANY($${params.length}::uuid[])`);
    } else if (input.companyIds.length > 0) {
      params.push(input.companyIds);
      clauses.push(`eor.company_id = ANY($${params.length}::uuid[])`);
    } else {
      clauses.push("FALSE");
    }

    if (input.status) {
      params.push(input.status);
      clauses.push(`eor.request_status = $${params.length}`);
    }

    const whereSql = clauses.join(" AND ");
    const countResult = await this.databaseService.query<{ total: number }>(
      `
        SELECT COUNT(*)::int AS total
        FROM ops.employee_offboarding_request eor
        WHERE ${whereSql}
      `,
      params,
    );

    const listParams = [...params, input.limit, input.offset];
    const limitParam = params.length + 1;
    const offsetParam = params.length + 2;
    const result = await this.databaseService.query<EmployeeOffboardingRequestRow>(
      `
        SELECT
          eor.offboarding_request_id,
          eor.company_id,
          eor.region_id,
          eor.store_id,
          s.store_code,
          s.store_name,
          eor.employee_id,
          e.external_employee_ref,
          e.first_name,
          e.last_name,
          p.position_code,
          p.position_name,
          eor.request_status,
          eor.requested_termination_date,
          eor.termination_reason,
          eor.request_reason,
          eor.submitted_by_user_id,
          eor.reviewed_by_user_id,
          eor.reviewed_at,
          eor.review_note,
          eor.created_at,
          eor.updated_at
        FROM ops.employee_offboarding_request eor
        INNER JOIN ops.store s
          ON s.store_id = eor.store_id
        INNER JOIN ops.employee e
          ON e.employee_id = eor.employee_id
        LEFT JOIN LATERAL (
          SELECT eah.position_id
          FROM ops.employee_assignment_history eah
          WHERE eah.employee_id = eor.employee_id
            AND eah.store_id = eor.store_id
          ORDER BY
            CASE WHEN eah.assignment_status = 'active' AND eah.end_date IS NULL THEN 0 ELSE 1 END,
            eah.start_date DESC
          LIMIT 1
        ) assignment ON TRUE
        LEFT JOIN ops.position p
          ON p.position_id = assignment.position_id
        WHERE ${whereSql}
        ORDER BY eor.created_at DESC, eor.offboarding_request_id DESC
        LIMIT $${limitParam}
        OFFSET $${offsetParam}
      `,
      listParams,
    );

    return {
      items: result.rows,
      total: Number(countResult.rows[0]?.total ?? 0),
    };
  }

  async getOffboardingRequestById(requestId: string) {
    const result = await this.databaseService.query<EmployeeOffboardingRequestRow>(
      `
        SELECT
          eor.offboarding_request_id,
          eor.company_id,
          eor.region_id,
          eor.store_id,
          s.store_code,
          s.store_name,
          eor.employee_id,
          e.external_employee_ref,
          e.first_name,
          e.last_name,
          p.position_code,
          p.position_name,
          eor.request_status,
          eor.requested_termination_date,
          eor.termination_reason,
          eor.request_reason,
          eor.submitted_by_user_id,
          eor.reviewed_by_user_id,
          eor.reviewed_at,
          eor.review_note,
          eor.created_at,
          eor.updated_at
        FROM ops.employee_offboarding_request eor
        INNER JOIN ops.store s
          ON s.store_id = eor.store_id
        INNER JOIN ops.employee e
          ON e.employee_id = eor.employee_id
        LEFT JOIN LATERAL (
          SELECT eah.position_id
          FROM ops.employee_assignment_history eah
          WHERE eah.employee_id = eor.employee_id
            AND eah.store_id = eor.store_id
          ORDER BY
            CASE WHEN eah.assignment_status = 'active' AND eah.end_date IS NULL THEN 0 ELSE 1 END,
            eah.start_date DESC
          LIMIT 1
        ) assignment ON TRUE
        LEFT JOIN ops.position p
          ON p.position_id = assignment.position_id
        WHERE eor.offboarding_request_id = $1::uuid
        LIMIT 1
      `,
      [requestId],
    );

    return result.rows[0] ?? null;
  }
}
