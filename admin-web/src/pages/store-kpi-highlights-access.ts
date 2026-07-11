import type { AuthSessionSummary } from '../features/auth/api'

export function hasReportingAccess(authSummary: AuthSessionSummary | null) {
  const roles = authSummary?.user.roleCodes ?? []
  return (
    roles.includes('SUPER_ADMIN') ||
    roles.includes('REPORT_VIEWER') ||
    roles.includes('AUDITOR') ||
    roles.includes('STORE_MANAGER') ||
    roles.includes('REGION_MANAGER')
  )
}

export function hasStoreShellIntent(authSummary: AuthSessionSummary | null) {
  const roles = authSummary?.user.roleCodes ?? []
  return (
    roles.includes('STORE_MANAGER') ||
    roles.includes('REGION_MANAGER') ||
    Boolean(authSummary?.user.scope.storeIds.length)
  )
}

export function hasStoreDetailDefault(authSummary: AuthSessionSummary | null) {
  return authSummary?.user.roleCodes.some((role) =>
    role === 'SUPER_ADMIN' || role === 'REPORT_VIEWER' || role === 'AUDITOR' || role === 'STORE_MANAGER',
  ) ?? false
}

export function hasGlobalStoreDetailDefault(authSummary: AuthSessionSummary | null) {
  return authSummary?.user.roleCodes.some((role) =>
    role === 'SUPER_ADMIN' || role === 'REPORT_VIEWER' || role === 'AUDITOR',
  ) ?? false
}

export function getQueryValue(searchParams: URLSearchParams, key: string) {
  return searchParams.get(key)?.trim() || ''
}
