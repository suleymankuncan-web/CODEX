import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppConfigService } from "./app-config.service";
import { BullMqJobDispatcherService } from "./jobs/bullmq-job-dispatcher.service";
import { JOB_DISPATCHER } from "./jobs/jobs.constants";
import { InMemoryJobDispatcherService } from "./jobs/in-memory-job-dispatcher.service";

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
  ],
  providers: [
    AppConfigService,
    InMemoryJobDispatcherService,
    BullMqJobDispatcherService,
    {
      provide: JOB_DISPATCHER,
      inject: [
        AppConfigService,
        InMemoryJobDispatcherService,
        BullMqJobDispatcherService,
      ],
      useFactory: (
        config: AppConfigService,
        inMemoryDispatcher: InMemoryJobDispatcherService,
        bullMqDispatcher: BullMqJobDispatcherService,
      ) =>
        config.queueBackend === "bullmq"
          ? bullMqDispatcher
          : inMemoryDispatcher,
    },
  ],
  exports: [
    AppConfigService,
    JOB_DISPATCHER,
    InMemoryJobDispatcherService,
    BullMqJobDispatcherService,
  ],
})
export class AppConfigModule {}
