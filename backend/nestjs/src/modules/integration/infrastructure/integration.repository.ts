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
      actorCompanyIds: string[];
      status?: string;
      entityType?: string;
      sourceCode?: string;
      startedFrom?: string;
      startedTo?: string;
    },
    batchAlias = "stg.import_batch",
    sourceAlias = "src",
  ) {
    const conditions: string[] = [`${batchAlias}.company_ids && $1::uuid[]`];
    const params: unknown[] = [input.actorCompanyIds];

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
    actorCompanyIds: string[];
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
              AND company_ids && $2::uuid[]
            LIMIT 1
          `,
          [input.idempotencyKey, input.actorCompanyIds],
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
              AND company_ids && $4::uuid[]
            LIMIT 1
          `,
          [integrationSourceId, input.entityType, input.sourceBatchId, input.actorCompanyIds],
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
            company_ids,
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
          VALUES ($1, $2::uuid[], $3, $4, $5, $6, $7::timestamptz, $8::timestamptz, $9::timestamptz, 'pending', $10, 0, 0)
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
          input.actorCompanyIds,
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
            companyIds: input.actorCompanyIds,
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
                  row_hash,
                  raw_row_reference,
                  normalized_status,
                  processed_flag
                )
                VALUES ($1::uuid, $2, $3, $4, $5::date, $6::date, $7::jsonb, $8, $9, 'pending', FALSE)
              `,
              [
                batch.import_batch_id,
                String(row["sourceMetricId"] ?? row["metricId"] ?? "unknown"),
                String(row["storeExternalRef"] ?? row["storeId"] ?? "unknown"),
                row["employeeExternalRef"] ? String(row["employeeExternalRef"]) : null,
                row["periodStart"] ? String(row["periodStart"]) : null,
                row["periodEnd"] ? String(row["periodEnd"]) : null,
                JSON.stringify(row),
                row["rowHash"] ? String(row["rowHash"]) : null,
                row["rawRowReference"] ? String(row["rawRowReference"]) : null,
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

  async listExternalIdMapCandidates(input: {
    actorCompanyIds: string[];
    entityType: "employee" | "store";
    q?: string;
    limit: number;
  }) {
    const search = `%${(input.q ?? "").trim()}%`;

    if (input.entityType === "store") {
      const result = await this.databaseService.query<{
        internal_id: string;
        label: string;
        secondary_label: string;
      }>(
        `
          SELECT
            store_id::text AS internal_id,
            store_name AS label,
            CONCAT(store_code, ' / ', status) AS secondary_label
          FROM ops.store
          WHERE status = 'active'
            AND company_id = ANY($1::uuid[])
            AND (
              $2 = '%%'
              OR store_name ILIKE $2
              OR store_code ILIKE $2
            )
          ORDER BY store_name ASC, store_code ASC
          LIMIT $3
        `,
        [input.actorCompanyIds, search, input.limit],
      );

      return result.rows;
    }

    const result = await this.databaseService.query<{
      internal_id: string;
      label: string;
      secondary_label: string;
    }>(
      `
        SELECT
          employee_id::text AS internal_id,
          TRIM(CONCAT(first_name, ' ', last_name)) AS label,
          CONCAT(COALESCE(external_employee_ref, 'no external ref'), ' / ', employment_status)
            AS secondary_label
        FROM ops.employee
        WHERE employment_status = 'active'
          AND company_id = ANY($1::uuid[])
          AND (
            $2 = '%%'
            OR first_name ILIKE $2
            OR last_name ILIKE $2
            OR external_employee_ref ILIKE $2
            OR CONCAT(first_name, ' ', last_name) ILIKE $2
          )
        ORDER BY first_name ASC, last_name ASC, employee_id ASC
        LIMIT $3
      `,
      [input.actorCompanyIds, search, input.limit],
    );

    return result.rows;
  }

  async getScopedExternalIdMappingTarget(input: {
    actorCompanyIds: string[];
    entityType: "employee" | "store";
    internalId: string;
  }) {
    if (input.entityType === "store") {
      const result = await this.databaseService.query<{ internal_id: string }>(
        `
          SELECT store_id::text AS internal_id
          FROM ops.store
          WHERE store_id = $1::uuid
            AND company_id = ANY($2::uuid[])
            AND status = 'active'
          LIMIT 1
        `,
        [input.internalId, input.actorCompanyIds],
      );

      return result.rows[0] ?? null;
    }

    const result = await this.databaseService.query<{ internal_id: string }>(
      `
        SELECT employee_id::text AS internal_id
        FROM ops.employee
        WHERE employee_id = $1::uuid
          AND company_id = ANY($2::uuid[])
          AND employment_status = 'active'
        LIMIT 1
      `,
      [input.internalId, input.actorCompanyIds],
    );

    return result.rows[0] ?? null;
  }

  async listKpiImportStoreExternalRefs(input: {
    integrationSourceId: string;
    actorCompanyIds: string[];
  }) {
    const result = await this.databaseService.query<{ external_ref: string }>(
      `
        SELECT DISTINCT external_ref
        FROM (
          SELECT s.store_name AS external_ref
          FROM ops.store s
          WHERE s.status = 'active'
            AND s.kpi_import_enabled = TRUE
            AND s.company_id = ANY($2::uuid[])

          UNION

          SELECT s.store_code AS external_ref
          FROM ops.store s
          WHERE s.status = 'active'
            AND s.kpi_import_enabled = TRUE
            AND s.company_id = ANY($2::uuid[])

          UNION

          SELECT map.external_id AS external_ref
          FROM stg.external_id_map map
          INNER JOIN ops.store s
            ON s.store_id = map.internal_id
          WHERE map.integration_source_id = $1::uuid
            AND map.entity_type = 'store'
            AND map.is_active = TRUE
            AND s.status = 'active'
            AND s.kpi_import_enabled = TRUE
            AND s.company_id = ANY($2::uuid[])
        ) refs
        WHERE external_ref IS NOT NULL
          AND BTRIM(external_ref) <> ''
        ORDER BY external_ref ASC
      `,
      [input.integrationSourceId, input.actorCompanyIds],
    );

    return result.rows;
  }

  async listKpiImportStoreScope(input: {
    actorCompanyIds: string[];
    q?: string;
    enabled?: boolean;
    status?: "active" | "inactive" | "closed";
    limit?: number;
    offset?: number;
  }) {
    const conditions: string[] = ["s.company_id = ANY($1::uuid[])"];
    const params: unknown[] = [input.actorCompanyIds];

    const search = input.q?.trim();
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(
        s.store_name ILIKE $${params.length}
        OR s.store_code ILIKE $${params.length}
        OR r.region_name ILIKE $${params.length}
      )`);
    }

    if (typeof input.enabled === "boolean") {
      params.push(input.enabled);
      conditions.push(`s.kpi_import_enabled = $${params.length}`);
    }

    if (input.status) {
      params.push(input.status);
      conditions.push(`s.status = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const totalResult = await this.databaseService.query<{ total_count: string }>(
      `
        SELECT COUNT(*)::text AS total_count
        FROM ops.store s
        LEFT JOIN ops.region r
          ON r.region_id = s.region_id
        ${whereClause}
      `,
      params,
    );

    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;
    const listParams = [...params, limit, offset];
    const result = await this.databaseService.query<{
      store_id: string;
      store_code: string;
      store_name: string;
      store_type: string;
      status: string;
      kpi_import_enabled: boolean;
      region_id: string | null;
      region_name: string | null;
    }>(
      `
        SELECT
          s.store_id::text AS store_id,
          s.store_code,
          s.store_name,
          s.store_type,
          s.status,
          s.kpi_import_enabled,
          r.region_id::text AS region_id,
          r.region_name
        FROM ops.store s
        LEFT JOIN ops.region r
          ON r.region_id = s.region_id
        ${whereClause}
        ORDER BY s.store_name ASC, s.store_code ASC
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

  async listStoreMasterRegions(input: { actorCompanyIds: string[] }) {
    const result = await this.databaseService.query<{
      region_id: string;
      region_code: string;
      region_name: string;
    }>(
      `
        SELECT
          r.region_id::text AS region_id,
          r.region_code,
          r.region_name
        FROM ops.region r
        WHERE r.status = 'active'
          AND r.company_id = ANY($1::uuid[])
        ORDER BY r.region_name ASC, r.region_code ASC
      `,
      [input.actorCompanyIds],
    );

    return result.rows;
  }

  async updateKpiImportStoreScope(input: {
    actorCompanyIds: string[];
    storeId: string;
    storeType: "company" | "franchise" | "operator";
    regionId: string;
    status: "active" | "inactive" | "closed";
    kpiImportEnabled: boolean;
    actorUserId: string;
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const auditActorUserId = await this.resolveAuditActorUserId(input.actorUserId, client);
      const result = await client.query<{
        store_id: string;
        store_code: string;
        store_name: string;
        store_type: string;
        status: string;
        kpi_import_enabled: boolean;
        region_id: string | null;
        region_name: string | null;
      }>(
        `
          UPDATE ops.store s
          SET
            store_type = $2,
            region_id = $3::uuid,
            status = $4,
            kpi_import_enabled = $5
          FROM ops.region r
          WHERE s.store_id = $1::uuid
            AND r.region_id = $3::uuid
            AND r.status = 'active'
            AND s.company_id = ANY($6::uuid[])
            AND r.company_id = s.company_id
          RETURNING
            s.store_id::text AS store_id,
            s.store_code,
            s.store_name,
            s.store_type,
            s.status,
            s.kpi_import_enabled,
            r.region_id::text AS region_id,
            r.region_name
        `,
        [
          input.storeId,
          input.storeType,
          input.regionId,
          input.status,
          input.kpiImportEnabled,
          input.actorCompanyIds,
        ],
      );

      const store = result.rows[0] ?? null;
      if (!store) {
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
          VALUES ($1::uuid, 'store_master_data.updated', 'ops.store', $2::uuid, 'company', $3::jsonb)
        `,
        [
          auditActorUserId,
          input.storeId,
          JSON.stringify({
            correlationId: RequestContextStore.getCorrelationId(),
            requestedActorUserId: input.actorUserId,
            storeType: input.storeType,
            regionId: input.regionId,
            status: input.status,
            kpiImportEnabled: input.kpiImportEnabled,
          }),
        ],
      );

      return store;
    });
  }

  async listImportBatches(input: {
    actorCompanyIds: string[];
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
    actorCompanyIds: string[];
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
    actorCompanyIds: string[];
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
    actorCompanyIds: string[];
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
    actorCompanyIds: string[];
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
    actorCompanyIds: string[];
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

  async getImportBatch(input: { actorCompanyIds: string[]; batchId: string }) {
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
          AND b.company_ids && $2::uuid[]
        LIMIT 1
      `,
      [input.batchId, input.actorCompanyIds],
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

  async getImportBatchLineageSummary(batchId: string) {
    const result = await this.databaseService.query<{
      row_hash_count: string;
      raw_row_reference_count: string;
      sample_row_hash: string | null;
      sample_raw_row_reference: string | null;
    }>(
      `
        SELECT
          COUNT(*) FILTER (WHERE row_hash IS NOT NULL)::text AS row_hash_count,
          COUNT(*) FILTER (WHERE raw_row_reference IS NOT NULL)::text AS raw_row_reference_count,
          MIN(row_hash) FILTER (WHERE row_hash IS NOT NULL) AS sample_row_hash,
          MIN(raw_row_reference) FILTER (WHERE raw_row_reference IS NOT NULL) AS sample_raw_row_reference
        FROM stg.kpi_raw
        WHERE import_batch_id = $1
      `,
      [batchId],
    );

    return result.rows[0] ?? null;
  }

  async getImportBatchQualityIssueRows(
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
      validation_error: string | null;
      row_count: string;
    }>(
      `
        SELECT
          normalized_status,
          validation_error,
          COUNT(*)::text AS row_count
        FROM ${metadata.tableName}
        WHERE import_batch_id = $1
          AND normalized_status IN ('validation_failed', 'retryable_error')
        GROUP BY validation_error, normalized_status
        ORDER BY COUNT(*) DESC, normalized_status ASC, validation_error ASC
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
      store_external_ref: string | null;
      employee_external_ref: string | null;
      payload_json: Record<string, unknown> | null;
      row_hash: string | null;
      raw_row_reference: string | null;
      normalized_status: string;
      validation_error: string | null;
      processed_at: string | null;
    }>(
      `
        SELECT
          ${metadata.rowIdColumn} AS row_id,
          ${metadata.sourceRefColumn} AS source_ref,
          ${input.entityType === "kpi" ? "store_external_ref" : "NULL::text"} AS store_external_ref,
          ${input.entityType === "kpi" ? "employee_external_ref" : "NULL::text"} AS employee_external_ref,
          payload_json,
          ${input.entityType === "kpi" ? "row_hash" : "NULL::text"} AS row_hash,
          ${input.entityType === "kpi" ? "raw_row_reference" : "NULL::text"} AS raw_row_reference,
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

  async markImportBatchPending(input: { actorCompanyIds: string[]; batchId: string }) {
    await this.databaseService.query(
      `
        UPDATE stg.import_batch
        SET
          status = 'pending',
          finished_at = NULL,
          retry_count = retry_count + 1,
          last_retried_at = NOW()
        WHERE import_batch_id = $1
          AND company_ids && $2::uuid[]
      `,
      [input.batchId, input.actorCompanyIds],
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

  async recordExternalIdMappingApproved(input: {
    actorUserId: string;
    integrationSourceId: string;
    entityType: string;
    externalId: string;
    internalId: string;
    internalTableName: string;
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
        VALUES ($1::uuid, 'external_id_mapping.approved', 'stg.external_id_map', NULL, 'company', $2::jsonb)
      `,
      [
        auditActorUserId,
        JSON.stringify({
          correlationId: RequestContextStore.getCorrelationId(),
          requestedActorUserId: input.actorUserId,
          integrationSourceId: input.integrationSourceId,
          entityType: input.entityType,
          externalId: input.externalId,
          internalId: input.internalId,
          internalTableName: input.internalTableName,
        }),
      ],
    );
  }
}
