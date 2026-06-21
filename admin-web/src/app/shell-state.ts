import type { AuthSessionSummary } from '../features/auth/api'
import { ApiError } from '../lib/api'
import {
  getStoreLandingPath,
  isStoreVisualMerchandiserOnly,
} from './store-route-registry'

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

  if (hasAnyRole(roles, ['SUPER_ADMIN', 'REPORT_VIEWER'])) {
    return '/admin/reports'
  }

  if (hasAnyRole(roles, ['SUPER_ADMIN', 'AUDITOR'])) {
    return '/admin/audit'
  }

  if (hasAnyRole(roles, ['SUPER_ADMIN'])) {
    return '/admin/auth'
  }

  if (isStoreVisualMerchandiserOnly(authSummary)) {
    return getStoreLandingPath(authSummary)
  }

  if (hasAnyRole(roles, ['STORE_PERSONNEL']) && !hasAnyRole(roles, ['STORE_MANAGER', 'REGION_MANAGER'])) {
    return getStoreLandingPath(authSummary)
  }

  if (hasAnyRole(roles, ['REGION_MANAGER', 'STORE_MANAGER', 'VISUAL_MERCHANDISER'])) {
    return getStoreLandingPath(authSummary)
  }

  return '/store/home'
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
  return isStoreVisualMerchandiserOnly(authSummary)
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
