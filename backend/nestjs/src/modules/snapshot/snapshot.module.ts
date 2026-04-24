import { Module } from "@nestjs/common";
import { SnapshotSchedulerService } from "./snapshot-scheduler.service";
import { StoreOpsModule } from "../store-ops/store-ops.module";
import { SnapshotSchedulerController } from "./snapshot-scheduler.controller";
import { SnapshotDailyClosureWorkerService } from "./snapshot-daily-closure-worker.service";

@Module({
  imports: [StoreOpsModule],
  controllers: [SnapshotSchedulerController],
  providers: [SnapshotSchedulerService, SnapshotDailyClosureWorkerService],
  exports: [SnapshotSchedulerService],
})
export class SnapshotModule {}
