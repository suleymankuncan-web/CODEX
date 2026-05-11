import type { AuthSessionSummary } from '../features/auth/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import type { SessionMode } from '../features/session/session-storage'
import { ApiError } from '../lib/api'

export type ShellState = {
  mode: 'setup-required' | 'verifying' | 'rejected' | 'ready'
  firstAllowedPath: string
  notice: string | null
  errorCopy: string | null
}

type ShellLocation = {
  pathname: string
  search: string
  hash: string
}

export function getShellState(input: {
  isReady: boolean
  authSummary: AuthSessionSummary | null
  authError: boolean
  authLoading: boolean
  authErrorDetail: unknown
  firstAllowedPath: string
  sessionNotice: string | null
  providerSessionHydrating: boolean
}): ShellState {
  const errorCopy = resolveAuthErrorCopy(input.authErrorDetail)

  if (!input.isReady && input.providerSessionHydrating) {
    return {
      mode: 'verifying',
      firstAllowedPath: input.firstAllowedPath,
      notice: input.sessionNotice,
      errorCopy,
    }
  }

  if (!input.isReady) {
    return {
      mode: 'setup-required',
      firstAllowedPath: input.firstAllowedPath,
      notice: input.sessionNotice,
      errorCopy,
    }
  }

  if (input.authLoading) {
    return {
      mode: 'verifying',
      firstAllowedPath: input.firstAllowedPath,
      notice: input.sessionNotice,
      errorCopy,
    }
  }

  if (input.authError || !input.authSummary) {
    return {
      mode: 'rejected',
      firstAllowedPath: input.firstAllowedPath,
      notice: input.sessionNotice,
      errorCopy,
    }
  }

  return {
    mode: 'ready',
    firstAllowedPath: input.firstAllowedPath,
    notice: input.sessionNotice,
    errorCopy,
  }
}

export function formatAdminShellSessionMode(mode: SessionMode, t: TranslateFunction) {
  return mode === 'bearer'
    ? t('adminShell.sessionMode.bearer')
    : t('adminShell.sessionMode.mock')
}

export function formatAdminShellAuthState(
  isLoading: boolean,
  isError: boolean,
  hasAuthSummary: boolean,
  t: TranslateFunction,
) {
  if (isLoading) return t('adminShell.authState.checking')
  if (isError) return t('adminShell.authState.rejected')
  if (hasAuthSummary) return t('adminShell.authState.verified')
  return t('adminShell.authState.idle')
}

export function formatAdminShellState(mode: ShellState['mode'], t: TranslateFunction) {
  if (mode === 'ready') return t('adminShell.state.ready')
  if (mode === 'verifying') return t('adminShell.state.checking')
  if (mode === 'setup-required') return t('adminShell.state.needsSetup')
  return t('adminShell.state.attention')
}

export function resolveLandingPath(authSummary: AuthSessionSummary | null, isReady: boolean) {
  if (!isReady) {
    return '/auth/login'
  }

  const roles = authSummary?.user.roleCodes ?? []

  if (hasAnyRole(roles, ['SUPER_ADMIN', 'INTEGRATION_ADMIN'])) {
    return '/admin/integrations'
  }

  if (hasAnyRole(roles, ['SUPER_ADMIN', 'SNAPSHOT_OPERATOR'])) {
    return '/admin/snapshots'
  }

  if (hasAnyRole(roles, ['HR_ADMIN'])) {
    return '/admin/competitions'
  }

  if (hasAnyRole(roles, ['REGION_MANAGER'])) {
    return '/admin/targets'
  }

  if (hasAnyRole(roles, ['SUPER_ADMIN', 'REPORT_VIEWER'])) {
    return '/admin/reports'
  }

  if (hasAnyRole(roles, ['SUPER_ADMIN', 'AUDITOR'])) {
    return '/admin/audit'
  }

  if (hasAnyRole(roles, ['SUPER_ADMIN'])) {
    return '/admin/auth'
  }

  if (hasAnyRole(roles, ['VISUAL_MERCHANDISER'])) {
    return '/store/checklists'
  }

  return '/store'
}

function resolveAuthErrorCopy(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Session verification failed with 401. Refresh the bearer token or continue through the real login route.'
    }

    if (error.status === 403) {
      return 'Session verified but does not have access to the requested shell surface. Use a route that matches the current role and scope.'
    }
  }

  if (error instanceof Error) {
    return error.message
  }

  return null
}

export function isVisualMerchandiserOnly(authSummary: AuthSessionSummary | null) {
  const roles = authSummary?.user.roleCodes ?? []
  const broadRoles = ['SUPER_ADMIN', 'HR_ADMIN', 'REGION_MANAGER', 'STORE_MANAGER', 'STORE_PERSONNEL']
  return roles.includes('VISUAL_MERCHANDISER') && !hasAnyRole(roles, broadRoles)
}

export function hasAnyRole(userRoles: string[], requiredRoles: string[]) {
  return requiredRoles.some((role) => userRoles.includes(role))
}

export function getCurrentReturnPath(location: ShellLocation) {
  return `${location.pathname}${location.search}${location.hash}`
}

export function buildAuthLoginPath(returnTo: string) {
  return `/auth/login?returnTo=${encodeURIComponent(returnTo)}`
}
