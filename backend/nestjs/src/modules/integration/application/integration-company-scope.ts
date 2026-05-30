import { ForbiddenException } from "@nestjs/common";

export function normalizeCompanyScope(companyIds: string[]) {
  return [...new Set(companyIds.filter((companyId) => companyId.trim().length > 0))].sort();
}

export function assertCompanyScope(companyIds: string[]) {
  if (companyIds.length === 0) {
    throw new ForbiddenException("Integration operation requires company scope");
  }
}
