import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { AppConfigService } from "../../../shared/app-config.service";
import { logStructuredError, logStructuredMessage } from "../../../shared/structured-log";
import { SalesTargetIncentiveCloseRepository } from "../infrastructure/sales-target-incentive-close.repository";
import { SalesTargetIncentiveApiService } from "./sales-target-incentive-api.service";

const POLL_MS = 15 * 60 * 1000;

export function previousIncentivePeriod(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const previous = new Date(Date.UTC(year, month - 2, 1));
  const periodKey = `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}`;
  const finalDay = new Date(Date.UTC(year, month - 1, 0)).toISOString().slice(0, 10);
  return { periodKey, finalDay };
}

@Injectable()
export class SalesTargetIncentiveAutoCloseWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SalesTargetIncentiveAutoCloseWorkerService.name);
  private intervalRef: NodeJS.Timeout | null = null;
  private tickInFlight = false;

  constructor(
    private readonly config: AppConfigService,
    private readonly closeRepository: SalesTargetIncentiveCloseRepository,
    private readonly incentiveApi: SalesTargetIncentiveApiService,
  ) {}

  onModuleInit() {
    if (!this.config.incentiveAutoCloseEnabled) return;
    this.intervalRef = setInterval(() => void this.runOnce(), POLL_MS);
    this.intervalRef.unref?.();
    void this.runOnce();
  }

  onModuleDestroy() {
    if (this.intervalRef) clearInterval(this.intervalRef);
    this.intervalRef = null;
  }

  async runOnce() {
    if (this.tickInFlight || !this.config.incentiveAutoCloseEnabled) return;
    this.tickInFlight = true;
    const { periodKey, finalDay } = previousIncentivePeriod(new Date());
    try {
      const companyIds = await this.closeRepository.listAutomaticCloseCompanyIds({ periodKey, finalDay });
      for (const companyId of companyIds) {
        try {
          const result = await this.incentiveApi.runAutomaticClose({ periodKey, companyId });
          logStructuredMessage(this.logger, "incentive.auto_close.result", {
            periodKey, companyId, closed: result.closed, status: result.status,
          });
        } catch (error) {
          logStructuredError(this.logger, "incentive.auto_close.company_failed", error, {
            periodKey, companyId,
          });
        }
      }
    } catch (error) {
      logStructuredError(this.logger, "incentive.auto_close.tick_failed", error, { periodKey });
    } finally {
      this.tickInFlight = false;
    }
  }
}
