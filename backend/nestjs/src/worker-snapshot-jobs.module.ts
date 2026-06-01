import { Module } from "@nestjs/common";
import { SnapshotService } from "./modules/store-ops/application/snapshot.service";
import { KpiConfigRepository } from "./modules/store-ops/infrastructure/kpi-config.repository";
import { SnapshotOperationsRepository } from "./modules/store-ops/infrastructure/snapshot-operations.repository";
import { SnapshotRunCommandRepository } from "./modules/store-ops/infrastructure/snapshot-run-command.repository";

@Module({
  providers: [
    SnapshotService,
    KpiConfigRepository,
    SnapshotOperationsRepository,
    SnapshotRunCommandRepository,
  ],
  exports: [SnapshotService],
})
export class WorkerSnapshotJobsModule {}
