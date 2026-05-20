import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PoolClient } from "pg";
import { RequestContextStore } from "../../../shared/request-context";
import { DatabaseService } from "../../../shared/database/database.service";
import {
  ImportBatchRawWriterRepository,
  type ImportBatchEntityType,
} from "./import-batch-raw-writer.repository";

@Injectable()
export class IntegrationRepository {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly importBatchRawWriterRepository: ImportBatchRawWriterRepository,
  ) {}

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

  async listPersonnelMaster(input: {
    actorCompanyIds: string[];
    q?: string;
    status?: "active" | "inactive" | "terminated";
    storeId?: string;
    limit?: number;
    offset?: number;
  }) {
    const conditions: string[] = ["e.company_id = ANY($1::uuid[])"];
    const params: unknown[] = [input.actorCompanyIds];

    const search = input.q?.trim();
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(
        e.external_employee_ref ILIKE $${params.length}
        OR e.first_name ILIKE $${params.length}
        OR e.last_name ILIKE $${params.length}
        OR CONCAT(e.first_name, ' ', e.last_name) ILIKE $${params.length}
        OR s.store_name ILIKE $${params.length}
        OR s.store_code ILIKE $${params.length}
        OR p.position_name ILIKE $${params.length}
      )`);
    }

    if (input.status) {
      params.push(input.status);
      conditions.push(`e.employment_status = $${params.length}`);
    }

    if (input.storeId) {
      params.push(input.storeId);
      conditions.push(`assignment.store_id = $${params.length}::uuid`);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;
    const fromClause = `
      FROM ops.employee e
      LEFT JOIN LATERAL (
        SELECT
          eah.assignment_id,
          eah.store_id,
          eah.region_id,
          eah.position_id,
          eah.start_date
        FROM ops.employee_assignment_history eah
        WHERE eah.employee_id = e.employee_id
          AND eah.is_primary_assignment = TRUE
          AND eah.assignment_status = 'active'
          AND eah.end_date IS NULL
        ORDER BY eah.start_date DESC, eah.created_at DESC
        LIMIT 1
      ) assignment ON TRUE
      LEFT JOIN ops.store s
        ON s.store_id = assignment.store_id
      LEFT JOIN ops.region r
        ON r.region_id = assignment.region_id
      LEFT JOIN ops.position p
        ON p.position_id = assignment.position_id
    `;

    const totalResult = await this.databaseService.query<{ total_count: string }>(
      `
        SELECT COUNT(*)::text AS total_count
        ${fromClause}
        ${whereClause}
      `,
      params,
    );

    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;
    const listParams = [...params, limit, offset];
    const result = await this.databaseService.query<{
      employee_id: string;
      external_employee_ref: string | null;
      first_name: string;
      last_name: string;
      hire_date: string;
      termination_date: string | null;
      employment_status: string;
      employment_type: string;
      assignment_id: string | null;
      assignment_start_date: string | null;
      store_id: string | null;
      store_code: string | null;
      store_name: string | null;
      region_id: string | null;
      region_name: string | null;
      position_id: string | null;
      position_code: string | null;
      position_name: string | null;
    }>(
      `
        SELECT
          e.employee_id::text AS employee_id,
          e.external_employee_ref,
          e.first_name,
          e.last_name,
          e.hire_date::text AS hire_date,
          e.termination_date::text AS termination_date,
          e.employment_status,
          e.employment_type,
          assignment.assignment_id::text AS assignment_id,
          assignment.start_date::text AS assignment_start_date,
          s.store_id::text AS store_id,
          s.store_code,
          s.store_name,
          r.region_id::text AS region_id,
          r.region_name,
          p.position_id::text AS position_id,
          p.position_code,
          p.position_name
        ${fromClause}
        ${whereClause}
        ORDER BY e.first_name ASC, e.last_name ASC, e.external_employee_ref ASC
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

  async listPersonnelMasterLookups(input: { actorCompanyIds: string[] }) {
    const [stores, positions] = await Promise.all([
      this.databaseService.query<{
        store_id: string;
        store_code: string;
        store_name: string;
        region_id: string;
        region_name: string;
      }>(
        `
          SELECT
            s.store_id::text AS store_id,
            s.store_code,
            s.store_name,
            r.region_id::text AS region_id,
            r.region_name
          FROM ops.store s
          INNER JOIN ops.region r
            ON r.region_id = s.region_id
          WHERE s.company_id = ANY($1::uuid[])
            AND s.status = 'active'
          ORDER BY s.store_name ASC, s.store_code ASC
        `,
        [input.actorCompanyIds],
      ),
      this.databaseService.query<{
        position_id: string;
        position_code: string;
        position_name: string;
        is_managerial: boolean;
      }>(
        `
          SELECT
            p.position_id::text AS position_id,
            p.position_code,
            p.position_name,
            p.is_managerial
          FROM ops.position p
          WHERE p.company_id = ANY($1::uuid[])
          ORDER BY p.is_managerial DESC, p.position_name ASC, p.position_code ASC
        `,
        [input.actorCompanyIds],
      ),
    ]);

    return {
      stores: stores.rows,
      positions: positions.rows,
    };
  }

  async updatePersonnelMaster(input: {
    actorCompanyIds: string[];
    employeeId: string;
    firstName: string;
    lastName: string;
    externalEmployeeRef?: string;
    employmentStatus: "active" | "inactive" | "terminated";
    employmentType: "full_time" | "part_time" | "temporary";
    hireDate: string;
    storeId: string;
    positionId: string;
    assignmentStartDate?: string;
    actorUserId: string;
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const auditActorUserId = await this.resolveAuditActorUserId(input.actorUserId, client);
      const employeeResult = await client.query<{ employee_id: string; company_id: string }>(
        `
          SELECT employee_id::text AS employee_id, company_id::text AS company_id
          FROM ops.employee
          WHERE employee_id = $1::uuid
            AND company_id = ANY($2::uuid[])
          LIMIT 1
        `,
        [input.employeeId, input.actorCompanyIds],
      );
      const employee = employeeResult.rows[0] ?? null;
      if (!employee) {
        return null;
      }

      const storeResult = await client.query<{
        store_id: string;
        region_id: string;
        company_id: string;
      }>(
        `
          SELECT
            s.store_id::text AS store_id,
            s.region_id::text AS region_id,
            s.company_id::text AS company_id
          FROM ops.store s
          WHERE s.store_id = $1::uuid
            AND s.company_id = $2::uuid
          LIMIT 1
        `,
        [input.storeId, employee.company_id],
      );
      const store = storeResult.rows[0] ?? null;
      if (!store) {
        return null;
      }

      const positionResult = await client.query<{ position_id: string }>(
        `
          SELECT p.position_id::text AS position_id
          FROM ops.position p
          WHERE p.position_id = $1::uuid
            AND p.company_id = $2::uuid
          LIMIT 1
        `,
        [input.positionId, employee.company_id],
      );
      if (!positionResult.rows[0]) {
        return null;
      }

      await client.query(
        `
          UPDATE ops.employee
          SET
            external_employee_ref = NULLIF(BTRIM($2), ''),
            first_name = BTRIM($3),
            last_name = BTRIM($4),
            employment_status = $5,
            employment_type = $6,
            hire_date = $7::date
          WHERE employee_id = $1::uuid
        `,
        [
          input.employeeId,
          input.externalEmployeeRef ?? "",
          input.firstName,
          input.lastName,
          input.employmentStatus,
          input.employmentType,
          input.hireDate,
        ],
      );

      const assignmentStartDate = input.assignmentStartDate ?? input.hireDate;
      const assignmentResult = await client.query<{ assignment_id: string }>(
        `
          SELECT assignment_id::text AS assignment_id
          FROM ops.employee_assignment_history
          WHERE employee_id = $1::uuid
            AND is_primary_assignment = TRUE
            AND assignment_status = 'active'
            AND end_date IS NULL
          ORDER BY start_date DESC, created_at DESC
          LIMIT 1
        `,
        [input.employeeId],
      );
      const assignmentId = assignmentResult.rows[0]?.assignment_id ?? null;

      if (assignmentId) {
        await client.query(
          `
            UPDATE ops.employee_assignment_history
            SET
              store_id = $2::uuid,
              region_id = $3::uuid,
              position_id = $4::uuid,
              start_date = $5::date
            WHERE assignment_id = $1::uuid
          `,
          [
            assignmentId,
            store.store_id,
            store.region_id,
            input.positionId,
            assignmentStartDate,
          ],
        );
      } else {
        await client.query(
          `
            INSERT INTO ops.employee_assignment_history (
              employee_id,
              store_id,
              region_id,
              position_id,
              start_date,
              is_primary_assignment,
              assignment_status
            )
            VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::date, TRUE, 'active')
          `,
          [
            input.employeeId,
            store.store_id,
            store.region_id,
            input.positionId,
            assignmentStartDate,
          ],
        );
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
          VALUES ($1::uuid, 'personnel_master_data.updated', 'ops.employee', $2::uuid, 'company', $3::jsonb)
        `,
        [
          auditActorUserId,
          input.employeeId,
          JSON.stringify({
            correlationId: RequestContextStore.getCorrelationId(),
            requestedActorUserId: input.actorUserId,
            storeId: store.store_id,
            regionId: store.region_id,
            positionId: input.positionId,
            employmentStatus: input.employmentStatus,
            employmentType: input.employmentType,
          }),
        ],
      );

      const updated = await client.query<{
        employee_id: string;
        external_employee_ref: string | null;
        first_name: string;
        last_name: string;
        hire_date: string;
        termination_date: string | null;
        employment_status: string;
        employment_type: string;
        assignment_id: string | null;
        assignment_start_date: string | null;
        store_id: string | null;
        store_code: string | null;
        store_name: string | null;
        region_id: string | null;
        region_name: string | null;
        position_id: string | null;
        position_code: string | null;
        position_name: string | null;
      }>(
        `
          SELECT
            e.employee_id::text AS employee_id,
            e.external_employee_ref,
            e.first_name,
            e.last_name,
            e.hire_date::text AS hire_date,
            e.termination_date::text AS termination_date,
            e.employment_status,
            e.employment_type,
            assignment.assignment_id::text AS assignment_id,
            assignment.start_date::text AS assignment_start_date,
            s.store_id::text AS store_id,
            s.store_code,
            s.store_name,
            r.region_id::text AS region_id,
            r.region_name,
            p.position_id::text AS position_id,
            p.position_code,
            p.position_name
          FROM ops.employee e
          LEFT JOIN LATERAL (
            SELECT
              eah.assignment_id,
              eah.store_id,
              eah.region_id,
              eah.position_id,
              eah.start_date
            FROM ops.employee_assignment_history eah
            WHERE eah.employee_id = e.employee_id
              AND eah.is_primary_assignment = TRUE
              AND eah.assignment_status = 'active'
              AND eah.end_date IS NULL
            ORDER BY eah.start_date DESC, eah.created_at DESC
            LIMIT 1
          ) assignment ON TRUE
          LEFT JOIN ops.store s
            ON s.store_id = assignment.store_id
          LEFT JOIN ops.region r
            ON r.region_id = assignment.region_id
          LEFT JOIN ops.position p
            ON p.position_id = assignment.position_id
          WHERE e.employee_id = $1::uuid
        `,
        [input.employeeId],
      );

      return updated.rows[0] ?? null;
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
