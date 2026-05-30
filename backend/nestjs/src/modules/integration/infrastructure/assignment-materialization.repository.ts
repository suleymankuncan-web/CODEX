import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";

export type PendingAssignmentRawRow = {
  stgAssignmentRawId: string;
  payloadJson: Record<string, unknown>;
};

@Injectable()
export class AssignmentMaterializationRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listPendingAssignmentRows(batchId: string): Promise<PendingAssignmentRawRow[]> {
    const rows = await this.databaseService.query<{
      stg_assignment_raw_id: string;
      payload_json: Record<string, unknown>;
    }>(
      `
        SELECT stg_assignment_raw_id, payload_json
        FROM stg.assignment_raw
        WHERE import_batch_id = $1::uuid
          AND processed_flag = FALSE
      `,
      [batchId],
    );

    return rows.rows.map((row) => ({
      stgAssignmentRawId: row.stg_assignment_raw_id,
      payloadJson: row.payload_json,
    }));
  }

  async resolveRegionIdForStore(storeId: string): Promise<string> {
    const result = await this.databaseService.query<{ region_id: string }>(
      `
        SELECT region_id
        FROM ops.store
        WHERE store_id = $1::uuid
        LIMIT 1
      `,
      [storeId],
    );

    if (result.rowCount === 0) {
      throw new Error("store region could not be resolved");
    }

    return result.rows[0].region_id;
  }

  async upsertAssignment(input: {
    assignmentId: string;
    employeeId: string;
    storeId: string;
    regionId: string;
    positionId: string;
    managerEmployeeId: string | null;
    startDate: string;
    endDate: string | null;
    isPrimaryAssignment: boolean;
    fteRatio: number;
    assignmentStatus: string;
  }): Promise<void> {
    await this.databaseService.query(
      `
        INSERT INTO ops.employee_assignment_history (
          assignment_id,
          employee_id,
          store_id,
          region_id,
          position_id,
          manager_employee_id,
          start_date,
          end_date,
          is_primary_assignment,
          fte_ratio,
          assignment_status
        )
        VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid, $7::date, $8::date, $9, $10::numeric, $11)
        ON CONFLICT (assignment_id) DO UPDATE
        SET
          employee_id = EXCLUDED.employee_id,
          store_id = EXCLUDED.store_id,
          region_id = EXCLUDED.region_id,
          position_id = EXCLUDED.position_id,
          manager_employee_id = EXCLUDED.manager_employee_id,
          start_date = EXCLUDED.start_date,
          end_date = EXCLUDED.end_date,
          is_primary_assignment = EXCLUDED.is_primary_assignment,
          fte_ratio = EXCLUDED.fte_ratio,
          assignment_status = EXCLUDED.assignment_status
      `,
      [
        input.assignmentId,
        input.employeeId,
        input.storeId,
        input.regionId,
        input.positionId,
        input.managerEmployeeId,
        input.startDate,
        input.endDate,
        input.isPrimaryAssignment,
        input.fteRatio,
        input.assignmentStatus,
      ],
    );
  }
}
