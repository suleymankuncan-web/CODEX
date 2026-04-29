import { Injectable } from "@nestjs/common";
import { buildRequestAuditMetadata } from "../../shared/audit/audit-metadata.factory";
import { DatabaseService } from "../../shared/database/database.service";

type RoleAssignmentRow = {
  user_role_assignment_id: string;
  user_id: string;
  username?: string;
  email?: string;
  role_code: string;
  role_name?: string;
  scope_type: string;
  company_id: string | null;
  region_id: string | null;
  store_id: string | null;
  start_at: string;
  end_at: string | null;
  created_at: string;
};

type RoleAssignmentAuditRow = {
  event_log_id: string;
  occurred_at: string;
  actor_user_id: string | null;
  event_type: string;
  metadata_json: Record<string, unknown>;
};

type ActionStoreAssignmentRow = {
  user_action_store_assignment_id: string;
  user_id: string;
  username?: string;
  email?: string;
  store_id: string;
  store_code: string;
  store_name: string;
  company_id: string;
  region_id: string;
  region_name: string;
  start_at: string;
  end_at: string | null;
  created_at: string;
};

type StoreLookupRow = {
  store_id: string;
  store_code: string;
  store_name: string;
  company_id: string;
  region_id: string;
  region_name: string;
};

type ActiveEmployeeAccessContextRow = {
  employee_id: string;
  external_employee_ref: string | null;
  first_name: string;
  last_name: string;
  store_id: string;
  store_code: string;
  store_name: string;
  company_id: string;
  region_id: string;
};

type UserAccountRow = {
  user_id: string;
  employee_id: string | null;
  username: string;
  email: string;
  auth_provider: string;
  provider_subject: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
};

type UserAccountAuditRow = {
  event_log_id: string;
  occurred_at: string;
  actor_user_id: string | null;
  event_type: string;
  metadata_json: Record<string, unknown>;
};

type RoleCatalogRow = {
  role_id: string;
  role_code: string;
  role_name: string;
  role_scope_type: string;
  description: string | null;
  is_system_role: boolean;
  permission_code: string | null;
  resource_name: string | null;
  action_name: string | null;
};

type PermissionCatalogRow = {
  permission_id: string;
  permission_code: string;
  resource_name: string;
  action_name: string;
  description: string | null;
};

type RolePermissionRow = {
  role_id: string;
  permission_id: string;
  role_code: string;
  permission_code: string;
  granted_at?: string;
};

type PilotUserBindingRow = {
  user: UserAccountRow;
  roleAssignments: RoleAssignmentRow[];
  actionStoreAssignments: ActionStoreAssignmentRow[];
  employee: ActiveEmployeeAccessContextRow;
};

@Injectable()
export class AuthAdminRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async getRoleByCode(roleCode: string) {
    const result = await this.databaseService.query<{
      role_id: string;
      role_code: string;
      role_scope_type: string;
      role_name: string;
    }>(
      `
        SELECT r.role_id, r.role_code, r.role_scope_type, r.role_name
        FROM ops.role r
        WHERE r.role_code = $1
      `,
      [roleCode],
    );

    return result.rows[0] ?? null;
  }

  async getRoleById(roleId: string) {
    const result = await this.databaseService.query<{
      role_id: string;
      role_code: string;
      role_scope_type: string;
      role_name: string;
    }>(
      `
        SELECT r.role_id, r.role_code, r.role_scope_type, r.role_name
        FROM ops.role r
        WHERE r.role_id = $1::uuid
      `,
      [roleId],
    );

    return result.rows[0] ?? null;
  }

  async getUserAccountByProviderSubject(input: {
    authProvider: string;
    providerSubject: string;
  }) {
    const result = await this.databaseService.query<UserAccountRow>(
      `
        SELECT
          ua.user_id,
          ua.employee_id,
          ua.username,
          ua.email,
          ua.auth_provider,
          ua.provider_subject,
          ua.is_active,
          ua.last_login_at,
          ua.created_at
        FROM ops.user_account ua
        WHERE ua.auth_provider = $1
          AND ua.provider_subject = $2
        LIMIT 1
      `,
      [input.authProvider, input.providerSubject],
    );

    return result.rows[0] ?? null;
  }

  async getActiveEmployeeAccessContext(employeeId: string) {
    const result = await this.databaseService.query<ActiveEmployeeAccessContextRow>(
      `
        /* active_employee_access_context */
        SELECT
          e.employee_id,
          e.external_employee_ref,
          e.first_name,
          e.last_name,
          s.store_id,
          s.store_code,
          s.store_name,
          s.company_id,
          s.region_id
        FROM ops.employee e
        INNER JOIN ops.employee_assignment_history eah
          ON eah.employee_id = e.employee_id
        INNER JOIN ops.store s
          ON s.store_id = eah.store_id
        WHERE e.employee_id = $1::uuid
          AND e.employment_status = 'active'
          AND eah.assignment_status = 'active'
          AND eah.is_primary_assignment = TRUE
          AND eah.start_date <= CURRENT_DATE
          AND (eah.end_date IS NULL OR eah.end_date >= CURRENT_DATE)
          AND s.status = 'active'
        ORDER BY eah.start_date DESC, eah.assignment_id DESC
        LIMIT 1
      `,
      [employeeId],
    );

    return result.rows[0] ?? null;
  }

  async listActiveStoresByIds(storeIds: string[]) {
    if (storeIds.length === 0) {
      return [];
    }

    const result = await this.databaseService.query<StoreLookupRow>(
      `
        SELECT
          s.store_id,
          s.store_code,
          s.store_name,
          s.company_id,
          s.region_id,
          r.region_name
        FROM ops.store s
        INNER JOIN ops.region r
          ON r.region_id = s.region_id
        WHERE s.store_id = ANY($1::uuid[])
          AND s.status = 'active'
        ORDER BY s.store_code ASC, s.store_id ASC
      `,
      [storeIds],
    );

    return result.rows;
  }

  async countActiveAssignments(input: {
    userId: string;
    roleId: string;
    scopeType: string;
    companyId?: string | null;
    regionId?: string | null;
    storeId?: string | null;
  }) {
    const result = await this.databaseService.query<{ active_assignment_count: string }>(
      `
        SELECT COUNT(*)::text AS active_assignment_count
        FROM ops.user_role_assignment ura
        WHERE ura.user_id = $1::uuid
          AND ura.role_id = $2::uuid
          AND ura.scope_type = $3
          AND (
            ($4::uuid IS NULL AND ura.company_id IS NULL) OR ura.company_id = $4::uuid
          )
          AND (
            ($5::uuid IS NULL AND ura.region_id IS NULL) OR ura.region_id = $5::uuid
          )
          AND (
            ($6::uuid IS NULL AND ura.store_id IS NULL) OR ura.store_id = $6::uuid
          )
          AND ura.start_at <= NOW()
          AND (ura.end_at IS NULL OR ura.end_at > NOW())
      `,
      [
        input.userId,
        input.roleId,
        input.scopeType,
        input.companyId ?? null,
        input.regionId ?? null,
        input.storeId ?? null,
      ],
    );

    return Number(result.rows[0]?.active_assignment_count ?? "0");
  }

  async createRoleAssignment(input: {
    userId: string;
    roleId: string;
    scopeType: string;
    companyId?: string | null;
    regionId?: string | null;
    storeId?: string | null;
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
    actorUserId: string;
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<RoleAssignmentRow>(
        `
          INSERT INTO ops.user_role_assignment (
            user_id,
            role_id,
            scope_type,
            company_id,
            region_id,
            store_id,
            start_at,
            end_at
          )
          SELECT
            $1::uuid,
            $2::uuid,
            $3,
            $4::uuid,
            $5::uuid,
            $6::uuid,
            COALESCE($7::timestamptz, NOW()),
            $8::timestamptz
          RETURNING
            user_role_assignment_id,
            user_id,
            (SELECT role_code FROM ops.role WHERE role_id = $2::uuid) AS role_code,
            scope_type,
            company_id,
            region_id,
            store_id,
            start_at,
            end_at,
            created_at
        `,
        [
          input.userId,
          input.roleId,
          input.scopeType,
          input.companyId ?? null,
          input.regionId ?? null,
          input.storeId ?? null,
          input.effectiveFrom ?? null,
          input.effectiveTo ?? null,
        ],
      );

      const assignment = result.rows[0];

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
            'user_role_assignment.created',
            'ops.user_role_assignment',
            $2::uuid,
            $3,
            $4::uuid,
            $5::uuid,
            $6::uuid,
            $7::jsonb
          )
        `,
        [
          input.actorUserId,
          assignment.user_role_assignment_id,
          input.scopeType,
          input.companyId ?? null,
          input.regionId ?? null,
          input.storeId ?? null,
          JSON.stringify({
            ...buildRequestAuditMetadata({
              sourceContext: {
                module: "auth-admin",
                operation: "create-role-assignment",
              },
              changedFields: [
                "roleId",
                "scopeType",
                "companyId",
                "regionId",
                "storeId",
                "effectiveFrom",
                "effectiveTo",
              ],
              details: {
                userId: input.userId,
                roleId: input.roleId,
                scopeType: input.scopeType,
                companyId: input.companyId ?? null,
                regionId: input.regionId ?? null,
                storeId: input.storeId ?? null,
                effectiveFrom: input.effectiveFrom ?? null,
                effectiveTo: input.effectiveTo ?? null,
              },
            }),
          }),
        ],
      );

      return assignment;
    });
  }

  async listRoleAssignments(input: {
    limit?: number;
    offset?: number;
    userId?: string;
    roleCode?: string;
    scopeType?: string;
    active?: boolean;
  }) {
    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;
    const filters: string[] = [];
    const params: unknown[] = [];

    if (input.userId) {
      params.push(input.userId);
      filters.push(`ura.user_id = $${params.length}::uuid`);
    }

    if (input.roleCode) {
      params.push(input.roleCode);
      filters.push(`r.role_code = $${params.length}`);
    }

    if (input.scopeType) {
      params.push(input.scopeType);
      filters.push(`ura.scope_type = $${params.length}`);
    }

    if (typeof input.active === "boolean") {
      params.push(input.active);
      filters.push(
        input.active
          ? `(ura.start_at <= NOW() AND (ura.end_at IS NULL OR ura.end_at > NOW())) = $${params.length}`
          : `(ura.end_at IS NOT NULL AND ura.end_at <= NOW()) = NOT $${params.length}`,
      );
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

    const totalResult = await this.databaseService.query<{ total_count: string }>(
      `
        SELECT COUNT(*)::text AS total_count
        FROM ops.user_role_assignment ura
        INNER JOIN ops.role r ON r.role_id = ura.role_id
        ${whereClause}
      `,
      params,
    );

    const result = await this.databaseService.query<RoleAssignmentRow>(
      `
        SELECT
          ura.user_role_assignment_id,
          ura.user_id,
          ua.username,
          ua.email,
          r.role_code,
          r.role_name,
          ura.scope_type,
          ura.company_id,
          ura.region_id,
          ura.store_id,
          ura.start_at,
          ura.end_at,
          ura.created_at
        FROM ops.user_role_assignment ura
        INNER JOIN ops.user_account ua ON ua.user_id = ura.user_id
        INNER JOIN ops.role r ON r.role_id = ura.role_id
        ${whereClause}
        ORDER BY ura.created_at DESC, ura.user_role_assignment_id DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `,
      [...params, limit, offset],
    );

    return {
      rows: result.rows,
      total: Number(totalResult.rows[0]?.total_count ?? "0"),
    };
  }

  async getRoleAssignmentById(assignmentId: string) {
    const result = await this.databaseService.query<RoleAssignmentRow>(
      `
        SELECT
          ura.user_role_assignment_id,
          ura.user_id,
          r.role_code,
          ura.scope_type,
          ura.company_id,
          ura.region_id,
          ura.store_id,
          ura.start_at,
          ura.end_at,
          ura.created_at
        FROM ops.user_role_assignment ura
        INNER JOIN ops.role r ON r.role_id = ura.role_id
        WHERE ura.user_role_assignment_id = $1::uuid
      `,
      [assignmentId],
    );

    return result.rows[0] ?? null;
  }

  async deactivateRoleAssignment(input: { assignmentId: string; actorUserId: string }) {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<RoleAssignmentRow>(
        `
          UPDATE ops.user_role_assignment
          SET end_at = NOW()
          WHERE user_role_assignment_id = $1::uuid
            AND (end_at IS NULL OR end_at > NOW())
          RETURNING
            user_role_assignment_id,
            user_id,
            (SELECT role_code FROM ops.role WHERE role_id = ops.user_role_assignment.role_id) AS role_code,
            scope_type,
            company_id,
            region_id,
            store_id,
            start_at,
            end_at,
            created_at
        `,
        [input.assignmentId],
      );

      const assignment = result.rows[0] ?? null;

      if (assignment) {
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
              'user_role_assignment.deactivated',
              'ops.user_role_assignment',
              $2::uuid,
              $3,
              $4::uuid,
              $5::uuid,
              $6::uuid,
              $7::jsonb
            )
          `,
          [
            input.actorUserId,
            assignment.user_role_assignment_id,
            assignment.scope_type,
            assignment.company_id,
            assignment.region_id,
            assignment.store_id,
            JSON.stringify({
              ...buildRequestAuditMetadata({
                sourceContext: {
                  module: "auth-admin",
                  operation: "deactivate-role-assignment",
                },
                changedFields: ["endAt"],
                details: {
                  userId: assignment.user_id,
                  roleCode: assignment.role_code,
                  scopeType: assignment.scope_type,
                  companyId: assignment.company_id,
                  regionId: assignment.region_id,
                  storeId: assignment.store_id,
                  endAt: assignment.end_at,
                },
              }),
            }),
          ],
        );
      }

      return assignment;
    });
  }

  async getRoleAssignmentAudit(input: { assignmentId: string; limit?: number; offset?: number }) {
    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;

    const result = await this.databaseService.query<RoleAssignmentAuditRow>(
      `
        SELECT
          event_log_id,
          occurred_at,
          actor_user_id,
          event_type,
          metadata_json
        FROM audit.event_log
        WHERE entity_name = 'ops.user_role_assignment'
          AND entity_id = $1::uuid
        ORDER BY occurred_at ASC, event_log_id ASC
        LIMIT $2 OFFSET $3
      `,
      [input.assignmentId, limit, offset],
    );

    return result.rows;
  }

  async getStoreLookupById(storeId: string) {
    const result = await this.databaseService.query<StoreLookupRow>(
      `
        SELECT
          s.store_id,
          s.store_code,
          s.store_name,
          s.company_id,
          s.region_id,
          r.region_name
        FROM ops.store s
        INNER JOIN ops.region r ON r.region_id = s.region_id
        WHERE s.store_id = $1::uuid
          AND s.status = 'active'
      `,
      [storeId],
    );

    return result.rows[0] ?? null;
  }

  async countActiveActionStoreAssignments(input: { userId: string; storeId: string }) {
    const result = await this.databaseService.query<{
      active_action_store_assignment_count: string;
    }>(
      `
        SELECT COUNT(*)::text AS active_action_store_assignment_count
        FROM ops.user_action_store_assignment uasa
        WHERE uasa.user_id = $1::uuid
          AND uasa.store_id = $2::uuid
          AND uasa.start_at <= NOW()
          AND (uasa.end_at IS NULL OR uasa.end_at > NOW())
      `,
      [input.userId, input.storeId],
    );

    return Number(result.rows[0]?.active_action_store_assignment_count ?? "0");
  }

  async createActionStoreAssignment(input: {
    userId: string;
    storeId: string;
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
    actorUserId: string;
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<ActionStoreAssignmentRow>(
        `
          WITH inserted AS (
            INSERT INTO ops.user_action_store_assignment (
              user_id,
              store_id,
              start_at,
              end_at
            )
            VALUES (
              $1::uuid,
              $2::uuid,
              COALESCE($3::timestamptz, NOW()),
              $4::timestamptz
            )
            RETURNING
              user_action_store_assignment_id,
              user_id,
              store_id,
              start_at,
              end_at,
              created_at
          )
          SELECT
            inserted.user_action_store_assignment_id,
            inserted.user_id,
            ua.username,
            ua.email,
            inserted.store_id,
            s.store_code,
            s.store_name,
            s.company_id,
            s.region_id,
            r.region_name,
            inserted.start_at,
            inserted.end_at,
            inserted.created_at
          FROM inserted
          INNER JOIN ops.user_account ua ON ua.user_id = inserted.user_id
          INNER JOIN ops.store s ON s.store_id = inserted.store_id
          INNER JOIN ops.region r ON r.region_id = s.region_id
        `,
        [
          input.userId,
          input.storeId,
          input.effectiveFrom ?? null,
          input.effectiveTo ?? null,
        ],
      );

      const assignment = result.rows[0];

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
            'user_action_store_assignment.created',
            'ops.user_action_store_assignment',
            $2::uuid,
            'store',
            $3::uuid,
            $4::uuid,
            $5::uuid,
            $6::jsonb
          )
        `,
        [
          input.actorUserId,
          assignment.user_action_store_assignment_id,
          assignment.company_id,
          assignment.region_id,
          assignment.store_id,
          JSON.stringify({
            ...buildRequestAuditMetadata({
              sourceContext: {
                module: "auth-admin",
                operation: "create-action-store-assignment",
              },
              changedFields: ["userId", "storeId", "effectiveFrom", "effectiveTo"],
              details: {
                userId: input.userId,
                storeId: input.storeId,
                effectiveFrom: input.effectiveFrom ?? null,
                effectiveTo: input.effectiveTo ?? null,
              },
            }),
          }),
        ],
      );

      return assignment;
    });
  }

  async listActionStoreAssignments(input: {
    limit?: number;
    offset?: number;
    userId?: string;
    storeId?: string;
    active?: boolean;
  }) {
    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;
    const filters: string[] = [];
    const params: unknown[] = [];

    if (input.userId) {
      params.push(input.userId);
      filters.push(`uasa.user_id = $${params.length}::uuid`);
    }

    if (input.storeId) {
      params.push(input.storeId);
      filters.push(`uasa.store_id = $${params.length}::uuid`);
    }

    if (typeof input.active === "boolean") {
      params.push(input.active);
      filters.push(
        input.active
          ? `(uasa.start_at <= NOW() AND (uasa.end_at IS NULL OR uasa.end_at > NOW())) = $${params.length}`
          : `(uasa.end_at IS NOT NULL AND uasa.end_at <= NOW()) = NOT $${params.length}`,
      );
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

    const totalResult = await this.databaseService.query<{ total_count: string }>(
      `
        SELECT COUNT(*)::text AS total_count
        FROM ops.user_action_store_assignment uasa
        INNER JOIN ops.user_account ua ON ua.user_id = uasa.user_id
        INNER JOIN ops.store s ON s.store_id = uasa.store_id
        INNER JOIN ops.region r ON r.region_id = s.region_id
        ${whereClause}
      `,
      params,
    );

    const result = await this.databaseService.query<ActionStoreAssignmentRow>(
      `
        SELECT
          uasa.user_action_store_assignment_id,
          uasa.user_id,
          ua.username,
          ua.email,
          uasa.store_id,
          s.store_code,
          s.store_name,
          s.company_id,
          s.region_id,
          r.region_name,
          uasa.start_at,
          uasa.end_at,
          uasa.created_at
        FROM ops.user_action_store_assignment uasa
        INNER JOIN ops.user_account ua ON ua.user_id = uasa.user_id
        INNER JOIN ops.store s ON s.store_id = uasa.store_id
        INNER JOIN ops.region r ON r.region_id = s.region_id
        ${whereClause}
        ORDER BY uasa.created_at DESC, uasa.user_action_store_assignment_id DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `,
      [...params, limit, offset],
    );

    return {
      rows: result.rows,
      total: Number(totalResult.rows[0]?.total_count ?? "0"),
    };
  }

  async getActionStoreAssignmentById(assignmentId: string) {
    const result = await this.databaseService.query<ActionStoreAssignmentRow>(
      `
        SELECT
          uasa.user_action_store_assignment_id,
          uasa.user_id,
          ua.username,
          ua.email,
          uasa.store_id,
          s.store_code,
          s.store_name,
          s.company_id,
          s.region_id,
          r.region_name,
          uasa.start_at,
          uasa.end_at,
          uasa.created_at
        FROM ops.user_action_store_assignment uasa
        INNER JOIN ops.user_account ua ON ua.user_id = uasa.user_id
        INNER JOIN ops.store s ON s.store_id = uasa.store_id
        INNER JOIN ops.region r ON r.region_id = s.region_id
        WHERE uasa.user_action_store_assignment_id = $1::uuid
      `,
      [assignmentId],
    );

    return result.rows[0] ?? null;
  }

  async deactivateActionStoreAssignment(input: { assignmentId: string; actorUserId: string }) {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<ActionStoreAssignmentRow>(
        `
          WITH updated AS (
            UPDATE ops.user_action_store_assignment
            SET end_at = NOW()
            WHERE user_action_store_assignment_id = $1::uuid
              AND (end_at IS NULL OR end_at > NOW())
            RETURNING
              user_action_store_assignment_id,
              user_id,
              store_id,
              start_at,
              end_at,
              created_at
          )
          SELECT
            updated.user_action_store_assignment_id,
            updated.user_id,
            ua.username,
            ua.email,
            updated.store_id,
            s.store_code,
            s.store_name,
            s.company_id,
            s.region_id,
            r.region_name,
            updated.start_at,
            updated.end_at,
            updated.created_at
          FROM updated
          INNER JOIN ops.user_account ua ON ua.user_id = updated.user_id
          INNER JOIN ops.store s ON s.store_id = updated.store_id
          INNER JOIN ops.region r ON r.region_id = s.region_id
        `,
        [input.assignmentId],
      );

      const assignment = result.rows[0] ?? null;

      if (assignment) {
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
              'user_action_store_assignment.deactivated',
              'ops.user_action_store_assignment',
              $2::uuid,
              'store',
              $3::uuid,
              $4::uuid,
              $5::uuid,
              $6::jsonb
            )
          `,
          [
            input.actorUserId,
            assignment.user_action_store_assignment_id,
            assignment.company_id,
            assignment.region_id,
            assignment.store_id,
            JSON.stringify({
              ...buildRequestAuditMetadata({
                sourceContext: {
                  module: "auth-admin",
                  operation: "deactivate-action-store-assignment",
                },
                changedFields: ["endAt"],
                details: {
                  userId: assignment.user_id,
                  storeId: assignment.store_id,
                  endAt: assignment.end_at,
                },
              }),
            }),
          ],
        );
      }

      return assignment;
    });
  }

  async getActionStoreAssignmentAudit(input: {
    assignmentId: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;

    const result = await this.databaseService.query<RoleAssignmentAuditRow>(
      `
        SELECT
          event_log_id,
          occurred_at,
          actor_user_id,
          event_type,
          metadata_json
        FROM audit.event_log
        WHERE entity_name = 'ops.user_action_store_assignment'
          AND entity_id = $1::uuid
        ORDER BY occurred_at ASC, event_log_id ASC
        LIMIT $2 OFFSET $3
      `,
      [input.assignmentId, limit, offset],
    );

    return result.rows;
  }

  async createUserAccount(input: {
    employeeId?: string | null;
    username: string;
    email: string;
    authProvider: string;
    providerSubject?: string | null;
    actorUserId: string;
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<UserAccountRow>(
        `
          INSERT INTO ops.user_account (
            employee_id,
            username,
            email,
            auth_provider,
            provider_subject
          )
          VALUES ($1::uuid, $2, $3, $4, $5)
          RETURNING
            user_id,
            employee_id,
            username,
            email,
            auth_provider,
            provider_subject,
            is_active,
            last_login_at,
            created_at
        `,
        [
          input.employeeId ?? null,
          input.username,
          input.email,
          input.authProvider,
          input.providerSubject ?? null,
        ],
      );

      const user = result.rows[0];

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
          VALUES ($1::uuid, 'user_account.created', 'ops.user_account', $2::uuid, 'company', $3::jsonb)
        `,
        [
          input.actorUserId,
          user.user_id,
          JSON.stringify({
            ...buildRequestAuditMetadata({
              sourceContext: {
                module: "auth-admin",
                operation: "create-user-account",
              },
              changedFields: [
                "employeeId",
                "username",
                "email",
                "authProvider",
                "providerSubject",
                "isActive",
              ],
              details: {
                employeeId: user.employee_id,
                username: user.username,
                email: user.email,
                authProvider: user.auth_provider,
                providerSubject: user.provider_subject,
                isActive: user.is_active,
              },
            }),
          }),
        ],
      );

      return user;
    });
  }

  async createPilotUserBinding(input: {
    employeeId: string;
    authProvider: string;
    providerSubject: string;
    username: string;
    email: string;
    role: {
      role_id: string;
      role_code: string;
      role_scope_type: string;
      role_name: string;
    };
    stores: StoreLookupRow[];
    employee: ActiveEmployeeAccessContextRow;
    actorUserId: string;
  }): Promise<PilotUserBindingRow> {
    return this.databaseService.withTransaction(async (client) => {
      const userResult = await client.query<UserAccountRow>(
        `
          INSERT INTO ops.user_account (
            employee_id,
            username,
            email,
            auth_provider,
            provider_subject
          )
          VALUES ($1::uuid, $2, $3, $4, $5)
          RETURNING
            user_id,
            employee_id,
            username,
            email,
            auth_provider,
            provider_subject,
            is_active,
            last_login_at,
            created_at
        `,
        [
          input.employeeId,
          input.username,
          input.email,
          input.authProvider,
          input.providerSubject,
        ],
      );

      const user = userResult.rows[0];
      const roleAssignments: RoleAssignmentRow[] = [];
      const actionStoreAssignments: ActionStoreAssignmentRow[] = [];

      for (const store of input.stores) {
        const roleAssignmentResult = await client.query<RoleAssignmentRow>(
          `
            INSERT INTO ops.user_role_assignment (
              user_id,
              role_id,
              scope_type,
              company_id,
              region_id,
              store_id,
              start_at
            )
            VALUES (
              $1::uuid,
              $2::uuid,
              'store',
              $3::uuid,
              $4::uuid,
              $5::uuid,
              NOW()
            )
            RETURNING
              user_role_assignment_id,
              user_id,
              $6::text AS role_code,
              scope_type,
              company_id,
              region_id,
              store_id,
              start_at,
              end_at,
              created_at
          `,
          [
            user.user_id,
            input.role.role_id,
            store.company_id,
            store.region_id,
            store.store_id,
            input.role.role_code,
          ],
        );
        roleAssignments.push(roleAssignmentResult.rows[0]);

        const actionStoreAssignmentResult = await client.query<ActionStoreAssignmentRow>(
          `
            WITH inserted AS (
              INSERT INTO ops.user_action_store_assignment (
                user_id,
                store_id,
                start_at
              )
              VALUES ($1::uuid, $2::uuid, NOW())
              RETURNING
                user_action_store_assignment_id,
                user_id,
                store_id,
                start_at,
                end_at,
                created_at
            )
            SELECT
              inserted.user_action_store_assignment_id,
              inserted.user_id,
              ua.username,
              ua.email,
              inserted.store_id,
              s.store_code,
              s.store_name,
              s.company_id,
              s.region_id,
              r.region_name,
              inserted.start_at,
              inserted.end_at,
              inserted.created_at
            FROM inserted
            INNER JOIN ops.user_account ua
              ON ua.user_id = inserted.user_id
            INNER JOIN ops.store s
              ON s.store_id = inserted.store_id
            INNER JOIN ops.region r
              ON r.region_id = s.region_id
          `,
          [user.user_id, store.store_id],
        );
        actionStoreAssignments.push(actionStoreAssignmentResult.rows[0]);
      }

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
            'pilot_user_binding.created',
            'ops.user_account',
            $2::uuid,
            'store',
            $3::uuid,
            $4::uuid,
            $5::uuid,
            $6::jsonb
          )
        `,
        [
          input.actorUserId,
          user.user_id,
          input.stores[0]?.company_id ?? null,
          input.stores[0]?.region_id ?? null,
          input.stores[0]?.store_id ?? null,
          JSON.stringify({
            ...buildRequestAuditMetadata({
              sourceContext: {
                module: "auth-admin",
                operation: "create-pilot-user-binding",
              },
              changedFields: [
                "employeeId",
                "username",
                "email",
                "authProvider",
                "providerSubject",
                "roleCode",
                "storeIds",
              ],
              details: {
                employeeId: input.employeeId,
                username: input.username,
                email: input.email,
                authProvider: input.authProvider,
                providerSubject: input.providerSubject,
                roleCode: input.role.role_code,
                storeIds: input.stores.map((store) => store.store_id),
              },
            }),
          }),
        ],
      );

      return {
        user,
        roleAssignments,
        actionStoreAssignments,
        employee: input.employee,
      };
    });
  }

  async listUserAccounts(input: {
    limit?: number;
    offset?: number;
    authProvider?: string;
    isActive?: boolean;
  }) {
    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;
    const filters: string[] = [];
    const params: unknown[] = [];

    if (input.authProvider) {
      params.push(input.authProvider);
      filters.push(`ua.auth_provider = $${params.length}`);
    }

    if (typeof input.isActive === "boolean") {
      params.push(input.isActive);
      filters.push(`ua.is_active = $${params.length}`);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

    const totalResult = await this.databaseService.query<{ total_count: string }>(
      `
        SELECT COUNT(*)::text AS total_count
        FROM ops.user_account ua
        ${whereClause}
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `,
      [...params, limit, offset],
    );

    const result = await this.databaseService.query<UserAccountRow>(
      `
        SELECT
          user_id,
          employee_id,
          username,
          email,
          auth_provider,
          provider_subject,
          is_active,
          last_login_at,
          created_at
        FROM ops.user_account ua
        ${whereClause}
        ORDER BY created_at DESC, user_id DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `,
      [...params, limit, offset],
    );

    return {
      rows: result.rows,
      total: Number(totalResult.rows[0]?.total_count ?? "0"),
    };
  }

  async getUserAccountById(userId: string) {
    const result = await this.databaseService.query<UserAccountRow>(
      `
        SELECT
          user_id,
          employee_id,
          username,
          email,
          auth_provider,
          provider_subject,
          is_active,
          last_login_at,
          created_at
        FROM ops.user_account
        WHERE user_id = $1::uuid
      `,
      [userId],
    );

    return result.rows[0] ?? null;
  }

  async deactivateUserAccount(input: { userId: string; actorUserId: string }) {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<UserAccountRow>(
        `
          UPDATE ops.user_account
          SET is_active = FALSE,
              updated_at = NOW(),
              deactivated_at = NOW()
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
            created_at
        `,
        [input.userId],
      );

      const user = result.rows[0] ?? null;

      if (user) {
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
            JSON.stringify({
              ...buildRequestAuditMetadata({
                sourceContext: {
                  module: "auth-admin",
                  operation: "deactivate-user-account",
                },
                changedFields: ["isActive"],
                details: {
                  username: user.username,
                  email: user.email,
                  isActive: user.is_active,
                },
              }),
            }),
          ],
        );
      }

      return user;
    });
  }

  async reactivateUserAccount(input: { userId: string; actorUserId: string }) {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<UserAccountRow>(
        `
          UPDATE ops.user_account
          SET is_active = TRUE,
              updated_at = NOW(),
              deactivated_at = NULL
          WHERE user_id = $1::uuid
            AND is_active = FALSE
          RETURNING
            user_id,
            employee_id,
            username,
            email,
            auth_provider,
            provider_subject,
            is_active,
            last_login_at,
            created_at
        `,
        [input.userId],
      );

      const user = result.rows[0] ?? null;

      if (user) {
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
            VALUES ($1::uuid, 'user_account.reactivated', 'ops.user_account', $2::uuid, 'company', $3::jsonb)
          `,
          [
            input.actorUserId,
            input.userId,
            JSON.stringify({
              ...buildRequestAuditMetadata({
                sourceContext: {
                  module: "auth-admin",
                  operation: "reactivate-user-account",
                },
                changedFields: ["isActive"],
                details: {
                  username: user.username,
                  email: user.email,
                  isActive: user.is_active,
                },
              }),
            }),
          ],
        );
      }

      return user;
    });
  }

  async getUserAccountAudit(input: { userId: string; limit?: number; offset?: number }) {
    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;

    const result = await this.databaseService.query<UserAccountAuditRow>(
      `
        SELECT
          event_log_id,
          occurred_at,
          actor_user_id,
          event_type,
          metadata_json
        FROM audit.event_log
        WHERE entity_name = 'ops.user_account'
          AND entity_id = $1::uuid
        ORDER BY occurred_at ASC, event_log_id ASC
        LIMIT $2 OFFSET $3
      `,
      [input.userId, limit, offset],
    );

    return result.rows;
  }

  async listRoles() {
    const result = await this.databaseService.query<RoleCatalogRow>(
      `
        SELECT
          r.role_id,
          r.role_code,
          r.role_name,
          r.role_scope_type,
          r.description,
          r.is_system_role,
          p.permission_code,
          p.resource_name,
          p.action_name
        FROM ops.role r
        LEFT JOIN ops.role_permission rp ON rp.role_id = r.role_id
        LEFT JOIN ops.permission p ON p.permission_id = rp.permission_id
        ORDER BY r.role_code ASC, p.permission_code ASC NULLS LAST
      `,
    );

    return result.rows;
  }

  async listPermissions() {
    const result = await this.databaseService.query<PermissionCatalogRow>(
      `
        SELECT
          permission_id,
          permission_code,
          resource_name,
          action_name,
          description
        FROM ops.permission
        ORDER BY permission_code ASC
      `,
    );

    return result.rows;
  }

  async listActiveUserLookups() {
    const result = await this.databaseService.query<{
      user_id: string;
      username: string;
      email: string;
      auth_provider: string;
    }>(
      `
        SELECT user_id, username, email, auth_provider
        FROM ops.user_account
        WHERE is_active = TRUE
        ORDER BY username ASC
        LIMIT 50
      `,
    );

    return result.rows;
  }

  async listActiveStoreLookups() {
    const result = await this.databaseService.query<StoreLookupRow>(
      `
        SELECT
          s.store_id,
          s.store_code,
          s.store_name,
          s.company_id,
          s.region_id,
          r.region_name
        FROM ops.store s
        INNER JOIN ops.region r ON r.region_id = s.region_id
        WHERE s.status = 'active'
        ORDER BY s.store_code ASC, s.store_id ASC
        LIMIT 200
      `,
    );

    return result.rows;
  }

  async getPermissionByCode(permissionCode: string) {
    const result = await this.databaseService.query<{
      permission_id: string;
      permission_code: string;
    }>(
      `
        SELECT p.permission_id, p.permission_code
        FROM ops.permission p
        WHERE p.permission_code = $1
      `,
      [permissionCode],
    );

    return result.rows[0] ?? null;
  }

  async getRolePermission(input: { roleId: string; permissionId: string }) {
    const result = await this.databaseService.query<RolePermissionRow>(
      `
        SELECT rp.role_id, rp.permission_id
        FROM ops.role_permission rp
        WHERE rp.role_id = $1::uuid
          AND rp.permission_id = $2::uuid
      `,
      [input.roleId, input.permissionId],
    );

    return result.rows[0] ?? null;
  }

  async grantRolePermission(input: {
    roleId: string;
    permissionId: string;
    actorUserId: string;
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<RolePermissionRow>(
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

  async revokeRolePermission(input: {
    roleId: string;
    permissionCode: string;
    actorUserId: string;
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<RolePermissionRow>(
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
