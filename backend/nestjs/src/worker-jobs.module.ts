import { Module } from "@nestjs/common";
import { MaterializationService } from "./modules/integration/application/materialization.service";
import { KpiMaterializationService } from "./modules/integration/application/kpi-materialization.service";
import { EmployeeMaterializationService } from "./modules/integration/application/employee-materialization.service";
import { StoreMaterializationService } from "./modules/integration/application/store-materialization.service";
import { ExternalIdMappingService } from "./modules/integration/application/external-id-mapping.service";
import { ExternalIdMappingCommandRepository } from "./modules/integration/infrastructure/external-id-mapping-command.repository";
import { KpiMaterializationRepository } from "./modules/integration/infrastructure/kpi-materialization.repository";
import { MaterializationRowStatusRepository } from "./modules/integration/infrastructure/materialization-row-status.repository";
import { EmployeeMaterializationRepository } from "./modules/integration/infrastructure/employee-materialization.repository";
import { StoreMaterializationRepository } from "./modules/integration/infrastructure/store-materialization.repository";
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
    ExternalIdMappingService,
    ExternalIdMappingCommandRepository,
    KpiMaterializationRepository,
    MaterializationRowStatusRepository,
    EmployeeMaterializationRepository,
    StoreMaterializationRepository,
    SnapshotService,
    KpiConfigRepository,
    SnapshotOperationsRepository,
    SnapshotRunCommandRepository,
  ],
  exports: [MaterializationService, SnapshotService],
})
export class WorkerJobsModule {}
