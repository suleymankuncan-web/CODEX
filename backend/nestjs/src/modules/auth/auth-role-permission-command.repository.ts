import { Injectable } from "@nestjs/common";
import { buildRequestAuditMetadata } from "../../shared/audit/audit-metadata.factory";
import { DatabaseService } from "../../shared/database/database.service";

type RolePermissionCommandRow = {
  role_id: string;
  permission_id: string;
  role_code: string;
  permission_code: string;
  granted_at?: string;
};

export type GrantRolePermissionCommandInput = {
  roleId: string;
  permissionId: string;
  actorUserId: string;
};

export type RevokeRolePermissionCommandInput = {
  roleId: string;
  permissionCode: string;
  actorUserId: string;
};

@Injectable()
export class AuthRolePermissionCommandRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async grantRolePermission(input: GrantRolePermissionCommandInput) {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<RolePermissionCommandRow>(
        `
          INSERT INTO ops.role_permission (
            role_id,
            permission_id
          )
          VALUES ($1::uuid, $2::uuid)
          RETURNING
            role_id,
            permission_id,
            (SELECT role_code FROM ops.role WHERE role_id = $1::uuid) AS role_code,
            (SELECT permission_code FROM ops.permission WHERE permission_id = $2::uuid) AS permission_code,
            granted_at
        `,
        [input.roleId, input.permissionId],
      );

      const rolePermission = result.rows[0];

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
          VALUES ($1::uuid, 'role_permission.granted', 'ops.role', $2::uuid, 'company', $3::jsonb)
        `,
        [
          input.actorUserId,
          input.roleId,
          JSON.stringify({
            ...buildRequestAuditMetadata({
              sourceContext: {
                module: "auth-admin",
                operation: "grant-role-permission",
              },
              changedFields: ["permissionId"],
              details: {
                permissionId: input.permissionId,
                permissionCode: rolePermission.permission_code,
              },
            }),
          }),
        ],
      );

      return rolePermission;
    });
  }

  async revokeRolePermission(input: RevokeRolePermissionCommandInput) {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<RolePermissionCommandRow>(
        `
          DELETE FROM ops.role_permission rp
          USING ops.permission p, ops.role r
          WHERE rp.permission_id = p.permission_id
            AND rp.role_id = r.role_id
            AND rp.role_id = $1::uuid
            AND p.permission_code = $2
          RETURNING
            rp.role_id,
            rp.permission_id,
            r.role_code,
            p.permission_code
        `,
        [input.roleId, input.permissionCode],
      );

      const rolePermission = result.rows[0] ?? null;

      if (rolePermission) {
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
            VALUES ($1::uuid, 'role_permission.revoked', 'ops.role', $2::uuid, 'company', $3::jsonb)
          `,
          [
            input.actorUserId,
            input.roleId,
            JSON.stringify({
              ...buildRequestAuditMetadata({
                sourceContext: {
                  module: "auth-admin",
                  operation: "revoke-role-permission",
                },
                changedFields: ["permissionId"],
                details: {
                  permissionId: rolePermission.permission_id,
                  permissionCode: rolePermission.permission_code,
                },
              }),
            }),
          ],
        );
      }

      return rolePermission;
    });
  }
}
