import { Injectable } from "@nestjs/common";
import { RequestContextStore } from "../../../shared/request-context";
import { DatabaseService } from "../../../shared/database/database.service";

export type MaterializationEntityType =
  | "employee"
  | "store"
  | "kpi"
  | "assignment"
  | "position"
  | "company"
  | "region";

export type ImportBatchMaterializationRecord = {
  importBatchId: string;
  entityType: MaterializationEntityType;
  integrationSourceId: string;
  sourceBatchId: string | null;
  sourcePayloadHash: string | null;
  sourceCapturedAt: string | null;
};

@Injectable()
export class MaterializationBatchRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findImportBatchForMaterialization(
    batchId: string,
  ): Promise<ImportBatchMaterializationRecord | null> {
    const batchResult = await this.databaseService.query<{
      import_batch_id: string;
      entity_type: MaterializationEntityType;
      integration_source_id: string;
      source_batch_id: string | null;
      source_payload_hash: string | null;
      source_captured_at: string | null;
    }>(
      `
        SELECT
          import_batch_id,
          entity_type,
          integration_source_id,
          source_batch_id,
          source_payload_hash,
          source_captured_at
        FROM stg.import_batch
        WHERE import_batch_id = $1::uuid
        LIMIT 1
      `,
      [batchId],
    );

    if (batchResult.rowCount === 0) {
      return null;
    }

    const batch = batchResult.rows[0];

    return {
      importBatchId: batch.import_batch_id,
      entityType: batch.entity_type,
      integrationSourceId: batch.integration_source_id,
      sourceBatchId: batch.source_batch_id,
      sourcePayloadHash: batch.source_payload_hash,
      sourceCapturedAt: batch.source_captured_at,
    };
  }

  async markImportBatchFinished(input: {
    batchId: string;
    status: "completed" | "completed_with_errors" | "failed";
    errorCount: number;
  }): Promise<void> {
    await this.databaseService.query(
      `
        UPDATE stg.import_batch
        SET status = $2, error_count = $3, finished_at = NOW()
        WHERE import_batch_id = $1::uuid
      `,
      [input.batchId, input.status, input.errorCount],
    );
  }

  async recordImportBatchAuditEvent(
    batchId: string,
    eventType: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
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
        VALUES (NULL, $1, 'stg.import_batch', $2::uuid, 'company', $3::jsonb)
      `,
      [
        eventType,
        batchId,
        JSON.stringify({
          correlationId: RequestContextStore.getCorrelationId(),
          ...metadata,
        }),
      ],
    );
  }
}
