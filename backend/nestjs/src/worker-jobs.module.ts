import { Module } from "@nestjs/common";
import { WorkerMaterializationJobsModule } from "./worker-materialization-jobs.module";
import { WorkerSnapshotJobsModule } from "./worker-snapshot-jobs.module";
import { WorkerVisualComparisonJobsModule } from "./worker-visual-comparison-jobs.module";

@Module({
  imports: [
    WorkerMaterializationJobsModule,
    WorkerSnapshotJobsModule,
    WorkerVisualComparisonJobsModule,
  ],
  exports: [
    WorkerMaterializationJobsModule,
    WorkerSnapshotJobsModule,
    WorkerVisualComparisonJobsModule,
  ],
})
export class WorkerJobsModule {}
