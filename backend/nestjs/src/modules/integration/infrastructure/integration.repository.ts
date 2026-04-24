import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PoolClient } from "pg";
import { RequestContextStore } from "../../../shared/request-context";
import { DatabaseService } from "../../../shared/database/database.service";

@Injectable()
export class IntegrationRepository {
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

  private buildImportBatchFilters(
    input: {
      status?: string;
      entityType?: string;
      sourceCode?: string;
      startedFrom?: string;
      startedTo?: string;
    },
    batchAlias = "stg.import_batch",
    sourceAlias = "src",
  ) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (input.status) {
      params.push(input.status);
      conditions.push(`${batchAlias}.status = $${params.length}`);
    }

    if (input.entityType) {
      params.push(input.entityType);
      conditions.push(`${batchAlias}.entity_type = $${params.length}`);
    }

    if (input.sourceCode) {
      params.push(input.sourceCode);
      conditions.push(`${sourceAlias}.source_code = $${params.length}`);
    }

    if (input.startedFrom) {
      params.push(input.startedFrom);
      conditions.push(`${batchAlias}.started_at >= $${params.length}::timestamptz`);
    }

    if (input.startedTo) {
      params.push(input.startedTo);
      conditions.push(`${batchAlias}.started_at <= $${params.length}::timestamptz`);
    }

    return {
      conditions,
      params,
      whereClause: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    };
  }

  private getImportRawUnionSql() {
    return `
      SELECT import_batch_id, normalized_status, validation_error FROM stg.employee_raw
      UNION ALL
      SELECT import_batch_id, normalized_status, validation_error FROM stg.store_raw
      UNION ALL
      SELECT import_batch_id, normalized_status, validation_error FROM stg.kpi_raw
      UNION ALL
      SELECT import_batch_id, normalized_status, validation_error FROM stg.assignment_raw
      UNION ALL
      SELECT import_batch_id, normalized_status, validation_error FROM stg.position_raw
      UNION ALL
      SELECT import_batch_id, normalized_status, validation_error FROM stg.company_raw
      UNION ALL
      SELECT import_batch_id, normalized_status, validation_error FROM stg.region_raw
    `;
  }

  private getMissingDependencyPredicate(alias = "raw") {
    return `
      ${alias}.validation_error ILIKE '%employee reference could not be resolved%'
      OR ${alias}.validation_error ILIKE '%store reference could not be resolved%'
      OR ${alias}.validation_error ILIKE '%position reference could not be resolved%'
      OR ${alias}.validation_error ILIKE '%region could not be resolved%'
      OR ${alias}.validation_error ILIKE '%company could not be resolved%'
      OR ${alias}.validation_error ILIKE '%manager%could not be resolved%'
    `;
  }

  private getRawTableMetadata(
    entityType:
      | "employee"
      | "store"
      | "kpi"
      | "assignment"
      | "position"
      | "company"
      | "region",
  ) {
    switch (entityType) {
      case "employee":
        return {
          tableName: "stg.employee_raw",
          rowIdColumn: "stg_employee_raw_id",
          sourceRefColumn: "source_employee_id",
        };
      case "store":
        return {
          tableName: "stg.store_raw",
          rowIdColumn: "stg_store_raw_id",
          sourceRefColumn: "source_store_id",
        };
      case "kpi":
        return {
          tableName: "stg.kpi_raw",
          rowIdColumn: "stg_kpi_raw_id",
          sourceRefColumn: "source_metric_id",
        };
      case "assignment":
        return {
          tableName: "stg.assignment_raw",
          rowIdColumn: "stg_assignment_raw_id",
          sourceRefColumn: "source_assignment_id",
        };
      case "position":
        return {
          tableName: "stg.position_raw",
          rowIdColumn: "stg_position_raw_id",
          sourceRefColumn: "source_position_id",
        };
      case "company":
        return {
          tableName: "stg.company_raw",
          rowIdColumn: "stg_company_raw_id",
          sourceRefColumn: "source_company_id",
        };
      case "region":
        return {
          tableName: "stg.region_raw",
          rowIdColumn: "stg_region_raw_id",
          sourceRefColumn: "source_region_id",
        };
    }
  }

  async createImportBatch(input: {
    sourceCode: string;
    entityType:
      | "employee"
      | "store"
      | "kpi"
      | "assignment"
      | "position"
      | "company"
      | "region";
    fileReference: string;
    actorUserId: string;
    idempotencyKey?: string;
    sourceBatchId?: string;
    sourcePayloadHash?: string;
    sourceCapturedAt?: string;
    sourceWindowStartedAt?: string;
    sourceWindowEndedAt?: string;
    rows?: Record<string, unknown>[];
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const auditActorUserId = await this.resolveAuditActorUserId(input.actorUserId, client);

      if (input.idempotencyKey) {
        const existing = await client.query<{
          import_batch_id: string;
          started_at: string;
          status: string;
          integration_source_id: string;
          record_count: number;
        }>(
          `
            SELECT import_batch_id, started_at, status, integration_source_id, record_count
            FROM stg.import_batch
            WHERE idempotency_key = $1
            LIMIT 1
          `,
          [input.idempotencyKey],
        );

        if (existing.rowCount && existing.rows[0]) {
          const found = existing.rows[0];
          return {
            batchId: found.import_batch_id,
            status: found.status,
            startedAt: found.started_at,
            integrationSourceId: found.integration_source_id,
            acceptedRowCount: found.record_count,
            reused: true,
          };
        }
      }

      const sourceResult = await client.query<{
        integration_source_id: string;
      }>(
        `
          SELECT integration_source_id
          FROM stg.integration_source
          WHERE source_code = $1
            AND entity_type = $2
            AND is_active = TRUE
          LIMIT 1
        `,
        [input.sourceCode, input.entityType],
      );

      if (sourceResult.rowCount === 0) {
        const anySourceResult = await client.query<{
          integration_source_id: string;
          is_active: boolean;
        }>(
          `
            SELECT integration_source_id, is_active
            FROM stg.integration_source
            WHERE source_code = $1
              AND entity_type = $2
            LIMIT 1
          `,
          [input.sourceCode, input.entityType],
        );

        if (Number(anySourceResult.rowCount ?? 0) > 0) {
          throw new ConflictException(
            `Integration source is inactive for ${input.sourceCode}/${input.entityType}`,
          );
        }

        throw new NotFoundException(
          `Integration source not found for ${input.sourceCode}/${input.entityType}`,
        );
      }

      const integrationSourceId = sourceResult.rows[0].integration_source_id;

      if (input.sourceBatchId) {
        const existingBySourceBatch = await client.query<{
          import_batch_id: string;
          started_at: string;
          status: string;
          integration_source_id: string;
          record_count: number;
          source_batch_id: string | null;
          source_payload_hash: string | null;
          source_captured_at: string | null;
          source_window_started_at: string | null;
          source_window_ended_at: string | null;
        }>(
          `
            SELECT
              import_batch_id,
              started_at,
              status,
              integration_source_id,
              record_count,
              source_batch_id,
              source_payload_hash,
              source_captured_at,
              source_window_started_at,
              source_window_ended_at
            FROM stg.import_batch
            WHERE integration_source_id = $1::uuid
              AND entity_type = $2
              AND source_batch_id = $3
            LIMIT 1
          `,
          [integrationSourceId, input.entityType, input.sourceBatchId],
        );

        if (existingBySourceBatch.rowCount && existingBySourceBatch.rows[0]) {
          const found = existingBySourceBatch.rows[0];
          return {
            batchId: found.import_batch_id,
            status: found.status,
            startedAt: found.started_at,
            integrationSourceId: found.integration_source_id,
            sourceBatchId: found.source_batch_id,
            sourcePayloadHash: found.source_payload_hash,
            sourceCapturedAt: found.source_captured_at,
            sourceWindowStartedAt: found.source_window_started_at,
            sourceWindowEndedAt: found.source_window_ended_at,
            acceptedRowCount: found.record_count,
            reused: true,
          };
        }
      }

      const batchResult = await client.query<{
        import_batch_id: string;
        started_at: string;
        status: string;
        source_batch_id: string | null;
        source_payload_hash: string | null;
        source_captured_at: string | null;
        source_window_started_at: string | null;
        source_window_ended_at: string | null;
      }>(
        `
          INSERT INTO stg.import_batch (
            integration_source_id,
            entity_type,
            idempotency_key,
            source_batch_id,
            source_payload_hash,
            source_captured_at,
            source_window_started_at,
            source_window_ended_at,
            status,
            raw_file_name,
            record_count,
            error_count
          )
          VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz, $8::timestamptz, 'pending', $9, 0, 0)
          RETURNING
            import_batch_id,
            started_at,
            status,
            source_batch_id,
            source_payload_hash,
            source_captured_at,
            source_window_started_at,
            source_window_ended_at
        `,
        [
          integrationSourceId,
          input.entityType,
          input.idempotencyKey ?? null,
          input.sourceBatchId ?? null,
          input.sourcePayloadHash ?? null,
          input.sourceCapturedAt ?? null,
          input.sourceWindowStartedAt ?? null,
          input.sourceWindowEndedAt ?? null,
          input.fileReference,
        ],
      );

      const batch = batchResult.rows[0];

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
          VALUES ($1, 'import_batch.created', 'stg.import_batch', $2::uuid, 'company', $3::jsonb)
        `,
        [
          auditActorUserId,
          batch.import_batch_id,
          JSON.stringify({
            correlationId: RequestContextStore.getCorrelationId(),
            requestedActorUserId: input.actorUserId,
            sourceCode: input.sourceCode,
            entityType: input.entityType,
            fileReference: input.fileReference,
            sourceBatchId: input.sourceBatchId ?? null,
            sourcePayloadHash: input.sourcePayloadHash ?? null,
            sourceCapturedAt: input.sourceCapturedAt ?? null,
            sourceWindowStartedAt: input.sourceWindowStartedAt ?? null,
            sourceWindowEndedAt: input.sourceWindowEndedAt ?? null,
          }),
        ],
      );

      if (input.rows && input.rows.length > 0) {
        for (const row of input.rows) {
          if (input.entityType === "employee") {
            await client.query(
              `
                INSERT INTO stg.employee_raw (
                  import_batch_id,
                  source_employee_id,
                  payload_json,
                  normalized_status,
                  processed_flag
                )
                VALUES ($1::uuid, $2, $3::jsonb, 'pending', FALSE)
              `,
              [
                batch.import_batch_id,
                String(row["sourceEmployeeId"] ?? row["employeeId"] ?? "unknown"),
                JSON.stringify(row),
              ],
            );
          }

          if (input.entityType === "store") {
            await client.query(
              `
                INSERT INTO stg.store_raw (
                  import_batch_id,
                  source_store_id,
                  payload_json,
                  normalized_status,
                  processed_flag
                )
                VALUES ($1::uuid, $2, $3::jsonb, 'pending', FALSE)
              `,
              [
                batch.import_batch_id,
                String(row["sourceStoreId"] ?? row["storeId"] ?? "unknown"),
                JSON.stringify(row),
              ],
            );
          }

          if (input.entityType === "kpi") {
            await client.query(
              `
                INSERT INTO stg.kpi_raw (
                  import_batch_id,
                  source_metric_id,
                  store_external_ref,
                  employee_external_ref,
                  period_start,
                  period_end,
                  payload_json,
                  normalized_status,
                  processed_flag
                )
                VALUES ($1::uuid, $2, $3, $4, $5::date, $6::date, $7::jsonb, 'pending', FALSE)
              `,
              [
                batch.import_batch_id,
                String(row["sourceMetricId"] ?? row["metricId"] ?? "unknown"),
                String(row["storeExternalRef"] ?? row["storeId"] ?? "unknown"),
                row["employeeExternalRef"] ? String(row["employeeExternalRef"]) : null,
                row["periodStart"] ? String(row["periodStart"]) : null,
                row["periodEnd"] ? String(row["periodEnd"]) : null,
                JSON.stringify(row),
              ],
            );
          }

          if (input.entityType === "assignment") {
            await client.query(
              `
                INSERT INTO stg.assignment_raw (
                  import_batch_id,
                  source_assignment_id,
                  source_employee_id,
                  source_store_id,
                  source_position_id,
                  payload_json,
                  normalized_status,
                  processed_flag
                )
                VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb, 'pending', FALSE)
              `,
              [
                batch.import_batch_id,
                String(row["sourceAssignmentId"] ?? row["assignmentId"] ?? "unknown"),
                row["sourceEmployeeId"] ? String(row["sourceEmployeeId"]) : null,
                row["sourceStoreId"] ? String(row["sourceStoreId"]) : null,
                row["sourcePositionId"] ? String(row["sourcePositionId"]) : null,
                JSON.stringify(row),
              ],
            );
          }

          if (input.entityType === "position") {
            await client.query(
              `
                INSERT INTO stg.position_raw (
                  import_batch_id,
                  source_position_id,
                  payload_json,
                  normalized_status,
                  processed_flag
                )
                VALUES ($1::uuid, $2, $3::jsonb, 'pending', FALSE)
              `,
              [
                batch.import_batch_id,
                String(
                  row["sourcePositionId"] ??
                    row["positionCode"] ??
                    row["positionId"] ??
                    "unknown",
                ),
                JSON.stringify(row),
              ],
            );
          }

          if (input.entityType === "company") {
            await client.query(
              `
                INSERT INTO stg.company_raw (
                  import_batch_id,
                  source_company_id,
                  payload_json,
                  normalized_status,
                  processed_flag
                )
                VALUES ($1::uuid, $2, $3::jsonb, 'pending', FALSE)
              `,
              [
                batch.import_batch_id,
                String(row["sourceCompanyId"] ?? row["companyCode"] ?? row["companyId"] ?? "unknown"),
                JSON.stringify(row),
              ],
            );
          }

          if (input.entityType === "region") {
            await client.query(
              `
                INSERT INTO stg.region_raw (
                  import_batch_id,
                  source_region_id,
                  source_company_id,
                  payload_json,
                  normalized_status,
                  processed_flag
                )
                VALUES ($1::uuid, $2, $3, $4::jsonb, 'pending', FALSE)
              `,
              [
                batch.import_batch_id,
                String(row["sourceRegionId"] ?? row["regionCode"] ?? row["regionId"] ?? "unknown"),
                row["sourceCompanyId"] ? String(row["sourceCompanyId"]) : null,
                JSON.stringify(row),
              ],
            );
          }
        }

        await client.query(
          `
            UPDATE stg.import_batch
            SET record_count = $2
            WHERE import_batch_id = $1::uuid
          `,
          [batch.import_batch_id, input.rows.length],
        );
      }

      return {
        batchId: batch.import_batch_id,
        status: batch.status,
        startedAt: batch.started_at,
        integrationSourceId,
        sourceBatchId: batch.source_batch_id,
        sourcePayloadHash: batch.source_payload_hash,
        sourceCapturedAt: batch.source_captured_at,
        sourceWindowStartedAt: batch.source_window_started_at,
        sourceWindowEndedAt: batch.source_window_ended_at,
        acceptedRowCount: input.rows?.length ?? 0,
        reused: false,
      };
    });
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

  async listImportBatches(input: {
    limit?: number;
    offset?: number;
    status?: string;
    entityType?: string;
    sourceCode?: string;
    startedFrom?: string;
    startedTo?: string;
  }) {
    const { params, whereClause } = this.buildImportBatchFilters(input);

    const totalResult = await this.databaseService.query<{ total_count: string }>(
      `
        SELECT COUNT(*)::text AS total_count
        FROM stg.import_batch
        INNER JOIN stg.integration_source src
          ON src.integration_source_id = stg.import_batch.integration_source_id
        ${whereClause}
      `,
      params,
    );

    const listParams = [...params, input.limit ?? 50, input.offset ?? 0];
    const result = await this.databaseService.query<{
      import_batch_id: string;
      integration_source_id: string;
      source_code: string;
      source_name: string;
      entity_type: string;
      source_batch_id: string | null;
      source_payload_hash: string | null;
      source_captured_at: string | null;
      source_window_started_at: string | null;
      source_window_ended_at: string | null;
      started_at: string;
      finished_at: string | null;
      status: string;
      raw_file_name: string | null;
      record_count: number;
      error_count: number;
      retry_count: number;
      last_retried_at: string | null;
    }>(
      `
        SELECT
          import_batch_id,
          integration_source_id,
          src.source_code,
          src.source_name,
          entity_type,
          source_batch_id,
          source_payload_hash,
          source_captured_at,
          source_window_started_at,
          source_window_ended_at,
          started_at,
          finished_at,
          status,
          raw_file_name,
          record_count,
          error_count,
          retry_count,
          last_retried_at
        FROM stg.import_batch
        INNER JOIN stg.integration_source src
          ON src.integration_source_id = stg.import_batch.integration_source_id
        ${whereClause}
        ORDER BY started_at DESC, import_batch_id DESC
        LIMIT $${params.length + 1}
        OFFSET $${params.length + 2}
      `,
      listParams,
    );

    return {
      rows: result.rows,
      total: Number(totalResult.rows[0]?.total_count ?? 0),
    };
  }

  async getImportBatchSummary(input: {
    status?: string;
    entityType?: string;
    sourceCode?: string;
    startedFrom?: string;
    startedTo?: string;
  }) {
    const { params, whereClause } = this.buildImportBatchFilters(input);

    const totalResult = await this.databaseService.query<{ total_count: string }>(
      `
        SELECT COUNT(*)::text AS total_count
        FROM stg.import_batch
        INNER JOIN stg.integration_source src
          ON src.integration_source_id = stg.import_batch.integration_source_id
        ${whereClause}
      `,
      params,
    );

    const groupedResult = await this.databaseService.query<{
      status: string;
      batch_count: string;
    }>(
      `
        SELECT status, COUNT(*)::text AS batch_count
        FROM stg.import_batch
        INNER JOIN stg.integration_source src
          ON src.integration_source_id = stg.import_batch.integration_source_id
        ${whereClause}
        GROUP BY status
      `,
      params,
    );

    const totals = {
      all: Number(totalResult.rows[0]?.total_count ?? 0),
      completed: 0,
      failed: 0,
      completedWithErrors: 0,
      pending: 0,
      queued: 0,
      processing: 0,
    };

    for (const row of groupedResult.rows) {
      if (row.status === "completed") totals.completed = Number(row.batch_count);
      if (row.status === "failed") totals.failed = Number(row.batch_count);
      if (row.status === "completed_with_errors") {
        totals.completedWithErrors = Number(row.batch_count);
      }
      if (row.status === "pending") totals.pending = Number(row.batch_count);
      if (row.status === "queued") totals.queued = Number(row.batch_count);
      if (row.status === "processing") totals.processing = Number(row.batch_count);
    }

    return totals;
  }

  async getLatestImportBatchIdByStatus(input: {
    status: string;
    entityType?: string;
    sourceCode?: string;
    startedFrom?: string;
    startedTo?: string;
  }) {
    const { conditions, params } = this.buildImportBatchFilters(input);
    params.push(input.status);
    conditions.push(`stg.import_batch.status = $${params.length}`);
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await this.databaseService.query<{ import_batch_id: string }>(
      `
        SELECT import_batch_id
        FROM stg.import_batch
        INNER JOIN stg.integration_source src
          ON src.integration_source_id = stg.import_batch.integration_source_id
        ${whereClause}
        ORDER BY started_at DESC, import_batch_id DESC
        LIMIT 1
      `,
      params,
    );

    return result.rows[0]?.import_batch_id ?? null;
  }

  async getImportBatchActionCounts(input: {
    status?: string;
    entityType?: string;
    sourceCode?: string;
    startedFrom?: string;
    startedTo?: string;
    stuckBefore: string;
  }) {
    const { params, whereClause } = this.buildImportBatchFilters(input, "b", "src");
    params.push(input.stuckBefore);
    const stuckBeforeParam = `$${params.length}::timestamptz`;

    const result = await this.databaseService.query<{
      blocked_count: string;
      retry_ready_count: string;
      needs_action_count: string;
      stuck_count: string;
    }>(
      `
        WITH filtered_batches AS (
          SELECT
            b.import_batch_id,
            b.status,
            b.started_at
          FROM stg.import_batch b
          INNER JOIN stg.integration_source src
            ON src.integration_source_id = b.integration_source_id
          ${whereClause}
        ),
        raw_all AS (
          ${this.getImportRawUnionSql()}
        ),
        per_batch AS (
          SELECT
            fb.import_batch_id,
            fb.status,
            fb.started_at,
            COALESCE(
              BOOL_OR(
                raw.normalized_status = 'retryable_error'
                AND (${this.getMissingDependencyPredicate("raw")})
              ),
              FALSE
            ) AS has_dependency_blockers,
            COALESCE(BOOL_OR(raw.normalized_status = 'retryable_error'), FALSE) AS has_retryable_error
          FROM filtered_batches fb
          LEFT JOIN raw_all raw
            ON raw.import_batch_id = fb.import_batch_id
          GROUP BY fb.import_batch_id, fb.status, fb.started_at
        ),
        action_totals AS (
          SELECT
            COUNT(*) FILTER (
              WHERE status IN ('failed', 'completed_with_errors')
                AND has_dependency_blockers
            )::text AS blocked_count,
            COUNT(*) FILTER (
              WHERE status IN ('failed', 'completed_with_errors')
                AND has_retryable_error
                AND NOT has_dependency_blockers
            )::text AS retry_ready_count,
            COUNT(*) FILTER (
              WHERE status IN ('failed', 'completed_with_errors')
                AND NOT has_retryable_error
            )::text AS needs_action_count,
            COUNT(*) FILTER (
              WHERE status IN ('pending', 'queued', 'processing')
                AND started_at < ${stuckBeforeParam}
            )::text AS stuck_count
          FROM per_batch
        )
        SELECT * FROM action_totals
      `,
      params,
    );

    return {
      blocked: Number(result.rows[0]?.blocked_count ?? 0),
      retryReady: Number(result.rows[0]?.retry_ready_count ?? 0),
      needsAction: Number(result.rows[0]?.needs_action_count ?? 0),
      stuck: Number(result.rows[0]?.stuck_count ?? 0),
    };
  }

  async getLatestStuckImportBatchId(input: {
    status?: string;
    entityType?: string;
    sourceCode?: string;
    startedFrom?: string;
    startedTo?: string;
    stuckBefore: string;
  }) {
    const { conditions, params } = this.buildImportBatchFilters(input);
    params.push(input.stuckBefore);
    conditions.push(`stg.import_batch.status IN ('pending', 'queued', 'processing')`);
    conditions.push(`stg.import_batch.started_at < $${params.length}::timestamptz`);
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await this.databaseService.query<{ import_batch_id: string }>(
      `
        SELECT /* latest_stuck_batch */ import_batch_id
        FROM stg.import_batch
        INNER JOIN stg.integration_source src
          ON src.integration_source_id = stg.import_batch.integration_source_id
        ${whereClause}
        ORDER BY started_at DESC, import_batch_id DESC
        LIMIT 1
      `,
      params,
    );

    return result.rows[0]?.import_batch_id ?? null;
  }

  async listImportBatchesNeedingAction(input: {
    limit?: number;
    offset?: number;
    status?: string;
    entityType?: string;
    sourceCode?: string;
    startedFrom?: string;
    startedTo?: string;
    stuckBefore: string;
  }) {
    const { params, whereClause } = this.buildImportBatchFilters(input, "b", "src");
    params.push(input.stuckBefore);
    const stuckBeforeParam = `$${params.length}::timestamptz`;

    const baseCte = `
      WITH filtered_batches AS (
        SELECT
          b.import_batch_id,
          b.integration_source_id,
          src.source_code,
          src.source_name,
          b.entity_type,
          b.source_batch_id,
          b.source_payload_hash,
          b.source_captured_at,
          b.source_window_started_at,
          b.source_window_ended_at,
          b.started_at,
          b.finished_at,
          b.status,
          b.raw_file_name,
          b.record_count,
          b.error_count,
          b.retry_count,
          b.last_retried_at
        FROM stg.import_batch b
        INNER JOIN stg.integration_source src
          ON src.integration_source_id = b.integration_source_id
        ${whereClause}
      ),
      raw_all AS (
        ${this.getImportRawUnionSql()}
      ),
      per_batch AS (
        SELECT
          fb.import_batch_id,
          fb.integration_source_id,
          fb.source_code,
          fb.source_name,
          fb.entity_type,
          fb.source_batch_id,
          fb.source_payload_hash,
          fb.source_captured_at,
          fb.source_window_started_at,
          fb.source_window_ended_at,
          fb.started_at,
          fb.finished_at,
          fb.status,
          fb.raw_file_name,
          fb.record_count,
          fb.error_count,
          fb.retry_count,
          fb.last_retried_at,
          COALESCE(
            BOOL_OR(
              raw.normalized_status = 'retryable_error'
              AND (${this.getMissingDependencyPredicate("raw")})
            ),
            FALSE
          ) AS has_dependency_blockers,
          COALESCE(BOOL_OR(raw.normalized_status = 'retryable_error'), FALSE) AS has_retryable_error
        FROM filtered_batches fb
        LEFT JOIN raw_all raw
          ON raw.import_batch_id = fb.import_batch_id
        GROUP BY
          fb.import_batch_id,
          fb.integration_source_id,
          fb.source_code,
          fb.source_name,
          fb.entity_type,
          fb.source_batch_id,
          fb.source_payload_hash,
          fb.source_captured_at,
          fb.source_window_started_at,
          fb.source_window_ended_at,
          fb.started_at,
          fb.finished_at,
          fb.status,
          fb.raw_file_name,
          fb.record_count,
          fb.error_count,
          fb.retry_count,
          fb.last_retried_at
      ),
      action_queue AS (
        SELECT
          import_batch_id,
          integration_source_id,
          source_code,
          source_name,
          entity_type,
          source_batch_id,
          source_payload_hash,
          source_captured_at,
          source_window_started_at,
          source_window_ended_at,
          started_at,
          finished_at,
          status,
          raw_file_name,
          record_count,
          error_count,
          retry_count,
          last_retried_at,
          CASE
            WHEN status IN ('pending', 'queued', 'processing') AND started_at < ${stuckBeforeParam} THEN 'stuck'
            WHEN status IN ('failed', 'completed_with_errors') AND has_dependency_blockers THEN 'blocked'
            WHEN status IN ('failed', 'completed_with_errors') AND has_retryable_error AND NOT has_dependency_blockers THEN 'retry_ready'
            WHEN status IN ('failed', 'completed_with_errors') AND NOT has_retryable_error THEN 'needs_action'
            ELSE NULL
          END AS health_state,
          CASE
            WHEN status IN ('pending', 'queued', 'processing') AND started_at < ${stuckBeforeParam} THEN 'Batch has exceeded the in-progress time threshold'
            WHEN status IN ('failed', 'completed_with_errors') AND has_dependency_blockers THEN 'Missing dependency mappings detected'
            WHEN status IN ('failed', 'completed_with_errors') AND has_retryable_error AND NOT has_dependency_blockers THEN 'Retryable write errors remain'
            WHEN status IN ('failed', 'completed_with_errors') AND NOT has_retryable_error THEN 'Batch requires manual review before retry'
            ELSE NULL
          END AS action_reason,
          CASE
            WHEN status IN ('pending', 'queued', 'processing') AND started_at < ${stuckBeforeParam} THEN 'Inspect worker execution and consider retrying after the root cause is fixed'
            WHEN status IN ('failed', 'completed_with_errors') AND has_dependency_blockers THEN 'Import the missing dependency entity types before retrying'
            WHEN status IN ('failed', 'completed_with_errors') AND has_retryable_error AND NOT has_dependency_blockers THEN 'Retry the batch now'
            WHEN status IN ('failed', 'completed_with_errors') AND NOT has_retryable_error THEN 'Inspect batch errors and correct the source data before retrying'
            ELSE NULL
          END AS recommended_action,
          CASE
            WHEN status IN ('pending', 'queued', 'processing') AND started_at < ${stuckBeforeParam} THEN TRUE
            ELSE FALSE
          END AS is_stuck
        FROM per_batch
        WHERE
          (status IN ('pending', 'queued', 'processing') AND started_at < ${stuckBeforeParam})
          OR status IN ('failed', 'completed_with_errors')
      )
    `;

    const totalResult = await this.databaseService.query<{ total_count: string }>(
      `
        ${baseCte}
        SELECT COUNT(*)::text AS total_count
        FROM action_queue
        WHERE health_state IS NOT NULL
      `,
      params,
    );

    const listParams = [...params, input.limit ?? 50, input.offset ?? 0];
    const result = await this.databaseService.query<{
      import_batch_id: string;
      integration_source_id: string;
      source_code: string;
      source_name: string;
      entity_type: string;
      source_batch_id: string | null;
      source_payload_hash: string | null;
      source_captured_at: string | null;
      source_window_started_at: string | null;
      source_window_ended_at: string | null;
      started_at: string;
      finished_at: string | null;
      status: string;
      raw_file_name: string | null;
      record_count: number;
      error_count: number;
      retry_count: number;
      last_retried_at: string | null;
      health_state: string;
      action_reason: string;
      recommended_action: string;
      is_stuck: boolean;
    }>(
      `
        ${baseCte}
        SELECT *
        FROM action_queue
        WHERE health_state IS NOT NULL
        ORDER BY started_at DESC, import_batch_id DESC
        LIMIT $${params.length + 1}
        OFFSET $${params.length + 2}
      `,
      listParams,
    );

    return {
      rows: result.rows,
      total: Number(totalResult.rows[0]?.total_count ?? 0),
    };
  }

  async getImportBatch(batchId: string) {
    const result = await this.databaseService.query<{
      import_batch_id: string;
      integration_source_id: string;
      source_code: string;
      source_name: string;
      entity_type:
        | "employee"
        | "store"
        | "kpi"
        | "assignment"
        | "position"
        | "company"
        | "region";
      source_batch_id: string | null;
      source_payload_hash: string | null;
      source_captured_at: string | null;
      source_window_started_at: string | null;
      source_window_ended_at: string | null;
      started_at: string;
      finished_at: string | null;
      status: string;
      raw_file_name: string | null;
      record_count: number;
      error_count: number;
      retry_count: number;
      last_retried_at: string | null;
    }>(
      `
        SELECT
          b.import_batch_id,
          b.integration_source_id,
          src.source_code,
          src.source_name,
          b.entity_type,
          b.source_batch_id,
          b.source_payload_hash,
          b.source_captured_at,
          b.source_window_started_at,
          b.source_window_ended_at,
          b.started_at,
          b.finished_at,
          b.status,
          b.raw_file_name,
          b.record_count,
          b.error_count,
          b.retry_count,
          b.last_retried_at
        FROM stg.import_batch b
        INNER JOIN stg.integration_source src
          ON src.integration_source_id = b.integration_source_id
        WHERE b.import_batch_id = $1
        LIMIT 1
      `,
      [batchId],
    );

    return result.rows[0] ?? null;
  }

  async getImportBatchRowStatusSummary(
    batchId: string,
    entityType:
      | "employee"
      | "store"
      | "kpi"
      | "assignment"
      | "position"
      | "company"
      | "region",
  ) {
    const metadata = this.getRawTableMetadata(entityType);
    const result = await this.databaseService.query<{
      normalized_status: string;
      row_count: string;
    }>(
      `
        SELECT normalized_status, COUNT(*)::text AS row_count
        FROM ${metadata.tableName}
        WHERE import_batch_id = $1
        GROUP BY normalized_status
      `,
      [batchId],
    );

    return result.rows;
  }

  async getImportBatchErrors(input: {
    batchId: string;
    entityType:
      | "employee"
      | "store"
      | "kpi"
      | "assignment"
      | "position"
      | "company"
      | "region";
    limit?: number;
    offset?: number;
  }) {
    const metadata = this.getRawTableMetadata(input.entityType);
    const filterClause = `
      WHERE import_batch_id = $1
        AND normalized_status IN ('validation_failed', 'retryable_error')
    `;

    const totalResult = await this.databaseService.query<{ total_count: string }>(
      `
        SELECT COUNT(*)::text AS total_count
        FROM ${metadata.tableName}
        ${filterClause}
      `,
      [input.batchId],
    );

    const params: unknown[] = [input.batchId, input.limit ?? 50, input.offset ?? 0];
    const result = await this.databaseService.query<{
      row_id: string;
      source_ref: string;
      normalized_status: string;
      validation_error: string | null;
      processed_at: string | null;
    }>(
      `
        SELECT
          ${metadata.rowIdColumn} AS row_id,
          ${metadata.sourceRefColumn} AS source_ref,
          normalized_status,
          validation_error,
          processed_at
        FROM ${metadata.tableName}
        ${filterClause}
        ORDER BY processed_at DESC NULLS LAST, ${metadata.rowIdColumn} ASC
        LIMIT $2
        OFFSET $3
      `,
      params,
    );

    return {
      rows: result.rows,
      total: Number(totalResult.rows[0]?.total_count ?? 0),
    };
  }

  async getImportBatchDependencySummary(
    batchId: string,
    entityType:
      | "employee"
      | "store"
      | "kpi"
      | "assignment"
      | "position"
      | "company"
      | "region",
  ) {
    const metadata = this.getRawTableMetadata(entityType);
    const result = await this.databaseService.query<{
      employee_count: string;
      store_count: string;
      position_count: string;
      region_count: string;
      company_count: string;
      manager_count: string;
    }>(
      `
        SELECT
          SUM(CASE WHEN validation_error ILIKE '%employee reference could not be resolved%' THEN 1 ELSE 0 END)::text AS employee_count,
          SUM(CASE WHEN validation_error ILIKE '%store reference could not be resolved%' THEN 1 ELSE 0 END)::text AS store_count,
          SUM(CASE WHEN validation_error ILIKE '%position reference could not be resolved%' THEN 1 ELSE 0 END)::text AS position_count,
          SUM(CASE WHEN validation_error ILIKE '%region could not be resolved%' THEN 1 ELSE 0 END)::text AS region_count,
          SUM(CASE WHEN validation_error ILIKE '%company could not be resolved%' THEN 1 ELSE 0 END)::text AS company_count,
          SUM(CASE WHEN validation_error ILIKE '%manager%could not be resolved%' THEN 1 ELSE 0 END)::text AS manager_count
        FROM ${metadata.tableName}
        WHERE import_batch_id = $1
          AND normalized_status = 'retryable_error'
      `,
      [batchId],
    );

    return result.rows[0] ?? null;
  }

  async markImportBatchPending(batchId: string) {
    await this.databaseService.query(
      `
        UPDATE stg.import_batch
        SET
          status = 'pending',
          finished_at = NULL,
          retry_count = retry_count + 1,
          last_retried_at = NOW()
        WHERE import_batch_id = $1
      `,
      [batchId],
    );
  }

  async getImportBatchAudit(batchId: string) {
    const result = await this.databaseService.query<{
      event_log_id: string;
      occurred_at: string;
      actor_user_id: string | null;
      event_type: string;
      metadata_json: Record<string, unknown>;
    }>(
      `
        SELECT
          event_log_id,
          occurred_at,
          actor_user_id,
          event_type,
          metadata_json
        FROM audit.event_log
        WHERE entity_name = 'stg.import_batch'
          AND entity_id = $1::uuid
        ORDER BY occurred_at ASC, event_log_id ASC
      `,
      [batchId],
    );

    return result.rows;
  }

  async recordImportBatchRetried(input: {
    batchId: string;
    actorUserId: string;
    entityType: string;
    retryCount: number;
  }) {
    const auditActorUserId = await this.resolveAuditActorUserId(input.actorUserId);

    await this.databaseService.query(
      `
        INSERT INTO audit.event_log (
          actor_user_id,
          event_type,
          entity_name,
          entity_id,
          scope_type,
          metadata_json
        )
        VALUES ($1::uuid, 'import_batch.retried', 'stg.import_batch', $2::uuid, 'company', $3::jsonb)
      `,
      [
        auditActorUserId,
        input.batchId,
        JSON.stringify({
          correlationId: RequestContextStore.getCorrelationId(),
          requestedActorUserId: input.actorUserId,
          entityType: input.entityType,
          retryCount: input.retryCount,
        }),
      ],
    );
  }
}
