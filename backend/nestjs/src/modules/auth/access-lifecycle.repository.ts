import { Injectable } from "@nestjs/common";
import { PoolClient } from "pg";
import { buildRequestAuditMetadata } from "../../shared/audit/audit-metadata.factory";
import { DatabaseService } from "../../shared/database/database.service";

export type AccessLifecycleReason =
  | "manual_admin_deactivation"
  | "employee_offboarding";

export type AccessLifecycleSourceEntity = {
  entityName: string;
  entityId: string;
};

export type AccessLifecycleUserRow = {
  user_id: string;
  employee_id: string | null;
  username: string;
  email: string;
  auth_provider: string;
  provider_subject: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  deactivated_at?: string | null;
  deactivation_reason?: string | null;
  deactivated_by_user_id?: string | null;
};

export type AccessLifecycleResult = {
  user: AccessLifecycleUserRow | null;
  closedRoleAssignments: number;
  closedActionStoreAssignments: number;
  revokedMobileSessions: number;
};

@Injectable()
export class AccessLifecycleRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async deactivateUserAccess(input: {
    userId: string;
    actorUserId: string;
    reason: AccessLifecycleReason;
    operatorReason?: string | null;
    sourceEntity?: AccessLifecycleSourceEntity;
  }): Promise<AccessLifecycleResult> {
    return this.databaseService.withTransaction((client) =>
      this.deactivateUserAccessInTransaction(client, input),
    );
  }

  async deactivateUserAccessInTransaction(
    client: PoolClient,
    input: {
      userId: string;
      actorUserId: string;
      reason: AccessLifecycleReason;
      operatorReason?: string | null;
      sourceEntity?: AccessLifecycleSourceEntity;
    },
  ): Promise<AccessLifecycleResult> {
    const lockedUserResult = await client.query<AccessLifecycleUserRow>(
      `
        /* access_lifecycle_lock_user */
        SELECT
          user_id,
          employee_id,
          username,
          email,
          auth_provider,
          provider_subject,
          is_active,
          last_login_at,
          created_at,
          deactivated_at,
          deactivation_reason,
          deactivated_by_user_id
        FROM ops.user_account
        WHERE user_id = $1::uuid
        FOR UPDATE
      `,
      [input.userId],
    );

    const lockedUser = lockedUserResult.rows[0] ?? null;
    if (!lockedUser || !lockedUser.is_active) {
      return emptyAccessLifecycleResult();
    }

    const deactivationReason = input.operatorReason?.trim() || input.reason;

    const userResult = await client.query<AccessLifecycleUserRow>(
      `
        /* access_lifecycle_deactivate_user */
        UPDATE ops.user_account
        SET
          is_active = FALSE,
          updated_at = NOW(),
          deactivated_at = NOW(),
          deactivation_reason = $3,
          deactivated_by_user_id = $2::uuid
        WHERE user_id = $1::uuid
          AND is_active = TRUE
        RETURNING
          user_id,
          employee_id,
          username,
          email,
          auth_provider,
          provider_subject,
          is_active,
          last_login_at,
          created_at,
          deactivated_at,
          deactivation_reason,
          deactivated_by_user_id
      `,
      [input.userId, input.actorUserId, deactivationReason],
    );

    const user = userResult.rows[0] ?? null;
    if (!user) {
      return emptyAccessLifecycleResult();
    }

    const roleAssignmentsResult = await client.query<{ user_role_assignment_id: string }>(
      `
        /* access_lifecycle_close_role_assignments */
        UPDATE ops.user_role_assignment
        SET end_at = CASE
          WHEN start_at > NOW() THEN start_at
          ELSE NOW()
        END
        WHERE user_id = $1::uuid
          AND (end_at IS NULL OR end_at >= NOW())
        RETURNING user_role_assignment_id
      `,
      [input.userId],
    );

    const actionStoreAssignmentsResult = await client.query<{
      user_action_store_assignment_id: string;
    }>(
      `
        /* access_lifecycle_close_action_store_assignments */
        UPDATE ops.user_action_store_assignment
        SET end_at = CASE
          WHEN start_at > NOW() THEN start_at
          ELSE NOW()
        END
        WHERE user_id = $1::uuid
          AND (end_at IS NULL OR end_at >= NOW())
        RETURNING user_action_store_assignment_id
      `,
      [input.userId],
    );

    const mobileSessionsResult = await client.query<{ mobile_device_session_id: string }>(
      `
        /* access_lifecycle_revoke_mobile_sessions */
        UPDATE ops.mobile_device_session
        SET
          status = 'revoked',
          revoked_at = NOW(),
          revoked_by_user_id = $2::uuid,
          revocation_reason = $3
        WHERE user_id = $1::uuid
          AND status = 'active'
        RETURNING mobile_device_session_id
      `,
      [input.userId, input.actorUserId, input.reason],
    );

    const result = {
      user,
      closedRoleAssignments: roleAssignmentsResult.rows.length,
      closedActionStoreAssignments: actionStoreAssignmentsResult.rows.length,
      revokedMobileSessions: mobileSessionsResult.rows.length,
    };

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
        VALUES ($1::uuid, 'user_account.deactivated', 'ops.user_account', $2::uuid, 'company', $3::jsonb)
      `,
      [
        input.actorUserId,
        input.userId,
        JSON.stringify(
          buildRequestAuditMetadata({
            reason: input.reason,
            sourceContext: {
              module: "auth",
              operation: "deactivate-user-access",
            },
            changedFields: [
              "isActive",
              "roleAssignments",
              "actionStoreAssignments",
              "mobileDeviceSessions",
            ],
            details: {
              username: user.username,
              email: user.email,
              isActive: user.is_active,
              closedRoleAssignments: result.closedRoleAssignments,
              closedActionStoreAssignments: result.closedActionStoreAssignments,
              revokedMobileSessions: result.revokedMobileSessions,
              operatorReason: input.operatorReason ?? null,
              sourceEntity: input.sourceEntity ?? null,
            },
          }),
        ),
      ],
    );

    return result;
  }
}

function emptyAccessLifecycleResult(): AccessLifecycleResult {
  return {
    user: null,
    closedRoleAssignments: 0,
    closedActionStoreAssignments: 0,
    revokedMobileSessions: 0,
  };
}
