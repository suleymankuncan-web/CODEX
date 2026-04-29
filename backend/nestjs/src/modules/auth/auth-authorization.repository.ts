import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../shared/database/database.service";

@Injectable()
export class AuthAuthorizationRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async getUserAccountByProviderSubject(input: {
    authProvider: string;
    providerSubject: string;
  }) {
    const result = await this.databaseService.query<{
      user_id: string;
      employee_id: string | null;
      username: string;
      email: string;
      is_active: boolean;
    }>(
      `
        SELECT
          ua.user_id,
          ua.employee_id,
          ua.username,
          ua.email,
          ua.is_active
        FROM ops.user_account ua
        WHERE ua.auth_provider = $1
          AND ua.provider_subject = $2
        LIMIT 1
      `,
      [input.authProvider, input.providerSubject],
    );

    return result.rows[0] ?? null;
  }

  async getActiveRoleAssignments(userId: string) {
    if (!isUuid(userId)) {
      return [];
    }

    const result = await this.databaseService.query<{
      role_code: string;
      scope_type: string;
      company_id: string | null;
      region_id: string | null;
      store_id: string | null;
    }>(
      `
        SELECT
          r.role_code,
          ura.scope_type,
          ura.company_id,
          ura.region_id,
          ura.store_id
        FROM ops.user_account ua
        INNER JOIN ops.user_role_assignment ura
          ON ura.user_id = ua.user_id
        INNER JOIN ops.role r
          ON r.role_id = ura.role_id
        WHERE ua.user_id = $1::uuid
          AND ua.is_active = TRUE
          AND ura.start_at <= NOW()
          AND (ura.end_at IS NULL OR ura.end_at >= NOW())
      `,
      [userId],
    );

    return result.rows;
  }

  async getActiveActionStoreAssignments(userId: string) {
    if (!isUuid(userId)) {
      return [];
    }

    const result = await this.databaseService.query<{
      store_id: string;
    }>(
      `
        SELECT uasa.store_id
        FROM ops.user_account ua
        INNER JOIN ops.user_action_store_assignment uasa
          ON uasa.user_id = ua.user_id
        INNER JOIN ops.store s
          ON s.store_id = uasa.store_id
        WHERE ua.user_id = $1::uuid
          AND ua.is_active = TRUE
          AND s.status = 'active'
          AND uasa.start_at <= NOW()
          AND (uasa.end_at IS NULL OR uasa.end_at >= NOW())
        ORDER BY s.store_code ASC, uasa.store_id ASC
      `,
      [userId],
    );

    return result.rows;
  }
}

function isUuid(input: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    input,
  );
}
