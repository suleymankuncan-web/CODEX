import { IntegrationSchedulerService } from "./integration-scheduler.service";

describe("IntegrationSchedulerService", () => {
  function createService(rows: Array<Record<string, unknown>>) {
    const repository = {
      listScheduledIntegrationSources: jest.fn().mockResolvedValue(rows),
    };

    return {
      repository,
      service: new IntegrationSchedulerService(repository as never),
    };
  }

  it("marks source due when inside window and interval elapsed", async () => {
    const { service } = createService([
      {
        integration_source_id: "source-1",
        source_code: "nebim-kpi",
        source_name: "Nebim KPI",
        entity_type: "kpi",
        source_system: "nebim_v3",
        state_model: "latest_state",
        poll_enabled: true,
        poll_interval_minutes: 30,
        poll_window_start_local: "10:30:00",
        poll_window_end_local: "00:00:00",
        poll_timezone: "Europe/Istanbul",
        is_active: true,
        last_import_batch_id: "batch-1",
        last_import_started_at: "2026-04-22T08:00:00.000Z",
        last_import_status: "completed",
      },
    ]);

    const rows = await service.listDueSources("2026-04-22T09:00:00.000Z");
    expect(rows[0]).toEqual(
      expect.objectContaining({
        dueNow: true,
        inWindow: true,
      }),
    );
  });

  it("keeps source out of window after midnight cutoff", async () => {
    const { service } = createService([
      {
        integration_source_id: "source-1",
        source_code: "nebim-kpi",
        source_name: "Nebim KPI",
        entity_type: "kpi",
        source_system: "nebim_v3",
        state_model: "latest_state",
        poll_enabled: true,
        poll_interval_minutes: 30,
        poll_window_start_local: "10:30:00",
        poll_window_end_local: "00:00:00",
        poll_timezone: "Europe/Istanbul",
        is_active: true,
        last_import_batch_id: "batch-1",
        last_import_started_at: "2026-04-21T20:30:00.000Z",
        last_import_status: "completed",
      },
    ]);

    const rows = await service.listDueSources("2026-04-22T00:30:00.000Z");
    expect(rows[0]).toEqual(
      expect.objectContaining({
        inWindow: false,
        dueNow: false,
      }),
    );
  });
});
