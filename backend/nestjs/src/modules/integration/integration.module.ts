import { Module } from "@nestjs/common";
import { IntegrationController } from "./web/integration.controller";
import { IntegrationService } from "./application/integration.service";
import { IntegrationRepository } from "./infrastructure/integration.repository";
import { MaterializationService } from "./application/materialization.service";
import { ExternalIdMappingService } from "./application/external-id-mapping.service";
import { KpiImportNormalizationService } from "./application/kpi-import-normalization.service";
import { IntegrationSchedulerService } from "./application/integration-scheduler.service";
import { PowerBiExportUploadService } from "./application/power-bi-export-upload.service";

@Module({
  controllers: [IntegrationController],
  providers: [
    IntegrationService,
    IntegrationRepository,
    MaterializationService,
    ExternalIdMappingService,
    KpiImportNormalizationService,
    IntegrationSchedulerService,
    PowerBiExportUploadService,
  ],
  exports: [
    IntegrationService,
    IntegrationRepository,
    MaterializationService,
    ExternalIdMappingService,
    KpiImportNormalizationService,
    IntegrationSchedulerService,
    PowerBiExportUploadService,
  ],
})
export class IntegrationModule {}
