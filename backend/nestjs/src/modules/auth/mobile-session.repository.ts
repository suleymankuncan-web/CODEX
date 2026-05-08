import { Injectable } from "@nestjs/common";
import { buildRequestAuditMetadata } from "../../shared/audit/audit-metadata.factory";
import { DatabaseService } from "../../shared/database/database.service";

export type MobileSessionPlatform = "ios" | "android";

export type MobileDeviceSessionRow = {
  mobile_device_session_id: string;
  user_id: string;
  provider_subject: string;
  device_id_hash: string;
  platform: MobileSessionPlatform;
  device_name: string | null;
  app_version: string | null;
  os_version: string | null;
  status: "active" | "revoked" | "expired";
  created_at: string;
  last_seen_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  revoked_by_user_id: string | null;
  revocation_reason: string | null;
};

const MOBILE_SESSION_COLUMNS = `
  mobile_device_session_id,
  user_id,
  provider_subject,
  device_id_hash,
  platform,
  device_name,
  app_version,
  os_version,
  status,
  created_at,
  last_seen_at,
  expires_at,
  revoked_at,
  revoked_by_user_id,
  revocation_reason
`;

@Injectable()
export class MobileSessionRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findActiveByUserAndDeviceHash(input: {
    userId: string;
    deviceIdHash: string;
  }) {
    const result = await this.databaseService.query<MobileDeviceSessionRow>(
      `
        SELECT ${MOBILE_SESSION_COLUMNS}
        FROM ops.mobile_device_session
        WHERE user_id = $1::uuid
          AND device_id_hash = $2
          AND status = 'active'
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY last_seen_at DESC, mobile_device_session_id DESC
        LIMIT 1
      `,
      [input.userId, input.deviceIdHash],
    );

    return result.rows[0] ?? null;
  }

  async createSession(input: {
    userId: string;
    providerSubject: string;
    deviceIdHash: string;
    platform: MobileSessionPlatform;
    deviceName?: string | null;
    appVersion?: string | null;
    osVersion?: string | null;
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<MobileDeviceSessionRow>(
        `
          INSERT INTO ops.mobile_device_session (
            user_id,
            provider_subject,
            device_id_hash,
            platform,
            device_name,
            app_version,
            os_version
          )
          VALUES ($1::uuid, $2, $3, $4, $5, $6, $7)
          RETURNING ${MOBILE_SESSION_COLUMNS}
        `,
        [
          input.userId,
          input.providerSubject,
          input.deviceIdHash,
          input.platform,
          input.deviceName ?? null,
          input.appVersion ?? null,
          input.osVersion ?? null,
        ],
      );

      const session = result.rows[0];
      await this.insertAuditEvent(client, {
        actorUserId: input.userId,
        eventType: "mobile_device_session.created",
        entityId: session.mobile_device_session_id,
        operation: "create-mobile-session",
        changedFields: [
          "userId",
          "providerSubject",
          "deviceIdHash",
          "platform",
          "deviceName",
          "appVersion",
          "osVersion",
          "status",
        ],
        details: {
          userId: input.userId,
          platform: input.platform,
          deviceName: input.deviceName ?? null,
          appVersion: input.appVersion ?? null,
          osVersion: input.osVersion ?? null,
          status: session.status,
        },
      });

      return session;
    });
  }

  async touchSession(input: { sessionId: string; userId: string }) {
    const result = await this.databaseService.query<MobileDeviceSessionRow>(
      `
        UPDATE ops.mobile_device_session
        SET last_seen_at = NOW()
        WHERE mobile_device_session_id = $1::uuid
          AND user_id = $2::uuid
          AND status = 'active'
          AND (expires_at IS NULL OR expires_at > NOW())
        RETURNING ${MOBILE_SESSION_COLUMNS}
      `,
      [input.sessionId, input.userId],
    );

    return result.rows[0] ?? null;
  }

  async getActiveSessionForUser(input: { sessionId: string; userId: string }) {
    const result = await this.databaseService.query<MobileDeviceSessionRow>(
      `
        SELECT ${MOBILE_SESSION_COLUMNS}
        FROM ops.mobile_device_session
        WHERE mobile_device_session_id = $1::uuid
          AND user_id = $2::uuid
          AND status = 'active'
          AND (expires_at IS NULL OR expires_at > NOW())
        LIMIT 1
      `,
      [input.sessionId, input.userId],
    );

    return result.rows[0] ?? null;
  }

  async listSessionsForUser(input: { userId: string; limit?: number; offset?: number }) {
    const limit = input.limit ?? 25;
    const offset = input.offset ?? 0;

    const result = await this.databaseService.query<MobileDeviceSessionRow>(
      `
        SELECT ${MOBILE_SESSION_COLUMNS}
        FROM ops.mobile_device_session
        WHERE user_id = $1::uuid
        ORDER BY last_seen_at DESC, created_at DESC
        LIMIT $2 OFFSET $3
      `,
      [input.userId, limit, offset],
    );

    return result.rows;
  }

  async revokeSession(input: {
    sessionId: string;
    userId: string;
    revokedByUserId: string;
    reason: string;
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<MobileDeviceSessionRow>(
        `
          UPDATE ops.mobile_device_session
          SET status = 'revoked',
              revoked_at = NOW(),
              revoked_by_user_id = $3::uuid,
              revocation_reason = $4
          WHERE mobile_device_session_id = $1::uuid
            AND user_id = $2::uuid
            AND status = 'active'
          RETURNING ${MOBILE_SESSION_COLUMNS}
        `,
        [input.sessionId, input.userId, input.revokedByUserId, input.reason],
      );

      const session = result.rows[0] ?? null;
      if (!session) {
        return null;
      }

      await this.insertAuditEvent(client, {
        actorUserId: input.revokedByUserId,
        eventType: "mobile_device_session.revoked",
        entityId: session.mobile_device_session_id,
        operation: "revoke-mobile-session",
        changedFields: ["status", "revokedAt", "revokedByUserId", "revocationReason"],
        details: {
          userId: input.userId,
          revokedByUserId: input.revokedByUserId,
          reason: input.reason,
          platform: session.platform,
          status: session.status,
        },
      });

      return session;
    });
  }

  private async insertAuditEvent(
    client: {
      query: (sql: string, params?: unknown[]) => Promise<unknown>;
    },
    input: {
      actorUserId: string;
      eventType: string;
      entityId: string;
      operation: string;
      changedFields: string[];
      details: Record<string, unknown>;
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
        VALUES ($1::uuid, $2, 'ops.mobile_device_session', $3::uuid, 'company', $4::jsonb)
      `,
      [
        input.actorUserId,
        input.eventType,
        input.entityId,
        JSON.stringify({
          ...buildRequestAuditMetadata({
            sourceContext: {
              module: "auth-mobile",
              operation: input.operation,
            },
            changedFields: input.changedFields,
            details: input.details,
          }),
        }),
      ],
    );
  }
}
