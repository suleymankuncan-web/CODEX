import { Module } from "@nestjs/common";
import { IntegrationController } from "./web/integration.controller";
import { IntegrationMasterDataQualityController } from "./web/integration-master-data-quality.controller";
import { IntegrationPersonnelMasterController } from "./web/integration-personnel-master.controller";
import { IntegrationService } from "./application/integration.service";
import { IntegrationRepository } from "./infrastructure/integration.repository";
import { ImportBatchReadRepository } from "./infrastructure/import-batch-read.repository";
import { ImportBatchRawWriterRepository } from "./infrastructure/import-batch-raw-writer.repository";
import { ExternalIdMappingCommandRepository } from "./infrastructure/external-id-mapping-command.repository";
import { ExternalIdMappingReadRepository } from "./infrastructure/external-id-mapping-read.repository";
import { KpiMaterializationRepository } from "./infrastructure/kpi-materialization.repository";
import { KpiImportStoreReadRepository } from "./infrastructure/kpi-import-store-read.repository";
import { PersonnelMasterReadRepository } from "./infrastructure/personnel-master-read.repository";
import { IntegrationSourceRepository } from "./infrastructure/integration-source.repository";
import { MaterializationService } from "./application/materialization.service";
import { KpiMaterializationService } from "./application/kpi-materialization.service";
import { MaterializationBatchRepository } from "./infrastructure/materialization-batch.repository";
import { MaterializationRowStatusRepository } from "./infrastructure/materialization-row-status.repository";
import { EmployeeMaterializationService } from "./application/employee-materialization.service";
import { StoreMaterializationService } from "./application/store-materialization.service";
import { AssignmentMaterializationService } from "./application/assignment-materialization.service";
import { PositionMaterializationService } from "./application/position-materialization.service";
import { CompanyMaterializationService } from "./application/company-materialization.service";
import { RegionMaterializationService } from "./application/region-materialization.service";
import { EmployeeMaterializationRepository } from "./infrastructure/employee-materialization.repository";
import { StoreMaterializationRepository } from "./infrastructure/store-materialization.repository";
import { AssignmentMaterializationRepository } from "./infrastructure/assignment-materialization.repository";
import { PositionMaterializationRepository } from "./infrastructure/position-materialization.repository";
import { CompanyMaterializationRepository } from "./infrastructure/company-materialization.repository";
import { RegionMaterializationRepository } from "./infrastructure/region-materialization.repository";
import { ExternalIdMappingService } from "./application/external-id-mapping.service";
import { KpiImportNormalizationService } from "./application/kpi-import-normalization.service";
import { IntegrationSchedulerService } from "./application/integration-scheduler.service";
import { IntegrationImportCommandService } from "./application/integration-import-command.service";
import { PowerBiExportUploadService } from "./application/power-bi-export-upload.service";
import { PowerBiExportParserService } from "./application/power-bi-export-parser.service";
import { PowerBiExportNormalizerService } from "./application/power-bi-export-normalizer.service";
import { MasterDataBootstrapService } from "./application/master-data-bootstrap.service";
import { MasterDataBootstrapRepository } from "./infrastructure/master-data-bootstrap.repository";
import { MasterDataQualityService } from "./application/master-data-quality.service";
import { MasterDataQualityRepository } from "./infrastructure/master-data-quality.repository";
import { PersonnelMasterService } from "./application/personnel-master.service";

@Module({
  controllers: [
    IntegrationController,
    IntegrationMasterDataQualityController,
    IntegrationPersonnelMasterController,
  ],
  providers: [
    IntegrationService,
    PersonnelMasterService,
    IntegrationRepository,
    ImportBatchReadRepository,
    ImportBatchRawWriterRepository,
    ExternalIdMappingCommandRepository,
    ExternalIdMappingReadRepository,
    KpiMaterializationRepository,
    KpiImportStoreReadRepository,
    PersonnelMasterReadRepository,
    IntegrationSourceRepository,
    MaterializationService,
    KpiMaterializationService,
    MaterializationBatchRepository,
    MaterializationRowStatusRepository,
    EmployeeMaterializationService,
    StoreMaterializationService,
    AssignmentMaterializationService,
    PositionMaterializationService,
    CompanyMaterializationService,
    RegionMaterializationService,
    EmployeeMaterializationRepository,
    StoreMaterializationRepository,
    AssignmentMaterializationRepository,
    PositionMaterializationRepository,
    CompanyMaterializationRepository,
    RegionMaterializationRepository,
    ExternalIdMappingService,
    KpiImportNormalizationService,
    IntegrationSchedulerService,
    IntegrationImportCommandService,
    PowerBiExportUploadService,
    PowerBiExportParserService,
    PowerBiExportNormalizerService,
    MasterDataBootstrapService,
    MasterDataBootstrapRepository,
    MasterDataQualityService,
    MasterDataQualityRepository,
  ],
  exports: [
    IntegrationService,
    IntegrationRepository,
    ImportBatchReadRepository,
    ExternalIdMappingCommandRepository,
    ExternalIdMappingReadRepository,
    KpiMaterializationRepository,
    KpiImportStoreReadRepository,
    PersonnelMasterReadRepository,
    IntegrationSourceRepository,
    MaterializationService,
    KpiMaterializationService,
    ExternalIdMappingService,
    KpiImportNormalizationService,
    IntegrationSchedulerService,
    PowerBiExportUploadService,
    PowerBiExportParserService,
    PowerBiExportNormalizerService,
    MasterDataBootstrapService,
    MasterDataBootstrapRepository,
    MasterDataQualityService,
    MasterDataQualityRepository,
  ],
})
export class IntegrationModule {}
