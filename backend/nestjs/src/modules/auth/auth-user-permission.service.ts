import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { buildCommandResponse, buildListResponse } from "../../shared/http/response-builders";
import { AuthAdminLookupRepository } from "./auth-admin-lookup.repository";
import { AuthRoleScopePolicyService } from "./auth-role-scope-policy.service";
import {
  UserPermissionAssignmentRepository,
  type UserPermissionAssignmentRow,
} from "./user-permission-assignment.repository";

@Injectable()
export class AuthUserPermissionService {
  constructor(
    private readonly lookupRepository: AuthAdminLookupRepository,
    private readonly roleScopePolicy: AuthRoleScopePolicyService,
    private readonly repository: UserPermissionAssignmentRepository,
  ) {}

  async list(input: { userId?: string; roleAssignmentId?: string; active?: boolean; limit?: number; offset?: number }) {
    const result = await this.repository.list(input);
    return buildListResponse(result.rows.map(mapAssignment), {
      total: result.total, limit: result.limit, offset: result.offset,
    });
  }

  async grant(input: {
    roleAssignmentId: string; permissionCode: string;
    scopeType: "company" | "region" | "store"; companyId?: string;
    regionId?: string; storeId?: string; startsAt?: string; endsAt?: string;
    reason: string; actorUserId: string;
  }) {
    const context = await this.repository.getGrantContext(input.roleAssignmentId);
    if (!context) throw new NotFoundException("Active role assignment not found");
    if (context.user_id === input.actorUserId) throw new ForbiddenException("Users cannot change their own capability grants");
    if (context.role_code === "SUPER_ADMIN" || await this.repository.hasOverlappingSuperAssignment({
      userId: context.user_id, startsAt: input.startsAt ?? null, endsAt: input.endsAt ?? context.end_at,
    })) throw new ForbiddenException("Super Admin permissions are fixed and cannot be customized");

    this.roleScopePolicy.validateAssignmentScope(input);
    await this.assertScopeHierarchy(input);
    assertScopeWithinRoleAssignment(context, input);
    const permission = await this.repository.getPermissionByCode(input.permissionCode);
    if (!permission) throw new NotFoundException(`Permission not found: ${input.permissionCode}`);
    if (permission.permission_code === "INCENTIVE_FINAL_APPROVAL") throw new ForbiddenException("Legacy final approval permission cannot be granted directly");
    if (await this.repository.roleHasPermission(context.role_id, permission.permission_id)) throw new ConflictException("Permission is already included in the role defaults");
    assertApprovalPermissionRole(context.role_code, permission.permission_code, input.scopeType);

    if (["INCENTIVE_SALES_DIRECTOR_APPROVAL", "INCENTIVE_GENERAL_MANAGER_APPROVAL"].includes(permission.permission_code)) {
      const conflictingCode = permission.permission_code === "INCENTIVE_SALES_DIRECTOR_APPROVAL"
        ? "INCENTIVE_GENERAL_MANAGER_APPROVAL" : "INCENTIVE_SALES_DIRECTOR_APPROVAL";
      if (await this.repository.hasConflictingApprovalStage({
        userId: context.user_id, companyId: input.companyId!, permissionCodes: [conflictingCode],
        startsAt: input.startsAt ?? null, endsAt: input.endsAt ?? context.end_at,
      })) throw new ConflictException("Sales Director and General Manager approval cannot belong to the same user");
    }

    try {
      const assignment = await this.repository.grant({
        roleAssignmentId: context.user_role_assignment_id, userId: context.user_id,
        permissionId: permission.permission_id, scopeType: input.scopeType, companyId: input.companyId!,
        regionId: getRegionId(input), storeId: getStoreId(input), startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? context.end_at, reason: input.reason.trim(), actorUserId: input.actorUserId,
      });
      return buildCommandResponse({ status: "created", message: "User capability granted", data: { assignment: mapAssignment(assignment) } });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "23P01") throw new ConflictException("Capability validity overlaps an existing grant");
      if (code === "23514") throw new ConflictException("Capability grant violates role, scope, or separation rules");
      throw error;
    }
  }

  async revoke(input: { assignmentId: string; reason: string; actorUserId: string }) {
    const existing = await this.repository.getById(input.assignmentId);
    if (!existing) throw new NotFoundException("User capability assignment not found");
    if (existing.user_id === input.actorUserId) throw new ForbiddenException("Users cannot change their own capability grants");
    if (existing.role_code === "SUPER_ADMIN") throw new ForbiddenException("Super Admin permissions are fixed and cannot be customized");
    const assignment = await this.repository.revoke({ ...input, reason: input.reason.trim() });
    if (!assignment) throw new ConflictException("User capability assignment is already inactive");
    return buildCommandResponse({ status: "updated", message: "User capability revoked", data: { assignment: mapAssignment(assignment) } });
  }

  private async assertScopeHierarchy(input: { scopeType: "company" | "region" | "store"; companyId?: string; regionId?: string; storeId?: string }) {
    const company = await this.lookupRepository.getCompanyLookupById(input.companyId!);
    if (!company) throw new NotFoundException(`Company not found: ${input.companyId}`);
    if (input.regionId) {
      const region = await this.lookupRepository.getRegionLookupById(input.regionId);
      if (!region || region.company_id !== input.companyId) throw new ConflictException("Region does not belong to the selected company");
    }
    if (input.storeId) {
      const store = await this.lookupRepository.getStoreLookupById(input.storeId);
      if (!store || store.company_id !== input.companyId || store.region_id !== input.regionId) throw new ConflictException("Store does not belong to the selected company and region");
    }
  }
}

function assertScopeWithinRoleAssignment(
  assignment: { scope_type: string; company_id: string | null; region_id: string | null; store_id: string | null },
  input: { scopeType: "company" | "region" | "store"; companyId?: string; regionId?: string; storeId?: string },
) {
  const rank = { company: 0, region: 1, store: 2 } as const;
  if (rank[input.scopeType] < rank[assignment.scope_type as keyof typeof rank]) throw new ForbiddenException("Capability scope cannot be broader than the role assignment");
  if (assignment.company_id !== input.companyId || (assignment.region_id && assignment.region_id !== input.regionId) || (assignment.store_id && assignment.store_id !== input.storeId)) throw new ForbiddenException("Capability scope must stay within the role assignment hierarchy");
}

function assertApprovalPermissionRole(roleCode: string, permissionCode: string, scopeType: string) {
  if (["INCENTIVE_SALES_DIRECTOR_APPROVAL", "INCENTIVE_GENERAL_MANAGER_APPROVAL"].includes(permissionCode) && (roleCode !== "REPORT_VIEWER" || scopeType !== "company")) throw new ForbiddenException("Executive incentive approval requires a company-scoped Report Viewer assignment");
  if (["INCENTIVE_HR_APPROVAL", "INCENTIVE_PAYROLL_DELIVERY"].includes(permissionCode) && (roleCode !== "HR_ADMIN" || scopeType !== "company")) throw new ForbiddenException("HR incentive permissions require a company-scoped HR Admin assignment");
}

function getRegionId(input: { scopeType: string; regionId?: string }) { return input.scopeType === "region" || input.scopeType === "store" ? input.regionId ?? null : null; }
function getStoreId(input: { scopeType: string; storeId?: string }) { return input.scopeType === "store" ? input.storeId ?? null : null; }

function mapAssignment(row: UserPermissionAssignmentRow) {
  return {
    assignmentId: row.user_permission_assignment_id, roleAssignmentId: row.user_role_assignment_id,
    userId: row.user_id, roleCode: row.role_code, permissionCode: row.permission_code,
    resourceName: row.resource_name, actionName: row.action_name, scopeType: row.scope_type,
    companyId: row.company_id, regionId: row.region_id, storeId: row.store_id,
    startsAt: row.starts_at, endsAt: row.ends_at, grantReason: row.grant_reason,
    createdAt: row.created_at, revokedAt: row.revoked_at, revokeReason: row.revoke_reason,
  };
}
