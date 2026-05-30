import { Module } from "@nestjs/common";
import { AppConfigModule } from "./shared/app-config.module";
import { DatabaseModule } from "./shared/database/database.module";
import { BullMqWorkerHostService } from "./shared/jobs/bullmq-worker-host.service";
import { ObservabilityModule } from "./shared/observability/observability.module";
import { WorkerJobsModule } from "./worker-jobs.module";

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    ObservabilityModule,
    WorkerJobsModule,
  ],
  providers: [BullMqWorkerHostService],
})
export class WorkerModule {}
