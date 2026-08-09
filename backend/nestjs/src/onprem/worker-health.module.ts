import { Module } from "@nestjs/common";
import { OnPremDatabaseModule } from "./onprem-database.module";
import {
  ONPREM_REDIS_PROBE,
  RedisRuntimeProbe,
  RuntimeReadinessService,
} from "./runtime-readiness.service";

@Module({
  imports: [OnPremDatabaseModule],
  providers: [
    RedisRuntimeProbe,
    RuntimeReadinessService,
    { provide: ONPREM_REDIS_PROBE, useExisting: RedisRuntimeProbe },
  ],
})
export class WorkerHealthModule {}
