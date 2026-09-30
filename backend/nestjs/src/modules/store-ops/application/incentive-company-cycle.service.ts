import { ForbiddenException, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/auth-context.service";
import { IncentiveCompanyCycleRepository, type CompanyStage } from "../infrastructure/incentive-company-cycle.repository";

export const incentiveStagePermissions = {
  sales_director: ["REPORT_VIEWER", "INCENTIVE_SALES_DIRECTOR_APPROVAL"],
  hr: ["HR_ADMIN", "INCENTIVE_HR_APPROVAL"],
  general_manager: ["REPORT_VIEWER", "INCENTIVE_GENERAL_MANAGER_APPROVAL"],
  payroll: ["HR_ADMIN", "INCENTIVE_PAYROLL_DELIVERY"],
} as const;

export function incentiveStageCompanies(actor: AuthenticatedUser, stage: keyof typeof incentiveStagePermissions) {
  const [role, permission] = incentiveStagePermissions[stage];
  if (!actor.roleCodes.includes(role)) return [];
  const personaCompanies = actor.roleScopes?.[role]?.companyIds ?? [];
  const grants = actor.permissionScopes?.[permission]?.companyIds ?? [];
  return [...new Set(personaCompanies.filter(id => grants.includes(id)))].sort();
}

@Injectable()
export class IncentiveCompanyCycleService {
  constructor(private readonly repository: IncentiveCompanyCycleRepository) {}

  async list(actor: AuthenticatedUser, period: string) {
    const companies = [...new Set(Object.keys(incentiveStagePermissions).flatMap(stage => incentiveStageCompanies(actor, stage as keyof typeof incentiveStagePermissions)))].sort();
    if (!companies.length) throw new ForbiddenException("Company incentive capability is required");
    return { items: await Promise.all(companies.map(company => this.repository.read(company, period, actor.userId))) };
  }

  seal(actor: AuthenticatedUser, input: { companyId: string; period: string; expectedRevision: number }) {
    this.requireCompany(actor, input.companyId, "sales_director");
    return this.repository.seal({ ...input, actorId: actor.userId });
  }

  decide(actor: AuthenticatedUser, input: { companyId: string; period: string; cycleId: string; revision: number; stage: CompanyStage; sealHash: string; decision: "approve" | "return"; reasonNote?: string }) {
    this.requireCompany(actor, input.companyId, input.stage);
    return this.repository.decide({ ...input, actorId: actor.userId });
  }

  private requireCompany(actor: AuthenticatedUser, companyId: string, stage: CompanyStage) {
    if (!incentiveStageCompanies(actor, stage).includes(companyId)) throw new ForbiddenException("Company stage is outside the matching persona capability scope");
  }
}
