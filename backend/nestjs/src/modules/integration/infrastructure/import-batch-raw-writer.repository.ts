import { Injectable } from "@nestjs/common";
import { PoolClient } from "pg";

export type ImportBatchEntityType =
  | "employee"
  | "store"
  | "kpi"
  | "assignment"
  | "position"
  | "company"
  | "region";

@Injectable()
export class ImportBatchRawWriterRepository {
  async writeRawRows(input: {
    client: PoolClient;
    batchId: string;
    entityType: ImportBatchEntityType;
    rows: Record<string, unknown>[];
  }) {
    if (input.rows.length === 0) {
      return;
    }

    for (const row of input.rows) {
      if (input.entityType === "employee") {
        await input.client.query(
          `
            INSERT INTO stg.employee_raw (
              import_batch_id,
              source_employee_id,
              payload_json,
              normalized_status,
              processed_flag
            )
            VALUES ($1::uuid, $2, $3::jsonb, 'pending', FALSE)
          `,
          [
            input.batchId,
            String(row["sourceEmployeeId"] ?? row["employeeId"] ?? "unknown"),
            JSON.stringify(row),
          ],
        );
      }

      if (input.entityType === "store") {
        await input.client.query(
          `
            INSERT INTO stg.store_raw (
              import_batch_id,
              source_store_id,
              payload_json,
              normalized_status,
              processed_flag
            )
            VALUES ($1::uuid, $2, $3::jsonb, 'pending', FALSE)
          `,
          [
            input.batchId,
            String(row["sourceStoreId"] ?? row["storeId"] ?? "unknown"),
            JSON.stringify(row),
          ],
        );
      }

      if (input.entityType === "kpi") {
        await input.client.query(
          `
            INSERT INTO stg.kpi_raw (
              import_batch_id,
              source_metric_id,
              store_external_ref,
              employee_external_ref,
              period_start,
              period_end,
              payload_json,
                  row_hash,
                  raw_row_reference,
              normalized_status,
              processed_flag
            )
            VALUES ($1::uuid, $2, $3, $4, $5::date, $6::date, $7::jsonb, $8, $9, 'pending', FALSE)
          `,
          [
            input.batchId,
            String(row["sourceMetricId"] ?? row["metricId"] ?? "unknown"),
            String(row["storeExternalRef"] ?? row["storeId"] ?? "unknown"),
            row["employeeExternalRef"] ? String(row["employeeExternalRef"]) : null,
            row["periodStart"] ? String(row["periodStart"]) : null,
            row["periodEnd"] ? String(row["periodEnd"]) : null,
            JSON.stringify(row),
            row["rowHash"] ? String(row["rowHash"]) : null,
            row["rawRowReference"] ? String(row["rawRowReference"]) : null,
          ],
        );
      }

      if (input.entityType === "assignment") {
        await input.client.query(
          `
            INSERT INTO stg.assignment_raw (
              import_batch_id,
              source_assignment_id,
              source_employee_id,
              source_store_id,
              source_position_id,
              payload_json,
              normalized_status,
              processed_flag
            )
            VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb, 'pending', FALSE)
          `,
          [
            input.batchId,
            String(row["sourceAssignmentId"] ?? row["assignmentId"] ?? "unknown"),
            row["sourceEmployeeId"] ? String(row["sourceEmployeeId"]) : null,
            row["sourceStoreId"] ? String(row["sourceStoreId"]) : null,
            row["sourcePositionId"] ? String(row["sourcePositionId"]) : null,
            JSON.stringify(row),
          ],
        );
      }

      if (input.entityType === "position") {
        await input.client.query(
          `
            INSERT INTO stg.position_raw (
              import_batch_id,
              source_position_id,
              payload_json,
              normalized_status,
              processed_flag
            )
            VALUES ($1::uuid, $2, $3::jsonb, 'pending', FALSE)
          `,
          [
            input.batchId,
            String(
              row["sourcePositionId"] ??
                row["positionCode"] ??
                row["positionId"] ??
                "unknown",
            ),
            JSON.stringify(row),
          ],
        );
      }

      if (input.entityType === "company") {
        await input.client.query(
          `
            INSERT INTO stg.company_raw (
              import_batch_id,
              source_company_id,
              payload_json,
              normalized_status,
              processed_flag
            )
            VALUES ($1::uuid, $2, $3::jsonb, 'pending', FALSE)
          `,
          [
            input.batchId,
            String(row["sourceCompanyId"] ?? row["companyCode"] ?? row["companyId"] ?? "unknown"),
            JSON.stringify(row),
          ],
        );
      }

      if (input.entityType === "region") {
        await input.client.query(
          `
            INSERT INTO stg.region_raw (
              import_batch_id,
              source_region_id,
              source_company_id,
              payload_json,
              normalized_status,
              processed_flag
            )
            VALUES ($1::uuid, $2, $3, $4::jsonb, 'pending', FALSE)
          `,
          [
            input.batchId,
            String(row["sourceRegionId"] ?? row["regionCode"] ?? row["regionId"] ?? "unknown"),
            row["sourceCompanyId"] ? String(row["sourceCompanyId"]) : null,
            JSON.stringify(row),
          ],
        );
      }
    }

    await input.client.query(
      `
        UPDATE stg.import_batch
        SET record_count = $2
        WHERE import_batch_id = $1::uuid
      `,
      [input.batchId, input.rows.length],
    );
  }
}
