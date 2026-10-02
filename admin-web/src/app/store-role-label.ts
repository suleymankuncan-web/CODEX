import type { AuthSessionSummary } from '../features/auth/api'
import type { TranslateFunction, TranslationKey } from '../features/localization/dictionary'

const roleLabelKeys: Record<string, TranslationKey> = {
  SUPER_ADMIN: 'storeHome.role.SUPER_ADMIN',
  REPORT_VIEWER: 'storeHome.role.REPORT_VIEWER',
  REGION_MANAGER: 'storeHome.role.REGION_MANAGER',
  HR_ADMIN: 'storeHome.role.HR_ADMIN',
  STORE_MANAGER: 'storeHome.role.STORE_MANAGER',
  STORE_PERSONNEL: 'storeHome.role.STORE_PERSONNEL',
  VISUAL_MERCHANDISER: 'storeHome.role.VISUAL_MERCHANDISER',
}

export function getStoreRoleLabels(authSummary: AuthSessionSummary | null, t: TranslateFunction) {
  const roles = new Set(authSummary?.user.roleCodes ?? [])
  const labels = Object.entries(roleLabelKeys)
    .filter(([role]) => roles.has(role))
    .map(([, key]) => t(key))

  return labels.length ? labels : [t('adminShell.userLabel')]
}

export function getStoreRoleLabel(authSummary: AuthSessionSummary | null, t: TranslateFunction) {
  return getStoreRoleLabels(authSummary, t)[0] ?? t('adminShell.userLabel')
}
