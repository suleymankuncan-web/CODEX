import { Module } from "@nestjs/common";
import { WorkerMaterializationJobsModule } from "./worker-materialization-jobs.module";
import { WorkerSnapshotJobsModule } from "./worker-snapshot-jobs.module";

@Module({
  imports: [WorkerMaterializationJobsModule, WorkerSnapshotJobsModule],
  exports: [WorkerMaterializationJobsModule, WorkerSnapshotJobsModule],
})
export class WorkerJobsModule {}
