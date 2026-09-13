import { ForbiddenException } from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/auth-context.service";

export function incentiveFinalApprovalCompanyIds(actor: AuthenticatedUser): string[] {
  if (!actor.roleCodes.includes("REPORT_VIEWER")) throw new ForbiddenException("Prim approval permission is required");
  const viewerCompanies = actor.roleScopes?.REPORT_VIEWER?.companyIds ?? [];
  const permissionCompanies = actor.permissionScopes?.INCENTIVE_FINAL_APPROVAL?.companyIds ?? [];
  const companyIds = [...new Set(viewerCompanies.filter((id) => permissionCompanies.includes(id)))];
  if (!companyIds.length) throw new ForbiddenException("Prim approval permission is required");
  return companyIds;
}
