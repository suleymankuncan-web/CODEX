import { Module } from "@nestjs/common";
import { IntegrationController } from "./web/integration.controller";
import { IntegrationService } from "./application/integration.service";
import { IntegrationRepository } from "./infrastructure/integration.repository";
import { IntegrationSourceRepository } from "./infrastructure/integration-source.repository";
import { MaterializationService } from "./application/materialization.service";
import { ExternalIdMappingService } from "./application/external-id-mapping.service";
import { KpiImportNormalizationService } from "./application/kpi-import-normalization.service";
import { IntegrationSchedulerService } from "./application/integration-scheduler.service";
import { PowerBiExportUploadService } from "./application/power-bi-export-upload.service";
import { MasterDataBootstrapService } from "./application/master-data-bootstrap.service";
import { MasterDataBootstrapRepository } from "./infrastructure/master-data-bootstrap.repository";

@Module({
  controllers: [IntegrationController],
  providers: [
    IntegrationService,
    IntegrationRepository,
    IntegrationSourceRepository,
    MaterializationService,
    ExternalIdMappingService,
    KpiImportNormalizationService,
    IntegrationSchedulerService,
    PowerBiExportUploadService,
    MasterDataBootstrapService,
    MasterDataBootstrapRepository,
  ],
  exports: [
    IntegrationService,
    IntegrationRepository,
    IntegrationSourceRepository,
    MaterializationService,
    ExternalIdMappingService,
    KpiImportNormalizationService,
    IntegrationSchedulerService,
    PowerBiExportUploadService,
    MasterDataBootstrapService,
    MasterDataBootstrapRepository,
  ],
})
export class IntegrationModule {}
