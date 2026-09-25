import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../shared/database/database.service";

export type AuthAdminUserAccountRow = {
  user_id: string;
  employee_id: string | null;
  username: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  auth_provider: string;
  provider_subject: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  deactivated_at?: string | null;
  deactivation_reason?: string | null;
  deactivated_by_user_id?: string | null;
  employee_status?: string | null;
  identity_operation?: string | null;
  identity_status?: string | null;
  identity_error_code?: string | null;
};

@Injectable()
export class AuthAdminUserAccountReadRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listUserAccounts(input: {
    limit?: number;
    offset?: number;
    authProvider?: string;
    q?: string;
    isActive?: boolean;
  }) {
    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;
    const filters: string[] = [];
    const params: unknown[] = [];

    if (input.authProvider) {
      params.push(input.authProvider);
      filters.push(`ua.auth_provider = $${params.length}`);
    }

    if (typeof input.isActive === "boolean") {
      params.push(input.isActive);
      filters.push(`ua.is_active = $${params.length}`);
    }

    if (input.q) {
      params.push(`%${input.q}%`);
      filters.push(`(
        ua.username ILIKE $${params.length}
        OR ua.email ILIKE $${params.length}
        OR COALESCE(ua.provider_subject, '') ILIKE $${params.length}
        OR COALESCE(e.external_employee_ref, '') ILIKE $${params.length}
        OR COALESCE(e.first_name, '') ILIKE $${params.length}
        OR COALESCE(e.last_name, '') ILIKE $${params.length}
        OR COALESCE(ua.first_name, '') ILIKE $${params.length}
        OR COALESCE(ua.last_name, '') ILIKE $${params.length}
      )`);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

    const totalResult = await this.databaseService.query<{ total_count: string }>(
      `
        SELECT COUNT(*)::text AS total_count
        FROM ops.user_account ua
        LEFT JOIN ops.employee e
          ON e.employee_id = ua.employee_id
        ${whereClause}
      `,
      params,
    );

    const result = await this.databaseService.query<AuthAdminUserAccountRow>(
      `
        SELECT
          ua.user_id,
          ua.employee_id,
          ua.username,
          COALESCE(e.first_name, ua.first_name) AS first_name,
          COALESCE(e.last_name, ua.last_name) AS last_name,
          ua.email,
          ua.auth_provider,
          ua.provider_subject,
          ua.is_active,
          ua.last_login_at,
          ua.created_at,
          ua.deactivated_at,
          ua.deactivation_reason,
          ua.deactivated_by_user_id,
          e.employment_status AS employee_status,
          identity_job.operation AS identity_operation,
          identity_job.status AS identity_status,
          identity_job.last_error_code AS identity_error_code
        FROM ops.user_account ua
        LEFT JOIN ops.employee e
          ON e.employee_id = ua.employee_id
        LEFT JOIN LATERAL (
          SELECT operation, status, last_error_code
          FROM ops.identity_lifecycle_job
          WHERE user_id = ua.user_id
          ORDER BY created_at DESC, identity_lifecycle_job_id DESC
          LIMIT 1
        ) identity_job ON TRUE
        ${whereClause}
        ORDER BY ua.created_at DESC, ua.user_id DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `,
      [...params, limit, offset],
    );

    return {
      rows: result.rows,
      total: Number(totalResult.rows[0]?.total_count ?? "0"),
    };
  }

  async getUserAccountById(userId: string) {
    const result = await this.databaseService.query<AuthAdminUserAccountRow>(
      `
        SELECT
          ua.user_id,
          ua.employee_id,
          ua.username,
          COALESCE(e.first_name, ua.first_name) AS first_name,
          COALESCE(e.last_name, ua.last_name) AS last_name,
          ua.email,
          ua.auth_provider,
          ua.provider_subject,
          ua.is_active,
          ua.last_login_at,
          ua.created_at,
          ua.deactivated_at,
          ua.deactivation_reason,
          ua.deactivated_by_user_id,
          e.employment_status AS employee_status,
          identity_job.operation AS identity_operation,
          identity_job.status AS identity_status,
          identity_job.last_error_code AS identity_error_code
        FROM ops.user_account ua
        LEFT JOIN ops.employee e
          ON e.employee_id = ua.employee_id
        LEFT JOIN LATERAL (
          SELECT operation, status, last_error_code
          FROM ops.identity_lifecycle_job
          WHERE user_id = ua.user_id
          ORDER BY created_at DESC, identity_lifecycle_job_id DESC
          LIMIT 1
        ) identity_job ON TRUE
        WHERE user_id = $1::uuid
      `,
      [userId],
    );

    return result.rows[0] ?? null;
  }
}
