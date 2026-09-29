import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../shared/database/database.service";

export type UserPermissionAssignmentRow = {
  user_permission_assignment_id: string;
  user_role_assignment_id: string;
  user_id: string;
  role_code: string;
  permission_code: string;
  resource_name: string;
  action_name: string;
  scope_type: string;
  company_id: string;
  region_id: string | null;
  store_id: string | null;
  starts_at: string;
  ends_at: string | null;
  grant_reason: string;
  created_at: string;
  revoked_at: string | null;
  revoke_reason: string | null;
};

@Injectable()
export class UserPermissionAssignmentRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async getGrantContext(roleAssignmentId: string) {
    const result = await this.databaseService.query<{
      user_role_assignment_id: string;
      user_id: string;
      role_id: string;
      role_code: string;
      role_scope_type: string;
      scope_type: string;
      company_id: string | null;
      region_id: string | null;
      store_id: string | null;
      start_at: string;
      end_at: string | null;
    }>(`
      SELECT ura.user_role_assignment_id::text, ura.user_id::text, ura.role_id::text,
             role.role_code, role.role_scope_type, ura.scope_type,
             ura.company_id::text, ura.region_id::text, ura.store_id::text,
             ura.start_at::text, ura.end_at::text
      FROM ops.user_role_assignment ura
      JOIN ops.user_account account ON account.user_id = ura.user_id AND account.is_active = TRUE
      JOIN ops.role role ON role.role_id = ura.role_id
      WHERE ura.user_role_assignment_id = $1::uuid
        AND ura.start_at <= NOW() AND (ura.end_at IS NULL OR ura.end_at > NOW())
      LIMIT 1
    `, [roleAssignmentId]);
    return result.rows[0] ?? null;
  }

  async getPermissionByCode(permissionCode: string) {
    const result = await this.databaseService.query<{
      permission_id: string; permission_code: string; resource_name: string; action_name: string;
    }>(`
      SELECT permission_id::text, permission_code, resource_name, action_name
      FROM ops.permission WHERE permission_code = $1 LIMIT 1
    `, [permissionCode]);
    return result.rows[0] ?? null;
  }

  async roleHasPermission(roleId: string, permissionId: string) {
    const result = await this.databaseService.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM ops.role_permission
        WHERE role_id = $1::uuid AND permission_id = $2::uuid
      ) AS exists
    `, [roleId, permissionId]);
    return result.rows[0]?.exists ?? false;
  }

  async hasOverlappingSuperAssignment(input: {
    userId: string; startsAt: string | null; endsAt: string | null;
  }) {
    const result = await this.databaseService.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM ops.user_role_assignment assignment
        JOIN ops.role role ON role.role_id = assignment.role_id
        WHERE assignment.user_id = $1::uuid AND role.role_code = 'SUPER_ADMIN'
          AND assignment.start_at < COALESCE($3::timestamptz, 'infinity'::timestamptz)
          AND COALESCE(assignment.end_at, 'infinity'::timestamptz) > COALESCE($2::timestamptz, NOW())
      ) AS exists
    `, [input.userId, input.startsAt, input.endsAt]);
    return result.rows[0]?.exists ?? false;
  }

  async hasConflictingApprovalStage(input: {
    userId: string; companyId: string; permissionCodes: string[];
    startsAt: string | null; endsAt: string | null;
  }) {
    const result = await this.databaseService.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1
        FROM ops.user_permission_assignment assignment
        JOIN ops.permission permission ON permission.permission_id = assignment.permission_id
        WHERE assignment.user_id = $1::uuid AND assignment.company_id = $2::uuid
          AND permission.permission_code = ANY($3::text[])
          AND assignment.revoked_at IS NULL
          AND assignment.starts_at < COALESCE($5::timestamptz, 'infinity'::timestamptz)
          AND COALESCE(assignment.ends_at, 'infinity'::timestamptz) > COALESCE($4::timestamptz, NOW())
      ) AS exists
    `, [input.userId, input.companyId, input.permissionCodes, input.startsAt, input.endsAt]);
    return result.rows[0]?.exists ?? false;
  }

  async list(input: { userId?: string; roleAssignmentId?: string; active?: boolean; limit?: number; offset?: number }) {
    const limit = Math.min(Math.max(input.limit ?? 100, 1), 200);
    const offset = Math.max(input.offset ?? 0, 0);
    const filters: string[] = [];
    const params: unknown[] = [];
    if (input.userId) { params.push(input.userId); filters.push(`assignment.user_id = $${params.length}::uuid`); }
    if (input.roleAssignmentId) { params.push(input.roleAssignmentId); filters.push(`assignment.user_role_assignment_id = $${params.length}::uuid`); }
    const activePredicate = `(assignment.revoked_at IS NULL AND assignment.starts_at <= NOW() AND (assignment.ends_at IS NULL OR assignment.ends_at > NOW()) AND role_assignment.start_at <= NOW() AND (role_assignment.end_at IS NULL OR role_assignment.end_at > NOW()))`;
    if (input.active === true) filters.push(activePredicate);
    if (input.active === false) filters.push(`NOT ${activePredicate}`);
    const where = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
    const [rows, total] = await Promise.all([
      this.databaseService.query<UserPermissionAssignmentRow>(`
        SELECT assignment.user_permission_assignment_id::text,
               assignment.user_role_assignment_id::text, assignment.user_id::text,
               role.role_code, permission.permission_code, permission.resource_name, permission.action_name,
               assignment.scope_type, assignment.company_id::text, assignment.region_id::text,
               assignment.store_id::text, assignment.starts_at::text, assignment.ends_at::text,
               assignment.grant_reason, assignment.created_at::text,
               assignment.revoked_at::text, assignment.revoke_reason
        FROM ops.user_permission_assignment assignment
        JOIN ops.user_role_assignment role_assignment
          ON role_assignment.user_role_assignment_id = assignment.user_role_assignment_id
        JOIN ops.role role ON role.role_id = role_assignment.role_id
        JOIN ops.permission permission ON permission.permission_id = assignment.permission_id
        ${where}
        ORDER BY assignment.created_at DESC, assignment.user_permission_assignment_id DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]),
      this.databaseService.query<{ total_count: string }>(`
        SELECT COUNT(*)::text AS total_count
        FROM ops.user_permission_assignment assignment
        JOIN ops.user_role_assignment role_assignment
          ON role_assignment.user_role_assignment_id = assignment.user_role_assignment_id
        ${where}
      `, params),
    ]);
    return { rows: rows.rows, total: Number(total.rows[0]?.total_count ?? "0"), limit, offset };
  }

  async grant(input: {
    roleAssignmentId: string; userId: string; permissionId: string;
    scopeType: "company" | "region" | "store"; companyId: string;
    regionId: string | null; storeId: string | null; startsAt: string | null;
    endsAt: string | null; reason: string; actorUserId: string;
  }) {
    return this.databaseService.withTransaction(async (client) => {
      await client.query(`SELECT 1 FROM ops.user_account WHERE user_id = $1::uuid FOR UPDATE`, [input.userId]);
      await client.query(`SELECT 1 FROM ops.user_role_assignment WHERE user_role_assignment_id = $1::uuid FOR UPDATE`, [input.roleAssignmentId]);
      const result = await client.query<UserPermissionAssignmentRow>(`
        WITH inserted AS (
          INSERT INTO ops.user_permission_assignment (
            user_role_assignment_id, user_id, permission_id, scope_type,
            company_id, region_id, store_id, starts_at, ends_at,
            granted_by_user_id, grant_reason
          ) VALUES (
            $1::uuid, $2::uuid, $3::uuid, $4, $5::uuid, $6::uuid, $7::uuid,
            COALESCE($8::timestamptz, NOW()), $9::timestamptz, $10::uuid, $11
          ) RETURNING *
        )
        SELECT inserted.user_permission_assignment_id::text,
               inserted.user_role_assignment_id::text, inserted.user_id::text,
               role.role_code, permission.permission_code, permission.resource_name, permission.action_name,
               inserted.scope_type, inserted.company_id::text, inserted.region_id::text,
               inserted.store_id::text, inserted.starts_at::text, inserted.ends_at::text,
               inserted.grant_reason, inserted.created_at::text,
               inserted.revoked_at::text, inserted.revoke_reason
        FROM inserted
        JOIN ops.user_role_assignment role_assignment
          ON role_assignment.user_role_assignment_id = inserted.user_role_assignment_id
        JOIN ops.role role ON role.role_id = role_assignment.role_id
        JOIN ops.permission permission ON permission.permission_id = inserted.permission_id
      `, [
        input.roleAssignmentId, input.userId, input.permissionId, input.scopeType,
        input.companyId, input.regionId, input.storeId, input.startsAt, input.endsAt,
        input.actorUserId, input.reason,
      ]);
      const row = result.rows[0]!;
      await client.query(`
        INSERT INTO audit.event_log (
          actor_user_id, event_type, entity_name, entity_id, scope_type,
          company_id, region_id, store_id, metadata_json
        ) VALUES ($1::uuid, 'user_permission.granted', 'ops.user_permission_assignment',
                  $2::uuid, $3, $4::uuid, $5::uuid, $6::uuid, $7::jsonb)
      `, [input.actorUserId, row.user_permission_assignment_id, input.scopeType,
        input.companyId, input.regionId, input.storeId, JSON.stringify({
        operation: "grant-user-permission", changedFields: ["permissionCode", "scope", "validity"],
        permissionCode: row.permission_code, roleAssignmentId: input.roleAssignmentId,
        companyId: input.companyId, regionId: input.regionId, storeId: input.storeId,
        startsAt: row.starts_at, endsAt: row.ends_at, reason: input.reason,
      })]);
      return row;
    });
  }

  async getById(assignmentId: string) {
    const result = await this.listById(assignmentId);
    return result;
  }

  async revoke(input: { assignmentId: string; actorUserId: string; reason: string }) {
    return this.databaseService.withTransaction(async (client) => {
      const current = await client.query<{ user_id: string }>(`
        SELECT user_id::text FROM ops.user_permission_assignment
        WHERE user_permission_assignment_id = $1::uuid AND revoked_at IS NULL FOR UPDATE
      `, [input.assignmentId]);
      if (!current.rows[0]) return null;
      const result = await client.query<UserPermissionAssignmentRow>(`
        WITH updated AS (
          UPDATE ops.user_permission_assignment
          SET revoked_at = NOW(), revoked_by_user_id = $2::uuid, revoke_reason = $3
          WHERE user_permission_assignment_id = $1::uuid
          RETURNING *
        )
        SELECT updated.user_permission_assignment_id::text,
               updated.user_role_assignment_id::text, updated.user_id::text,
               role.role_code, permission.permission_code, permission.resource_name, permission.action_name,
               updated.scope_type, updated.company_id::text, updated.region_id::text,
               updated.store_id::text, updated.starts_at::text, updated.ends_at::text,
               updated.grant_reason, updated.created_at::text,
               updated.revoked_at::text, updated.revoke_reason
        FROM updated
        JOIN ops.user_role_assignment role_assignment ON role_assignment.user_role_assignment_id = updated.user_role_assignment_id
        JOIN ops.role role ON role.role_id = role_assignment.role_id
        JOIN ops.permission permission ON permission.permission_id = updated.permission_id
      `, [input.assignmentId, input.actorUserId, input.reason]);
      const row = result.rows[0]!;
      await client.query(`
        INSERT INTO audit.event_log (
          actor_user_id, event_type, entity_name, entity_id, scope_type,
          company_id, region_id, store_id, metadata_json
        ) VALUES ($1::uuid, 'user_permission.revoked', 'ops.user_permission_assignment',
                  $2::uuid, $3, $4::uuid, $5::uuid, $6::uuid, $7::jsonb)
      `, [input.actorUserId, input.assignmentId, row.scope_type,
        row.company_id, row.region_id, row.store_id, JSON.stringify({
        operation: "revoke-user-permission", changedFields: ["revokedAt"],
        permissionCode: row.permission_code, reason: input.reason,
      })]);
      return row;
    });
  }

  private async listById(assignmentId: string) {
    const result = await this.databaseService.query<UserPermissionAssignmentRow>(`
      SELECT assignment.user_permission_assignment_id::text,
             assignment.user_role_assignment_id::text, assignment.user_id::text,
             role.role_code, permission.permission_code, permission.resource_name, permission.action_name,
             assignment.scope_type, assignment.company_id::text, assignment.region_id::text,
             assignment.store_id::text, assignment.starts_at::text, assignment.ends_at::text,
             assignment.grant_reason, assignment.created_at::text,
             assignment.revoked_at::text, assignment.revoke_reason
      FROM ops.user_permission_assignment assignment
      JOIN ops.user_role_assignment role_assignment ON role_assignment.user_role_assignment_id = assignment.user_role_assignment_id
      JOIN ops.role role ON role.role_id = role_assignment.role_id
      JOIN ops.permission permission ON permission.permission_id = assignment.permission_id
      WHERE assignment.user_permission_assignment_id = $1::uuid
      LIMIT 1
    `, [assignmentId]);
    return result.rows[0] ?? null;
  }
}
