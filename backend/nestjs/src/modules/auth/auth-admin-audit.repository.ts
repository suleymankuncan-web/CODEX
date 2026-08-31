import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../shared/database/database.service";

type AuthAdminAuditRow = {
  event_log_id: string;
  occurred_at: string;
  actor_user_id: string | null;
  event_type: string;
  metadata_json: Record<string, unknown>;
  total_count?: string | number;
  row_kind?: "item" | "meta";
};

@Injectable()
export class AuthAdminAuditRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async getRoleAssignmentAudit(input: { assignmentId: string; limit?: number; offset?: number }) {
    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;

    const result = await this.databaseService.query<AuthAdminAuditRow>(
      `
        WITH filtered AS (
          SELECT
            event_log_id,
            occurred_at,
            actor_user_id,
            event_type,
            metadata_json
          FROM audit.event_log
          WHERE entity_name = 'ops.user_role_assignment'
            AND entity_id = $1::uuid
        ),
        paged AS (
          SELECT *
          FROM filtered
          ORDER BY occurred_at ASC, event_log_id ASC
          LIMIT $2 OFFSET $3
        ),
        totals AS (
          SELECT COUNT(*)::text AS total_count
          FROM filtered
        )
        SELECT
          'item'::text AS row_kind,
          paged.event_log_id,
          paged.occurred_at,
          paged.actor_user_id,
          paged.event_type,
          paged.metadata_json,
          totals.total_count
        FROM paged
        CROSS JOIN totals
        UNION ALL
        SELECT
          'meta'::text AS row_kind,
          NULL,
          NULL,
          NULL,
          NULL,
          NULL,
          totals.total_count
        FROM totals
        WHERE NOT EXISTS (SELECT 1 FROM paged)
        ORDER BY occurred_at ASC NULLS LAST, event_log_id ASC NULLS LAST
      `,
      [input.assignmentId, limit, offset],
    );

    return this.toPage(result.rows);
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
        WITH filtered AS (
          SELECT
            event_log_id,
            occurred_at,
            actor_user_id,
            event_type,
            metadata_json
          FROM audit.event_log
          WHERE entity_name = 'ops.user_action_store_assignment'
            AND entity_id = $1::uuid
        ),
        paged AS (
          SELECT *
          FROM filtered
          ORDER BY occurred_at ASC, event_log_id ASC
          LIMIT $2 OFFSET $3
        ),
        totals AS (
          SELECT COUNT(*)::text AS total_count
          FROM filtered
        )
        SELECT
          'item'::text AS row_kind,
          paged.event_log_id,
          paged.occurred_at,
          paged.actor_user_id,
          paged.event_type,
          paged.metadata_json,
          totals.total_count
        FROM paged
        CROSS JOIN totals
        UNION ALL
        SELECT
          'meta'::text AS row_kind,
          NULL,
          NULL,
          NULL,
          NULL,
          NULL,
          totals.total_count
        FROM totals
        WHERE NOT EXISTS (SELECT 1 FROM paged)
        ORDER BY occurred_at ASC NULLS LAST, event_log_id ASC NULLS LAST
      `,
      [input.assignmentId, limit, offset],
    );

    return this.toPage(result.rows);
  }

  async getUserAccountAudit(input: { userId: string; limit?: number; offset?: number }) {
    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;

    const result = await this.databaseService.query<AuthAdminAuditRow>(
      `
        WITH filtered AS (
          SELECT
            event_log_id,
            occurred_at,
            actor_user_id,
            event_type,
            metadata_json
          FROM audit.event_log
          WHERE entity_name = 'ops.user_account'
            AND entity_id = $1::uuid
        ),
        paged AS (
          SELECT *
          FROM filtered
          ORDER BY occurred_at ASC, event_log_id ASC
          LIMIT $2 OFFSET $3
        ),
        totals AS (
          SELECT COUNT(*)::text AS total_count
          FROM filtered
        )
        SELECT
          'item'::text AS row_kind,
          paged.event_log_id,
          paged.occurred_at,
          paged.actor_user_id,
          paged.event_type,
          paged.metadata_json,
          totals.total_count
        FROM paged
        CROSS JOIN totals
        UNION ALL
        SELECT
          'meta'::text AS row_kind,
          NULL,
          NULL,
          NULL,
          NULL,
          NULL,
          totals.total_count
        FROM totals
        WHERE NOT EXISTS (SELECT 1 FROM paged)
        ORDER BY occurred_at ASC NULLS LAST, event_log_id ASC NULLS LAST
      `,
      [input.userId, limit, offset],
    );

    return this.toPage(result.rows);
  }

  private toPage(rows: AuthAdminAuditRow[]) {
    const pageRows = rows.filter(
      (row) => row.row_kind !== "meta" && Boolean(row.event_log_id),
    );
    const total = Number(rows.find((row) => row.total_count !== undefined)?.total_count ?? pageRows.length);

    return {
      rows: pageRows.map(({ total_count: _totalCount, row_kind: _rowKind, ...row }) => row),
      total,
    };
  }
}
