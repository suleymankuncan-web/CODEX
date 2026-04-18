import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../shared/database/database.service";

@Injectable()
export class AuthAuthorizationRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async getActiveRoleAssignments(userId: string) {
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
}
