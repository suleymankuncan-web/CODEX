import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { logStructuredError, redactSensitiveLogValue } from "../../../shared/structured-log";
import { ExternalIdMappingService } from "./external-id-mapping.service";
import { type MaterializationStats } from "./kpi-materialization.service";
import { MaterializationRowStatusRepository } from "../infrastructure/materialization-row-status.repository";
import { EmployeeMaterializationRepository } from "../infrastructure/employee-materialization.repository";

@Injectable()
export class EmployeeMaterializationService {
  private readonly logger = new Logger(EmployeeMaterializationService.name);

  constructor(
    private readonly employeeMaterializationRepository: EmployeeMaterializationRepository,
    private readonly externalIdMappingService: ExternalIdMappingService,
    private readonly rowStatusRepository: MaterializationRowStatusRepository,
  ) {}

  async materializeEmployees(input: {
    batchId: string;
    integrationSourceId: string;
  }): Promise<MaterializationStats> {
    const rows = await this.employeeMaterializationRepository.listPendingEmployeeRows(
      input.batchId,
    );

    const stats: MaterializationStats = {
      processedCount: 0,
      errorCount: 0,
      hasRetryableFailure: false,
    };

    for (const row of rows) {
      const payload = row.payloadJson;
      const validationError = this.validateEmployeePayload(payload);

      if (validationError) {
        stats.errorCount += 1;
        await this.rowStatusRepository.markRawRowValidationFailed(
          "employee",
          row.stgEmployeeRawId,
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
          integrationSourceId: input.integrationSourceId,
          entityType: "company",
          directKeys: ["companyId", "internalCompanyId"],
          externalKeys: ["sourceCompanyId", "companyExternalRef"],
          missingMessage: "company reference is required",
          unresolvedMessage: "company reference could not be resolved",
        });

        await this.employeeMaterializationRepository.upsertEmployee({
          employeeId,
          companyId,
          externalEmployeeRef: String(payload["sourceEmployeeId"] ?? payload["employeeNumber"] ?? employeeId),
          firstName: String(payload["firstName"] ?? "Unknown"),
          lastName: String(payload["lastName"] ?? "Unknown"),
          hireDate: String(payload["hireDate"] ?? new Date().toISOString().slice(0, 10)),
          employmentStatus: String(payload["employmentStatus"] ?? "active"),
          employmentType: String(payload["employmentType"] ?? "full_time"),
        });

        await this.externalIdMappingService.upsertMapping({
          integrationSourceId: input.integrationSourceId,
          entityType: "employee",
          externalId: String(payload["sourceEmployeeId"] ?? payload["employeeNumber"] ?? employeeId),
          internalId: employeeId,
          internalTableName: "ops.employee",
        });

        await this.rowStatusRepository.markRawRowProcessed(
          "employee",
          row.stgEmployeeRawId,
        );
        stats.processedCount += 1;
      } catch (error) {
        stats.errorCount += 1;
        stats.hasRetryableFailure = true;
        await this.markRawRowRetryableError(row.stgEmployeeRawId, error);
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
      tableName: this.rowStatusRepository.getRawTableName("employee"),
      rowId,
    });

    await this.rowStatusRepository.markRawRowRetryableError("employee", rowId, errorMessage);
  }
}
