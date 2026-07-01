import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import {
  auditBootstrapBatchCreated,
  auditBootstrapBatchValidated,
  auditBootstrapRowsPromoted,
} from "./master-data-bootstrap-audit.helper";

export type BootstrapEntity = "store" | "personnel";

export type BootstrapValidationStatus =
  | "pending"
  | "valid"
  | "needs_review"
  | "invalid"
  | "promoted";

type BootstrapBatchRow = {
  master_data_bootstrap_batch_id: string;
  company_id: string;
  bootstrap_entity: BootstrapEntity;
  source_label: string;
  file_reference: string | null;
  uploaded_by_user_id: string;
  batch_status: string;
  row_count: number;
  valid_count: number;
  needs_review_count: number;
  invalid_count: number;
  promoted_count: number;
  created_at: string;
  validated_at?: string | null;
  promoted_at?: string | null;
};

type BootstrapStagedRowRecord = {
  master_data_bootstrap_row_id: string;
  master_data_bootstrap_batch_id: string;
  row_number: number;
  row_hash: string;
  source_store_code: string | null;
  source_employee_code: string | null;
  raw_payload_json: Record<string, unknown>;
  normalized_payload_json: Record<string, unknown>;
  validation_status: BootstrapValidationStatus;
  issue_code: string | null;
  issue_message: string | null;
  resolved_company_id: string | null;
  resolved_region_id: string | null;
  resolved_store_id: string | null;
  resolved_employee_id: string | null;
  resolved_position_id: string | null;
  promoted_entity_id: string | null;
  created_at: string;
  updated_at: string;
};

type BootstrapBatchQueueRecord = BootstrapBatchRow & {
  pending_count: number;
};

export type BootstrapBatch = {
  batchId: string;
  companyId: string;
  bootstrapEntity: BootstrapEntity;
  sourceLabel: string;
  fileReference: string | null;
  uploadedByUserId: string;
  batchStatus: string;
  rowCount: number;
  validCount: number;
  needsReviewCount: number;
  invalidCount: number;
  promotedCount: number;
  createdAt: string;
  validatedAt: string | null;
  promotedAt: string | null;
};

export type BootstrapStagedRow = {
  rowId: string;
  batchId: string;
  rowNumber: number;
  rowHash: string;
  sourceStoreCode: string | null;
  sourceEmployeeCode: string | null;
  rawPayload: Record<string, unknown>;
  normalizedPayload: Record<string, unknown>;
  validationStatus: BootstrapValidationStatus;
  issueCode: string | null;
  issueMessage: string | null;
  resolvedCompanyId: string | null;
  resolvedRegionId: string | null;
  resolvedStoreId: string | null;
  resolvedEmployeeId: string | null;
  resolvedPositionId: string | null;
  promotedEntityId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BootstrapValidationResult = {
  rowId: string;
  validationStatus: "valid" | "needs_review" | "invalid";
  issueCode: string | null;
  issueMessage: string | null;
  resolvedCompanyId: string | null;
  resolvedRegionId: string | null;
  resolvedStoreId: string | null;
  resolvedEmployeeId: string | null;
  resolvedPositionId: string | null;
};

export type BootstrapResolvedStore = {
  storeId: string;
  regionId: string;
};

export type BootstrapValidationSummary = {
  batchId: string;
  batchStatus: string;
  rowCount: number;
  validCount: number;
  needsReviewCount: number;
  invalidCount: number;
  promotedCount: number;
};

export type BootstrapStorePromotionSummary = BootstrapValidationSummary & {
  promotedRows: Array<{
    rowId: string;
    promotedEntityId: string;
  }>;
};

export type BootstrapPersonnelPromotionSummary = BootstrapValidationSummary & {
  promotedRows: Array<{
    rowId: string;
    promotedEntityId: string;
    assignmentId: string;
  }>;
};

export type BootstrapBatchQueueItem = BootstrapBatch & {
  pendingCount: number;
};

export type BootstrapReadinessFilter =
  | "needs_validation"
  | "needs_review"
  | "ready_to_promote"
  | "closed";

@Injectable()
export class MasterDataBootstrapRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async createBootstrapBatch(input: {
    companyId: string;
    bootstrapEntity: BootstrapEntity;
    sourceLabel: string;
    fileReference?: string;
    uploadedByUserId: string;
    rows: Array<{
      rowNumber: number;
      rowHash: string;
      sourceStoreCode: string | null;
      sourceEmployeeCode: string | null;
      rawPayload: Record<string, unknown>;
      normalizedPayload: Record<string, unknown>;
      validationStatus: BootstrapValidationStatus;
    }>;
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const batchResult = await client.query<BootstrapBatchRow>(
        `
          INSERT INTO stg.master_data_bootstrap_batch (
            company_id,
            bootstrap_entity,
            source_label,
            file_reference,
            uploaded_by_user_id,
            row_count
          )
          VALUES ($1::uuid, $2, $3, $4, $5, $6::integer)
          RETURNING
            master_data_bootstrap_batch_id,
            company_id,
            bootstrap_entity,
            source_label,
            file_reference,
            uploaded_by_user_id,
            batch_status,
            row_count,
            valid_count,
            needs_review_count,
            invalid_count,
            promoted_count,
            created_at
        `,
        [
          input.companyId,
          input.bootstrapEntity,
          input.sourceLabel,
          input.fileReference ?? null,
          input.uploadedByUserId,
          input.rows.length,
        ],
      );
      const batch = batchResult.rows[0];

      for (const row of input.rows) {
        await client.query(
          `
            INSERT INTO stg.master_data_bootstrap_row (
              master_data_bootstrap_batch_id,
              row_number,
              row_hash,
              source_store_code,
              source_employee_code,
              raw_payload_json,
              normalized_payload_json,
              validation_status
            )
            VALUES ($1::uuid, $2::integer, $3, $4, $5, $6::jsonb, $7::jsonb, $8)
          `,
          [
            batch.master_data_bootstrap_batch_id,
            row.rowNumber,
            row.rowHash,
            row.sourceStoreCode,
            row.sourceEmployeeCode,
            JSON.stringify(row.rawPayload),
            JSON.stringify(row.normalizedPayload),
            row.validationStatus,
          ],
        );
      }
      await auditBootstrapBatchCreated(client, input, batch.master_data_bootstrap_batch_id);
      return mapBootstrapBatch(batch);
    });
  }
  async getBootstrapBatchForActor(input: {
    batchId: string;
    companyIds: string[];
  }): Promise<BootstrapBatch | null> {
    if (input.companyIds.length === 0) {
      return null;
    }
    const result = await this.databaseService.query<BootstrapBatchRow>(
      `
        SELECT
          master_data_bootstrap_batch_id,
          company_id,
          bootstrap_entity,
          source_label,
          file_reference,
          uploaded_by_user_id,
          batch_status,
          row_count,
          valid_count,
          needs_review_count,
          invalid_count,
          promoted_count,
          created_at,
          validated_at,
          promoted_at
        FROM stg.master_data_bootstrap_batch
        WHERE master_data_bootstrap_batch_id = $1::uuid
          AND company_id = ANY($2::uuid[])
      `,
      [input.batchId, input.companyIds],
    );
    return result.rows[0] ? mapBootstrapBatch(result.rows[0]) : null;
  }
  async listBootstrapBatches(input: {
    companyIds: string[];
    bootstrapEntity?: BootstrapEntity;
    batchStatus?: string;
    readiness?: BootstrapReadinessFilter;
    q?: string;
    limit: number;
    offset: number;
  }): Promise<{ rows: BootstrapBatchQueueItem[]; total: number }> {
    if (input.companyIds.length === 0) {
      return { rows: [], total: 0 };
    }
    const params: unknown[] = [input.companyIds];
    const filters = ["company_id = ANY($1::uuid[])"];
    if (input.bootstrapEntity) {
      params.push(input.bootstrapEntity);
      filters.push(`bootstrap_entity = $${params.length}`);
    }
    if (input.batchStatus) {
      params.push(input.batchStatus);
      filters.push(`batch_status = $${params.length}`);
    }
    if (input.q) {
      params.push(`%${input.q.trim()}%`);
      filters.push(
        `(source_label ILIKE $${params.length} OR file_reference ILIKE $${params.length})`,
      );
    }
    const readinessClause = buildBootstrapReadinessSql(input.readiness);
    if (readinessClause) {
      filters.push(readinessClause);
    }
    const whereClause = `WHERE ${filters.join(" AND ")}`;
    const selectSql = `
      SELECT
        master_data_bootstrap_batch_id,
        company_id,
        bootstrap_entity,
        source_label,
        file_reference,
        uploaded_by_user_id,
        batch_status,
        row_count,
        valid_count,
        needs_review_count,
        invalid_count,
        promoted_count,
        GREATEST(
          row_count - valid_count - needs_review_count - invalid_count - promoted_count,
          0
        )::integer AS pending_count,
        created_at,
        validated_at,
        promoted_at
      FROM stg.master_data_bootstrap_batch
      ${whereClause}
    `;
    const totalResult = await this.databaseService.query<{ total_count: string }>(
      `SELECT COUNT(*)::text AS total_count FROM (${selectSql}) batches`,
      params,
    );
    params.push(input.limit, input.offset);
    const result = await this.databaseService.query<BootstrapBatchQueueRecord>(
      `
        ${selectSql}
        ORDER BY created_at DESC, master_data_bootstrap_batch_id DESC
        LIMIT $${params.length - 1}
        OFFSET $${params.length}
      `,
      params,
    );
    return {
      rows: result.rows.map(mapBootstrapBatchQueueItem),
      total: Number(totalResult.rows[0]?.total_count ?? 0),
    };
  }
  async listBootstrapRows(batchId: string): Promise<BootstrapStagedRow[]> {
    const result = await this.databaseService.query<BootstrapStagedRowRecord>(
      `
        SELECT
          master_data_bootstrap_row_id,
          master_data_bootstrap_batch_id,
          row_number,
          row_hash,
          source_store_code,
          source_employee_code,
          raw_payload_json,
          normalized_payload_json,
          validation_status,
          issue_code,
          issue_message,
          resolved_company_id,
          resolved_region_id,
          resolved_store_id,
          resolved_employee_id,
          resolved_position_id,
          promoted_entity_id,
          created_at,
          updated_at
        FROM stg.master_data_bootstrap_row
        WHERE master_data_bootstrap_batch_id = $1::uuid
        ORDER BY row_number ASC, master_data_bootstrap_row_id ASC
      `,
      [batchId],
    );
    return result.rows.map(mapBootstrapStagedRow);
  }

  async listBootstrapRowsForReview(input: {
    batchId: string;
    companyIds: string[];
    validationStatus?: BootstrapValidationStatus;
    issueCode?: string;
    q?: string;
    limit: number;
    offset: number;
  }): Promise<{ rows: BootstrapStagedRow[]; total: number }> {
    if (input.companyIds.length === 0) {
      return { rows: [], total: 0 };
    }

    const params: unknown[] = [input.batchId, input.companyIds];
    const filters = [
      "r.master_data_bootstrap_batch_id = $1::uuid",
      "b.company_id = ANY($2::uuid[])",
    ];

    if (input.validationStatus) {
      params.push(input.validationStatus);
      filters.push(`r.validation_status = $${params.length}`);
    }

    if (input.issueCode) {
      params.push(input.issueCode);
      filters.push(`r.issue_code = $${params.length}`);
    }

    if (input.q) {
      params.push(`%${input.q.trim()}%`);
      filters.push(
        `(r.source_store_code ILIKE $${params.length} OR r.source_employee_code ILIKE $${params.length})`,
      );
    }

    const whereClause = `WHERE ${filters.join(" AND ")}`;
    const fromSql = `
      FROM stg.master_data_bootstrap_row r
      INNER JOIN stg.master_data_bootstrap_batch b
        ON b.master_data_bootstrap_batch_id = r.master_data_bootstrap_batch_id
      ${whereClause}
    `;

    const totalResult = await this.databaseService.query<{ total_count: string }>(
      `SELECT COUNT(*)::text AS total_count ${fromSql}`,
      params,
    );

    params.push(input.limit, input.offset);
    const result = await this.databaseService.query<BootstrapStagedRowRecord>(
      `
        SELECT
          r.master_data_bootstrap_row_id,
          r.master_data_bootstrap_batch_id,
          r.row_number,
          r.row_hash,
          r.source_store_code,
          r.source_employee_code,
          r.raw_payload_json,
          r.normalized_payload_json,
          r.validation_status,
          r.issue_code,
          r.issue_message,
          r.resolved_company_id,
          r.resolved_region_id,
          r.resolved_store_id,
          r.resolved_employee_id,
          r.resolved_position_id,
          r.promoted_entity_id,
          r.created_at,
          r.updated_at
        ${fromSql}
        ORDER BY
          CASE r.validation_status
            WHEN 'invalid' THEN 1
            WHEN 'needs_review' THEN 2
            WHEN 'pending' THEN 3
            WHEN 'valid' THEN 4
            WHEN 'promoted' THEN 5
            ELSE 6
          END ASC,
          r.row_number ASC,
          r.master_data_bootstrap_row_id ASC
        LIMIT $${params.length - 1}
        OFFSET $${params.length}
      `,
      params,
    );

    return {
      rows: result.rows.map(mapBootstrapStagedRow),
      total: Number(totalResult.rows[0]?.total_count ?? 0),
    };
  }

  async resolveStoreByCode(
    companyId: string,
    normalizedStoreCode: string,
  ): Promise<BootstrapResolvedStore | null> {
    const result = await this.databaseService.query<{
      store_id: string;
      region_id: string;
    }>(
      `
        SELECT
          store_id::text AS store_id,
          region_id::text AS region_id
        FROM ops.store
        WHERE company_id = $1::uuid
          AND UPPER(REGEXP_REPLACE(store_code, '[\\s-]', '', 'g')) = $2
        LIMIT 1
      `,
      [companyId, normalizedStoreCode],
    );

    const row = result.rows[0];
    return row ? { storeId: row.store_id, regionId: row.region_id } : null;
  }

  async resolveRegionByCode(
    companyId: string,
    normalizedRegionCode: string,
  ): Promise<string | null> {
    const result = await this.databaseService.query<{ region_id: string }>(
      `
        SELECT region_id::text AS region_id
        FROM ops.region
        WHERE company_id = $1::uuid
          AND UPPER(REGEXP_REPLACE(region_code, '[\\s-]+', '_', 'g')) = $2
        LIMIT 1
      `,
      [companyId, normalizedRegionCode],
    );

    return result.rows[0]?.region_id ?? null;
  }

  async resolveEmployeeByCode(
    companyId: string,
    normalizedEmployeeCode: string,
  ): Promise<string | null> {
    const result = await this.databaseService.query<{ employee_id: string }>(
      `
        SELECT employee_id::text AS employee_id
        FROM ops.employee
        WHERE company_id = $1::uuid
          AND UPPER(REGEXP_REPLACE(COALESCE(external_employee_ref, ''), '[\\s-]', '', 'g')) = $2
        LIMIT 1
      `,
      [companyId, normalizedEmployeeCode],
    );

    return result.rows[0]?.employee_id ?? null;
  }

  async resolveEmployeeByNationalIdHash(
    companyId: string,
    normalizedNationalIdHash: string,
  ): Promise<string | null> {
    const result = await this.databaseService.query<{ employee_id: string }>(
      `
        SELECT employee_id::text AS employee_id
        FROM ops.employee
        WHERE company_id = $1::uuid
          AND national_id_hash = $2
        LIMIT 1
      `,
      [companyId, normalizedNationalIdHash],
    );

    return result.rows[0]?.employee_id ?? null;
  }

  async resolvePositionByCode(
    companyId: string,
    normalizedPositionCode: string,
  ): Promise<string | null> {
    const result = await this.databaseService.query<{ position_id: string }>(
      `
        SELECT position_id::text AS position_id
        FROM ops.position
        WHERE company_id = $1::uuid
          AND UPPER(REGEXP_REPLACE(position_code, '\\s+', '_', 'g')) = $2
        LIMIT 1
      `,
      [companyId, normalizedPositionCode],
    );

    return result.rows[0]?.position_id ?? null;
  }

  async updateBootstrapRowValidationResults(input: {
    actorUserId?: string;
    batchId: string;
    bootstrapEntity?: BootstrapEntity;
    companyId?: string;
    results: BootstrapValidationResult[];
  }): Promise<BootstrapValidationSummary | null> {
    return this.databaseService.withTransaction(async (client) => {
      for (const result of input.results) {
        await client.query(
          `
            UPDATE stg.master_data_bootstrap_row
            SET
              validation_status = $3,
              issue_code = $4,
              issue_message = $5,
              resolved_company_id = $6::uuid,
              resolved_region_id = $7::uuid,
              resolved_store_id = $8::uuid,
              resolved_employee_id = $9::uuid,
              resolved_position_id = $10::uuid,
              updated_at = NOW()
            WHERE master_data_bootstrap_row_id = $1::uuid
              AND master_data_bootstrap_batch_id = $2::uuid
          `,
          [
            result.rowId,
            input.batchId,
            result.validationStatus,
            result.issueCode,
            result.issueMessage,
            result.resolvedCompanyId,
            result.resolvedRegionId,
            result.resolvedStoreId,
            result.resolvedEmployeeId,
            result.resolvedPositionId,
          ],
        );
      }

      const batchResult = await client.query<{
        master_data_bootstrap_batch_id: string;
        batch_status: string;
        row_count: number;
        valid_count: number;
        needs_review_count: number;
        invalid_count: number;
        promoted_count: number;
      }>(
        `
          WITH row_counts AS (
            SELECT
              COUNT(*)::integer AS row_count,
              COUNT(*) FILTER (WHERE validation_status = 'valid')::integer AS valid_count,
              COUNT(*) FILTER (WHERE validation_status = 'needs_review')::integer AS needs_review_count,
              COUNT(*) FILTER (WHERE validation_status = 'invalid')::integer AS invalid_count,
              COUNT(*) FILTER (WHERE validation_status = 'promoted')::integer AS promoted_count,
              COUNT(*) FILTER (WHERE validation_status = 'pending')::integer AS pending_count
            FROM stg.master_data_bootstrap_row
            WHERE master_data_bootstrap_batch_id = $1::uuid
          )
          UPDATE stg.master_data_bootstrap_batch b
          SET
            batch_status = CASE
              WHEN row_counts.pending_count = 0
                AND row_counts.invalid_count = 0
                AND row_counts.needs_review_count = 0
              THEN 'ready_to_promote'
              ELSE 'validated'
            END,
            row_count = row_counts.row_count,
            valid_count = row_counts.valid_count,
            needs_review_count = row_counts.needs_review_count,
            invalid_count = row_counts.invalid_count,
            promoted_count = row_counts.promoted_count,
            validated_at = NOW()
          FROM row_counts
          WHERE b.master_data_bootstrap_batch_id = $1::uuid
          RETURNING
            b.master_data_bootstrap_batch_id,
            b.batch_status,
            b.row_count,
            b.valid_count,
            b.needs_review_count,
            b.invalid_count,
            b.promoted_count
        `,
        [input.batchId],
      );

      const batch = batchResult.rows[0];
      if (batch) await auditBootstrapBatchValidated(client, input, batch);
      return batch
        ? {
            batchId: batch.master_data_bootstrap_batch_id,
            batchStatus: batch.batch_status,
            rowCount: batch.row_count,
            validCount: batch.valid_count,
            needsReviewCount: batch.needs_review_count,
            invalidCount: batch.invalid_count,
            promotedCount: batch.promoted_count,
          }
        : null;
    });
  }

  async promoteStoreBootstrapRows(input: {
    actorUserId?: string;
    batchId: string;
    companyId?: string;
    rows: Array<{
      rowId: string;
      companyId: string;
      regionId: string;
      storeCode: string;
      storeName: string;
      storeType: string;
      status: string;
      kpiImportEnabled: boolean;
    }>;
  }): Promise<BootstrapStorePromotionSummary> {
    return this.databaseService.withTransaction(async (client) => {
      const promotedRows: Array<{ rowId: string; promotedEntityId: string }> = [];

      for (const row of input.rows) {
        const storeResult = await client.query<{ store_id: string }>(
          `
            INSERT INTO ops.store (
              company_id,
              region_id,
              store_code,
              store_name,
              store_type,
              status,
              kpi_import_enabled
            )
            VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::boolean)
            ON CONFLICT (store_code) DO UPDATE
            SET
              region_id = EXCLUDED.region_id,
              store_name = EXCLUDED.store_name,
              store_type = EXCLUDED.store_type,
              status = EXCLUDED.status,
              kpi_import_enabled = EXCLUDED.kpi_import_enabled
            WHERE ops.store.company_id = EXCLUDED.company_id
            RETURNING store_id::text AS store_id
          `,
          [
            row.companyId,
            row.regionId,
            row.storeCode,
            row.storeName,
            row.storeType,
            row.status,
            row.kpiImportEnabled,
          ],
        );
        const promotedEntityId = storeResult.rows[0]?.store_id;
        if (!promotedEntityId) {
          throw new Error(
            `Store code conflict belongs to another company: ${row.storeCode}`,
          );
        }

        const rowUpdateResult = await client.query(
          `
            UPDATE stg.master_data_bootstrap_row
            SET
              validation_status = 'promoted',
              promoted_entity_id = $3::uuid,
              updated_at = NOW()
            WHERE master_data_bootstrap_row_id = $1::uuid
              AND master_data_bootstrap_batch_id = $2::uuid
              AND validation_status = 'valid'
          `,
          [row.rowId, input.batchId, promotedEntityId],
        );
        if (rowUpdateResult.rowCount !== 1) {
          throw new Error(
            `Store bootstrap row was not marked promoted: ${row.rowId}`,
          );
        }

        promotedRows.push({
          rowId: row.rowId,
          promotedEntityId,
        });
      }

      const batchResult = await client.query<{
        master_data_bootstrap_batch_id: string;
        batch_status: string;
        row_count: number;
        valid_count: number;
        needs_review_count: number;
        invalid_count: number;
        promoted_count: number;
      }>(
        `
          WITH row_counts AS (
            SELECT
              COUNT(*)::integer AS row_count,
              COUNT(*) FILTER (WHERE validation_status = 'valid')::integer AS valid_count,
              COUNT(*) FILTER (WHERE validation_status = 'needs_review')::integer AS needs_review_count,
              COUNT(*) FILTER (WHERE validation_status = 'invalid')::integer AS invalid_count,
              COUNT(*) FILTER (WHERE validation_status = 'promoted')::integer AS promoted_count
            FROM stg.master_data_bootstrap_row
            WHERE master_data_bootstrap_batch_id = $1::uuid
          )
          UPDATE stg.master_data_bootstrap_batch b
          SET
            batch_status = CASE
              WHEN row_counts.row_count = row_counts.promoted_count
              THEN 'promoted'
              ELSE 'ready_to_promote'
            END,
            row_count = row_counts.row_count,
            valid_count = row_counts.valid_count,
            needs_review_count = row_counts.needs_review_count,
            invalid_count = row_counts.invalid_count,
            promoted_count = row_counts.promoted_count,
            promoted_at = CASE
              WHEN row_counts.row_count = row_counts.promoted_count
              THEN NOW()
              ELSE b.promoted_at
            END
          FROM row_counts
          WHERE b.master_data_bootstrap_batch_id = $1::uuid
          RETURNING
            b.master_data_bootstrap_batch_id,
            b.batch_status,
            b.row_count,
            b.valid_count,
            b.needs_review_count,
            b.invalid_count,
            b.promoted_count
        `,
        [input.batchId],
      );

      const batch = batchResult.rows[0];
      if (!batch) {
        throw new Error(`Store bootstrap batch was not refreshed: ${input.batchId}`);
      }

      await auditBootstrapRowsPromoted(client, input, batch, promotedRows.length, "master_data_bootstrap.stores.promoted");
      return {
        batchId: batch.master_data_bootstrap_batch_id,
        batchStatus: batch.batch_status,
        rowCount: batch.row_count,
        validCount: batch.valid_count,
        needsReviewCount: batch.needs_review_count,
        invalidCount: batch.invalid_count,
        promotedCount: batch.promoted_count,
        promotedRows,
      };
    });
  }

  async promotePersonnelBootstrapRows(input: {
    actorUserId?: string;
    batchId: string;
    companyId?: string;
    rows: Array<{
      rowId: string;
      companyId: string;
      storeId: string;
      regionId: string;
      positionId: string;
      employeeId: string | null;
      employeeCode: string;
      firstName: string;
      lastName: string;
      nationalIdHash: string | null;
      hireDate: string;
      employmentType: string;
    }>;
  }): Promise<BootstrapPersonnelPromotionSummary> {
    return this.databaseService.withTransaction(async (client) => {
      const promotedRows: Array<{
        rowId: string;
        promotedEntityId: string;
        assignmentId: string;
      }> = [];

      for (const row of input.rows) {
        const employeeResult = await client.query<{ employee_id: string }>(
          `
            WITH existing_employee AS (
              SELECT employee_id
              FROM ops.employee
              WHERE company_id = $1::uuid
                AND UPPER(REGEXP_REPLACE(COALESCE(external_employee_ref, ''), '[\\s-]', '', 'g')) = $2
              ORDER BY employee_id
              LIMIT 1
            ),
            target_employee AS (
              SELECT COALESCE($8::uuid, (SELECT employee_id FROM existing_employee)) AS employee_id
            ),
            updated_employee AS (
              UPDATE ops.employee
              SET
                external_employee_ref = $2,
                first_name = $3,
                last_name = $4,
                national_id_hash = $5::text,
                hire_date = $6::date,
                termination_date = NULL,
                employment_status = 'active',
                employment_type = $7
              WHERE employee_id = (SELECT employee_id FROM target_employee)
              RETURNING employee_id::text AS employee_id
            ),
            inserted_employee AS (
              INSERT INTO ops.employee (
                company_id,
                external_employee_ref,
                first_name,
                last_name,
                national_id_hash,
                hire_date,
                employment_status,
                employment_type
              )
              SELECT $1::uuid, $2, $3, $4, $5::text, $6::date, 'active', $7
              WHERE (SELECT employee_id FROM target_employee) IS NULL
              RETURNING employee_id::text AS employee_id
            )
            SELECT employee_id FROM updated_employee
            UNION ALL
            SELECT employee_id FROM inserted_employee
          `,
          [
            row.companyId,
            row.employeeCode,
            row.firstName,
            row.lastName,
            row.nationalIdHash,
            row.hireDate,
            row.employmentType,
            row.employeeId,
          ],
        );
        const promotedEntityId = employeeResult.rows[0]?.employee_id;
        if (!promotedEntityId) {
          throw new Error(
            `Personnel bootstrap employee was not upserted: ${row.rowId}`,
          );
        }

        await client.query(
          `
            UPDATE ops.employee_assignment_history
            SET
              end_date = GREATEST(start_date, $5::date),
              assignment_status = 'inactive'
            WHERE employee_id = $1::uuid
              AND is_primary_assignment = TRUE
              AND assignment_status = 'active'
              AND end_date IS NULL
              AND (store_id <> $2::uuid OR position_id <> $4::uuid)
          `,
          [
            promotedEntityId,
            row.storeId,
            row.regionId,
            row.positionId,
            row.hireDate,
          ],
        );

        const assignmentResult = await client.query<{ assignment_id: string }>(
          `
            WITH existing_assignment AS (
              SELECT assignment_id
              FROM ops.employee_assignment_history
              WHERE employee_id = $1::uuid
                AND store_id = $2::uuid
                AND position_id = $4::uuid
                AND is_primary_assignment = TRUE
                AND assignment_status = 'active'
                AND end_date IS NULL
              ORDER BY start_date DESC, assignment_id
              LIMIT 1
            ),
            updated_assignment AS (
              UPDATE ops.employee_assignment_history
              SET
                region_id = $3::uuid,
                start_date = LEAST(start_date, $5::date),
                is_primary_assignment = TRUE,
                fte_ratio = 1.00,
                assignment_status = 'active'
              WHERE assignment_id = (SELECT assignment_id FROM existing_assignment)
              RETURNING assignment_id::text AS assignment_id
            ),
            inserted_assignment AS (
              INSERT INTO ops.employee_assignment_history (
                employee_id,
                store_id,
                region_id,
                position_id,
                start_date,
                is_primary_assignment,
                fte_ratio,
                assignment_status
              )
              SELECT $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::date, TRUE, 1.00, 'active'
              WHERE NOT EXISTS (SELECT 1 FROM updated_assignment)
              RETURNING assignment_id::text AS assignment_id
            )
            SELECT assignment_id FROM updated_assignment
            UNION ALL
            SELECT assignment_id FROM inserted_assignment
          `,
          [
            promotedEntityId,
            row.storeId,
            row.regionId,
            row.positionId,
            row.hireDate,
          ],
        );
        const assignmentId = assignmentResult.rows[0]?.assignment_id;
        if (!assignmentId) {
          throw new Error(
            `Personnel bootstrap assignment was not upserted: ${row.rowId}`,
          );
        }

        const rowUpdateResult = await client.query(
          `
            UPDATE stg.master_data_bootstrap_row
            SET
              validation_status = 'promoted',
              promoted_entity_id = $3::uuid,
              updated_at = NOW()
            WHERE master_data_bootstrap_row_id = $1::uuid
              AND master_data_bootstrap_batch_id = $2::uuid
              AND validation_status = 'valid'
          `,
          [row.rowId, input.batchId, promotedEntityId],
        );
        if (rowUpdateResult.rowCount !== 1) {
          throw new Error(
            `Personnel bootstrap row was not marked promoted: ${row.rowId}`,
          );
        }

        promotedRows.push({
          rowId: row.rowId,
          promotedEntityId,
          assignmentId,
        });
      }

      const batchResult = await client.query<{
        master_data_bootstrap_batch_id: string;
        batch_status: string;
        row_count: number;
        valid_count: number;
        needs_review_count: number;
        invalid_count: number;
        promoted_count: number;
      }>(
        `
          WITH row_counts AS (
            SELECT
              COUNT(*)::integer AS row_count,
              COUNT(*) FILTER (WHERE validation_status = 'valid')::integer AS valid_count,
              COUNT(*) FILTER (WHERE validation_status = 'needs_review')::integer AS needs_review_count,
              COUNT(*) FILTER (WHERE validation_status = 'invalid')::integer AS invalid_count,
              COUNT(*) FILTER (WHERE validation_status = 'promoted')::integer AS promoted_count
            FROM stg.master_data_bootstrap_row
            WHERE master_data_bootstrap_batch_id = $1::uuid
          )
          UPDATE stg.master_data_bootstrap_batch b
          SET
            batch_status = CASE
              WHEN row_counts.row_count = row_counts.promoted_count
              THEN 'promoted'
              ELSE 'ready_to_promote'
            END,
            row_count = row_counts.row_count,
            valid_count = row_counts.valid_count,
            needs_review_count = row_counts.needs_review_count,
            invalid_count = row_counts.invalid_count,
            promoted_count = row_counts.promoted_count,
            promoted_at = CASE
              WHEN row_counts.row_count = row_counts.promoted_count
              THEN NOW()
              ELSE b.promoted_at
            END
          FROM row_counts
          WHERE b.master_data_bootstrap_batch_id = $1::uuid
          RETURNING
            b.master_data_bootstrap_batch_id,
            b.batch_status,
            b.row_count,
            b.valid_count,
            b.needs_review_count,
            b.invalid_count,
            b.promoted_count
        `,
        [input.batchId],
      );

      const batch = batchResult.rows[0];
      if (!batch) {
        throw new Error(
          `Personnel bootstrap batch was not refreshed: ${input.batchId}`,
        );
      }

      await auditBootstrapRowsPromoted(client, input, batch, promotedRows.length, "master_data_bootstrap.personnel.promoted");
      return {
        batchId: batch.master_data_bootstrap_batch_id,
        batchStatus: batch.batch_status,
        rowCount: batch.row_count,
        validCount: batch.valid_count,
        needsReviewCount: batch.needs_review_count,
        invalidCount: batch.invalid_count,
        promotedCount: batch.promoted_count,
        promotedRows,
      };
    });
  }
}

function mapBootstrapBatch(row: BootstrapBatchRow): BootstrapBatch {
  return {
    batchId: row.master_data_bootstrap_batch_id,
    companyId: row.company_id,
    bootstrapEntity: row.bootstrap_entity,
    sourceLabel: row.source_label,
    fileReference: row.file_reference,
    uploadedByUserId: row.uploaded_by_user_id,
    batchStatus: row.batch_status,
    rowCount: row.row_count,
    validCount: row.valid_count,
    needsReviewCount: row.needs_review_count,
    invalidCount: row.invalid_count,
    promotedCount: row.promoted_count,
    createdAt: row.created_at,
    validatedAt: row.validated_at ?? null,
    promotedAt: row.promoted_at ?? null,
  };
}

function mapBootstrapBatchQueueItem(
  row: BootstrapBatchQueueRecord,
): BootstrapBatchQueueItem {
  return {
    ...mapBootstrapBatch(row),
    pendingCount: row.pending_count,
  };
}

function mapBootstrapStagedRow(row: BootstrapStagedRowRecord): BootstrapStagedRow {
  return {
    rowId: row.master_data_bootstrap_row_id,
    batchId: row.master_data_bootstrap_batch_id,
    rowNumber: row.row_number,
    rowHash: row.row_hash,
    sourceStoreCode: row.source_store_code,
    sourceEmployeeCode: row.source_employee_code,
    rawPayload: row.raw_payload_json,
    normalizedPayload: row.normalized_payload_json,
    validationStatus: row.validation_status,
    issueCode: row.issue_code,
    issueMessage: row.issue_message,
    resolvedCompanyId: row.resolved_company_id,
    resolvedRegionId: row.resolved_region_id,
    resolvedStoreId: row.resolved_store_id,
    resolvedEmployeeId: row.resolved_employee_id,
    resolvedPositionId: row.resolved_position_id,
    promotedEntityId: row.promoted_entity_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildBootstrapReadinessSql(readiness?: BootstrapReadinessFilter) {
  if (!readiness) {
    return null;
  }

  const pendingExpression =
    "GREATEST(row_count - valid_count - needs_review_count - invalid_count - promoted_count, 0)";

  if (readiness === "needs_validation") {
    return `(batch_status = 'uploaded' OR ${pendingExpression} > 0)`;
  }

  if (readiness === "needs_review") {
    return "(invalid_count > 0 OR needs_review_count > 0)";
  }

  if (readiness === "ready_to_promote") {
    return "batch_status = 'ready_to_promote'";
  }

  return "batch_status IN ('promoted', 'rejected')";
}
