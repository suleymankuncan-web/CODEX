import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";

type MaterializationRawTableName =
  | "stg.employee_raw"
  | "stg.store_raw"
  | "stg.assignment_raw"
  | "stg.position_raw"
  | "stg.company_raw"
  | "stg.region_raw";

type MaterializationRawIdColumn =
  | "stg_employee_raw_id"
  | "stg_store_raw_id"
  | "stg_assignment_raw_id"
  | "stg_position_raw_id"
  | "stg_company_raw_id"
  | "stg_region_raw_id";

type MaterializationRawRowTargetShape = {
  readonly tableName: MaterializationRawTableName;
  readonly idColumn: MaterializationRawIdColumn;
};

const materializationRawRowTargets = {
  employee: {
    tableName: "stg.employee_raw",
    idColumn: "stg_employee_raw_id",
  },
  store: {
    tableName: "stg.store_raw",
    idColumn: "stg_store_raw_id",
  },
  assignment: {
    tableName: "stg.assignment_raw",
    idColumn: "stg_assignment_raw_id",
  },
  position: {
    tableName: "stg.position_raw",
    idColumn: "stg_position_raw_id",
  },
  company: {
    tableName: "stg.company_raw",
    idColumn: "stg_company_raw_id",
  },
  region: {
    tableName: "stg.region_raw",
    idColumn: "stg_region_raw_id",
  },
} as const satisfies Record<string, MaterializationRawRowTargetShape>;

export type MaterializationRawEntity = keyof typeof materializationRawRowTargets;

@Injectable()
export class MaterializationRowStatusRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  getRawTableName(entity: MaterializationRawEntity): MaterializationRawTableName {
    return materializationRawRowTargets[entity].tableName;
  }

  async markRawRowProcessed(entity: MaterializationRawEntity, rowId: string): Promise<void> {
    const target = materializationRawRowTargets[entity];

    await this.databaseService.query(
      `
        UPDATE ${target.tableName}
        SET
          processed_flag = TRUE,
          processed_at = NOW(),
          normalized_status = 'processed',
          validation_error = NULL
        WHERE ${target.idColumn} = $1::uuid
      `,
      [rowId],
    );
  }

  async markRawRowValidationFailed(
    entity: MaterializationRawEntity,
    rowId: string,
    errorMessage: string,
  ): Promise<void> {
    const target = materializationRawRowTargets[entity];

    await this.databaseService.query(
      `
        UPDATE ${target.tableName}
        SET processed_flag = TRUE, processed_at = NOW(), normalized_status = 'validation_failed', validation_error = $1
        WHERE ${target.idColumn} = $2::uuid
      `,
      [errorMessage, rowId],
    );
  }

  async markRawRowRetryableError(
    entity: MaterializationRawEntity,
    rowId: string,
    errorMessage: string,
  ): Promise<void> {
    const target = materializationRawRowTargets[entity];

    await this.databaseService.query(
      `
        UPDATE ${target.tableName}
        SET processed_flag = FALSE, normalized_status = 'retryable_error', validation_error = $1, processed_at = NULL
        WHERE ${target.idColumn} = $2::uuid
      `,
      [errorMessage, rowId],
    );
  }
}
