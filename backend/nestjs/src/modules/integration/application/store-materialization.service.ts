import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { logStructuredError, redactSensitiveLogValue } from "../../../shared/structured-log";
import { ExternalIdMappingService } from "./external-id-mapping.service";
import { type MaterializationStats } from "./kpi-materialization.service";
import { MaterializationRowStatusRepository } from "../infrastructure/materialization-row-status.repository";
import { StoreMaterializationRepository } from "../infrastructure/store-materialization.repository";

@Injectable()
export class StoreMaterializationService {
  private readonly logger = new Logger(StoreMaterializationService.name);

  constructor(
    private readonly storeMaterializationRepository: StoreMaterializationRepository,
    private readonly externalIdMappingService: ExternalIdMappingService,
    private readonly rowStatusRepository: MaterializationRowStatusRepository,
  ) {}

  async materializeStores(input: {
    batchId: string;
    integrationSourceId: string;
  }): Promise<MaterializationStats> {
    const rows = await this.storeMaterializationRepository.listPendingStoreRows(
      input.batchId,
    );

    const stats: MaterializationStats = {
      processedCount: 0,
      errorCount: 0,
      hasRetryableFailure: false,
    };

    for (const row of rows) {
      const payload = row.payloadJson;
      const validationError = this.validateStorePayload(payload);

      if (validationError) {
        stats.errorCount += 1;
        await this.rowStatusRepository.markRawRowValidationFailed(
          "store",
          row.stgStoreRawId,
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
        const regionId = await this.externalIdMappingService.resolveRequiredInternalId({
          payload,
          integrationSourceId: input.integrationSourceId,
          entityType: "region",
          directKeys: ["regionId", "internalRegionId"],
          externalKeys: ["sourceRegionId", "regionExternalRef"],
          missingMessage: "region reference is required",
          unresolvedMessage: "region reference could not be resolved",
        });
        const storeId =
          String(payload["storeId"] ?? payload["internalStoreId"] ?? randomUUID());

        await this.storeMaterializationRepository.upsertStore({
          storeId,
          companyId,
          regionId,
          storeCode: String(payload["sourceStoreId"] ?? payload["storeCode"] ?? storeId),
          storeName: String(payload["storeName"] ?? "Unknown Store"),
          storeType: String(payload["storeType"] ?? "standard"),
          status: String(payload["status"] ?? "active"),
          timezone: String(payload["timezone"] ?? "Europe/Istanbul"),
        });

        await this.externalIdMappingService.upsertMapping({
          integrationSourceId: input.integrationSourceId,
          entityType: "store",
          externalId: String(payload["sourceStoreId"] ?? payload["storeCode"] ?? storeId),
          internalId: storeId,
          internalTableName: "ops.store",
        });

        await this.rowStatusRepository.markRawRowProcessed("store", row.stgStoreRawId);
        stats.processedCount += 1;
      } catch (error) {
        stats.errorCount += 1;
        stats.hasRetryableFailure = true;
        await this.markRawRowRetryableError(row.stgStoreRawId, error);
      }
    }

    return stats;
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
      tableName: this.rowStatusRepository.getRawTableName("store"),
      rowId,
    });

    await this.rowStatusRepository.markRawRowRetryableError("store", rowId, errorMessage);
  }
}
