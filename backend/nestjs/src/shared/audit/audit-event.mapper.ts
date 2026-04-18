export function mapAuditEvent(item: {
  event_log_id: string;
  occurred_at: string;
  actor_user_id: string | null;
  event_type: string;
  metadata_json: Record<string, unknown>;
}) {
  return {
    eventLogId: item.event_log_id,
    occurredAt: item.occurred_at,
    actorUserId: item.actor_user_id,
    eventType: item.event_type,
    correlationId:
      typeof item.metadata_json?.correlationId === "string"
        ? item.metadata_json.correlationId
        : null,
    metadata: item.metadata_json,
  };
}
