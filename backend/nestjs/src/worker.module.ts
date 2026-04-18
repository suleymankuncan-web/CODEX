import { Module } from "@nestjs/common";
import { IntegrationModule } from "./modules/integration/integration.module";
import { StoreOpsModule } from "./modules/store-ops/store-ops.module";
import { AppConfigModule } from "./shared/app-config.module";
import { DatabaseModule } from "./shared/database/database.module";
import { BullMqWorkerHostService } from "./shared/jobs/bullmq-worker-host.service";

@Module({
  imports: [AppConfigModule, DatabaseModule, IntegrationModule, StoreOpsModule],
  providers: [BullMqWorkerHostService],
})
export class WorkerModule {}
