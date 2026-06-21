import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";

export type PendingKpiRawRow = {
  stgKpiRawId: string;
  payloadJson: Record<string, unknown>;
};

type KpiBatchEnvelope = {
  sourceBatchId: string | null;
  sourcePayloadHash: string | null;
  sourceCapturedAt: string | null;
};

@Injectable()
export class KpiMaterializationRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listPendingKpiRows(batchId: string): Promise<PendingKpiRawRow[]> {
    const rows = await this.databaseService.query<{
      stg_kpi_raw_id: string;
      payload_json: Record<string, unknown>;
    }>(
      `
        SELECT stg_kpi_raw_id, payload_json
        FROM stg.kpi_raw
        WHERE import_batch_id = $1::uuid
          AND processed_flag = FALSE
      `,
      [batchId],
    );

    return rows.rows.map((row) => ({
      stgKpiRawId: row.stg_kpi_raw_id,
      payloadJson: row.payload_json,
    }));
  }

  async findKpiDefinitionIdByCode(kpiCode: string): Promise<string | null> {
    const result = await this.databaseService.query<{ kpi_id: string }>(
      `
        SELECT kpi_id
        FROM ops.kpi_definition
        WHERE kpi_code = $1
          AND is_active = TRUE
        LIMIT 1
      `,
      [kpiCode],
    );

    return result.rows[0]?.kpi_id ?? null;
  }

  async getStoreOrgScope(storeId: string): Promise<{
    companyId: string | null;
    regionId: string | null;
  } | null> {
    const result = await this.databaseService.query<{
      company_id: string | null;
      region_id: string | null;
    }>(
      `
        SELECT company_id, region_id
        FROM ops.store
        WHERE store_id = $1::uuid
        LIMIT 1
      `,
      [storeId],
    );

    const row = result.rows[0];
    return row
      ? {
          companyId: row.company_id,
          regionId: row.region_id,
        }
      : null;
  }

  async upsertStoreKpiActual(input: {
    kpiId: string;
    companyId: string | null;
    regionId: string | null;
    storeId: string | null;
    periodType: string;
    periodStart: string;
    periodEnd: string;
    actualValue: number;
    achievementRate: number | null;
    batchEnvelope: KpiBatchEnvelope;
  }) {
    await this.databaseService.query(
      `
        INSERT INTO ops.kpi_actual (
          kpi_actual_id,
          kpi_id,
          scope_type,
          company_id,
          region_id,
          store_id,
          employee_id,
          period_type,
          period_start,
          period_end,
          actual_value,
          achievement_rate,
          calculated_at,
          source_batch_id,
          source_payload_hash,
          last_synced_at,
          source_type
        )
        VALUES (
          gen_random_uuid(),
          $1::uuid,
          'store',
          $2::uuid,
          $3::uuid,
          $4::uuid,
          NULL,
          $5,
          $6::date,
          $7::date,
          $8::numeric,
          $9::numeric,
          NOW(),
          $10,
          $11,
          COALESCE($12::timestamptz, NOW()),
          'integration'
        )
        ON CONFLICT (kpi_id, store_id, period_type, period_start, period_end)
        WHERE scope_type = 'store' AND store_id IS NOT NULL
        DO UPDATE SET
          company_id = EXCLUDED.company_id,
          region_id = EXCLUDED.region_id,
          actual_value = EXCLUDED.actual_value,
          achievement_rate = EXCLUDED.achievement_rate,
          calculated_at = NOW(),
          source_batch_id = EXCLUDED.source_batch_id,
          source_payload_hash = EXCLUDED.source_payload_hash,
          last_synced_at = EXCLUDED.last_synced_at,
          source_type = EXCLUDED.source_type
      `,
      [
        input.kpiId,
        input.companyId,
        input.regionId,
        input.storeId,
        input.periodType,
        input.periodStart,
        input.periodEnd,
        input.actualValue,
        input.achievementRate,
        input.batchEnvelope.sourceBatchId,
        input.batchEnvelope.sourcePayloadHash,
        input.batchEnvelope.sourceCapturedAt,
      ],
    );
  }

  async replaceStoreKpiTarget(input: {
    kpiId: string;
    companyId: string | null;
    regionId: string | null;
    storeId: string | null;
    periodType: string;
    periodStart: string;
    periodEnd: string;
    targetValue: number;
  }) {
    const thresholdGreen = input.targetValue;
    const thresholdYellow = Number((input.targetValue * 0.85).toFixed(4));
    const thresholdRed = Number((input.targetValue * 0.75).toFixed(4));

    await this.databaseService.query(
      `
        DELETE FROM ops.kpi_target
        WHERE kpi_id = $1::uuid
          AND scope_type = 'store'
          AND store_id = $2::uuid
          AND period_type = $3
          AND period_start = $4::date
          AND period_end = $5::date
      `,
      [input.kpiId, input.storeId, input.periodType, input.periodStart, input.periodEnd],
    );

    await this.databaseService.query(
      `
        INSERT INTO ops.kpi_target (
          kpi_target_id,
          kpi_id,
          scope_type,
          company_id,
          region_id,
          store_id,
          position_id,
          period_type,
          period_start,
          period_end,
          target_value,
          threshold_green,
          threshold_yellow,
          threshold_red
        )
        VALUES (
          gen_random_uuid(),
          $1::uuid,
          'store',
          $2::uuid,
          $3::uuid,
          $4::uuid,
          NULL,
          $5,
          $6::date,
          $7::date,
          $8::numeric,
          $9::numeric,
          $10::numeric,
          $11::numeric
        )
      `,
      [
        input.kpiId,
        input.companyId,
        input.regionId,
        input.storeId,
        input.periodType,
        input.periodStart,
        input.periodEnd,
        input.targetValue,
        thresholdGreen,
        thresholdYellow,
        thresholdRed,
      ],
    );
  }

  async upsertEmployeeKpiActual(input: {
    kpiId: string;
    companyId: string | null;
    regionId: string | null;
    storeId: string | null;
    employeeId: string | null;
    periodType: string;
    periodStart: string;
    periodEnd: string;
    actualValue: number;
    achievementRate: number | null;
    batchEnvelope: KpiBatchEnvelope;
  }) {
    await this.databaseService.query(
      `
        INSERT INTO ops.kpi_actual (
          kpi_actual_id,
          kpi_id,
          scope_type,
          company_id,
          region_id,
          store_id,
          employee_id,
          period_type,
          period_start,
          period_end,
          actual_value,
          achievement_rate,
          calculated_at,
          source_batch_id,
          source_payload_hash,
          last_synced_at,
          source_type
        )
        VALUES (
          gen_random_uuid(),
          $1::uuid,
          'employee',
          $2::uuid,
          $3::uuid,
          $4::uuid,
          $5::uuid,
          $6,
          $7::date,
          $8::date,
          $9::numeric,
          $10::numeric,
          NOW(),
          $11,
          $12,
          COALESCE($13::timestamptz, NOW()),
          'integration'
        )
        ON CONFLICT (kpi_id, employee_id, period_type, period_start, period_end)
        WHERE scope_type = 'employee' AND employee_id IS NOT NULL
        DO UPDATE SET
          company_id = EXCLUDED.company_id,
          region_id = EXCLUDED.region_id,
          store_id = EXCLUDED.store_id,
          actual_value = EXCLUDED.actual_value,
          achievement_rate = EXCLUDED.achievement_rate,
          calculated_at = NOW(),
          source_batch_id = EXCLUDED.source_batch_id,
          source_payload_hash = EXCLUDED.source_payload_hash,
          last_synced_at = EXCLUDED.last_synced_at,
          source_type = EXCLUDED.source_type
      `,
      [
        input.kpiId,
        input.companyId,
        input.regionId,
        input.storeId,
        input.employeeId,
        input.periodType,
        input.periodStart,
        input.periodEnd,
        input.actualValue,
        input.achievementRate,
        input.batchEnvelope.sourceBatchId,
        input.batchEnvelope.sourcePayloadHash,
        input.batchEnvelope.sourceCapturedAt,
      ],
    );
  }

  async markKpiRawRowProcessed(rowId: string): Promise<void> {
    await this.databaseService.query(
      `
        UPDATE stg.kpi_raw
        SET
          processed_flag = TRUE,
          processed_at = NOW(),
          normalized_status = 'processed',
          validation_error = NULL
        WHERE stg_kpi_raw_id = $1::uuid
      `,
      [rowId],
    );
  }

  async markKpiRawRowValidationFailed(
    rowId: string,
    errorMessage: string,
  ): Promise<void> {
    await this.databaseService.query(
      `
        UPDATE stg.kpi_raw
        SET processed_flag = TRUE, processed_at = NOW(), normalized_status = 'validation_failed', validation_error = $1
        WHERE stg_kpi_raw_id = $2::uuid
      `,
      [errorMessage, rowId],
    );
  }

  async markKpiRawRowRetryableError(
    rowId: string,
    errorMessage: string,
  ): Promise<void> {
    await this.databaseService.query(
      `
        UPDATE stg.kpi_raw
        SET processed_flag = FALSE, normalized_status = 'retryable_error', validation_error = $1, processed_at = NULL
        WHERE stg_kpi_raw_id = $2::uuid
      `,
      [errorMessage, rowId],
    );
  }
}
