import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";

type BootstrapBatchRow = {
  master_data_bootstrap_batch_id: string;
  company_id: string;
  bootstrap_entity: "store" | "personnel";
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
};

@Injectable()
export class MasterDataBootstrapRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async createBootstrapBatch(input: {
    companyId: string;
    bootstrapEntity: "store" | "personnel";
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
      validationStatus: "pending" | "valid" | "needs_review" | "invalid" | "promoted";
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

      return {
        batchId: batch.master_data_bootstrap_batch_id,
        companyId: batch.company_id,
        bootstrapEntity: batch.bootstrap_entity,
        sourceLabel: batch.source_label,
        fileReference: batch.file_reference,
        uploadedByUserId: batch.uploaded_by_user_id,
        batchStatus: batch.batch_status,
        rowCount: batch.row_count,
        validCount: batch.valid_count,
        needsReviewCount: batch.needs_review_count,
        invalidCount: batch.invalid_count,
        promotedCount: batch.promoted_count,
        createdAt: batch.created_at,
      };
    });
  }
}
