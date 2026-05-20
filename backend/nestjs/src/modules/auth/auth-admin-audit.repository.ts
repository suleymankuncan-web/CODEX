import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../shared/database/database.service";

type AuthAdminAuditRow = {
  event_log_id: string;
  occurred_at: string;
  actor_user_id: string | null;
  event_type: string;
  metadata_json: Record<string, unknown>;
};

@Injectable()
export class AuthAdminAuditRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async getRoleAssignmentAudit(input: { assignmentId: string; limit?: number; offset?: number }) {
    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;

    const result = await this.databaseService.query<AuthAdminAuditRow>(
      `
        SELECT
          event_log_id,
          occurred_at,
          actor_user_id,
          event_type,
          metadata_json
        FROM audit.event_log
        WHERE entity_name = 'ops.user_role_assignment'
          AND entity_id = $1::uuid
        ORDER BY occurred_at ASC, event_log_id ASC
        LIMIT $2 OFFSET $3
      `,
      [input.assignmentId, limit, offset],
    );

    return result.rows;
  }

  async getActionStoreAssignmentAudit(input: {
    assignmentId: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;

    const result = await this.databaseService.query<AuthAdminAuditRow>(
      `
        SELECT
          event_log_id,
          occurred_at,
          actor_user_id,
          event_type,
          metadata_json
        FROM audit.event_log
        WHERE entity_name = 'ops.user_action_store_assignment'
          AND entity_id = $1::uuid
        ORDER BY occurred_at ASC, event_log_id ASC
        LIMIT $2 OFFSET $3
      `,
      [input.assignmentId, limit, offset],
    );

    return result.rows;
  }

  async getUserAccountAudit(input: { userId: string; limit?: number; offset?: number }) {
    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;

    const result = await this.databaseService.query<AuthAdminAuditRow>(
      `
        SELECT
          event_log_id,
          occurred_at,
          actor_user_id,
          event_type,
          metadata_json
        FROM audit.event_log
        WHERE entity_name = 'ops.user_account'
          AND entity_id = $1::uuid
        ORDER BY occurred_at ASC, event_log_id ASC
        LIMIT $2 OFFSET $3
      `,
      [input.userId, limit, offset],
    );

    return result.rows;
  }
}
