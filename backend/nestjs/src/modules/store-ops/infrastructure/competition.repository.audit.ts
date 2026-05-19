import { RequestContextStore } from "../../../shared/request-context";
import { type Queryable } from "./competition.repository.db";

export async function writeCompetitionAudit(
  client: Queryable,
  input: {
    actorUserId: string;
    eventType: string;
    entityName: string;
    entityId: string;
    metadata: Record<string, unknown>;
  },
) {
  await client.query(
    `
      INSERT INTO audit.event_log (
        actor_user_id,
        event_type,
        entity_name,
        entity_id,
        scope_type,
        metadata_json
      )
      VALUES (
        $1::uuid,
        $2,
        $3,
        $4::uuid,
        'company',
        $5::jsonb
      )
    `,
    [
      input.actorUserId,
      input.eventType,
      input.entityName,
      input.entityId,
      JSON.stringify({
        correlationId: RequestContextStore.getCorrelationId(),
        actorUserId: input.actorUserId,
        ...input.metadata,
      }),
    ],
  );
}
