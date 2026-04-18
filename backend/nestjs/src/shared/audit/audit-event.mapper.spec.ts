import { mapAuditEvent } from "./audit-event.mapper";

describe("mapAuditEvent", () => {
  it("promotes correlationId to top level", () => {
    const result = mapAuditEvent({
      event_log_id: "event-1",
      occurred_at: "2026-04-18T10:00:00.000Z",
      actor_user_id: "user-1",
      event_type: "snapshot_run.created",
      metadata_json: {
        correlationId: "corr-123",
        snapshotType: "daily",
      },
    });

    expect(result).toEqual({
      eventLogId: "event-1",
      occurredAt: "2026-04-18T10:00:00.000Z",
      actorUserId: "user-1",
      eventType: "snapshot_run.created",
      correlationId: "corr-123",
      metadata: {
        correlationId: "corr-123",
        snapshotType: "daily",
      },
    });
  });

  it("returns null correlationId when metadata does not include it", () => {
    const result = mapAuditEvent({
      event_log_id: "event-2",
      occurred_at: "2026-04-18T10:00:00.000Z",
      actor_user_id: null,
      event_type: "legacy.event",
      metadata_json: {
        sourceCode: "HRIS",
      },
    });

    expect(result.correlationId).toBeNull();
  });
});
