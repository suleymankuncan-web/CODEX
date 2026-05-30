import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { logStructuredError, redactSensitiveLogValue } from "../../../shared/structured-log";
import { ExternalIdMappingService } from "./external-id-mapping.service";
import { type MaterializationStats } from "./kpi-materialization.service";
import { MaterializationRowStatusRepository } from "../infrastructure/materialization-row-status.repository";
import { RegionMaterializationRepository } from "../infrastructure/region-materialization.repository";

@Injectable()
export class RegionMaterializationService {
  private readonly logger = new Logger(RegionMaterializationService.name);

  constructor(
    private readonly regionMaterializationRepository: RegionMaterializationRepository,
    private readonly externalIdMappingService: ExternalIdMappingService,
    private readonly rowStatusRepository: MaterializationRowStatusRepository,
  ) {}

  async materializeRegions(input: {
    batchId: string;
    integrationSourceId: string;
  }): Promise<MaterializationStats> {
    const rows = await this.regionMaterializationRepository.listPendingRegionRows(
      input.batchId,
    );

    const stats: MaterializationStats = {
      processedCount: 0,
      errorCount: 0,
      hasRetryableFailure: false,
    };

    for (const row of rows) {
      const payload = row.payloadJson;
      const validationError = this.validateRegionPayload(payload);

      if (validationError) {
        stats.errorCount += 1;
        await this.rowStatusRepository.markRawRowValidationFailed(
          "region",
          row.stgRegionRawId,
          validationError,
        );
        continue;
      }

      try {
        const companyId = await this.externalIdMappingService.resolveRequiredInternalId({
          payload,
          integrationSourceId: input.integrationSourceId,
          entityType: "company",
          directKeys: ["companyId", "internalCompanyId"],
          externalKeys: ["sourceCompanyId", "companyExternalRef"],
          missingMessage: "company reference is required",
          unresolvedMessage: "company reference could not be resolved",
        });

        const regionId = await this.regionMaterializationRepository.upsertRegion({
          regionId: String(payload["regionId"] ?? payload["internalRegionId"] ?? randomUUID()),
          companyId,
          regionCode: String(payload["regionCode"] ?? payload["sourceRegionId"]),
          regionName: String(payload["regionName"] ?? payload["regionCode"] ?? payload["sourceRegionId"]),
          status: String(payload["status"] ?? "active"),
        });

        if (payload["sourceRegionId"]) {
          await this.externalIdMappingService.upsertMapping({
            integrationSourceId: input.integrationSourceId,
            entityType: "region",
            externalId: String(payload["sourceRegionId"]),
            internalId: regionId,
            internalTableName: "ops.region",
          });
        }

        await this.rowStatusRepository.markRawRowProcessed("region", row.stgRegionRawId);
        stats.processedCount += 1;
      } catch (error) {
        stats.errorCount += 1;
        stats.hasRetryableFailure = true;
        await this.markRawRowRetryableError(row.stgRegionRawId, error);
      }
    }

    return stats;
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

  private async markRawRowRetryableError(
    rowId: string,
    error: unknown,
  ): Promise<void> {
    const errorMessage = String(redactSensitiveLogValue(error instanceof Error ? error.message : String(error)));
    logStructuredError(this.logger, "import_batch.row.retryable_error", error, {
      tableName: this.rowStatusRepository.getRawTableName("region"),
      rowId,
    });

    await this.rowStatusRepository.markRawRowRetryableError("region", rowId, errorMessage);
  }
}
