import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { AppConfigService } from "../../../shared/app-config.service";
import { logStructuredError, logStructuredMessage } from "../../../shared/structured-log";
import { VmReferenceManagementService } from "./vm-reference-management.service";

@Injectable()
export class VmCampaignSettlementWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VmCampaignSettlementWorkerService.name);
  private timer: NodeJS.Timeout | null = null;
  private inFlight = false;

  constructor(
    private readonly config: AppConfigService,
    private readonly service: VmReferenceManagementService,
  ) {}

  onModuleInit() {
    if (!this.config.vmCampaignDeadlineSettlementEnabled) {
      logStructuredMessage(this.logger, "vm_campaign.settlement.disabled", {
        pollSeconds: this.config.vmCampaignSettlementPollSeconds,
      });
      return;
    }
    this.timer = setInterval(() => void this.tick(),
      this.config.vmCampaignSettlementPollSeconds * 1000);
    this.timer.unref?.();
    void this.tick();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick() {
    if (this.inFlight) return;
    this.inFlight = true;
    try {
      const result = await this.service.settle(100);
      logStructuredMessage(this.logger, "vm_campaign.settlement.completed", result);
    } catch (error) {
      logStructuredError(this.logger, "vm_campaign.settlement.failed", error);
    } finally {
      this.inFlight = false;
    }
  }
}
