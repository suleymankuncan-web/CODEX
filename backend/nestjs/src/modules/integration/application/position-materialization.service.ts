import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { logStructuredError, redactSensitiveLogValue } from "../../../shared/structured-log";
import { ExternalIdMappingService } from "./external-id-mapping.service";
import { type MaterializationStats } from "./kpi-materialization.service";
import { MaterializationRowStatusRepository } from "../infrastructure/materialization-row-status.repository";
import { PositionMaterializationRepository } from "../infrastructure/position-materialization.repository";

@Injectable()
export class PositionMaterializationService {
  private readonly logger = new Logger(PositionMaterializationService.name);

  constructor(
    private readonly positionMaterializationRepository: PositionMaterializationRepository,
    private readonly externalIdMappingService: ExternalIdMappingService,
    private readonly rowStatusRepository: MaterializationRowStatusRepository,
  ) {}

  async materializePositions(input: {
    batchId: string;
    integrationSourceId: string;
  }): Promise<MaterializationStats> {
    const rows = await this.positionMaterializationRepository.listPendingPositionRows(
      input.batchId,
    );

    const stats: MaterializationStats = {
      processedCount: 0,
      errorCount: 0,
      hasRetryableFailure: false,
    };

    for (const row of rows) {
      const payload = row.payloadJson;
      const validationError = this.validatePositionPayload(payload);

      if (validationError) {
        stats.errorCount += 1;
        await this.rowStatusRepository.markRawRowValidationFailed(
          "position",
          row.stgPositionRawId,
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
          integrationSourceId: input.integrationSourceId,
          entityType: "company",
          directKeys: ["companyId", "internalCompanyId"],
          externalKeys: ["sourceCompanyId", "companyExternalRef"],
          missingMessage: "company reference is required",
          unresolvedMessage: "company reference could not be resolved",
        });
        const positionId = await this.positionMaterializationRepository.upsertPosition({
          positionId: String(payload["positionId"] ?? payload["internalPositionId"] ?? randomUUID()),
          companyId,
          positionCode,
          positionName: String(payload["positionName"] ?? positionCode),
          jobFamily: payload["jobFamily"] ? String(payload["jobFamily"]) : null,
          isManagerial: Boolean(payload["isManagerial"] ?? false),
        });

        if (sourcePositionId) {
          await this.externalIdMappingService.upsertMapping({
            integrationSourceId: input.integrationSourceId,
            entityType: "position",
            externalId: sourcePositionId,
            internalId: positionId,
            internalTableName: "ops.position",
          });
        }

        await this.rowStatusRepository.markRawRowProcessed("position", row.stgPositionRawId);
        stats.processedCount += 1;
      } catch (error) {
        stats.errorCount += 1;
        stats.hasRetryableFailure = true;
        await this.markRawRowRetryableError(row.stgPositionRawId, error);
      }
    }

    return stats;
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
      tableName: this.rowStatusRepository.getRawTableName("position"),
      rowId,
    });

    await this.rowStatusRepository.markRawRowRetryableError("position", rowId, errorMessage);
  }
}
