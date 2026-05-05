export function resolveAuditBackLink(pathname: string) {
  if (pathname.startsWith('/admin/audit')) {
    return {
      to: '/admin/audit',
      label: 'Back to audit center',
    }
  }

  return {
    to: '/admin/auth',
    label: 'Back to auth overview',
  }
}
