import type { PoolClient } from "pg";
import { RequestContextStore } from "../../../shared/request-context";

type WorkforceAuditClient = Pick<PoolClient, "query">;

type WorkforceAuditEventInput = {
  actorUserId: string;
  eventType: string;
  entityName: string;
  entityId: string;
  companyId: string;
  regionId: string;
  storeId: string;
  metadata: Record<string, unknown>;
};

export class WorkforceRequestAuditRepository {
  async insertWorkforceAuditEvent(
    client: WorkforceAuditClient,
    input: WorkforceAuditEventInput,
  ) {
    await client.query(
      `
        INSERT INTO audit.event_log (
          actor_user_id,
          event_type,
          entity_name,
          entity_id,
          scope_type,
          company_id,
          region_id,
          store_id,
          metadata_json
        )
        VALUES (
          $1::uuid,
          $2,
          $3,
          $4::uuid,
          'store',
          $5::uuid,
          $6::uuid,
          $7::uuid,
          $8::jsonb
        )
      `,
      [
        input.actorUserId,
        input.eventType,
        input.entityName,
        input.entityId,
        input.companyId,
        input.regionId,
        input.storeId,
        JSON.stringify({
          correlationId: RequestContextStore.getCorrelationId(),
          actorUserId: input.actorUserId,
          ...input.metadata,
        }),
      ],
    );
  }
}
