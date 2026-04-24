const hiddenTechnicalRoles = new Set([
  'offline_access',
  'uma_authorization',
])

export function getDisplayRoleCodes(roleCodes: readonly string[] | null | undefined) {
  return (roleCodes ?? []).filter(
    (roleCode) => !hiddenTechnicalRoles.has(roleCode) && !roleCode.startsWith('default-roles-'),
  )
}

export function formatDisplayRoles(
  roleCodes: readonly string[] | null | undefined,
  fallback = 'none',
) {
  const displayRoles = getDisplayRoleCodes(roleCodes)
  return displayRoles.length > 0 ? displayRoles.join(', ') : fallback
}
