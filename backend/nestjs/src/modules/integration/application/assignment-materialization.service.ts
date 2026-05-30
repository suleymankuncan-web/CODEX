import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { logStructuredError, redactSensitiveLogValue } from "../../../shared/structured-log";
import { ExternalIdMappingService } from "./external-id-mapping.service";
import { type MaterializationStats } from "./kpi-materialization.service";
import { MaterializationRowStatusRepository } from "../infrastructure/materialization-row-status.repository";
import { AssignmentMaterializationRepository } from "../infrastructure/assignment-materialization.repository";

@Injectable()
export class AssignmentMaterializationService {
  private readonly logger = new Logger(AssignmentMaterializationService.name);

  constructor(
    private readonly assignmentMaterializationRepository: AssignmentMaterializationRepository,
    private readonly externalIdMappingService: ExternalIdMappingService,
    private readonly rowStatusRepository: MaterializationRowStatusRepository,
  ) {}

  async materializeAssignments(input: {
    batchId: string;
    integrationSourceId: string;
  }): Promise<MaterializationStats> {
    const rows = await this.assignmentMaterializationRepository.listPendingAssignmentRows(
      input.batchId,
    );

    const stats: MaterializationStats = {
      processedCount: 0,
      errorCount: 0,
      hasRetryableFailure: false,
    };

    for (const row of rows) {
      const payload = row.payloadJson;
      const validationError = this.validateAssignmentPayload(payload);

      if (validationError) {
        stats.errorCount += 1;
        await this.rowStatusRepository.markRawRowValidationFailed(
          "assignment",
          row.stgAssignmentRawId,
          validationError,
        );
        continue;
      }

      try {
        const employeeId = await this.externalIdMappingService.resolveRequiredInternalId({
          payload,
          integrationSourceId: input.integrationSourceId,
          entityType: "employee",
          directKeys: ["employeeId", "internalEmployeeId"],
          externalKeys: ["sourceEmployeeId", "employeeExternalRef"],
          missingMessage: "employee reference is required",
          unresolvedMessage: "employee reference could not be resolved",
        });
        const storeId = await this.externalIdMappingService.resolveRequiredInternalId({
          payload,
          integrationSourceId: input.integrationSourceId,
          entityType: "store",
          directKeys: ["storeId", "internalStoreId"],
          externalKeys: ["sourceStoreId", "storeExternalRef"],
          missingMessage: "store reference is required",
          unresolvedMessage: "store reference could not be resolved",
        });
        const positionId = await this.externalIdMappingService.resolveRequiredInternalId({
          payload,
          integrationSourceId: input.integrationSourceId,
          entityType: "position",
          directKeys: ["positionId", "internalPositionId"],
          externalKeys: ["sourcePositionId", "positionExternalRef"],
          missingMessage: "position reference is required",
          unresolvedMessage: "position reference could not be resolved",
        });
        const regionId = await this.assignmentMaterializationRepository.resolveRegionIdForStore(
          storeId,
        );
        const managerEmployeeId = await this.externalIdMappingService.resolveOptionalInternalId({
          payload,
          integrationSourceId: input.integrationSourceId,
          entityType: "employee",
          directKeys: ["managerEmployeeId", "internalManagerEmployeeId"],
          externalKeys: ["sourceManagerEmployeeId", "managerEmployeeExternalRef"],
        });

        const assignmentId =
          (await this.externalIdMappingService.resolveOptionalInternalId({
            payload,
            integrationSourceId: input.integrationSourceId,
            entityType: "assignment",
            directKeys: ["assignmentId", "internalAssignmentId"],
            externalKeys: ["sourceAssignmentId"],
          })) ?? randomUUID();

        await this.assignmentMaterializationRepository.upsertAssignment({
          assignmentId,
          employeeId,
          storeId,
          regionId,
          positionId,
          managerEmployeeId,
          startDate: String(payload["startDate"]),
          endDate: payload["endDate"] ? String(payload["endDate"]) : null,
          isPrimaryAssignment: Boolean(payload["isPrimaryAssignment"] ?? true),
          fteRatio: Number(payload["fteRatio"] ?? 1),
          assignmentStatus: String(payload["assignmentStatus"] ?? "active"),
        });

        if (payload["sourceAssignmentId"]) {
          await this.externalIdMappingService.upsertMapping({
            integrationSourceId: input.integrationSourceId,
            entityType: "assignment",
            externalId: String(payload["sourceAssignmentId"]),
            internalId: assignmentId,
            internalTableName: "ops.employee_assignment_history",
          });
        }

        await this.rowStatusRepository.markRawRowProcessed(
          "assignment",
          row.stgAssignmentRawId,
        );
        stats.processedCount += 1;
      } catch (error) {
        stats.errorCount += 1;
        stats.hasRetryableFailure = true;
        await this.markRawRowRetryableError(row.stgAssignmentRawId, error);
      }
    }

    return stats;
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

  private hasAnyValue(payload: Record<string, unknown>, keys: string[]): boolean {
    return keys.some((key) => {
      const value = payload[key];
      return value !== undefined && value !== null && String(value).trim() !== "";
    });
  }

  private async markRawRowRetryableError(
    rowId: string,
    error: unknown,
  ): Promise<void> {
    const errorMessage = String(redactSensitiveLogValue(error instanceof Error ? error.message : String(error)));
    logStructuredError(this.logger, "import_batch.row.retryable_error", error, {
      tableName: this.rowStatusRepository.getRawTableName("assignment"),
      rowId,
    });

    await this.rowStatusRepository.markRawRowRetryableError("assignment", rowId, errorMessage);
  }
}
