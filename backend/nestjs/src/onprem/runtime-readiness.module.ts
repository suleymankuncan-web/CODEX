import { Module } from "@nestjs/common";
import { DatabaseModule } from "../shared/database/database.module";
import {
  ONPREM_REDIS_PROBE,
  RedisRuntimeProbe,
  RuntimeReadinessService,
} from "./runtime-readiness.service";

@Module({
  imports: [DatabaseModule],
  providers: [
    RedisRuntimeProbe,
    RuntimeReadinessService,
    {
      provide: ONPREM_REDIS_PROBE,
      useExisting: RedisRuntimeProbe,
    },
  ],
  exports: [RuntimeReadinessService],
})
export class RuntimeReadinessModule {}
