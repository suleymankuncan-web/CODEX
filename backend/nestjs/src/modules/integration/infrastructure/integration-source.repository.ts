import { Injectable } from "@nestjs/common";
import { PoolClient } from "pg";
import { RequestContextStore } from "../../../shared/request-context";
import { DatabaseService } from "../../../shared/database/database.service";

@Injectable()
export class IntegrationSourceRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private async resolveAuditActorUserId(
    actorUserId: string | null | undefined,
    client?: PoolClient,
  ) {
    if (!actorUserId) {
      return null;
    }

    const sql = `
      SELECT user_id
      FROM ops.user_account
      WHERE user_id = $1::uuid
      LIMIT 1
    `;
    const result = client
      ? await client.query<{ user_id: string }>(sql, [actorUserId])
      : await this.databaseService.query<{ user_id: string }>(sql, [actorUserId]);

    return result.rows[0]?.user_id ?? null;
  }

  async listIntegrationSources(input: {
    limit?: number;
    offset?: number;
    entityType?: string;
    sourceSystem?: string;
    isActive?: boolean;
  }) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (input.entityType) {
      params.push(input.entityType);
      conditions.push(`entity_type = $${params.length}`);
    }

    if (input.sourceSystem) {
      params.push(input.sourceSystem);
      conditions.push(`source_system = $${params.length}`);
    }

    if (typeof input.isActive === "boolean") {
      params.push(input.isActive);
      conditions.push(`is_active = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const totalResult = await this.databaseService.query<{ total_count: string }>(
      `
        SELECT COUNT(*)::text AS total_count
        FROM stg.integration_source
        ${whereClause}
      `,
      params,
    );

    const result = await this.databaseService.query<{
      integration_source_id: string;
      source_code: string;
      source_name: string;
      entity_type: string;
      source_system: string;
      state_model: string;
      poll_enabled: boolean;
      poll_interval_minutes: number;
      poll_window_start_local: string;
      poll_window_end_local: string;
      poll_timezone: string;
      is_active: boolean;
    }>(
      `
        SELECT
          integration_source_id,
          source_code,
          source_name,
          entity_type,
          source_system,
          state_model,
          poll_enabled,
          poll_interval_minutes,
          poll_window_start_local,
          poll_window_end_local,
          poll_timezone,
          is_active
        FROM stg.integration_source
        ${whereClause}
        ORDER BY source_code ASC
        LIMIT $${params.length + 1}
        OFFSET $${params.length + 2}
      `,
      [...params, input.limit ?? 50, input.offset ?? 0],
    );

    return {
      rows: result.rows,
      total: Number(totalResult.rows[0]?.total_count ?? 0),
    };
  }

  async listActiveIntegrationSources() {
    const result = await this.databaseService.query<{
      integration_source_id: string;
      source_code: string;
      source_name: string;
      entity_type: string;
      source_system: string;
      state_model: string;
      poll_enabled: boolean;
      poll_interval_minutes: number;
      poll_window_start_local: string;
      poll_window_end_local: string;
      poll_timezone: string;
      is_active: boolean;
    }>(
      `
        SELECT
          integration_source_id,
          source_code,
          source_name,
          entity_type,
          source_system,
          state_model,
          poll_enabled,
          poll_interval_minutes,
          poll_window_start_local,
          poll_window_end_local,
          poll_timezone,
          is_active
        FROM stg.integration_source
        WHERE is_active = TRUE
        ORDER BY source_code ASC
      `,
    );

    return result.rows;
  }

  async getIntegrationSourceByCodeAndEntity(sourceCode: string, entityType: string) {
    const result = await this.databaseService.query<{
      integration_source_id: string;
      source_code: string;
      source_name: string;
      entity_type: string;
      source_system: string;
      state_model: string;
      poll_enabled: boolean;
      poll_interval_minutes: number;
      poll_window_start_local: string;
      poll_window_end_local: string;
      poll_timezone: string;
      is_active: boolean;
    }>(
      `
        SELECT
          integration_source_id,
          source_code,
          source_name,
          entity_type,
          source_system,
          state_model,
          poll_enabled,
          poll_interval_minutes,
          poll_window_start_local,
          poll_window_end_local,
          poll_timezone,
          is_active
        FROM stg.integration_source
        WHERE source_code = $1
          AND entity_type = $2
        LIMIT 1
      `,
      [sourceCode, entityType],
    );

    return result.rows[0] ?? null;
  }

  async getIntegrationSourceById(sourceId: string) {
    const result = await this.databaseService.query<{
      integration_source_id: string;
      source_code: string;
      source_name: string;
      entity_type: string;
      source_system: string;
      state_model: string;
      poll_enabled: boolean;
      poll_interval_minutes: number;
      poll_window_start_local: string;
      poll_window_end_local: string;
      poll_timezone: string;
      is_active: boolean;
    }>(
      `
        SELECT
          integration_source_id,
          source_code,
          source_name,
          entity_type,
          source_system,
          state_model,
          poll_enabled,
          poll_interval_minutes,
          poll_window_start_local,
          poll_window_end_local,
          poll_timezone,
          is_active
        FROM stg.integration_source
        WHERE integration_source_id = $1::uuid
        LIMIT 1
      `,
      [sourceId],
    );

    return result.rows[0] ?? null;
  }

  async createIntegrationSource(input: {
    sourceCode: string;
    sourceName: string;
    entityType: string;
    sourceSystem: string;
    stateModel: string;
    pollEnabled?: boolean;
    pollIntervalMinutes?: number;
    pollWindowStartLocal?: string;
    pollWindowEndLocal?: string;
    pollTimezone?: string;
    actorUserId: string;
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const auditActorUserId = await this.resolveAuditActorUserId(input.actorUserId, client);

      const result = await client.query<{
        integration_source_id: string;
        source_code: string;
        source_name: string;
        entity_type: string;
        source_system: string;
        state_model: string;
        poll_enabled: boolean;
        poll_interval_minutes: number;
        poll_window_start_local: string;
        poll_window_end_local: string;
        poll_timezone: string;
        is_active: boolean;
      }>(
        `
          INSERT INTO stg.integration_source (
            source_code,
            source_name,
            entity_type,
            source_system,
            state_model,
            poll_enabled,
            poll_interval_minutes,
            poll_window_start_local,
            poll_window_end_local,
            poll_timezone
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::time, $9::time, $10)
          RETURNING
            integration_source_id,
            source_code,
            source_name,
            entity_type,
            source_system,
            state_model,
            poll_enabled,
            poll_interval_minutes,
            poll_window_start_local,
            poll_window_end_local,
            poll_timezone,
            is_active
        `,
        [
          input.sourceCode,
          input.sourceName,
          input.entityType,
          input.sourceSystem,
          input.stateModel,
          input.pollEnabled ?? false,
          input.pollIntervalMinutes ?? 30,
          input.pollWindowStartLocal ?? "10:30",
          input.pollWindowEndLocal ?? "00:00",
          input.pollTimezone ?? "Europe/Istanbul",
        ],
      );

      const source = result.rows[0];

      await client.query(
        `
          INSERT INTO audit.event_log (
            actor_user_id,
            event_type,
            entity_name,
            entity_id,
            scope_type,
            metadata_json
          )
          VALUES ($1::uuid, 'integration_source.created', 'stg.integration_source', $2::uuid, 'company', $3::jsonb)
        `,
        [
          auditActorUserId,
          source.integration_source_id,
          JSON.stringify({
            correlationId: RequestContextStore.getCorrelationId(),
            requestedActorUserId: input.actorUserId,
            sourceCode: source.source_code,
            sourceName: source.source_name,
            entityType: source.entity_type,
            sourceSystem: source.source_system,
            stateModel: source.state_model,
            pollEnabled: source.poll_enabled,
            pollIntervalMinutes: source.poll_interval_minutes,
            pollWindowStartLocal: source.poll_window_start_local,
            pollWindowEndLocal: source.poll_window_end_local,
            pollTimezone: source.poll_timezone,
          }),
        ],
      );

      return source;
    });
  }

  async updateIntegrationSourceActiveState(input: {
    sourceId: string;
    isActive: boolean;
    actorUserId: string;
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const auditActorUserId = await this.resolveAuditActorUserId(input.actorUserId, client);

      const existing = await client.query<{
        integration_source_id: string;
        source_code: string;
        source_name: string;
        entity_type: string;
        source_system: string;
        state_model: string;
        poll_enabled: boolean;
        poll_interval_minutes: number;
        poll_window_start_local: string;
        poll_window_end_local: string;
        poll_timezone: string;
        is_active: boolean;
      }>(
        `
          SELECT
            integration_source_id,
            source_code,
            source_name,
            entity_type,
            source_system,
            state_model,
            poll_enabled,
            poll_interval_minutes,
            poll_window_start_local,
            poll_window_end_local,
            poll_timezone,
            is_active
          FROM stg.integration_source
          WHERE integration_source_id = $1::uuid
          LIMIT 1
        `,
        [input.sourceId],
      );

      if (existing.rowCount === 0) {
        return null;
      }

      const result = await client.query<{
        integration_source_id: string;
        source_code: string;
        source_name: string;
        entity_type: string;
        source_system: string;
        state_model: string;
        poll_enabled: boolean;
        poll_interval_minutes: number;
        poll_window_start_local: string;
        poll_window_end_local: string;
        poll_timezone: string;
        is_active: boolean;
      }>(
        `
          UPDATE stg.integration_source
          SET is_active = ${input.isActive ? "TRUE" : "FALSE"}
          WHERE integration_source_id = $1::uuid
          RETURNING
            integration_source_id,
            source_code,
            source_name,
            entity_type,
            source_system,
            state_model,
            poll_enabled,
            poll_interval_minutes,
            poll_window_start_local,
            poll_window_end_local,
            poll_timezone,
            is_active
        `,
        [input.sourceId],
      );

      const source = result.rows[0];

      await client.query(
        `
          INSERT INTO audit.event_log (
            actor_user_id,
            event_type,
            entity_name,
            entity_id,
            scope_type,
            metadata_json
          )
          VALUES ($1::uuid, $2, 'stg.integration_source', $3::uuid, 'company', $4::jsonb)
        `,
        [
          auditActorUserId,
          input.isActive ? "integration_source.reactivated" : "integration_source.deactivated",
          input.sourceId,
          JSON.stringify({
            correlationId: RequestContextStore.getCorrelationId(),
            requestedActorUserId: input.actorUserId,
            sourceCode: source.source_code,
            entityType: source.entity_type,
            sourceSystem: source.source_system,
            stateModel: source.state_model,
            pollEnabled: source.poll_enabled,
            pollIntervalMinutes: source.poll_interval_minutes,
            pollWindowStartLocal: source.poll_window_start_local,
            pollWindowEndLocal: source.poll_window_end_local,
            pollTimezone: source.poll_timezone,
            isActive: source.is_active,
          }),
        ],
      );

      return source;
    });
  }

  async updateIntegrationSourceSchedule(input: {
    sourceId: string;
    pollEnabled?: boolean;
    pollIntervalMinutes?: number;
    pollWindowStartLocal?: string;
    pollWindowEndLocal?: string;
    pollTimezone?: string;
    actorUserId: string;
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const auditActorUserId = await this.resolveAuditActorUserId(input.actorUserId, client);

      const result = await client.query<{
        integration_source_id: string;
        source_code: string;
        source_name: string;
        entity_type: string;
        source_system: string;
        state_model: string;
        poll_enabled: boolean;
        poll_interval_minutes: number;
        poll_window_start_local: string;
        poll_window_end_local: string;
        poll_timezone: string;
        is_active: boolean;
      }>(
        `
          UPDATE stg.integration_source
          SET
            poll_enabled = COALESCE($2, poll_enabled),
            poll_interval_minutes = COALESCE($3, poll_interval_minutes),
            poll_window_start_local = COALESCE($4::time, poll_window_start_local),
            poll_window_end_local = COALESCE($5::time, poll_window_end_local),
            poll_timezone = COALESCE($6, poll_timezone)
          WHERE integration_source_id = $1::uuid
          RETURNING
            integration_source_id,
            source_code,
            source_name,
            entity_type,
            source_system,
            state_model,
            poll_enabled,
            poll_interval_minutes,
            poll_window_start_local,
            poll_window_end_local,
            poll_timezone,
            is_active
        `,
        [
          input.sourceId,
          input.pollEnabled ?? null,
          input.pollIntervalMinutes ?? null,
          input.pollWindowStartLocal ?? null,
          input.pollWindowEndLocal ?? null,
          input.pollTimezone ?? null,
        ],
      );

      const source = result.rows[0];
      if (!source) {
        return null;
      }

      await client.query(
        `
          INSERT INTO audit.event_log (
            actor_user_id,
            event_type,
            entity_name,
            entity_id,
            scope_type,
            metadata_json
          )
          VALUES ($1::uuid, 'integration_source.schedule_updated', 'stg.integration_source', $2::uuid, 'company', $3::jsonb)
        `,
        [
          auditActorUserId,
          input.sourceId,
          JSON.stringify({
            correlationId: RequestContextStore.getCorrelationId(),
            requestedActorUserId: input.actorUserId,
            pollEnabled: source.poll_enabled,
            pollIntervalMinutes: source.poll_interval_minutes,
            pollWindowStartLocal: source.poll_window_start_local,
            pollWindowEndLocal: source.poll_window_end_local,
            pollTimezone: source.poll_timezone,
          }),
        ],
      );

      return source;
    });
  }

  async listScheduledIntegrationSources() {
    const result = await this.databaseService.query<{
      integration_source_id: string;
      source_code: string;
      source_name: string;
      entity_type: string;
      source_system: string;
      state_model: string;
      poll_enabled: boolean;
      poll_interval_minutes: number;
      poll_window_start_local: string;
      poll_window_end_local: string;
      poll_timezone: string;
      is_active: boolean;
      last_import_batch_id: string | null;
      last_import_started_at: string | null;
      last_import_status: string | null;
    }>(
      `
        SELECT
          src.integration_source_id,
          src.source_code,
          src.source_name,
          src.entity_type,
          src.source_system,
          src.state_model,
          src.poll_enabled,
          src.poll_interval_minutes,
          src.poll_window_start_local,
          src.poll_window_end_local,
          src.poll_timezone,
          src.is_active,
          latest.import_batch_id AS last_import_batch_id,
          latest.started_at AS last_import_started_at,
          latest.status AS last_import_status
        FROM stg.integration_source src
        LEFT JOIN LATERAL (
          SELECT import_batch_id, started_at, status
          FROM stg.import_batch b
          WHERE b.integration_source_id = src.integration_source_id
          ORDER BY started_at DESC
          LIMIT 1
        ) latest ON TRUE
        WHERE src.is_active = TRUE
          AND src.poll_enabled = TRUE
        ORDER BY src.source_code ASC, src.entity_type ASC
      `,
    );

    return result.rows;
  }

  async getIntegrationSourceAudit(sourceId: string) {
    const result = await this.databaseService.query<{
      event_log_id: string;
      occurred_at: string;
      actor_user_id: string | null;
      event_type: string;
      metadata_json: Record<string, unknown>;
    }>(
      `
        SELECT event_log_id, occurred_at, actor_user_id, event_type, metadata_json
        FROM audit.event_log
        WHERE entity_name = 'stg.integration_source'
          AND entity_id = $1::uuid
        ORDER BY occurred_at ASC, event_log_id ASC
      `,
      [sourceId],
    );

    return result.rows;
  }

  async countActiveImportBatchesForSource(sourceId: string) {
    const result = await this.databaseService.query<{ active_batch_count: string }>(
      `
        SELECT COUNT(*)::text AS active_batch_count
        FROM stg.import_batch
        WHERE integration_source_id = $1::uuid
          AND status IN ('pending', 'queued', 'processing')
      `,
      [sourceId],
    );

    return Number(result.rows[0]?.active_batch_count ?? 0);
  }
}
