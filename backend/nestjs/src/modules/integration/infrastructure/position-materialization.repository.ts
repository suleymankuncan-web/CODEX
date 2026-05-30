import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";

export type PendingPositionRawRow = {
  stgPositionRawId: string;
  payloadJson: Record<string, unknown>;
};

@Injectable()
export class PositionMaterializationRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listPendingPositionRows(batchId: string): Promise<PendingPositionRawRow[]> {
    const rows = await this.databaseService.query<{
      stg_position_raw_id: string;
      payload_json: Record<string, unknown>;
    }>(
      `
        SELECT stg_position_raw_id, payload_json
        FROM stg.position_raw
        WHERE import_batch_id = $1::uuid
          AND processed_flag = FALSE
      `,
      [batchId],
    );

    return rows.rows.map((row) => ({
      stgPositionRawId: row.stg_position_raw_id,
      payloadJson: row.payload_json,
    }));
  }

  async upsertPosition(input: {
    positionId: string;
    companyId: string;
    positionCode: string;
    positionName: string;
    jobFamily: string | null;
    isManagerial: boolean;
  }): Promise<string> {
    const positionResult = await this.databaseService.query<{ position_id: string }>(
      `
        INSERT INTO ops.position (
          position_id,
          company_id,
          position_code,
          position_name,
          job_family,
          is_managerial
        )
        VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6)
        ON CONFLICT (company_id, position_code) DO UPDATE
        SET
          position_name = EXCLUDED.position_name,
          job_family = EXCLUDED.job_family,
          is_managerial = EXCLUDED.is_managerial
        RETURNING position_id
      `,
      [
        input.positionId,
        input.companyId,
        input.positionCode,
        input.positionName,
        input.jobFamily,
        input.isManagerial,
      ],
    );

    return positionResult.rows[0].position_id;
  }
}
