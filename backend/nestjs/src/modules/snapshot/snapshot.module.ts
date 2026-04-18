import { Module } from "@nestjs/common";
import { SnapshotSchedulerService } from "./snapshot-scheduler.service";
import { StoreOpsModule } from "../store-ops/store-ops.module";

@Module({
  imports: [StoreOpsModule],
  providers: [SnapshotSchedulerService],
  exports: [SnapshotSchedulerService],
})
export class SnapshotModule {}
