import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";

export type PendingEmployeeRawRow = {
  stgEmployeeRawId: string;
  payloadJson: Record<string, unknown>;
};

@Injectable()
export class EmployeeMaterializationRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listPendingEmployeeRows(batchId: string): Promise<PendingEmployeeRawRow[]> {
    const rows = await this.databaseService.query<{
      stg_employee_raw_id: string;
      payload_json: Record<string, unknown>;
    }>(
      `
        SELECT stg_employee_raw_id, payload_json
        FROM stg.employee_raw
        WHERE import_batch_id = $1::uuid
          AND processed_flag = FALSE
      `,
      [batchId],
    );

    return rows.rows.map((row) => ({
      stgEmployeeRawId: row.stg_employee_raw_id,
      payloadJson: row.payload_json,
    }));
  }

  async upsertEmployee(input: {
    employeeId: string;
    companyId: string;
    externalEmployeeRef: string;
    firstName: string;
    lastName: string;
    hireDate: string;
    employmentStatus: string;
    employmentType: string;
  }): Promise<void> {
    await this.databaseService.query(
      `
        INSERT INTO ops.employee (
          employee_id,
          company_id,
          external_employee_ref,
          first_name,
          last_name,
          hire_date,
          employment_status,
          employment_type
        )
        VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::date, $7, $8)
        ON CONFLICT (employee_id) DO UPDATE
        SET
          external_employee_ref = EXCLUDED.external_employee_ref,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          employment_status = EXCLUDED.employment_status,
          employment_type = EXCLUDED.employment_type
      `,
      [
        input.employeeId,
        input.companyId,
        input.externalEmployeeRef,
        input.firstName,
        input.lastName,
        input.hireDate,
        input.employmentStatus,
        input.employmentType,
      ],
    );
  }
}
