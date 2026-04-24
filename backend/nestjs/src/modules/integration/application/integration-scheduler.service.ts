import { Injectable } from "@nestjs/common";
import { IntegrationRepository } from "../infrastructure/integration.repository";

@Injectable()
export class IntegrationSchedulerService {
  constructor(private readonly integrationRepository: IntegrationRepository) {}

  async listDueSources(referenceAt?: string) {
    const now = referenceAt ? new Date(referenceAt) : new Date();
    const sources = await this.integrationRepository.listScheduledIntegrationSources();

    return sources.map((source) => {
      const localMinutes = this.getLocalMinutesOfDay(now, source.poll_timezone);
      const inWindow = this.isWithinWindow(
        localMinutes,
        source.poll_window_start_local,
        source.poll_window_end_local,
      );
      const lastImportStartedAt = source.last_import_started_at
        ? new Date(source.last_import_started_at)
        : null;
      const minutesSinceLastImport = lastImportStartedAt
        ? Math.floor((now.getTime() - lastImportStartedAt.getTime()) / 60000)
        : null;
      const dueNow =
        inWindow &&
        (minutesSinceLastImport === null ||
          minutesSinceLastImport >= source.poll_interval_minutes);

      return {
        sourceId: source.integration_source_id,
        sourceCode: source.source_code,
        sourceName: source.source_name,
        entityType: source.entity_type,
        sourceSystem: source.source_system,
        stateModel: source.state_model,
        pollEnabled: source.poll_enabled,
        pollIntervalMinutes: source.poll_interval_minutes,
        pollWindowStartLocal: source.poll_window_start_local,
        pollWindowEndLocal: source.poll_window_end_local,
        pollTimezone: source.poll_timezone,
        localTime: this.formatLocalTime(now, source.poll_timezone),
        inWindow,
        dueNow,
        lastImportBatchId: source.last_import_batch_id,
        lastImportStartedAt: source.last_import_started_at,
        lastImportStatus: source.last_import_status,
        minutesSinceLastImport,
      };
    });
  }

  private isWithinWindow(currentMinutes: number, startLocal: string, endLocal: string) {
    const startMinutes = this.parseTimeToMinutes(startLocal);
    const endMinutes = this.parseTimeToMinutes(endLocal);

    if (startMinutes === endMinutes) {
      return true;
    }

    if (endMinutes > startMinutes) {
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    }

    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }

  private parseTimeToMinutes(value: string) {
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  }

  private getLocalMinutesOfDay(date: Date, timezone: string) {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
    return hour * 60 + minute;
  }

  private formatLocalTime(date: Date, timezone: string) {
    return new Intl.DateTimeFormat("sv-SE", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date);
  }
}
