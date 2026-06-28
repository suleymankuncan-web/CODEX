const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const providerIdPattern = /^(user|org|session|sess)_[a-z0-9]+$/i

export function isUuidLike(value: string | null | undefined) {
  return Boolean(value?.trim().match(uuidPattern))
}

export function isSystemIdentifier(value: string | null | undefined) {
  const label = value?.trim()
  return Boolean(label && (uuidPattern.test(label) || providerIdPattern.test(label)))
}

export function normalizeDisplayLabel(value: string | null | undefined, fallback: string) {
  const label = value?.trim()
  if (!label || isSystemIdentifier(label)) return fallback
  return label
}

export function resolveUserDisplayLabel(
  user:
    | {
        displayName?: string | null
        username?: string | null
        email?: string | null
        userId?: string | null
      }
    | null
    | undefined,
  fallback: string,
) {
  return normalizeDisplayLabel(
    user?.displayName ?? user?.username ?? user?.email ?? user?.userId,
    fallback,
  )
}
