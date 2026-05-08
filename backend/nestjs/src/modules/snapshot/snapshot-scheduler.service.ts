import { Injectable, Logger } from "@nestjs/common";
import { SnapshotService } from "../store-ops/application/snapshot.service";
import { SnapshotOperationsRepository } from "../store-ops/infrastructure/snapshot-operations.repository";
import { buildCommandResponse } from "../../shared/http/response-builders";
import { AppConfigService } from "../../shared/app-config.service";

@Injectable()
export class SnapshotSchedulerService {
  private readonly logger = new Logger(SnapshotSchedulerService.name);
  private static readonly DAILY_CLOSURE_TIMEZONE = "Europe/Istanbul";

  constructor(
    private readonly snapshotService: SnapshotService,
    private readonly snapshotOperationsRepository: SnapshotOperationsRepository,
    private readonly appConfigService: AppConfigService,
  ) {}

  async scheduleMonthlySnapshot(input: {
    periodStart: string;
    periodEnd: string;
    actorUserId: string;
    actorCompanyIds?: string[];
  }) {
    this.logger.log(
      `Scheduling monthly snapshot for ${input.periodStart} - ${input.periodEnd}`,
    );

    return this.snapshotService.enqueueSnapshotRun({
      snapshotType: "monthly",
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      actorUserId: input.actorUserId,
      actorCompanyIds: input.actorCompanyIds,
    });
  }

  async getDailyClosureStatus(
    input?: string | { referenceAt?: string; actorCompanyIds?: string[] },
  ) {
    const referenceAt = typeof input === "string" ? input : input?.referenceAt;
    const actorCompanyIds = typeof input === "string" ? undefined : input?.actorCompanyIds;
    const referenceDate = referenceAt ? new Date(referenceAt) : new Date();
    const localDate = this.getLocalIsoDate(
      referenceDate,
      SnapshotSchedulerService.DAILY_CLOSURE_TIMEZONE,
    );
    const closureDate = this.shiftIsoDate(localDate, -1);
    const existingSnapshotRun =
      await this.snapshotOperationsRepository.findLatestSnapshotRunByTypeAndPeriod({
        snapshotType: "daily",
        periodStart: closureDate,
        periodEnd: closureDate,
        actorCompanyIds,
      });

    const healthState = this.mapDailyClosureHealthState(existingSnapshotRun?.run_status ?? null);

    return {
      automationEnabled: this.appConfigService.dailyClosureAutomationEnabled,
      automationPollMinutes: this.appConfigService.dailyClosurePollMinutes,
      timezone: SnapshotSchedulerService.DAILY_CLOSURE_TIMEZONE,
      referenceAt: referenceDate.toISOString(),
      localDate,
      closureDate,
      healthState,
      dueNow: healthState === "ready",
      canQueue: healthState === "ready",
      canRerun: healthState === "retry_ready",
      recommendedAction: this.getRecommendedAction(healthState),
      existingSnapshotRunId: existingSnapshotRun?.snapshot_run_id ?? null,
      existingRunStatus: existingSnapshotRun?.run_status ?? null,
      existingFailureReason: existingSnapshotRun?.failure_reason ?? null,
      existingGeneratedAt: existingSnapshotRun?.generated_at ?? null,
    };
  }

  async scheduleDailySnapshot(input: {
    actorUserId: string;
    closureDate?: string;
    referenceAt?: string;
    actorCompanyIds?: string[];
  }) {
    const status = input.closureDate
      ? await this.getDailyClosureStatusForDate(
          input.closureDate,
          input.referenceAt,
          input.actorCompanyIds,
        )
      : await this.getDailyClosureStatus({
          referenceAt: input.referenceAt,
          actorCompanyIds: input.actorCompanyIds,
        });

    if (status.healthState === "completed") {
      return buildCommandResponse({
        status: "noop",
        message: "Daily closure already completed for this date",
        data: {
          dailyClosure: status,
        },
      });
    }

    if (status.healthState === "in_progress") {
      return buildCommandResponse({
        status: "noop",
        message: "Daily closure is already queued or running for this date",
        data: {
          dailyClosure: status,
        },
      });
    }

    if (status.healthState === "retry_ready") {
      return buildCommandResponse({
        status: "blocked",
        message: "Daily closure has a failed run. Rerun that snapshot instead of queuing a new one.",
        data: {
          dailyClosure: status,
        },
      });
    }

    this.logger.log(`Scheduling daily closure for ${status.closureDate}`);

    return this.snapshotService.enqueueSnapshotRun({
      snapshotType: "daily",
      periodStart: status.closureDate,
      periodEnd: status.closureDate,
      actorUserId: input.actorUserId,
      actorCompanyIds: input.actorCompanyIds,
    });
  }

  private async getDailyClosureStatusForDate(
    closureDate: string,
    referenceAt?: string,
    actorCompanyIds?: string[],
  ) {
    const referenceDate = referenceAt ? new Date(referenceAt) : new Date();
    const existingSnapshotRun =
      await this.snapshotOperationsRepository.findLatestSnapshotRunByTypeAndPeriod({
        snapshotType: "daily",
        periodStart: closureDate,
        periodEnd: closureDate,
        actorCompanyIds,
      });

    const healthState = this.mapDailyClosureHealthState(existingSnapshotRun?.run_status ?? null);

    return {
      automationEnabled: this.appConfigService.dailyClosureAutomationEnabled,
      automationPollMinutes: this.appConfigService.dailyClosurePollMinutes,
      timezone: SnapshotSchedulerService.DAILY_CLOSURE_TIMEZONE,
      referenceAt: referenceDate.toISOString(),
      localDate: this.getLocalIsoDate(
        referenceDate,
        SnapshotSchedulerService.DAILY_CLOSURE_TIMEZONE,
      ),
      closureDate,
      healthState,
      dueNow: healthState === "ready",
      canQueue: healthState === "ready",
      canRerun: healthState === "retry_ready",
      recommendedAction: this.getRecommendedAction(healthState),
      existingSnapshotRunId: existingSnapshotRun?.snapshot_run_id ?? null,
      existingRunStatus: existingSnapshotRun?.run_status ?? null,
      existingFailureReason: existingSnapshotRun?.failure_reason ?? null,
      existingGeneratedAt: existingSnapshotRun?.generated_at ?? null,
    };
  }

  private mapDailyClosureHealthState(runStatus: string | null) {
    if (!runStatus) return "ready";
    if (runStatus === "completed") return "completed";
    if (runStatus === "failed") return "retry_ready";
    if (runStatus === "queued" || runStatus === "running") return "in_progress";
    return "needs_action";
  }

  private getRecommendedAction(healthState: string) {
    if (healthState === "ready") return "Queue the daily snapshot closure";
    if (healthState === "in_progress") return "Wait for the active daily snapshot run to finish";
    if (healthState === "retry_ready") return "Open the failed snapshot run and request a rerun";
    if (healthState === "completed") return "Use the closed snapshot for historical reads";
    return "Inspect snapshot operations";
  }

  private getLocalIsoDate(date: Date, timezone: string) {
    const formatted = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);

    return formatted;
  }

  private shiftIsoDate(isoDate: string, days: number) {
    const value = new Date(`${isoDate}T00:00:00.000Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
  }
}
