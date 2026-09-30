import type { AuthSessionSummary } from '@/features/auth/api'

export const companyStagePermissions = {
  sales_director: ['REPORT_VIEWER', 'INCENTIVE_SALES_DIRECTOR_APPROVAL'],
  hr: ['HR_ADMIN', 'INCENTIVE_HR_APPROVAL'],
  general_manager: ['REPORT_VIEWER', 'INCENTIVE_GENERAL_MANAGER_APPROVAL'],
  payroll: ['HR_ADMIN', 'INCENTIVE_PAYROLL_DELIVERY'],
} as const
export type CompanyStage = keyof typeof companyStagePermissions

export function companyStageCompanies(auth: AuthSessionSummary | null | undefined, stage: CompanyStage) {
  const [role, permission] = companyStagePermissions[stage]
  if (!auth?.user.roleCodes.includes(role)) return []
  const roleCompanies = auth.user.roleScopes?.[role]?.companyIds ?? []
  const permissionCompanies = auth.user.permissionScopes?.[permission]?.companyIds ?? []
  return roleCompanies.filter(id => permissionCompanies.includes(id))
}

export function canReadCompanyCycle(auth: AuthSessionSummary | null | undefined) {
  return Object.keys(companyStagePermissions).some(stage => companyStageCompanies(auth, stage as CompanyStage).length > 0)
}
