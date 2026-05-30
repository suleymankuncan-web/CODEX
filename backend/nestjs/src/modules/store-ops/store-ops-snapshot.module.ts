import { Module } from "@nestjs/common";
import { SnapshotService } from "./application/snapshot.service";
import { KpiConfigRepository } from "./infrastructure/kpi-config.repository";
import { SnapshotOperationsRepository } from "./infrastructure/snapshot-operations.repository";
import { SnapshotRunCommandRepository } from "./infrastructure/snapshot-run-command.repository";
import { SnapshotController } from "./web/snapshot.controller";

@Module({
  controllers: [SnapshotController],
  providers: [
    SnapshotService,
    KpiConfigRepository,
    SnapshotOperationsRepository,
    SnapshotRunCommandRepository,
  ],
  exports: [SnapshotService, SnapshotOperationsRepository],
})
export class StoreOpsSnapshotModule {}
