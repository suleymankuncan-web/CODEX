import { Module } from "@nestjs/common";
import { AppConfigModule } from "../app-config.module";
import { ObservabilityService } from "./observability.service";

@Module({
  imports: [AppConfigModule],
  providers: [ObservabilityService],
  exports: [ObservabilityService],
})
export class ObservabilityModule {}
