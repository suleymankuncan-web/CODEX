import { Module } from "@nestjs/common";
import { MaterializationService } from "./modules/integration/application/materialization.service";
import { KpiMaterializationService } from "./modules/integration/application/kpi-materialization.service";
import { EmployeeMaterializationService } from "./modules/integration/application/employee-materialization.service";
import { StoreMaterializationService } from "./modules/integration/application/store-materialization.service";
import { AssignmentMaterializationService } from "./modules/integration/application/assignment-materialization.service";
import { PositionMaterializationService } from "./modules/integration/application/position-materialization.service";
import { CompanyMaterializationService } from "./modules/integration/application/company-materialization.service";
import { RegionMaterializationService } from "./modules/integration/application/region-materialization.service";
import { ExternalIdMappingService } from "./modules/integration/application/external-id-mapping.service";
import { ExternalIdMappingCommandRepository } from "./modules/integration/infrastructure/external-id-mapping-command.repository";
import { KpiMaterializationRepository } from "./modules/integration/infrastructure/kpi-materialization.repository";
import { MaterializationBatchRepository } from "./modules/integration/infrastructure/materialization-batch.repository";
import { MaterializationRowStatusRepository } from "./modules/integration/infrastructure/materialization-row-status.repository";
import { EmployeeMaterializationRepository } from "./modules/integration/infrastructure/employee-materialization.repository";
import { StoreMaterializationRepository } from "./modules/integration/infrastructure/store-materialization.repository";
import { AssignmentMaterializationRepository } from "./modules/integration/infrastructure/assignment-materialization.repository";
import { PositionMaterializationRepository } from "./modules/integration/infrastructure/position-materialization.repository";
import { CompanyMaterializationRepository } from "./modules/integration/infrastructure/company-materialization.repository";
import { RegionMaterializationRepository } from "./modules/integration/infrastructure/region-materialization.repository";
import { SnapshotService } from "./modules/store-ops/application/snapshot.service";
import { KpiConfigRepository } from "./modules/store-ops/infrastructure/kpi-config.repository";
import { SnapshotOperationsRepository } from "./modules/store-ops/infrastructure/snapshot-operations.repository";
import { SnapshotRunCommandRepository } from "./modules/store-ops/infrastructure/snapshot-run-command.repository";

@Module({
  providers: [
    MaterializationService,
    KpiMaterializationService,
    EmployeeMaterializationService,
    StoreMaterializationService,
    AssignmentMaterializationService,
    PositionMaterializationService,
    CompanyMaterializationService,
    RegionMaterializationService,
    ExternalIdMappingService,
    ExternalIdMappingCommandRepository,
    KpiMaterializationRepository,
    MaterializationBatchRepository,
    MaterializationRowStatusRepository,
    EmployeeMaterializationRepository,
    StoreMaterializationRepository,
    AssignmentMaterializationRepository,
    PositionMaterializationRepository,
    CompanyMaterializationRepository,
    RegionMaterializationRepository,
    SnapshotService,
    KpiConfigRepository,
    SnapshotOperationsRepository,
    SnapshotRunCommandRepository,
  ],
  exports: [MaterializationService, SnapshotService],
})
export class WorkerJobsModule {}
