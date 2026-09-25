import { Injectable, NotFoundException } from "@nestjs/common";
import { buildCommandResponse } from "../../shared/http/response-builders";
import { semanticValidation } from "../../shared/http/api-errors";
import { AuthAdminRepository } from "./auth-admin.repository";
import { AuthAdminUserAccountReadRepository } from "./auth-admin-user-account-read.repository";

@Injectable()
export class AuthAdminUserAccountService {
  constructor(
    private readonly authAdminRepository: AuthAdminRepository,
    private readonly authAdminUserAccountReadRepository: AuthAdminUserAccountReadRepository,
  ) {}

  async updateUserAccount(input: {
    userId: string;
    employeeId?: string | null;
    username?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    actorUserId: string;
  }) {
    const existingUser = await this.authAdminUserAccountReadRepository.getUserAccountById(
      input.userId,
    );

    if (!existingUser) {
      throw new NotFoundException(`User account not found: ${input.userId}`);
    }

    const hasEmployeeId = input.employeeId !== undefined;
    const hasUsername = input.username !== undefined;
    const hasFirstName = input.firstName !== undefined;
    const hasLastName = input.lastName !== undefined;
    const hasEmail = input.email !== undefined;

    if (!hasEmployeeId && !hasUsername && !hasFirstName && !hasLastName && !hasEmail) {
      throw semanticValidation("At least one user account field must be provided");
    }
    if (hasFirstName !== hasLastName) {
      throw semanticValidation("First and last name must be updated together");
    }
    if (hasFirstName && (!input.firstName?.trim() || !input.lastName?.trim())) {
      throw semanticValidation("First and last name cannot be empty");
    }
    const linkedEmployeeId = hasEmployeeId ? input.employeeId : existingUser.employee_id;
    if (linkedEmployeeId && hasFirstName) {
      throw semanticValidation("Linked personnel names must be edited in the personnel record");
    }
    if (existingUser.auth_provider === "oidc" && !linkedEmployeeId && hasEmployeeId && !hasFirstName
      && (!existingUser.first_name || !existingUser.last_name)) {
      throw semanticValidation("First and last name are required before unlinking personnel");
    }

    const user = await this.authAdminRepository.updateUserAccount({
      userId: input.userId,
      ...(hasEmployeeId ? { employeeId: input.employeeId ?? null } : {}),
      ...(hasUsername ? { username: input.username?.trim() } : {}),
      ...(hasFirstName ? { firstName: input.firstName?.trim(), lastName: input.lastName?.trim() } : {}),
      ...(hasEmail ? { email: input.email?.trim() } : {}),
      actorUserId: input.actorUserId,
    });

    if (!user) {
      throw new NotFoundException(`User account not found: ${input.userId}`);
    }

    return buildCommandResponse({
      status: "updated",
      message: "User account updated",
      data: {
        user: mapUser(user),
      },
    });
  }
}

function mapUser(item: {
  user_id: string;
  employee_id: string | null;
  username: string;
  first_name?: string | null;
  last_name?: string | null;
  email: string;
  auth_provider: string;
  provider_subject?: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  deactivated_at?: string | null;
  deactivation_reason?: string | null;
  deactivated_by_user_id?: string | null;
  employee_status?: string | null;
}) {
  return {
    userId: item.user_id,
    employeeId: item.employee_id,
    username: item.username,
    firstName: item.first_name ?? null,
    lastName: item.last_name ?? null,
    email: item.email,
    authProvider: item.auth_provider,
    providerSubject: item.provider_subject ?? null,
    isActive: item.is_active,
    lastLoginAt: item.last_login_at,
    createdAt: item.created_at,
    ...("deactivated_at" in item ? { deactivatedAt: item.deactivated_at ?? null } : {}),
    ...("deactivation_reason" in item
      ? { deactivationReason: item.deactivation_reason ?? null }
      : {}),
    ...("deactivated_by_user_id" in item
      ? { deactivatedByUserId: item.deactivated_by_user_id ?? null }
      : {}),
    ...("employee_status" in item ? { employeeStatus: item.employee_status ?? null } : {}),
  };
}
