import { isCookieBrowserSession, type SessionState } from '../features/session/session-storage'

export type SessionReadinessDisplayPolicy = {
  canEditSession: boolean
  canPreviewCredentials: boolean
  canVerifyCurrentSession: boolean
}

export function resolveSessionReadinessDisplayPolicy(
  isDevelopment: boolean,
): SessionReadinessDisplayPolicy {
  return {
    canEditSession: isDevelopment,
    canPreviewCredentials: isDevelopment,
    canVerifyCurrentSession: true,
  }
}

export type SafeSessionStatus = {
  mode: 'local' | 'provider'
  transport: 'browser_cookie' | 'local_headers' | 'provider_bearer'
}

export function resolveSafeSessionStatus(
  session: Pick<SessionState, 'mode' | 'browserSessionTransport'>,
): SafeSessionStatus {
  if (isCookieBrowserSession(session)) {
    return { mode: 'provider', transport: 'browser_cookie' }
  }

  if (session.mode === 'bearer') {
    return { mode: 'provider', transport: 'provider_bearer' }
  }

  return { mode: 'local', transport: 'local_headers' }
}
