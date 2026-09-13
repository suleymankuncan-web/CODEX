import type { AuthSessionSummary } from '@/features/auth/api'

export function canApproveIncentives(auth?: AuthSessionSummary | null) {
  return Boolean(auth?.user.roleCodes.includes('REPORT_VIEWER') &&
    auth.user.permissionScopes?.INCENTIVE_FINAL_APPROVAL?.companyIds.length)
}
