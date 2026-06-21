import { Injectable, Logger } from "@nestjs/common";
import { logStructuredError, redactSensitiveLogValue } from "../../../shared/structured-log";
import { KpiMaterializationRepository } from "../infrastructure/kpi-materialization.repository";
import { ExternalIdMappingService } from "./external-id-mapping.service";
import {
  GSM_APPROVAL_KPI_CODE,
  LEGACY_GSM_ONAY_KPI_CODE,
  normalizeGsmApprovalKpiCode,
} from "./gsm-approval-normalization";

export type MaterializationStats = {
  processedCount: number;
  errorCount: number;
  hasRetryableFailure: boolean;
};

export type KpiBatchEnvelope = {
  sourceBatchId: string | null;
  sourcePayloadHash: string | null;
  sourceCapturedAt: string | null;
};

@Injectable()
export class KpiMaterializationService {
  private readonly logger = new Logger(KpiMaterializationService.name);

  constructor(
    private readonly kpiMaterializationRepository: KpiMaterializationRepository,
    private readonly externalIdMappingService: ExternalIdMappingService,
  ) {}

  async materializeKpis(input: {
    batchId: string;
    integrationSourceId: string;
    batchEnvelope: KpiBatchEnvelope;
  }): Promise<MaterializationStats> {
    const rows = await this.kpiMaterializationRepository.listPendingKpiRows(
      input.batchId,
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

    for (const row of rows) {
      const payload = row.payloadJson;
      const validationError = this.validateKpiPayload(payload);
      if (validationError) {
        stats.errorCount += 1;
        await this.kpiMaterializationRepository.markKpiRawRowValidationFailed(
          row.stgKpiRawId,
          validationError,
        );
        continue;
      }

      try {
        const kpiId = await this.resolveKpiDefinitionId(payload);
        const companyId = await this.externalIdMappingService.resolveOptionalInternalId({
          payload,
          integrationSourceId: input.integrationSourceId,
          entityType: "company",
          directKeys: ["companyId", "internalCompanyId"],
          externalKeys: ["sourceCompanyId", "companyExternalRef"],
        });
        const regionId = await this.externalIdMappingService.resolveOptionalInternalId({
          payload,
          integrationSourceId: input.integrationSourceId,
          entityType: "region",
          directKeys: ["regionId", "internalRegionId"],
          externalKeys: ["sourceRegionId", "regionExternalRef"],
        });
        const storeId = await this.externalIdMappingService.resolveOptionalInternalId({
          payload,
          integrationSourceId: input.integrationSourceId,
          entityType: "store",
          directKeys: ["storeId", "internalStoreId"],
          externalKeys: ["sourceStoreId", "storeExternalRef"],
        });
        const employeeId = await this.externalIdMappingService.resolveOptionalInternalId({
          payload,
          integrationSourceId: input.integrationSourceId,
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
        const achievementRate =
          payload["achievementRate"] === null || payload["achievementRate"] === undefined
            ? null
            : Number(payload["achievementRate"]);
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
          await this.kpiMaterializationRepository.upsertStoreKpiActual({
            kpiId,
            companyId: companyIdToPersist,
            regionId: regionIdToPersist,
            storeId,
            periodType,
            periodStart,
            periodEnd,
            actualValue,
            achievementRate,
            batchEnvelope: input.batchEnvelope,
          });

          if (targetValue !== null && Number.isFinite(targetValue) && targetValue > 0) {
            await this.kpiMaterializationRepository.replaceStoreKpiTarget({
              kpiId,
              companyId: companyIdToPersist,
              regionId: regionIdToPersist,
              storeId,
              periodType,
              periodStart,
              periodEnd,
              targetValue,
            });
          }
        } else {
          await this.kpiMaterializationRepository.upsertEmployeeKpiActual({
            kpiId,
            companyId: companyIdToPersist,
            regionId: regionIdToPersist,
            storeId,
            employeeId: employeeIdToPersist,
            periodType,
            periodStart,
            periodEnd,
            actualValue,
            achievementRate,
            batchEnvelope: input.batchEnvelope,
          });
        }

        await this.kpiMaterializationRepository.markKpiRawRowProcessed(row.stgKpiRawId);
        stats.processedCount += 1;
      } catch (error) {
        stats.errorCount += 1;
        stats.hasRetryableFailure = true;
        await this.markKpiRawRowRetryableError(row.stgKpiRawId, error);
      }
    }

    return stats;
  }

  private validateKpiPayload(payload: Record<string, unknown>): string | null {
    if (typeof payload["validationError"] === "string" && payload["validationError"].trim()) {
      return payload["validationError"].trim();
    }

    if (!payload["kpiId"] && !payload["kpiCode"] && !payload["sourceMetricId"]) {
      return "kpiId, kpiCode, or sourceMetricId is required";
    }

    if (!payload["periodStart"]) {
      return "periodStart is required";
    }

    if (!payload["periodEnd"]) {
      return "periodEnd is required";
    }

    const kpiCode = normalizeGsmApprovalKpiCode(payload["kpiCode"] ?? payload["sourceMetricId"]);
    if (kpiCode === GSM_APPROVAL_KPI_CODE) {
      const actualValue = Number(payload["actualValue"]);
      if (!Number.isFinite(actualValue) || actualValue < 0 || actualValue > 100) {
        return "gsm_approval actualValue must be between 0 and 100";
      }

      const achievementRate = Number(payload["achievementRate"]);
      if (!Number.isFinite(achievementRate) || achievementRate < 0 || achievementRate > 1) {
        return "gsm_approval achievementRate must be between 0 and 1";
      }
    }

    return null;
  }

  private async resolveKpiDefinitionId(payload: Record<string, unknown>): Promise<string> {
    if (payload["kpiId"]) {
      return String(payload["kpiId"]);
    }

    const kpiCode = normalizeGsmApprovalKpiCode(payload["kpiCode"] ?? payload["sourceMetricId"]);
    if (!kpiCode) {
      throw new Error("kpi definition could not be resolved");
    }

    const kpiId = await this.kpiMaterializationRepository.findKpiDefinitionIdByCode(
      String(kpiCode),
    );

    if (!kpiId) {
      const legacyKpiId =
        kpiCode === GSM_APPROVAL_KPI_CODE
          ? await this.kpiMaterializationRepository.findKpiDefinitionIdByCode(
              LEGACY_GSM_ONAY_KPI_CODE,
            )
          : null;

      if (legacyKpiId) {
        return legacyKpiId;
      }

      throw new Error(`kpi definition could not be resolved for code: ${String(kpiCode)}`);
    }

    return kpiId;
  }

  private async resolveStoreOrgScope(
    storeId: string,
    cache: Map<string, { companyId: string | null; regionId: string | null }>,
  ): Promise<{ companyId: string | null; regionId: string | null }> {
    const cached = cache.get(storeId);
    if (cached) {
      return cached;
    }

    const scope = await this.kpiMaterializationRepository.getStoreOrgScope(storeId);

    if (!scope) {
      throw new Error("store organization scope could not be resolved");
    }

    cache.set(storeId, scope);

    return scope;
  }

  private async markKpiRawRowRetryableError(
    rowId: string,
    error: unknown,
  ): Promise<void> {
    const errorMessage = String(redactSensitiveLogValue(error instanceof Error ? error.message : String(error)));
    logStructuredError(this.logger, "import_batch.row.retryable_error", error, {
      tableName: "stg.kpi_raw",
      rowId,
    });

    await this.kpiMaterializationRepository.markKpiRawRowRetryableError(
      rowId,
      errorMessage,
    );
  }
}
