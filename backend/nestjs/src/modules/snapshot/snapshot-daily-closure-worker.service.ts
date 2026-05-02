import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { AppConfigService } from "../../shared/app-config.service";
import { logStructuredError, logStructuredMessage } from "../../shared/structured-log";
import { SnapshotSchedulerService } from "./snapshot-scheduler.service";

@Injectable()
export class SnapshotDailyClosureWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SnapshotDailyClosureWorkerService.name);
  private intervalRef: NodeJS.Timeout | null = null;
  private tickInFlight = false;

  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly snapshotSchedulerService: SnapshotSchedulerService,
  ) {}

  onModuleInit() {
    if (!this.appConfigService.dailyClosureAutomationEnabled) {
      logStructuredMessage(this.logger, "snapshot.daily_closure.automation.disabled", {
        pollMinutes: this.appConfigService.dailyClosurePollMinutes,
      });
      return;
    }

    const pollMs = this.appConfigService.dailyClosurePollMinutes * 60 * 1000;
    this.intervalRef = setInterval(() => {
      void this.runTick();
    }, pollMs);
    this.intervalRef.unref?.();

    void this.runTick();
  }

  onModuleDestroy() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }
  }

  private async runTick() {
    if (this.tickInFlight) {
      return;
    }

    this.tickInFlight = true;

    try {
      const status = await this.snapshotSchedulerService.getDailyClosureStatus();

      logStructuredMessage(this.logger, "snapshot.daily_closure.tick", {
        closureDate: status.closureDate,
        healthState: status.healthState,
        dueNow: status.dueNow,
        automationEnabled: status.automationEnabled,
        pollMinutes: status.automationPollMinutes,
      });

      if (!status.dueNow) {
        return;
      }

      const result = await this.snapshotSchedulerService.scheduleDailySnapshot({
        actorUserId: this.appConfigService.dailyClosureActorUserId,
        closureDate: status.closureDate,
      });

      logStructuredMessage(this.logger, "snapshot.daily_closure.queued", {
        closureDate: status.closureDate,
        commandStatus: result.command.status,
      });
    } catch (error) {
      logStructuredError(this.logger, "snapshot.daily_closure.tick_failed", error);
    } finally {
      this.tickInFlight = false;
    }
  }
}
