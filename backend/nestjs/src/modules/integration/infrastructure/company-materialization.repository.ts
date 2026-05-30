import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";

export type PendingCompanyRawRow = {
  stgCompanyRawId: string;
  payloadJson: Record<string, unknown>;
};

@Injectable()
export class CompanyMaterializationRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listPendingCompanyRows(batchId: string): Promise<PendingCompanyRawRow[]> {
    const rows = await this.databaseService.query<{
      stg_company_raw_id: string;
      payload_json: Record<string, unknown>;
    }>(
      `
        SELECT stg_company_raw_id, payload_json
        FROM stg.company_raw
        WHERE import_batch_id = $1::uuid
          AND processed_flag = FALSE
      `,
      [batchId],
    );

    return rows.rows.map((row) => ({
      stgCompanyRawId: row.stg_company_raw_id,
      payloadJson: row.payload_json,
    }));
  }

  async upsertCompany(input: {
    companyId: string;
    companyCode: string;
    companyName: string;
    status: string;
  }): Promise<string> {
    const result = await this.databaseService.query<{ company_id: string }>(
      `
        INSERT INTO ops.company (
          company_id,
          company_code,
          company_name,
          status
        )
        VALUES ($1::uuid, $2, $3, $4)
        ON CONFLICT (company_code) DO UPDATE
        SET
          company_name = EXCLUDED.company_name,
          status = EXCLUDED.status
        RETURNING company_id
      `,
      [
        input.companyId,
        input.companyCode,
        input.companyName,
        input.status,
      ],
    );

    return result.rows[0].company_id;
  }
}
