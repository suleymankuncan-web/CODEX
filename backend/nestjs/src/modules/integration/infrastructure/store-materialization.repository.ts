import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";

export type PendingStoreRawRow = {
  stgStoreRawId: string;
  payloadJson: Record<string, unknown>;
};

@Injectable()
export class StoreMaterializationRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listPendingStoreRows(batchId: string): Promise<PendingStoreRawRow[]> {
    const rows = await this.databaseService.query<{
      stg_store_raw_id: string;
      payload_json: Record<string, unknown>;
    }>(
      `
        SELECT stg_store_raw_id, payload_json
        FROM stg.store_raw
        WHERE import_batch_id = $1::uuid
          AND processed_flag = FALSE
      `,
      [batchId],
    );

    return rows.rows.map((row) => ({
      stgStoreRawId: row.stg_store_raw_id,
      payloadJson: row.payload_json,
    }));
  }

  async upsertStore(input: {
    storeId: string;
    companyId: string;
    regionId: string;
    storeCode: string;
    storeName: string;
    storeType: string;
    status: string;
    timezone: string;
  }): Promise<void> {
    await this.databaseService.query(
      `
        INSERT INTO ops.store (
          store_id,
          company_id,
          region_id,
          store_code,
          store_name,
          store_type,
          status,
          timezone
        )
        VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8)
        ON CONFLICT (store_code) DO UPDATE
        SET
          store_name = EXCLUDED.store_name,
          store_type = EXCLUDED.store_type,
          status = EXCLUDED.status,
          timezone = EXCLUDED.timezone
      `,
      [
        input.storeId,
        input.companyId,
        input.regionId,
        input.storeCode,
        input.storeName,
        input.storeType,
        input.status,
        input.timezone,
      ],
    );
  }
}
