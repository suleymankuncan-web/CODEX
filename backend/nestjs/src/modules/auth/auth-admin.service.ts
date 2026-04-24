import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { buildCommandResponse, buildListResponse } from "../../shared/http/response-builders";
import { mapAuditEvent } from "../../shared/audit/audit-event.mapper";
import { AuthAdminRepository } from "./auth-admin.repository";
import { AuthRoleScopePolicyService } from "./auth-role-scope-policy.service";

@Injectable()
export class AuthAdminService {
  constructor(
    private readonly authAdminRepository: AuthAdminRepository,
    private readonly authRoleScopePolicyService: AuthRoleScopePolicyService,
  ) {}

  async createRoleAssignment(input: {
    userId: string;
    roleCode: string;
    scopeType: "company" | "region" | "store";
    companyId?: string;
    regionId?: string;
    storeId?: string;
    effectiveFrom?: string;
    effectiveTo?: string;
    actorUserId: string;
  }) {
    this.authRoleScopePolicyService.validateAssignmentScope(input);

    const role = await this.authAdminRepository.getRoleByCode(input.roleCode);

    if (!role) {
      throw new NotFoundException(`Role not found: ${input.roleCode}`);
    }

    this.authRoleScopePolicyService.validateRoleScope(role.role_scope_type, input.scopeType);

    const activeAssignmentCount = await this.authAdminRepository.countActiveAssignments({
      userId: input.userId,
      roleId: role.role_id,
      scopeType: input.scopeType,
      companyId: this.getCompanyId(input),
      regionId: this.getRegionId(input),
      storeId: this.getStoreId(input),
    });

    if (activeAssignmentCount > 0) {
      throw new ConflictException("Active role assignment already exists for the same scope");
    }

    const assignment = await this.authAdminRepository.createRoleAssignment({
      userId: input.userId,
      roleId: role.role_id,
      scopeType: input.scopeType,
      companyId: this.getCompanyId(input),
      regionId: this.getRegionId(input),
      storeId: this.getStoreId(input),
      effectiveFrom: input.effectiveFrom ?? null,
      effectiveTo: input.effectiveTo ?? null,
      actorUserId: input.actorUserId,
    });

    return buildCommandResponse({
      status: "created",
      message: "Role assignment created",
      data: {
        assignment: this.mapAssignment(assignment),
      },
    });
  }

  async listRoleAssignments(input: {
    limit?: number;
    offset?: number;
    userId?: string;
    roleCode?: string;
    scopeType?: "company" | "region" | "store";
    active?: boolean;
  }) {
    const result = await this.authAdminRepository.listRoleAssignments(input);

    return buildListResponse(result.rows.map((item) => this.mapAssignment(item)), {
      total: result.total,
      limit: input.limit,
      offset: input.offset,
    });
  }

  async deactivateRoleAssignment(assignmentId: string, actorUserId: string) {
    const existingAssignment = await this.authAdminRepository.getRoleAssignmentById(assignmentId);

    if (!existingAssignment) {
      throw new NotFoundException(`Role assignment not found: ${assignmentId}`);
    }

    const assignment = await this.authAdminRepository.deactivateRoleAssignment({
      assignmentId,
      actorUserId,
    });

    if (!assignment) {
      throw new ConflictException("Role assignment is already inactive");
    }

    return buildCommandResponse({
      status: "updated",
      message: "Role assignment deactivated",
      data: {
        assignment: this.mapAssignment(assignment),
      },
    });
  }

  async getRoleAssignmentAudit(input: { assignmentId: string; limit?: number; offset?: number }) {
    const rows = await this.authAdminRepository.getRoleAssignmentAudit(input);

    return buildListResponse(
      rows.map((item) => mapAuditEvent(item)),
      {
        total: rows.length,
        limit: input.limit,
        offset: input.offset,
      },
    );
  }

  async createActionStoreAssignment(input: {
    userId: string;
    storeId: string;
    effectiveFrom?: string;
    effectiveTo?: string;
    actorUserId: string;
  }) {
    const store = await this.authAdminRepository.getStoreLookupById(input.storeId);

    if (!store) {
      throw new NotFoundException(`Store not found: ${input.storeId}`);
    }

    const activeAssignmentCount =
      await this.authAdminRepository.countActiveActionStoreAssignments({
        userId: input.userId,
        storeId: input.storeId,
      });

    if (activeAssignmentCount > 0) {
      throw new ConflictException("Active action store assignment already exists");
    }

    const assignment = await this.authAdminRepository.createActionStoreAssignment({
      userId: input.userId,
      storeId: input.storeId,
      effectiveFrom: input.effectiveFrom ?? null,
      effectiveTo: input.effectiveTo ?? null,
      actorUserId: input.actorUserId,
    });

    return buildCommandResponse({
      status: "created",
      message: "Action store assignment created",
      data: {
        assignment: this.mapActionStoreAssignment(assignment),
      },
    });
  }

  async listActionStoreAssignments(input: {
    limit?: number;
    offset?: number;
    userId?: string;
    storeId?: string;
    active?: boolean;
  }) {
    const result = await this.authAdminRepository.listActionStoreAssignments(input);

    return buildListResponse(result.rows.map((item) => this.mapActionStoreAssignment(item)), {
      total: result.total,
      limit: input.limit,
      offset: input.offset,
    });
  }

  async deactivateActionStoreAssignment(assignmentId: string, actorUserId: string) {
    const existingAssignment =
      await this.authAdminRepository.getActionStoreAssignmentById(assignmentId);

    if (!existingAssignment) {
      throw new NotFoundException(`Action store assignment not found: ${assignmentId}`);
    }

    const assignment = await this.authAdminRepository.deactivateActionStoreAssignment({
      assignmentId,
      actorUserId,
    });

    if (!assignment) {
      throw new ConflictException("Action store assignment is already inactive");
    }

    return buildCommandResponse({
      status: "updated",
      message: "Action store assignment deactivated",
      data: {
        assignment: this.mapActionStoreAssignment(assignment),
      },
    });
  }

  async getActionStoreAssignmentAudit(input: {
    assignmentId: string;
    limit?: number;
    offset?: number;
  }) {
    const rows = await this.authAdminRepository.getActionStoreAssignmentAudit(input);

    return buildListResponse(
      rows.map((item) => mapAuditEvent(item)),
      {
        total: rows.length,
        limit: input.limit,
        offset: input.offset,
      },
    );
  }

  async createUserAccount(input: {
    employeeId?: string;
    username: string;
    email: string;
    authProvider: "local" | "oidc" | "sso";
    actorUserId: string;
  }) {
    const user = await this.authAdminRepository.createUserAccount({
      employeeId: input.employeeId ?? null,
      username: input.username,
      email: input.email,
      authProvider: input.authProvider,
      actorUserId: input.actorUserId,
    });

    return buildCommandResponse({
      status: "created",
      message: "User account created",
      data: {
        user: this.mapUser(user),
      },
    });
  }

  async listUserAccounts(input: {
    limit?: number;
    offset?: number;
    authProvider?: "local" | "oidc" | "sso";
    isActive?: boolean;
  }) {
    const result = await this.authAdminRepository.listUserAccounts(input);

    return buildListResponse(result.rows.map((item) => this.mapUser(item)), {
      total: result.total,
      limit: input.limit,
      offset: input.offset,
    });
  }

  async deactivateUserAccount(userId: string, actorUserId: string) {
    const existingUser = await this.authAdminRepository.getUserAccountById(userId);

    if (!existingUser) {
      throw new NotFoundException(`User account not found: ${userId}`);
    }

    const user = await this.authAdminRepository.deactivateUserAccount({
      userId,
      actorUserId,
    });

    if (!user) {
      throw new ConflictException("User account is already inactive");
    }

    return buildCommandResponse({
      status: "updated",
      message: "User account deactivated",
      data: {
        user: this.mapUser(user),
      },
    });
  }

  async reactivateUserAccount(userId: string, actorUserId: string) {
    const existingUser = await this.authAdminRepository.getUserAccountById(userId);

    if (!existingUser) {
      throw new NotFoundException(`User account not found: ${userId}`);
    }

    const user = await this.authAdminRepository.reactivateUserAccount({
      userId,
      actorUserId,
    });

    if (!user) {
      throw new ConflictException("User account is already active");
    }

    return buildCommandResponse({
      status: "updated",
      message: "User account reactivated",
      data: {
        user: this.mapUser(user),
      },
    });
  }

  async getUserAccountAudit(input: { userId: string; limit?: number; offset?: number }) {
    const rows = await this.authAdminRepository.getUserAccountAudit(input);

    return buildListResponse(
      rows.map((item) => mapAuditEvent(item)),
      {
        total: rows.length,
        limit: input.limit,
        offset: input.offset,
      },
    );
  }

  async listRoles() {
    const rows = await this.authAdminRepository.listRoles();
    const grouped = new Map<
      string,
      {
        roleId: string;
        roleCode: string;
        roleName: string;
        scopeType: string;
        description: string | null;
        isSystemRole: boolean;
        permissions: Array<{
          permissionCode: string;
          resourceName: string;
          actionName: string;
        }>;
      }
    >();

    for (const row of rows) {
      if (!grouped.has(row.role_id)) {
        grouped.set(row.role_id, {
          roleId: row.role_id,
          roleCode: row.role_code,
          roleName: row.role_name,
          scopeType: row.role_scope_type,
          description: row.description,
          isSystemRole: row.is_system_role,
          permissions: [],
        });
      }

      if (row.permission_code && row.resource_name && row.action_name) {
        grouped.get(row.role_id)?.permissions.push({
          permissionCode: row.permission_code,
          resourceName: row.resource_name,
          actionName: row.action_name,
        });
      }
    }

    const items = [...grouped.values()];
    return buildListResponse(items, {
      total: items.length,
      limit: 50,
      offset: 0,
    });
  }

  async listPermissions() {
    const rows = await this.authAdminRepository.listPermissions();

    return buildListResponse(
      rows.map((item) => ({
        permissionId: item.permission_id,
        permissionCode: item.permission_code,
        resourceName: item.resource_name,
        actionName: item.action_name,
        description: item.description,
      })),
      {
        total: rows.length,
        limit: 50,
        offset: 0,
      },
    );
  }

  async getAuthLookups() {
    const [users, roles, permissions, stores] = await Promise.all([
      this.authAdminRepository.listActiveUserLookups(),
      this.authAdminRepository.listRoles(),
      this.authAdminRepository.listPermissions(),
      this.authAdminRepository.listActiveStoreLookups(),
    ]);

    const groupedRoles = new Map<
      string,
      { roleId: string; roleCode: string; roleName: string; scopeType: string }
    >();

    for (const row of roles) {
      if (!groupedRoles.has(row.role_id)) {
        groupedRoles.set(row.role_id, {
          roleId: row.role_id,
          roleCode: row.role_code,
          roleName: row.role_name,
          scopeType: row.role_scope_type,
        });
      }
    }

    const scopeTypes = ["company", "region", "store"];
    const authProviders = [...new Set(users.map((item) => item.auth_provider))];
    const userOptions = users.map((item) => ({
        userId: item.user_id,
        username: item.username,
        email: item.email,
      }));
    const roleOptions = [...groupedRoles.values()];
    const permissionOptions = permissions.map((item) => ({
        permissionId: item.permission_id,
        permissionCode: item.permission_code,
        resourceName: item.resource_name,
        actionName: item.action_name,
      }));
    const storeOptions = stores.map((item) => ({
        storeId: item.store_id,
        storeCode: item.store_code,
        storeName: item.store_name,
        companyId: item.company_id,
        regionId: item.region_id,
        regionName: item.region_name,
      }));

    return {
      scopeTypes,
      authProviders,
      users: userOptions,
      roles: roleOptions,
      permissions: permissionOptions,
      stores: storeOptions,
      optionGroups: {
        users: userOptions,
        roles: roleOptions,
        permissions: permissionOptions,
        stores: storeOptions,
        scopeTypes: scopeTypes.map((scopeType) => ({ value: scopeType, label: scopeType })),
        authProviders: authProviders.map((authProvider) => ({
          value: authProvider,
          label: authProvider,
        })),
      },
      meta: {
        totalUsers: userOptions.length,
        totalRoles: roleOptions.length,
        totalPermissions: permissionOptions.length,
        totalStores: storeOptions.length,
      },
    };
  }

  async grantRolePermission(input: {
    roleId: string;
    permissionCode: string;
    actorUserId: string;
  }) {
    const resolvedRole = await this.authAdminRepository.getRoleById(input.roleId);
    const permission = await this.authAdminRepository.getPermissionByCode(input.permissionCode);

    if (!resolvedRole) {
      throw new NotFoundException(`Role not found: ${input.roleId}`);
    }

    if (!permission) {
      throw new NotFoundException(`Permission not found: ${input.permissionCode}`);
    }

    const existing = await this.authAdminRepository.getRolePermission({
      roleId: resolvedRole.role_id,
      permissionId: permission.permission_id,
    });

    if (existing) {
      throw new ConflictException("Role permission already granted");
    }

    const rolePermission = await this.authAdminRepository.grantRolePermission({
      roleId: resolvedRole.role_id,
      permissionId: permission.permission_id,
      actorUserId: input.actorUserId,
    });

    return buildCommandResponse({
      status: "created",
      message: "Role permission granted",
      data: {
        rolePermission: {
          roleId: rolePermission.role_id,
          roleCode: rolePermission.role_code,
          permissionId: rolePermission.permission_id,
          permissionCode: rolePermission.permission_code,
          grantedAt: rolePermission.granted_at ?? null,
        },
      },
    });
  }

  async revokeRolePermission(input: {
    roleId: string;
    permissionCode: string;
    actorUserId: string;
  }) {
    const rolePermission = await this.authAdminRepository.revokeRolePermission(input);

    if (!rolePermission) {
      throw new NotFoundException(
        `Role permission not found: ${input.roleId} -> ${input.permissionCode}`,
      );
    }

    return buildCommandResponse({
      status: "updated",
      message: "Role permission revoked",
      data: {
        rolePermission: {
          roleId: rolePermission.role_id,
          roleCode: rolePermission.role_code,
          permissionId: rolePermission.permission_id,
          permissionCode: rolePermission.permission_code,
        },
      },
    });
  }

  private getCompanyId(input: {
    scopeType: "company" | "region" | "store";
    companyId?: string;
  }) {
    return input.companyId ?? null;
  }

  private getRegionId(input: {
    scopeType: "company" | "region" | "store";
    regionId?: string;
  }) {
    return input.scopeType === "region" || input.scopeType === "store" ? input.regionId ?? null : null;
  }

  private getStoreId(input: {
    scopeType: "company" | "region" | "store";
    storeId?: string;
  }) {
    return input.scopeType === "store" ? input.storeId ?? null : null;
  }

  private mapAssignment(item: {
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
  }) {
    return {
      assignmentId: item.user_role_assignment_id,
      userId: item.user_id,
      ...(item.username ? { username: item.username } : {}),
      ...(item.email ? { email: item.email } : {}),
      roleCode: item.role_code,
      ...(item.role_name ? { roleName: item.role_name } : {}),
      scopeType: item.scope_type,
      companyId: item.company_id,
      regionId: item.region_id,
      storeId: item.store_id,
      effectiveFrom: item.start_at,
      effectiveTo: item.end_at,
      createdAt: item.created_at,
      active: item.end_at === null,
    };
  }

  private mapActionStoreAssignment(item: {
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
  }) {
    return {
      assignmentId: item.user_action_store_assignment_id,
      userId: item.user_id,
      ...(item.username ? { username: item.username } : {}),
      ...(item.email ? { email: item.email } : {}),
      storeId: item.store_id,
      storeCode: item.store_code,
      storeName: item.store_name,
      companyId: item.company_id,
      regionId: item.region_id,
      regionName: item.region_name,
      effectiveFrom: item.start_at,
      effectiveTo: item.end_at,
      createdAt: item.created_at,
      active: item.end_at === null,
    };
  }

  private mapUser(item: {
    user_id: string;
    employee_id: string | null;
    username: string;
    email: string;
    auth_provider: string;
    is_active: boolean;
    last_login_at: string | null;
    created_at: string;
  }) {
    return {
      userId: item.user_id,
      employeeId: item.employee_id,
      username: item.username,
      email: item.email,
      authProvider: item.auth_provider,
      isActive: item.is_active,
      lastLoginAt: item.last_login_at,
      createdAt: item.created_at,
    };
  }
}
