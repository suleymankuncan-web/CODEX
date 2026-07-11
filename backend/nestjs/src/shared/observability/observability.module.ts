import { Module } from "@nestjs/common";
import { AppConfigModule } from "../app-config.module";
import { ObservabilityService } from "./observability.service";
import { SentryErrorDelivery } from "./sentry-error-delivery";

@Module({
  imports: [AppConfigModule],
  providers: [SentryErrorDelivery, ObservabilityService],
  exports: [ObservabilityService, SentryErrorDelivery],
})
export class ObservabilityModule {}
