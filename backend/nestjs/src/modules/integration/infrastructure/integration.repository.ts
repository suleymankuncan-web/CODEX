import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PoolClient } from "pg";
import { RequestContextStore } from "../../../shared/request-context";
import { DatabaseService } from "../../../shared/database/database.service";
import { AccessLifecycleRepository } from "../../auth/access-lifecycle.repository";
import {
  ImportBatchRawWriterRepository,
  type ImportBatchEntityType,
} from "./import-batch-raw-writer.repository";
import { PersonnelMasterCommandRepository } from "./personnel-master-command.repository";

@Injectable()
export class IntegrationRepository {
  private readonly personnelMasterCommands: PersonnelMasterCommandRepository;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly importBatchRawWriterRepository: ImportBatchRawWriterRepository,
    private readonly accessLifecycleRepository: AccessLifecycleRepository,
  ) {
    this.personnelMasterCommands = new PersonnelMasterCommandRepository(
      databaseService,
      accessLifecycleRepository,
    );
  }

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

  async updatePersonnelMaster(
    input: Parameters<PersonnelMasterCommandRepository["updatePersonnelMaster"]>[0],
  ) {
    return this.personnelMasterCommands.updatePersonnelMaster(input);
  }

  async createPersonnelMaster(
    input: Parameters<PersonnelMasterCommandRepository["createPersonnelMaster"]>[0],
  ) {
    return this.personnelMasterCommands.createPersonnelMaster(input);
  }

  async terminatePersonnelMaster(
    input: Parameters<PersonnelMasterCommandRepository["terminatePersonnelMaster"]>[0],
  ) {
    return this.personnelMasterCommands.terminatePersonnelMaster(input);
  }

  async createImportBatch(input: {
    actorCompanyIds: string[];
    sourceCode: string;
    entityType: ImportBatchEntityType;
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
        await this.importBatchRawWriterRepository.writeRawRows({
          client,
          batchId: batch.import_batch_id,
          entityType: input.entityType,
          rows: input.rows,
        });
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

  async updateKpiImportStoreScope(input: {
    actorCompanyIds: string[];
    storeId: string;
    storeType: "company" | "franchise" | "operator";
    regionId: string;
    status: "active" | "inactive" | "closed";
    kpiImportEnabled: boolean;
    actorUserId: string;
    expectedUpdatedAt?: string;
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const auditActorUserId = await this.resolveAuditActorUserId(input.actorUserId, client);
      const currentResult = await client.query<{
        store_id: string;
        is_current: boolean;
      }>(
        `
          SELECT
            s.store_id::text AS store_id,
            ($4::timestamptz IS NULL OR s.updated_at = $4::timestamptz) AS is_current
          FROM ops.store s
          INNER JOIN ops.region r
            ON r.region_id = $2::uuid
           AND r.status = 'active'
           AND r.company_id = s.company_id
          WHERE s.store_id = $1::uuid
            AND s.company_id = ANY($3::uuid[])
          FOR UPDATE OF s
        `,
        [
          input.storeId,
          input.regionId,
          input.actorCompanyIds,
          input.expectedUpdatedAt ?? null,
        ],
      );
      const currentStore = currentResult.rows[0] ?? null;
      if (!currentStore) {
        return null;
      }
      if (!currentStore.is_current) {
        throw new ConflictException("Store master data changed after it was loaded");
      }

      const result = await client.query<{
        store_id: string;
        store_code: string;
        store_name: string;
        store_type: string;
        status: string;
        kpi_import_enabled: boolean;
        region_id: string | null;
        region_name: string | null;
        updated_at: string;
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
            r.region_name,
            s.updated_at::text AS updated_at
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


  async createStoreMaster(input: {
    actorCompanyIds: string[];
    actorUserId: string;
    storeCode: string;
    storeName: string;
    storeType: "company" | "franchise" | "operator";
    regionId: string;
    status: "active" | "inactive" | "closed";
    kpiImportEnabled: boolean;
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const auditActorUserId = await this.resolveAuditActorUserId(input.actorUserId, client);
      const regionResult = await client.query<{ company_id: string }>(
        `
          SELECT company_id::text AS company_id
          FROM ops.region
          WHERE region_id = $1::uuid
            AND company_id = ANY($2::uuid[])
            AND status = 'active'
          LIMIT 1
        `,
        [input.regionId, input.actorCompanyIds],
      );
      const companyId = regionResult.rows[0]?.company_id;
      if (!companyId) return null;

      const duplicateResult = await client.query<{ store_id: string }>(
        `SELECT store_id::text AS store_id FROM ops.store WHERE UPPER(store_code) = UPPER($1) LIMIT 1`,
        [input.storeCode],
      );
      if (duplicateResult.rows[0]) {
        throw new ConflictException("Store code is already in use");
      }

      const storeResult = await client.query<{
        store_id: string;
        store_code: string;
        store_name: string;
        store_type: string;
        status: string;
        kpi_import_enabled: boolean;
        region_id: string;
        region_name: string;
        region_manager_user_id: string | null;
        region_manager_name: string | null;
        updated_at: string;
      }>(
        `
          WITH inserted AS (
            INSERT INTO ops.store (
              company_id, region_id, store_code, store_name, store_type,
              status, kpi_import_enabled, timezone
            )
            VALUES ($1::uuid, $2::uuid, BTRIM($3), BTRIM($4), $5, $6, $7, 'Europe/Istanbul')
            RETURNING *
          )
          SELECT
            inserted.store_id::text AS store_id,
            inserted.store_code,
            inserted.store_name,
            inserted.store_type,
            inserted.status,
            inserted.kpi_import_enabled,
            r.region_id::text AS region_id,
            r.region_name,
            manager.user_id AS region_manager_user_id,
            manager.display_name AS region_manager_name,
            inserted.updated_at::text AS updated_at
          FROM inserted
          INNER JOIN ops.region r ON r.region_id = inserted.region_id
          LEFT JOIN LATERAL (
            SELECT
              ua.user_id::text AS user_id,
              COALESCE(NULLIF(BTRIM(CONCAT(e.first_name, ' ', e.last_name)), ''), ua.username, ua.email) AS display_name
            FROM ops.user_role_assignment ura
            INNER JOIN ops.role role ON role.role_id = ura.role_id AND role.role_code = 'REGION_MANAGER'
            INNER JOIN ops.user_account ua ON ua.user_id = ura.user_id AND ua.is_active = TRUE
            LEFT JOIN ops.employee e ON e.employee_id = ua.employee_id
            WHERE ura.region_id = inserted.region_id
              AND ura.scope_type = 'region'
              AND ura.start_at <= NOW()
              AND (ura.end_at IS NULL OR ura.end_at > NOW())
            ORDER BY ura.start_at DESC, ura.created_at DESC
            LIMIT 1
          ) manager ON TRUE
        `,
        [
          companyId,
          input.regionId,
          input.storeCode,
          input.storeName,
          input.storeType,
          input.status,
          input.kpiImportEnabled,
        ],
      );
      const store = storeResult.rows[0];
      if (!store) return null;

      await client.query(
        `
          INSERT INTO audit.event_log (
            actor_user_id, event_type, entity_name, entity_id, scope_type, metadata_json
          )
          VALUES ($1::uuid, 'store_master_data.created', 'ops.store', $2::uuid, 'company', $3::jsonb)
        `,
        [
          auditActorUserId,
          store.store_id,
          JSON.stringify({
            correlationId: RequestContextStore.getCorrelationId(),
            requestedActorUserId: input.actorUserId,
            regionId: input.regionId,
            storeCode: store.store_code,
          }),
        ],
      );
      return store;
    });
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
