import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { RequestContextStore } from "../../../shared/request-context";
import { DatabaseService } from "../../../shared/database/database.service";
import { ExternalIdMappingService } from "./external-id-mapping.service";
import { logStructuredError, logStructuredMessage } from "../../../shared/structured-log";

type MaterializationStats = {
  processedCount: number;
  errorCount: number;
  hasRetryableFailure: boolean;
};

@Injectable()
export class MaterializationService {
  private readonly logger = new Logger(MaterializationService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly externalIdMappingService: ExternalIdMappingService,
  ) {}

  async materializeBatch(batchId: string): Promise<void> {
    const batchResult = await this.databaseService.query<{
      import_batch_id: string;
      entity_type:
        | "employee"
        | "store"
        | "kpi"
        | "assignment"
        | "position"
        | "company"
        | "region";
      integration_source_id: string;
      source_batch_id: string | null;
      source_payload_hash: string | null;
      source_captured_at: string | null;
    }>(
      `
        SELECT
          import_batch_id,
          entity_type,
          integration_source_id,
          source_batch_id,
          source_payload_hash,
          source_captured_at
        FROM stg.import_batch
        WHERE import_batch_id = $1::uuid
        LIMIT 1
      `,
      [batchId],
    );

    if (batchResult.rowCount === 0) {
      throw new Error(`Import batch not found: ${batchId}`);
    }

    const batch = batchResult.rows[0];
    logStructuredMessage(this.logger, "import_batch.materialization.started", {
      batchId,
      entityType: batch.entity_type,
    });
    await this.recordImportBatchAuditEvent(batchId, "import_batch.started", {
      entityType: batch.entity_type,
    });
    let stats: MaterializationStats = {
      processedCount: 0,
      errorCount: 0,
      hasRetryableFailure: false,
    };

    if (batch.entity_type === "employee") {
      stats = await this.materializeEmployees(batch.import_batch_id, batch.integration_source_id);
    }

    if (batch.entity_type === "store") {
      stats = await this.materializeStores(batch.import_batch_id, batch.integration_source_id);
    }

    if (batch.entity_type === "kpi") {
      stats = await this.materializeKpis(batch.import_batch_id, batch.integration_source_id, {
        sourceBatchId: batch.source_batch_id,
        sourcePayloadHash: batch.source_payload_hash,
        sourceCapturedAt: batch.source_captured_at,
      });
    }

    if (batch.entity_type === "assignment") {
      stats = await this.materializeAssignments(
        batch.import_batch_id,
        batch.integration_source_id,
      );
    }

    if (batch.entity_type === "position") {
      stats = await this.materializePositions(batch.import_batch_id, batch.integration_source_id);
    }

    if (batch.entity_type === "company") {
      stats = await this.materializeCompanies(batch.import_batch_id, batch.integration_source_id);
    }

    if (batch.entity_type === "region") {
      stats = await this.materializeRegions(batch.import_batch_id, batch.integration_source_id);
    }

    const batchStatus = stats.hasRetryableFailure
      ? "failed"
      : stats.errorCount > 0
        ? "completed_with_errors"
        : "completed";

    await this.databaseService.query(
      `
        UPDATE stg.import_batch
        SET status = $2, error_count = $3, finished_at = NOW()
        WHERE import_batch_id = $1::uuid
      `,
      [batchId, batchStatus, stats.errorCount],
    );

    await this.recordImportBatchAuditEvent(batchId, `import_batch.${batchStatus}`, {
      entityType: batch.entity_type,
      processedCount: stats.processedCount,
      errorCount: stats.errorCount,
      hasRetryableFailure: stats.hasRetryableFailure,
    });

    logStructuredMessage(this.logger, "import_batch.materialization.completed", {
      batchId,
      entityType: batch.entity_type,
      status: batchStatus,
      processedCount: stats.processedCount,
      errorCount: stats.errorCount,
      hasRetryableFailure: stats.hasRetryableFailure,
    });
  }

  private async materializeEmployees(
    batchId: string,
    integrationSourceId: string,
  ): Promise<MaterializationStats> {
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

    const stats: MaterializationStats = {
      processedCount: 0,
      errorCount: 0,
      hasRetryableFailure: false,
    };

    for (const row of rows.rows) {
      const payload = row.payload_json;
      const validationError = this.validateEmployeePayload(payload);

      if (validationError) {
        stats.errorCount += 1;
        await this.markRawRowValidationFailed(
          "stg.employee_raw",
          "stg_employee_raw_id",
          row.stg_employee_raw_id,
          validationError,
        );
        continue;
      }

      try {
        const employeeId = String(
          payload["employeeId"] ?? payload["internalEmployeeId"] ?? randomUUID(),
        );
        const companyId = await this.externalIdMappingService.resolveRequiredInternalId({
          payload,
          integrationSourceId,
          entityType: "company",
          directKeys: ["companyId", "internalCompanyId"],
          externalKeys: ["sourceCompanyId", "companyExternalRef"],
          missingMessage: "company reference is required",
          unresolvedMessage: "company reference could not be resolved",
        });

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
            employeeId,
            companyId,
            String(payload["sourceEmployeeId"] ?? payload["employeeNumber"] ?? employeeId),
            String(payload["firstName"] ?? "Unknown"),
            String(payload["lastName"] ?? "Unknown"),
            String(payload["hireDate"] ?? new Date().toISOString().slice(0, 10)),
            String(payload["employmentStatus"] ?? "active"),
            String(payload["employmentType"] ?? "full_time"),
          ],
        );

        await this.externalIdMappingService.upsertMapping({
          integrationSourceId,
          entityType: "employee",
          externalId: String(payload["sourceEmployeeId"] ?? payload["employeeNumber"] ?? employeeId),
          internalId: employeeId,
          internalTableName: "ops.employee",
        });

        await this.markRawRowProcessed(
          "stg.employee_raw",
          "stg_employee_raw_id",
          row.stg_employee_raw_id,
        );
        stats.processedCount += 1;
      } catch (error) {
        stats.errorCount += 1;
        stats.hasRetryableFailure = true;
        await this.markRawRowRetryableError(
          "stg.employee_raw",
          "stg_employee_raw_id",
          row.stg_employee_raw_id,
          error,
        );
      }
    }

    return stats;
  }

  private async materializeStores(
    batchId: string,
    integrationSourceId: string,
  ): Promise<MaterializationStats> {
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

    const stats: MaterializationStats = {
      processedCount: 0,
      errorCount: 0,
      hasRetryableFailure: false,
    };

    for (const row of rows.rows) {
      const payload = row.payload_json;
      const validationError = this.validateStorePayload(payload);
      if (validationError) {
        stats.errorCount += 1;
        await this.markRawRowValidationFailed(
          "stg.store_raw",
          "stg_store_raw_id",
          row.stg_store_raw_id,
          validationError,
        );
        continue;
      }

      try {
        const companyId = await this.externalIdMappingService.resolveRequiredInternalId({
          payload,
          integrationSourceId,
          entityType: "company",
          directKeys: ["companyId", "internalCompanyId"],
          externalKeys: ["sourceCompanyId", "companyExternalRef"],
          missingMessage: "company reference is required",
          unresolvedMessage: "company reference could not be resolved",
        });
        const regionId = await this.externalIdMappingService.resolveRequiredInternalId({
          payload,
          integrationSourceId,
          entityType: "region",
          directKeys: ["regionId", "internalRegionId"],
          externalKeys: ["sourceRegionId", "regionExternalRef"],
          missingMessage: "region reference is required",
          unresolvedMessage: "region reference could not be resolved",
        });
        const storeId =
          String(payload["storeId"] ?? payload["internalStoreId"] ?? randomUUID());

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
            storeId,
            companyId,
            regionId,
            String(payload["sourceStoreId"] ?? payload["storeCode"] ?? storeId),
            String(payload["storeName"] ?? "Unknown Store"),
            String(payload["storeType"] ?? "standard"),
            String(payload["status"] ?? "active"),
            String(payload["timezone"] ?? "Europe/Istanbul"),
          ],
        );

        await this.externalIdMappingService.upsertMapping({
          integrationSourceId,
          entityType: "store",
          externalId: String(payload["sourceStoreId"] ?? payload["storeCode"] ?? storeId),
          internalId: storeId,
          internalTableName: "ops.store",
        });

        await this.markRawRowProcessed("stg.store_raw", "stg_store_raw_id", row.stg_store_raw_id);
        stats.processedCount += 1;
      } catch (error) {
        stats.errorCount += 1;
        stats.hasRetryableFailure = true;
        await this.markRawRowRetryableError(
          "stg.store_raw",
          "stg_store_raw_id",
          row.stg_store_raw_id,
          error,
        );
      }
    }

    return stats;
  }

  private async materializeKpis(
    batchId: string,
    integrationSourceId: string,
    batchEnvelope: {
      sourceBatchId: string | null;
      sourcePayloadHash: string | null;
      sourceCapturedAt: string | null;
    },
  ): Promise<MaterializationStats> {
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

    const stats: MaterializationStats = {
      processedCount: 0,
      errorCount: 0,
      hasRetryableFailure: false,
    };
    const storeOrgScopeCache = new Map<
      string,
      { companyId: string | null; regionId: string | null }
    >();

    for (const row of rows.rows) {
      const payload = row.payload_json;
      const validationError = this.validateKpiPayload(payload);
      if (validationError) {
        stats.errorCount += 1;
        await this.markRawRowValidationFailed(
          "stg.kpi_raw",
          "stg_kpi_raw_id",
          row.stg_kpi_raw_id,
          validationError,
        );
        continue;
      }

      try {
        const kpiId = await this.resolveKpiDefinitionId(payload);
        const companyId = await this.externalIdMappingService.resolveOptionalInternalId({
          payload,
          integrationSourceId,
          entityType: "company",
          directKeys: ["companyId", "internalCompanyId"],
          externalKeys: ["sourceCompanyId", "companyExternalRef"],
        });
        const regionId = await this.externalIdMappingService.resolveOptionalInternalId({
          payload,
          integrationSourceId,
          entityType: "region",
          directKeys: ["regionId", "internalRegionId"],
          externalKeys: ["sourceRegionId", "regionExternalRef"],
        });
        const storeId = await this.externalIdMappingService.resolveOptionalInternalId({
          payload,
          integrationSourceId,
          entityType: "store",
          directKeys: ["storeId", "internalStoreId"],
          externalKeys: ["sourceStoreId", "storeExternalRef"],
        });
        const employeeId = await this.externalIdMappingService.resolveOptionalInternalId({
          payload,
          integrationSourceId,
          entityType: "employee",
          directKeys: ["employeeId", "internalEmployeeId"],
          externalKeys: ["employeeExternalRef", "sourceEmployeeId"],
        });
        const scopeType = String(payload["scopeType"] ?? (employeeId ? "employee" : "store"));

        if (scopeType === "store" && !storeId) {
          throw new Error("store reference could not be resolved");
        }

        if (scopeType === "employee" && !employeeId) {
          throw new Error("employee reference could not be resolved");
        }
        const periodType = String(payload["periodType"] ?? "monthly");
        const periodStart = String(payload["periodStart"]);
        const periodEnd = String(payload["periodEnd"]);
        const actualValue = Number(payload["actualValue"] ?? 0);
        const employeeIdToPersist = scopeType === "employee" ? employeeId : null;
        const storeOrgScope = storeId
          ? await this.resolveStoreOrgScope(storeId, storeOrgScopeCache)
          : { companyId: null, regionId: null };
        const companyIdToPersist = companyId ?? storeOrgScope.companyId;
        const regionIdToPersist = regionId ?? storeOrgScope.regionId;
        const targetValue =
          payload["targetValue"] === null || payload["targetValue"] === undefined
            ? null
            : Number(payload["targetValue"]);

        if (scopeType === "store") {
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
                NOW(),
                $9,
                $10,
                COALESCE($11::timestamptz, NOW()),
                'integration'
              )
              ON CONFLICT (kpi_id, store_id, period_type, period_start, period_end)
              WHERE scope_type = 'store' AND store_id IS NOT NULL
              DO UPDATE SET
                company_id = EXCLUDED.company_id,
                region_id = EXCLUDED.region_id,
                actual_value = EXCLUDED.actual_value,
                calculated_at = NOW(),
                source_batch_id = EXCLUDED.source_batch_id,
                source_payload_hash = EXCLUDED.source_payload_hash,
                last_synced_at = EXCLUDED.last_synced_at,
                source_type = EXCLUDED.source_type
            `,
            [
              kpiId,
              companyIdToPersist,
              regionIdToPersist,
              storeId,
              periodType,
              periodStart,
              periodEnd,
              actualValue,
              batchEnvelope.sourceBatchId,
              batchEnvelope.sourcePayloadHash,
              batchEnvelope.sourceCapturedAt,
            ],
          );

          if (targetValue !== null && Number.isFinite(targetValue) && targetValue > 0) {
            const thresholdGreen = targetValue;
            const thresholdYellow = Number((targetValue * 0.85).toFixed(4));
            const thresholdRed = Number((targetValue * 0.75).toFixed(4));

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
              [kpiId, storeId, periodType, periodStart, periodEnd],
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
                kpiId,
                companyIdToPersist,
                regionIdToPersist,
                storeId,
                periodType,
                periodStart,
                periodEnd,
                targetValue,
                thresholdGreen,
                thresholdYellow,
                thresholdRed,
              ],
            );
          }
        } else {
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
                NOW(),
                $10,
                $11,
                COALESCE($12::timestamptz, NOW()),
                'integration'
              )
              ON CONFLICT (kpi_id, employee_id, period_type, period_start, period_end)
              WHERE scope_type = 'employee' AND employee_id IS NOT NULL
              DO UPDATE SET
                company_id = EXCLUDED.company_id,
                region_id = EXCLUDED.region_id,
                store_id = EXCLUDED.store_id,
                actual_value = EXCLUDED.actual_value,
                calculated_at = NOW(),
                source_batch_id = EXCLUDED.source_batch_id,
                source_payload_hash = EXCLUDED.source_payload_hash,
                last_synced_at = EXCLUDED.last_synced_at,
                source_type = EXCLUDED.source_type
            `,
            [
              kpiId,
              companyIdToPersist,
              regionIdToPersist,
              storeId,
              employeeIdToPersist,
              periodType,
              periodStart,
              periodEnd,
              actualValue,
              batchEnvelope.sourceBatchId,
              batchEnvelope.sourcePayloadHash,
              batchEnvelope.sourceCapturedAt,
            ],
          );
        }

        await this.markRawRowProcessed("stg.kpi_raw", "stg_kpi_raw_id", row.stg_kpi_raw_id);
        stats.processedCount += 1;
      } catch (error) {
        stats.errorCount += 1;
        stats.hasRetryableFailure = true;
        await this.markRawRowRetryableError(
          "stg.kpi_raw",
          "stg_kpi_raw_id",
          row.stg_kpi_raw_id,
          error,
        );
      }
    }

    return stats;
  }

  private async materializeAssignments(
    batchId: string,
    integrationSourceId: string,
  ): Promise<MaterializationStats> {
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

    const stats: MaterializationStats = {
      processedCount: 0,
      errorCount: 0,
      hasRetryableFailure: false,
    };

    for (const row of rows.rows) {
      const payload = row.payload_json;
      const validationError = this.validateAssignmentPayload(payload);

      if (validationError) {
        stats.errorCount += 1;
        await this.markRawRowValidationFailed(
          "stg.assignment_raw",
          "stg_assignment_raw_id",
          row.stg_assignment_raw_id,
          validationError,
        );
        continue;
      }

      try {
        const employeeId = await this.externalIdMappingService.resolveRequiredInternalId({
          payload,
          integrationSourceId,
          entityType: "employee",
          directKeys: ["employeeId", "internalEmployeeId"],
          externalKeys: ["sourceEmployeeId", "employeeExternalRef"],
          missingMessage: "employee reference is required",
          unresolvedMessage: "employee reference could not be resolved",
        });
        const storeId = await this.externalIdMappingService.resolveRequiredInternalId({
          payload,
          integrationSourceId,
          entityType: "store",
          directKeys: ["storeId", "internalStoreId"],
          externalKeys: ["sourceStoreId", "storeExternalRef"],
          missingMessage: "store reference is required",
          unresolvedMessage: "store reference could not be resolved",
        });
        const positionId = await this.externalIdMappingService.resolveRequiredInternalId({
          payload,
          integrationSourceId,
          entityType: "position",
          directKeys: ["positionId", "internalPositionId"],
          externalKeys: ["sourcePositionId", "positionExternalRef"],
          missingMessage: "position reference is required",
          unresolvedMessage: "position reference could not be resolved",
        });
        const regionId = await this.resolveRegionIdForStore(storeId);
        const managerEmployeeId = await this.externalIdMappingService.resolveOptionalInternalId({
          payload,
          integrationSourceId,
          entityType: "employee",
          directKeys: ["managerEmployeeId", "internalManagerEmployeeId"],
          externalKeys: ["sourceManagerEmployeeId", "managerEmployeeExternalRef"],
        });

        const assignmentId =
          (await this.externalIdMappingService.resolveOptionalInternalId({
            payload,
            integrationSourceId,
            entityType: "assignment",
            directKeys: ["assignmentId", "internalAssignmentId"],
            externalKeys: ["sourceAssignmentId"],
          })) ?? randomUUID();

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
            assignmentId,
            employeeId,
            storeId,
            regionId,
            positionId,
            managerEmployeeId,
            String(payload["startDate"]),
            payload["endDate"] ? String(payload["endDate"]) : null,
            Boolean(payload["isPrimaryAssignment"] ?? true),
            Number(payload["fteRatio"] ?? 1),
            String(payload["assignmentStatus"] ?? "active"),
          ],
        );

        if (payload["sourceAssignmentId"]) {
          await this.externalIdMappingService.upsertMapping({
            integrationSourceId,
            entityType: "assignment",
            externalId: String(payload["sourceAssignmentId"]),
            internalId: assignmentId,
            internalTableName: "ops.employee_assignment_history",
          });
        }

        await this.markRawRowProcessed(
          "stg.assignment_raw",
          "stg_assignment_raw_id",
          row.stg_assignment_raw_id,
        );
        stats.processedCount += 1;
      } catch (error) {
        stats.errorCount += 1;
        stats.hasRetryableFailure = true;
        await this.markRawRowRetryableError(
          "stg.assignment_raw",
          "stg_assignment_raw_id",
          row.stg_assignment_raw_id,
          error,
        );
      }
    }

    return stats;
  }

  private async materializePositions(
    batchId: string,
    integrationSourceId: string,
  ): Promise<MaterializationStats> {
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

    const stats: MaterializationStats = {
      processedCount: 0,
      errorCount: 0,
      hasRetryableFailure: false,
    };

    for (const row of rows.rows) {
      const payload = row.payload_json;
      const validationError = this.validatePositionPayload(payload);

      if (validationError) {
        stats.errorCount += 1;
        await this.markRawRowValidationFailed(
          "stg.position_raw",
          "stg_position_raw_id",
          row.stg_position_raw_id,
          validationError,
        );
        continue;
      }

      try {
        const sourcePositionId = payload["sourcePositionId"]
          ? String(payload["sourcePositionId"])
          : null;
        const positionCode = String(payload["positionCode"] ?? sourcePositionId);
        const companyId = await this.externalIdMappingService.resolveRequiredInternalId({
          payload,
          integrationSourceId,
          entityType: "company",
          directKeys: ["companyId", "internalCompanyId"],
          externalKeys: ["sourceCompanyId", "companyExternalRef"],
          missingMessage: "company reference is required",
          unresolvedMessage: "company reference could not be resolved",
        });
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
            String(payload["positionId"] ?? payload["internalPositionId"] ?? randomUUID()),
            companyId,
            positionCode,
            String(payload["positionName"] ?? positionCode),
            payload["jobFamily"] ? String(payload["jobFamily"]) : null,
            Boolean(payload["isManagerial"] ?? false),
          ],
        );
        const positionId = positionResult.rows[0].position_id;

        if (sourcePositionId) {
          await this.externalIdMappingService.upsertMapping({
            integrationSourceId,
            entityType: "position",
            externalId: sourcePositionId,
            internalId: positionId,
            internalTableName: "ops.position",
          });
        }

        await this.markRawRowProcessed("stg.position_raw", "stg_position_raw_id", row.stg_position_raw_id);
        stats.processedCount += 1;
      } catch (error) {
        stats.errorCount += 1;
        stats.hasRetryableFailure = true;
        await this.markRawRowRetryableError(
          "stg.position_raw",
          "stg_position_raw_id",
          row.stg_position_raw_id,
          error,
        );
      }
    }

    return stats;
  }

  private async materializeCompanies(
    batchId: string,
    integrationSourceId: string,
  ): Promise<MaterializationStats> {
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

    const stats: MaterializationStats = {
      processedCount: 0,
      errorCount: 0,
      hasRetryableFailure: false,
    };

    for (const row of rows.rows) {
      const payload = row.payload_json;
      const validationError = this.validateCompanyPayload(payload);

      if (validationError) {
        stats.errorCount += 1;
        await this.markRawRowValidationFailed(
          "stg.company_raw",
          "stg_company_raw_id",
          row.stg_company_raw_id,
          validationError,
        );
        continue;
      }

      try {
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
            String(payload["companyId"] ?? payload["internalCompanyId"] ?? randomUUID()),
            String(payload["companyCode"] ?? payload["sourceCompanyId"]),
            String(payload["companyName"] ?? payload["companyCode"] ?? payload["sourceCompanyId"]),
            String(payload["status"] ?? "active"),
          ],
        );
        const companyId = result.rows[0].company_id;

        if (payload["sourceCompanyId"]) {
          await this.externalIdMappingService.upsertMapping({
            integrationSourceId,
            entityType: "company",
            externalId: String(payload["sourceCompanyId"]),
            internalId: companyId,
            internalTableName: "ops.company",
          });
        }

        await this.markRawRowProcessed("stg.company_raw", "stg_company_raw_id", row.stg_company_raw_id);
        stats.processedCount += 1;
      } catch (error) {
        stats.errorCount += 1;
        stats.hasRetryableFailure = true;
        await this.markRawRowRetryableError(
          "stg.company_raw",
          "stg_company_raw_id",
          row.stg_company_raw_id,
          error,
        );
      }
    }

    return stats;
  }

  private async materializeRegions(
    batchId: string,
    integrationSourceId: string,
  ): Promise<MaterializationStats> {
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

    const stats: MaterializationStats = {
      processedCount: 0,
      errorCount: 0,
      hasRetryableFailure: false,
    };

    for (const row of rows.rows) {
      const payload = row.payload_json;
      const validationError = this.validateRegionPayload(payload);

      if (validationError) {
        stats.errorCount += 1;
        await this.markRawRowValidationFailed(
          "stg.region_raw",
          "stg_region_raw_id",
          row.stg_region_raw_id,
          validationError,
        );
        continue;
      }

      try {
        const companyId = await this.externalIdMappingService.resolveRequiredInternalId({
          payload,
          integrationSourceId,
          entityType: "company",
          directKeys: ["companyId", "internalCompanyId"],
          externalKeys: ["sourceCompanyId", "companyExternalRef"],
          missingMessage: "company reference is required",
          unresolvedMessage: "company reference could not be resolved",
        });

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
            String(payload["regionId"] ?? payload["internalRegionId"] ?? randomUUID()),
            companyId,
            String(payload["regionCode"] ?? payload["sourceRegionId"]),
            String(payload["regionName"] ?? payload["regionCode"] ?? payload["sourceRegionId"]),
            String(payload["status"] ?? "active"),
          ],
        );
        const regionId = result.rows[0].region_id;

        if (payload["sourceRegionId"]) {
          await this.externalIdMappingService.upsertMapping({
            integrationSourceId,
            entityType: "region",
            externalId: String(payload["sourceRegionId"]),
            internalId: regionId,
            internalTableName: "ops.region",
          });
        }

        await this.markRawRowProcessed("stg.region_raw", "stg_region_raw_id", row.stg_region_raw_id);
        stats.processedCount += 1;
      } catch (error) {
        stats.errorCount += 1;
        stats.hasRetryableFailure = true;
        await this.markRawRowRetryableError(
          "stg.region_raw",
          "stg_region_raw_id",
          row.stg_region_raw_id,
          error,
        );
      }
    }

    return stats;
  }

  private validateEmployeePayload(payload: Record<string, unknown>): string | null {
    if (!this.hasAnyValue(payload, ["companyId", "internalCompanyId", "sourceCompanyId"])) {
      return "company reference is required";
    }

    return null;
  }

  private validateStorePayload(payload: Record<string, unknown>): string | null {
    if (!this.hasAnyValue(payload, ["companyId", "internalCompanyId", "sourceCompanyId"])) {
      return "company reference is required";
    }

    if (!this.hasAnyValue(payload, ["regionId", "internalRegionId", "sourceRegionId"])) {
      return "region reference is required";
    }

    return null;
  }

  private validateKpiPayload(payload: Record<string, unknown>): string | null {
    if (!payload["kpiId"] && !payload["kpiCode"] && !payload["sourceMetricId"]) {
      return "kpiId, kpiCode, or sourceMetricId is required";
    }

    if (!payload["periodStart"]) {
      return "periodStart is required";
    }

    if (!payload["periodEnd"]) {
      return "periodEnd is required";
    }

    return null;
  }

  private async resolveKpiDefinitionId(payload: Record<string, unknown>): Promise<string> {
    if (payload["kpiId"]) {
      return String(payload["kpiId"]);
    }

    const kpiCode = payload["kpiCode"] ?? payload["sourceMetricId"];
    if (!kpiCode) {
      throw new Error("kpi definition could not be resolved");
    }

    const result = await this.databaseService.query<{ kpi_id: string }>(
      `
        SELECT kpi_id
        FROM ops.kpi_definition
        WHERE kpi_code = $1
          AND is_active = TRUE
        LIMIT 1
      `,
      [String(kpiCode)],
    );

    if (result.rowCount === 0) {
      throw new Error(`kpi definition could not be resolved for code: ${String(kpiCode)}`);
    }

    return result.rows[0].kpi_id;
  }

  private validateAssignmentPayload(payload: Record<string, unknown>): string | null {
    if (!this.hasAnyValue(payload, ["employeeId", "internalEmployeeId", "sourceEmployeeId"])) {
      return "employee reference is required";
    }

    if (!this.hasAnyValue(payload, ["storeId", "internalStoreId", "sourceStoreId"])) {
      return "store reference is required";
    }

    if (!this.hasAnyValue(payload, ["positionId", "internalPositionId", "sourcePositionId"])) {
      return "position reference is required";
    }

    if (!payload["startDate"]) {
      return "startDate is required";
    }

    return null;
  }

  private validatePositionPayload(payload: Record<string, unknown>): string | null {
    if (!this.hasAnyValue(payload, ["companyId", "internalCompanyId", "sourceCompanyId"])) {
      return "company reference is required";
    }

    if (!this.hasAnyValue(payload, ["positionCode", "sourcePositionId"])) {
      return "positionCode or sourcePositionId is required";
    }

    return null;
  }

  private validateCompanyPayload(payload: Record<string, unknown>): string | null {
    if (!this.hasAnyValue(payload, ["companyCode", "sourceCompanyId"])) {
      return "companyCode or sourceCompanyId is required";
    }

    return null;
  }

  private validateRegionPayload(payload: Record<string, unknown>): string | null {
    if (!this.hasAnyValue(payload, ["companyId", "internalCompanyId", "sourceCompanyId"])) {
      return "company reference is required";
    }

    if (!this.hasAnyValue(payload, ["regionCode", "sourceRegionId"])) {
      return "regionCode or sourceRegionId is required";
    }

    return null;
  }

  private hasAnyValue(payload: Record<string, unknown>, keys: string[]): boolean {
    return keys.some((key) => {
      const value = payload[key];
      return value !== undefined && value !== null && String(value).trim() !== "";
    });
  }

  private async resolveRegionIdForStore(storeId: string): Promise<string> {
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

  private async resolveStoreOrgScope(
    storeId: string,
    cache: Map<string, { companyId: string | null; regionId: string | null }>,
  ): Promise<{ companyId: string | null; regionId: string | null }> {
    const cached = cache.get(storeId);
    if (cached) {
      return cached;
    }

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

    if (result.rowCount === 0) {
      throw new Error("store organization scope could not be resolved");
    }

    const scope = {
      companyId: result.rows[0].company_id,
      regionId: result.rows[0].region_id,
    };
    cache.set(storeId, scope);

    return scope;
  }

  private async markRawRowProcessed(
    tableName:
      | "stg.employee_raw"
      | "stg.store_raw"
      | "stg.kpi_raw"
      | "stg.assignment_raw"
      | "stg.position_raw"
      | "stg.company_raw"
      | "stg.region_raw",
    idColumn:
      | "stg_employee_raw_id"
      | "stg_store_raw_id"
      | "stg_kpi_raw_id"
      | "stg_assignment_raw_id"
      | "stg_position_raw_id"
      | "stg_company_raw_id"
      | "stg_region_raw_id",
    rowId: string,
  ): Promise<void> {
    await this.databaseService.query(
      `
        UPDATE ${tableName}
        SET
          processed_flag = TRUE,
          processed_at = NOW(),
          normalized_status = 'processed',
          validation_error = NULL
        WHERE ${idColumn} = $1::uuid
      `,
      [rowId],
    );
  }

  private async markRawRowValidationFailed(
    tableName:
      | "stg.employee_raw"
      | "stg.store_raw"
      | "stg.kpi_raw"
      | "stg.assignment_raw"
      | "stg.position_raw"
      | "stg.company_raw"
      | "stg.region_raw",
    idColumn:
      | "stg_employee_raw_id"
      | "stg_store_raw_id"
      | "stg_kpi_raw_id"
      | "stg_assignment_raw_id"
      | "stg_position_raw_id"
      | "stg_company_raw_id"
      | "stg_region_raw_id",
    rowId: string,
    errorMessage: string,
  ): Promise<void> {
    await this.databaseService.query(
      `
        UPDATE ${tableName}
        SET processed_flag = TRUE, processed_at = NOW(), normalized_status = 'validation_failed', validation_error = $1
        WHERE ${idColumn} = $2::uuid
      `,
      [errorMessage, rowId],
    );
  }

  private async markRawRowRetryableError(
    tableName:
      | "stg.employee_raw"
      | "stg.store_raw"
      | "stg.kpi_raw"
      | "stg.assignment_raw"
      | "stg.position_raw"
      | "stg.company_raw"
      | "stg.region_raw",
    idColumn:
      | "stg_employee_raw_id"
      | "stg_store_raw_id"
      | "stg_kpi_raw_id"
      | "stg_assignment_raw_id"
      | "stg_position_raw_id"
      | "stg_company_raw_id"
      | "stg_region_raw_id",
    rowId: string,
    error: unknown,
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStructuredError(this.logger, "import_batch.row.retryable_error", error, {
      tableName,
      rowId,
    });

    await this.databaseService.query(
      `
        UPDATE ${tableName}
        SET processed_flag = FALSE, normalized_status = 'retryable_error', validation_error = $1, processed_at = NULL
        WHERE ${idColumn} = $2::uuid
      `,
      [errorMessage, rowId],
    );
  }

  private async recordImportBatchAuditEvent(
    batchId: string,
    eventType: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.databaseService.query(
      `
        INSERT INTO audit.event_log (
          actor_user_id,
          event_type,
          entity_name,
          entity_id,
          scope_type,
          metadata_json
        )
        VALUES (NULL, $1, 'stg.import_batch', $2::uuid, 'company', $3::jsonb)
      `,
      [
        eventType,
        batchId,
        JSON.stringify({
          correlationId: RequestContextStore.getCorrelationId(),
          ...metadata,
        }),
      ],
    );
  }
}
