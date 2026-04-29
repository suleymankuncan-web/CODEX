import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";

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
    batchId: string;
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
