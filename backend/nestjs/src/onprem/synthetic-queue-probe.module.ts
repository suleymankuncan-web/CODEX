import { Module } from "@nestjs/common";
import { OnPremConfigModule } from "./onprem-config.module";
import { SyntheticQueueProbeService } from "./synthetic-queue-probe.service";

@Module({
  imports: [OnPremConfigModule],
  providers: [SyntheticQueueProbeService],
})
export class SyntheticQueueProbeModule {}
