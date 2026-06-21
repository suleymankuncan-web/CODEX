import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";

@Injectable()
export class StoreScoreReportingReadRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async getSnapshotRunKpiConfigVersionId(input: { snapshotRunId: string }) {
    const result = await this.databaseService.query<{
      kpi_config_version_id: string | null;
    }>(
      `
        SELECT kpi_config_version_id::text AS kpi_config_version_id
        FROM rpt.snapshot_run
        WHERE snapshot_run_id = $1::uuid
        LIMIT 1
      `,
      [input.snapshotRunId],
    );

    return result.rows[0]?.kpi_config_version_id ?? null;
  }

  async getStoreKpiSnapshotRowsForScore(input: {
    snapshotRunId: string;
    storeId: string;
  }) {
    const result = await this.databaseService.query<{
      kpi_code: string;
      actual_value: string | null;
      target_value: string | null;
      achievement_rate: string | null;
    }>(
      `
        SELECT
          kd.kpi_code,
          sks.actual_value::text AS actual_value,
          sks.target_value::text AS target_value,
          sks.achievement_rate::text AS achievement_rate
        FROM rpt.store_kpi_snapshot sks
        INNER JOIN ops.kpi_definition kd
          ON kd.kpi_id = sks.kpi_id
        WHERE sks.snapshot_run_id = $1::uuid
          AND sks.store_id = $2::uuid
        ORDER BY kd.kpi_code ASC
      `,
      [input.snapshotRunId, input.storeId],
    );

    return result.rows;
  }

  async getStoreChecklistSnapshotForScore(input: {
    snapshotRunId: string;
    storeId: string;
    templateType: string;
  }) {
    const result = await this.databaseService.query<{
      checklist_template_id: string;
      audit_count: number;
      avg_score: string | null;
    }>(
      `
        SELECT
          scs.checklist_template_id,
          scs.audit_count,
          scs.avg_score::text AS avg_score
        FROM rpt.store_checklist_snapshot scs
        INNER JOIN ops.checklist_template ct
          ON ct.checklist_template_id = scs.checklist_template_id
        WHERE scs.snapshot_run_id = $1::uuid
          AND scs.store_id = $2::uuid
          AND ct.template_type = $3
        ORDER BY scs.audit_count DESC, scs.checklist_template_id ASC
        LIMIT 1
      `,
      [input.snapshotRunId, input.storeId, input.templateType],
    );

    return result.rows[0] ?? null;
  }
}
