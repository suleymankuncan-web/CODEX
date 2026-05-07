import type { TranslateFunction } from '../features/localization/dictionary'

export function resolveAuditBackLink(pathname: string, t: TranslateFunction) {
  if (pathname.startsWith('/admin/audit')) {
    return {
      to: '/admin/audit',
      label: t('authAuditDetails.backToAuditCenter'),
    }
  }

  return {
    to: '/admin/auth',
    label: t('authAuditDetails.backToAuthOverview'),
  }
}
