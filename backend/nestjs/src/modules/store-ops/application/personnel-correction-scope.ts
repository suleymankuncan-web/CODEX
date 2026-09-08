import { ForbiddenException } from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/auth-context.service";

export function correctionReviewCompanies(actor: AuthenticatedUser): string[] {
  const roles = actor.roleCodes.filter((role) => ["SUPER_ADMIN", "HR_ADMIN"].includes(role));
  return [...new Set(roles.flatMap((role) => actor.roleScopes
    ? actor.roleScopes[role]?.companyIds ?? [] : actor.scope.companyIds))];
}

export function correctionStoreScope(actor: AuthenticatedUser): string[] {
  return actor.roleCodes.includes("STORE_MANAGER") ? actor.actionScope?.assignedStoreIds ?? [] : [];
}

export function assertCorrectionStore(actor: AuthenticatedUser, storeId: string) {
  if (!correctionStoreScope(actor).includes(storeId)) throw new ForbiddenException("Store action scope required");
}
