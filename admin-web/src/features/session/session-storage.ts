export type SessionMode = 'mock' | 'bearer'

export type SessionState = {
  mode: SessionMode
  mockUserId: string
  mockRoleCodes: string
  mockCompanyIds: string
  mockStoreIds: string
  mockReadStoreIds: string
  mockAssignedStoreIds: string
  mockRegionIds: string
  mockReadRegionIds: string
  bearerToken: string
}

const SESSION_STORAGE_KEY = 'store-ops-admin-session'
const BEARER_TOKEN_STORAGE_KEY = 'store-ops-admin-bearer-token'
const PROVIDER_ID_TOKEN_STORAGE_KEY = 'store-ops-admin-provider-id-token'
const TOKEN_REFRESH_SKEW_SECONDS = 30

export const defaultSession: SessionState = {
  mode: resolveSessionMode(import.meta.env.VITE_AUTH_MODE),
  mockUserId: import.meta.env.VITE_USER_ID ?? '80000000-0000-0000-0000-000000000001',
  mockRoleCodes:
    import.meta.env.VITE_ROLE_CODES ??
    'SUPER_ADMIN,INTEGRATION_ADMIN,SNAPSHOT_OPERATOR,REPORT_VIEWER,AUDITOR',
  mockCompanyIds: import.meta.env.VITE_COMPANY_IDS ?? '00000000-0000-0000-0000-000000000001',
  mockStoreIds: import.meta.env.VITE_STORE_IDS ?? '',
  mockReadStoreIds: import.meta.env.VITE_READ_STORE_IDS ?? import.meta.env.VITE_STORE_IDS ?? '',
  mockAssignedStoreIds:
    import.meta.env.VITE_ASSIGNED_STORE_IDS ?? import.meta.env.VITE_STORE_IDS ?? '',
  mockRegionIds: import.meta.env.VITE_REGION_IDS ?? '',
  mockReadRegionIds: import.meta.env.VITE_READ_REGION_IDS ?? import.meta.env.VITE_REGION_IDS ?? '',
  bearerToken: import.meta.env.VITE_BEARER_TOKEN ?? '',
}

export function readClientSession(): SessionState {
  if (typeof window === 'undefined') {
    return defaultSession
  }

  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
    const persisted = raw ? (JSON.parse(raw) as Partial<SessionState>) : {}
    const bearerToken = window.sessionStorage.getItem(BEARER_TOKEN_STORAGE_KEY) ?? ''

    if (isJwtExpired(bearerToken)) {
      clearClientBearerSession()
      return normalizeSession({
        ...defaultSession,
        ...persisted,
        bearerToken: '',
      })
    }

    return normalizeSession({
      ...defaultSession,
      ...persisted,
      bearerToken,
    })
  } catch {
    return defaultSession
  }
}

export function clearClientBearerSession() {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.removeItem(BEARER_TOKEN_STORAGE_KEY)
  window.sessionStorage.removeItem(PROVIDER_ID_TOKEN_STORAGE_KEY)
}

export function readClientProviderIdToken() {
  if (typeof window === 'undefined') {
    return ''
  }

  return window.sessionStorage.getItem(PROVIDER_ID_TOKEN_STORAGE_KEY)?.trim() ?? ''
}

export function writeClientBearerSession(token: string, providerIdToken?: string | null) {
  if (typeof window === 'undefined') {
    return
  }

  const normalized = token.trim()
  if (!normalized || isJwtExpired(normalized)) {
    window.sessionStorage.removeItem(BEARER_TOKEN_STORAGE_KEY)
    window.sessionStorage.removeItem(PROVIDER_ID_TOKEN_STORAGE_KEY)
    return
  }

  window.sessionStorage.setItem(BEARER_TOKEN_STORAGE_KEY, normalized)

  const normalizedProviderIdToken = providerIdToken?.trim()
  if (normalizedProviderIdToken) {
    window.sessionStorage.setItem(PROVIDER_ID_TOKEN_STORAGE_KEY, normalizedProviderIdToken)
    return
  }

  window.sessionStorage.removeItem(PROVIDER_ID_TOKEN_STORAGE_KEY)
}

export function buildSessionHeaders(session: SessionState): Record<string, string> {
  if (session.mode === 'bearer') {
    if (session.bearerToken.trim() && !isJwtExpired(session.bearerToken)) {
      return {
        Authorization: `Bearer ${session.bearerToken.trim()}`,
      }
    }

    return {}
  }

  const headers: Record<string, string> = {
    'x-user-id': session.mockUserId,
    'x-role-codes': session.mockRoleCodes,
    'x-company-ids': session.mockCompanyIds,
  }

  appendHeader(headers, 'x-store-ids', session.mockStoreIds)
  appendHeader(headers, 'x-read-store-ids', session.mockReadStoreIds)
  appendHeader(headers, 'x-assigned-store-ids', session.mockAssignedStoreIds)
  appendHeader(headers, 'x-region-ids', session.mockRegionIds)
  appendHeader(headers, 'x-read-region-ids', session.mockReadRegionIds)

  return headers
}

export function isSessionReady(session: SessionState) {
  if (session.mode === 'bearer') {
    return Boolean(session.bearerToken.trim())
  }

  return Boolean(
    session.mockUserId.trim() && session.mockRoleCodes.trim() && session.mockCompanyIds.trim(),
  )
}

export function getBearerSessionCacheKey(token: string) {
  const normalized = token.trim()

  if (!normalized) {
    return 'token-missing'
  }

  const payload = readJwtPayload(normalized)
  if (!payload) {
    return 'token-unreadable'
  }

  const sub = stringifyClaim(payload.sub)
  const sid = stringifyClaim(payload.sid)
  const aud = stringifyClaim(payload.aud)

  return [
    `sub:${sub || 'unknown'}`,
    sid ? `sid:${sid}` : null,
    aud ? `aud:${aud}` : null,
  ]
    .filter(Boolean)
    .join('|')
}

export function isBearerTokenExpiringSoon(token: string) {
  return isJwtExpired(token, TOKEN_REFRESH_SKEW_SECONDS)
}

export function persistClientSession(session: SessionState) {
  if (typeof window === 'undefined') {
    return
  }

  const normalized = normalizeSession(session)
  const persisted: SessionState = {
    ...normalized,
    bearerToken: '',
  }

  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(persisted))
}

export function normalizeSession(session: Partial<SessionState>): SessionState {
  const bearerToken = session.bearerToken?.trim() ?? ''

  return {
    mode: resolveSessionMode(session.mode),
    mockUserId: session.mockUserId?.trim() || defaultSession.mockUserId,
    mockRoleCodes: session.mockRoleCodes?.trim() || defaultSession.mockRoleCodes,
    mockCompanyIds: session.mockCompanyIds?.trim() || defaultSession.mockCompanyIds,
    mockStoreIds: session.mockStoreIds?.trim() ?? defaultSession.mockStoreIds,
    mockReadStoreIds: session.mockReadStoreIds?.trim() ?? defaultSession.mockReadStoreIds,
    mockAssignedStoreIds:
      session.mockAssignedStoreIds?.trim() ?? defaultSession.mockAssignedStoreIds,
    mockRegionIds: session.mockRegionIds?.trim() ?? defaultSession.mockRegionIds,
    mockReadRegionIds: session.mockReadRegionIds?.trim() ?? defaultSession.mockReadRegionIds,
    bearerToken: isJwtExpired(bearerToken) ? '' : bearerToken,
  }
}

function appendHeader(headers: Record<string, string>, key: string, value: string) {
  const normalized = value.trim()
  if (normalized) {
    headers[key] = normalized
  }
}

function resolveSessionMode(input: unknown): SessionMode {
  return input === 'bearer' ? 'bearer' : 'mock'
}

function isJwtExpired(token: string, skewSeconds = 0) {
  const normalized = token.trim()
  if (!normalized) {
    return false
  }

  const payload = readJwtPayload(normalized)
  if (typeof payload?.exp !== 'number') {
    return false
  }

  return payload.exp <= Math.floor(Date.now() / 1000) + skewSeconds
}

function readJwtPayload(token: string) {
  const [, payload] = token.split('.')
  if (!payload) {
    return null
  }

  try {
    return JSON.parse(globalThis.atob(toBase64(payload))) as Record<string, unknown>
  } catch {
    return null
  }
}

function stringifyClaim(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).sort().join(',')
  }

  if (value === undefined || value === null) {
    return ''
  }

  return String(value)
}

function toBase64(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  return normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')
}
