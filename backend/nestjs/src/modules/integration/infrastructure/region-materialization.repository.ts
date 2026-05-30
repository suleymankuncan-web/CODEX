import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";

export type PendingRegionRawRow = {
  stgRegionRawId: string;
  payloadJson: Record<string, unknown>;
};

@Injectable()
export class RegionMaterializationRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listPendingRegionRows(batchId: string): Promise<PendingRegionRawRow[]> {
    const rows = await this.databaseService.query<{
      stg_region_raw_id: string;
      payload_json: Record<string, unknown>;
    }>(
      `
        SELECT stg_region_raw_id, payload_json
        FROM stg.region_raw
        WHERE import_batch_id = $1::uuid
          AND processed_flag = FALSE
      `,
      [batchId],
    );

    return rows.rows.map((row) => ({
      stgRegionRawId: row.stg_region_raw_id,
      payloadJson: row.payload_json,
    }));
  }

  async upsertRegion(input: {
    regionId: string;
    companyId: string;
    regionCode: string;
    regionName: string;
    status: string;
  }): Promise<string> {
    const result = await this.databaseService.query<{ region_id: string }>(
      `
        INSERT INTO ops.region (
          region_id,
          company_id,
          region_code,
          region_name,
          status
        )
        VALUES ($1::uuid, $2::uuid, $3, $4, $5)
        ON CONFLICT (company_id, region_code) DO UPDATE
        SET
          region_name = EXCLUDED.region_name,
          status = EXCLUDED.status
        RETURNING region_id
      `,
      [
        input.regionId,
        input.companyId,
        input.regionCode,
        input.regionName,
        input.status,
      ],
    );

    return result.rows[0].region_id;
  }
}
