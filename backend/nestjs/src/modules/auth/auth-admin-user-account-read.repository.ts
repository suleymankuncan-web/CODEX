import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../shared/database/database.service";

export type AuthAdminUserAccountRow = {
  user_id: string;
  employee_id: string | null;
  username: string;
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
};

@Injectable()
export class AuthAdminUserAccountReadRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listUserAccounts(input: {
    limit?: number;
    offset?: number;
    authProvider?: string;
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

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

    const totalResult = await this.databaseService.query<{ total_count: string }>(
      `
        SELECT COUNT(*)::text AS total_count
        FROM ops.user_account ua
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
          ua.email,
          ua.auth_provider,
          ua.provider_subject,
          ua.is_active,
          ua.last_login_at,
          ua.created_at,
          ua.deactivated_at,
          ua.deactivation_reason,
          ua.deactivated_by_user_id,
          e.employment_status AS employee_status
        FROM ops.user_account ua
        LEFT JOIN ops.employee e
          ON e.employee_id = ua.employee_id
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
          ua.email,
          ua.auth_provider,
          ua.provider_subject,
          ua.is_active,
          ua.last_login_at,
          ua.created_at,
          ua.deactivated_at,
          ua.deactivation_reason,
          ua.deactivated_by_user_id,
          e.employment_status AS employee_status
        FROM ops.user_account ua
        LEFT JOIN ops.employee e
          ON e.employee_id = ua.employee_id
        WHERE user_id = $1::uuid
      `,
      [userId],
    );

    return result.rows[0] ?? null;
  }
}
