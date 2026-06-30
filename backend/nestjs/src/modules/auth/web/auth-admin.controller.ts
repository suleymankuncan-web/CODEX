import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { RequireRoles } from "../decorators/roles.decorator";
import { RequireScope } from "../decorators/scope.decorator";
import { AuthAdminService } from "../auth-admin.service";
import { AuthAdminUserAccountService } from "../auth-admin-user-account.service";
import { CreateActionStoreAssignmentDto } from "./dto/create-action-store-assignment.dto";
import { CreatePilotUserBindingDto } from "./dto/create-pilot-user-binding.dto";
import { CreateRoleAssignmentDto } from "./dto/create-role-assignment.dto";
import { CreateUserAccountDto } from "./dto/create-user-account.dto";
import { DeactivateUserAccountDto } from "./dto/deactivate-user-account.dto";
import { GrantRolePermissionDto } from "./dto/grant-role-permission.dto";
import { ListActionStoreAssignmentsQueryDto } from "./dto/list-action-store-assignments.query";
import { ListRoleAssignmentAuditQueryDto } from "./dto/list-role-assignment-audit.query";
import { ListRoleAssignmentsQueryDto } from "./dto/list-role-assignments.query";
import { ListUserAccountsQueryDto } from "./dto/list-user-accounts.query";
import { SearchAuthLookupQueryDto } from "./dto/search-auth-lookup.query";
import { UpdateUserAccountDto } from "./dto/update-user-account.dto";

@Controller("auth")
@RequireRoles("SUPER_ADMIN")
export class AuthAdminController {
  constructor(
    private readonly authAdminService: AuthAdminService,
    private readonly authAdminUserAccountService: AuthAdminUserAccountService,
  ) {}

  @Post("role-assignments")
  async createRoleAssignment(
    @Req()
    request: {
      user: {
        userId: string;
      };
    },
    @Body() body: CreateRoleAssignmentDto,
  ) {
    return this.authAdminService.createRoleAssignment({
      ...body,
      actorUserId: request.user.userId,
    });
  }

  @Get("role-assignments")
  async listRoleAssignments(@Query() query: ListRoleAssignmentsQueryDto) {
    return this.authAdminService.listRoleAssignments({
      limit: query.limit,
      offset: query.offset,
      userId: query.userId,
      roleCode: query.roleCode,
      scopeType: query.scopeType,
      active: query.active,
    });
  }

  @Get("role-assignments/:assignmentId/audit")
  async getRoleAssignmentAudit(
    @Param("assignmentId") assignmentId: string,
    @Query() query: ListRoleAssignmentAuditQueryDto,
  ) {
    return this.authAdminService.getRoleAssignmentAudit({
      assignmentId,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Patch("role-assignments/:assignmentId/deactivate")
  async deactivateRoleAssignment(
    @Param("assignmentId") assignmentId: string,
    @Req()
    request: {
      user: {
        userId: string;
      };
    },
  ) {
    return this.authAdminService.deactivateRoleAssignment(assignmentId, request.user.userId);
  }

  @Post("action-store-assignments")
  async createActionStoreAssignment(
    @Req()
    request: {
      user: {
        userId: string;
      };
    },
    @Body() body: CreateActionStoreAssignmentDto,
  ) {
    return this.authAdminService.createActionStoreAssignment({
      ...body,
      actorUserId: request.user.userId,
    });
  }

  @Get("action-store-assignments")
  async listActionStoreAssignments(@Query() query: ListActionStoreAssignmentsQueryDto) {
    return this.authAdminService.listActionStoreAssignments({
      limit: query.limit,
      offset: query.offset,
      userId: query.userId,
      storeId: query.storeId,
      active: query.active,
    });
  }

  @Get("action-store-assignments/:assignmentId/audit")
  async getActionStoreAssignmentAudit(
    @Param("assignmentId") assignmentId: string,
    @Query() query: ListRoleAssignmentAuditQueryDto,
  ) {
    return this.authAdminService.getActionStoreAssignmentAudit({
      assignmentId,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Patch("action-store-assignments/:assignmentId/deactivate")
  async deactivateActionStoreAssignment(
    @Param("assignmentId") assignmentId: string,
    @Req()
    request: {
      user: {
        userId: string;
      };
    },
  ) {
    return this.authAdminService.deactivateActionStoreAssignment(
      assignmentId,
      request.user.userId,
    );
  }

  @Post("users")
  async createUserAccount(
    @Req()
    request: {
      user: {
        userId: string;
      };
    },
    @Body() body: CreateUserAccountDto,
  ) {
    return this.authAdminService.createUserAccount({
      ...body,
      actorUserId: request.user.userId,
    });
  }

  @Post("pilot-user-bindings")
  @RequireScope("company")
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN")
  async createPilotUserBinding(
    @Req()
    request: {
      user: {
        userId: string;
        roleCodes: string[];
        scope: {
          companyIds: string[];
        };
      };
    },
    @Body() body: CreatePilotUserBindingDto,
  ) {
    return this.authAdminService.createPilotUserBinding({
      ...body,
      actorRoleCodes: request.user.roleCodes,
      actorScope: {
        companyIds: request.user.scope.companyIds,
      },
      actorUserId: request.user.userId,
    });
  }

  @Get("users")
  async listUserAccounts(@Query() query: ListUserAccountsQueryDto) {
    return this.authAdminService.listUserAccounts({
      limit: query.limit,
      offset: query.offset,
      authProvider: query.authProvider,
      q: query.q,
      isActive: query.isActive,
    });
  }

  @Get("users/:userId/audit")
  async getUserAccountAudit(
    @Param("userId") userId: string,
    @Query() query: ListRoleAssignmentAuditQueryDto,
  ) {
    return this.authAdminService.getUserAccountAudit({
      userId,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Patch("users/:userId")
  async updateUserAccount(
    @Param("userId") userId: string,
    @Req()
    request: {
      user: {
        userId: string;
      };
    },
    @Body() body: UpdateUserAccountDto,
  ) {
    return this.authAdminUserAccountService.updateUserAccount({
      userId,
      employeeId: body.employeeId,
      username: body.username,
      email: body.email,
      actorUserId: request.user.userId,
    });
  }

  @Patch("users/:userId/deactivate")
  async deactivateUserAccount(
    @Param("userId") userId: string,
    @Req()
    request: {
      user: {
        userId: string;
      };
    },
    @Body() body?: DeactivateUserAccountDto,
  ) {
    return this.authAdminService.deactivateUserAccount(userId, request.user.userId, body?.reason);
  }

  @Patch("users/:userId/reactivate")
  async reactivateUserAccount(
    @Param("userId") userId: string,
    @Req()
    request: {
      user: {
        userId: string;
      };
    },
  ) {
    return this.authAdminService.reactivateUserAccount(userId, request.user.userId);
  }

  @Get("roles")
  async listRoles() {
    return this.authAdminService.listRoles();
  }

  @Get("permissions")
  async listPermissions() {
    return this.authAdminService.listPermissions();
  }

  @Get("lookups")
  async getAuthLookups() {
    return this.authAdminService.getAuthLookups();
  }

  @Get("lookups/users/search")
  async searchAuthUsers(@Query() query: SearchAuthLookupQueryDto) {
    return this.authAdminService.searchAuthUsers({
      query: query.q,
      limit: query.limit,
    });
  }

  @Get("lookups/stores/search")
  async searchAuthStores(@Query() query: SearchAuthLookupQueryDto) {
    return this.authAdminService.searchAuthStores({
      query: query.q,
      limit: query.limit,
    });
  }

  @Post("roles/:roleId/permissions")
  async grantRolePermission(
    @Param("roleId") roleId: string,
    @Req()
    request: {
      user: {
        userId: string;
      };
    },
    @Body() body: GrantRolePermissionDto,
  ) {
    return this.authAdminService.grantRolePermission({
      roleId,
      permissionCode: body.permissionCode,
      actorUserId: request.user.userId,
    });
  }

  @Delete("roles/:roleId/permissions/:permissionCode")
  async revokeRolePermission(
    @Param("roleId") roleId: string,
    @Param("permissionCode") permissionCode: string,
    @Req()
    request: {
      user: {
        userId: string;
      };
    },
  ) {
    return this.authAdminService.revokeRolePermission({
      roleId,
      permissionCode,
      actorUserId: request.user.userId,
    });
  }
}
