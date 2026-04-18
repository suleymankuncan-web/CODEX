import { Injectable } from "@nestjs/common";
import { semanticValidation } from "../../shared/http/api-errors";

type ScopeType = "company" | "region" | "store";

@Injectable()
export class AuthRoleScopePolicyService {
  validateAssignmentScope(input: {
    scopeType: ScopeType;
    companyId?: string;
    regionId?: string;
    storeId?: string;
  }) {
    if (input.scopeType === "company") {
      if (!input.companyId) {
        throw semanticValidation("companyId is required for company-scoped assignments");
      }

      if (input.regionId || input.storeId) {
        throw semanticValidation(
          "regionId and storeId must not be provided for company-scoped assignments",
        );
      }

      return;
    }

    if (input.scopeType === "region") {
      if (!input.companyId) {
        throw semanticValidation("companyId is required for region-scoped assignments");
      }

      if (!input.regionId) {
        throw semanticValidation("regionId is required for region-scoped assignments");
      }

      if (input.storeId) {
        throw semanticValidation("storeId must not be provided for region-scoped assignments");
      }

      return;
    }

    if (!input.companyId) {
      throw semanticValidation("companyId is required for store-scoped assignments");
    }

    if (!input.regionId) {
      throw semanticValidation("regionId is required for store-scoped assignments");
    }

    if (!input.storeId) {
      throw semanticValidation("storeId is required for store-scoped assignments");
    }
  }

  validateRoleScope(roleScopeType: string, assignmentScopeType: ScopeType) {
    if (roleScopeType !== assignmentScopeType) {
      throw semanticValidation("Role scope type does not match assignment scope");
    }
  }
}
