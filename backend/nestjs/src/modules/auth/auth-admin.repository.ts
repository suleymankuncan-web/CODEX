import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../shared/database/database.service";
import { AuthActionStoreAssignmentCommandRepository } from "./auth-action-store-assignment-command.repository";
import {
  AuthRoleAssignmentCommandRepository,
  type CreateRoleAssignmentCommandInput,
  type DeactivateRoleAssignmentCommandInput,
} from "./auth-role-assignment-command.repository";
import { AuthRolePermissionCommandRepository } from "./auth-role-permission-command.repository";
import { AuthUserAccountCommandRepository } from "./auth-user-account-command.repository";

type RoleAssignmentRow = {
  user_role_assignment_id: string;
  user_id: string;
  username?: string;
  email?: string;
  role_code: string;
  role_name?: string;
  incentive_approval?: boolean;
  scope_type: string;
  company_id: string | null;
  region_id: string | null;
  store_id: string | null;
  start_at: string;
  end_at: string | null;
  created_at: string;
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
  deactivated_at?: string | null;
  deactivation_reason?: string | null;
  deactivated_by_user_id?: string | null;
  employee_status?: string | null;
};

@Injectable()
export class AuthAdminRepository {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly actionStoreAssignmentCommandRepository: AuthActionStoreAssignmentCommandRepository,
    private readonly roleAssignmentCommandRepository: AuthRoleAssignmentCommandRepository,
    private readonly rolePermissionCommandRepository: AuthRolePermissionCommandRepository,
    private readonly userAccountCommandRepository: AuthUserAccountCommandRepository,
  ) {}

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
         AND r.company_id = s.company_id
        INNER JOIN ops.company c
          ON c.company_id = s.company_id
        WHERE s.store_id = ANY($1::uuid[])
          AND s.status = 'active'
          AND r.status = 'active'
          AND c.status = 'active'
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

  async createRoleAssignment(input: CreateRoleAssignmentCommandInput) {
    return this.roleAssignmentCommandRepository.createRoleAssignment(input);
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
          ura.incentive_approval,
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
          ura.incentive_approval,
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

  async updateIncentiveApproval(input: { assignmentId: string; enabled: boolean; actorUserId: string }) {
    return this.roleAssignmentCommandRepository.updateIncentiveApproval(input);
  }

  async deactivateRoleAssignment(input: DeactivateRoleAssignmentCommandInput) {
    return this.roleAssignmentCommandRepository.deactivateRoleAssignment(input);
  }

  async countActiveActionStoreAssignments(input: {
    userId: string;
    storeId: string;
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
  }) {
    return this.actionStoreAssignmentCommandRepository.countActiveActionStoreAssignments(input);
  }

  async createActionStoreAssignment(input: {
    userId: string;
    storeId: string;
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
    actorUserId: string;
  }) {
    return this.actionStoreAssignmentCommandRepository.createActionStoreAssignment(input);
  }

  async createActionStoreAssignmentsBatch(input: {
    userId: string;
    storeIds: string[];
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
    actorUserId: string;
  }) {
    return this.actionStoreAssignmentCommandRepository.createActionStoreAssignmentsBatch(input);
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
    return this.actionStoreAssignmentCommandRepository.deactivateActionStoreAssignment(input);
  }

  async createUserAccount(input: {
    employeeId?: string | null;
    username: string;
    email: string;
    authProvider: string;
    providerSubject?: string | null;
    actorUserId: string;
  }) {
    return this.userAccountCommandRepository.createUserAccount(input);
  }

  async updateUserAccount(input: {
    userId: string;
    employeeId?: string | null;
    username?: string;
    email?: string;
    actorUserId: string;
  }) {
    return this.userAccountCommandRepository.updateUserAccount(input);
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
  }) {
    return this.userAccountCommandRepository.createPilotUserBinding(input);
  }

  async reactivateUserAccount(input: { userId: string; actorUserId: string }) {
    return this.userAccountCommandRepository.reactivateUserAccount(input);
  }

  async grantRolePermission(input: {
    roleId: string;
    permissionId: string;
    actorUserId: string;
  }) {
    return this.rolePermissionCommandRepository.grantRolePermission(input);
  }

  async revokeRolePermission(input: {
    roleId: string;
    permissionCode: string;
    actorUserId: string;
  }) {
    return this.rolePermissionCommandRepository.revokeRolePermission(input);
  }
}
