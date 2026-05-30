import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { logStructuredError, redactSensitiveLogValue } from "../../../shared/structured-log";
import { ExternalIdMappingService } from "./external-id-mapping.service";
import { type MaterializationStats } from "./kpi-materialization.service";
import { MaterializationRowStatusRepository } from "../infrastructure/materialization-row-status.repository";
import { CompanyMaterializationRepository } from "../infrastructure/company-materialization.repository";

@Injectable()
export class CompanyMaterializationService {
  private readonly logger = new Logger(CompanyMaterializationService.name);

  constructor(
    private readonly companyMaterializationRepository: CompanyMaterializationRepository,
    private readonly externalIdMappingService: ExternalIdMappingService,
    private readonly rowStatusRepository: MaterializationRowStatusRepository,
  ) {}

  async materializeCompanies(input: {
    batchId: string;
    integrationSourceId: string;
  }): Promise<MaterializationStats> {
    const rows = await this.companyMaterializationRepository.listPendingCompanyRows(
      input.batchId,
    );

    const stats: MaterializationStats = {
      processedCount: 0,
      errorCount: 0,
      hasRetryableFailure: false,
    };

    for (const row of rows) {
      const payload = row.payloadJson;
      const validationError = this.validateCompanyPayload(payload);

      if (validationError) {
        stats.errorCount += 1;
        await this.rowStatusRepository.markRawRowValidationFailed(
          "company",
          row.stgCompanyRawId,
          validationError,
        );
        continue;
      }

      try {
        const companyId = await this.companyMaterializationRepository.upsertCompany({
          companyId: String(payload["companyId"] ?? payload["internalCompanyId"] ?? randomUUID()),
          companyCode: String(payload["companyCode"] ?? payload["sourceCompanyId"]),
          companyName: String(payload["companyName"] ?? payload["companyCode"] ?? payload["sourceCompanyId"]),
          status: String(payload["status"] ?? "active"),
        });

        if (payload["sourceCompanyId"]) {
          await this.externalIdMappingService.upsertMapping({
            integrationSourceId: input.integrationSourceId,
            entityType: "company",
            externalId: String(payload["sourceCompanyId"]),
            internalId: companyId,
            internalTableName: "ops.company",
          });
        }

        await this.rowStatusRepository.markRawRowProcessed("company", row.stgCompanyRawId);
        stats.processedCount += 1;
      } catch (error) {
        stats.errorCount += 1;
        stats.hasRetryableFailure = true;
        await this.markRawRowRetryableError(row.stgCompanyRawId, error);
      }
    }

    return stats;
  }

  private validateCompanyPayload(payload: Record<string, unknown>): string | null {
    if (!this.hasAnyValue(payload, ["companyCode", "sourceCompanyId"])) {
      return "companyCode or sourceCompanyId is required";
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
      tableName: this.rowStatusRepository.getRawTableName("company"),
      rowId,
    });

    await this.rowStatusRepository.markRawRowRetryableError("company", rowId, errorMessage);
  }
}
