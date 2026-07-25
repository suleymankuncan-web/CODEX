import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { ScreenState } from '../components/dashboard-primitives'
import type { AuthSessionSummary } from '../features/auth/api'
import { useLocalization } from '../features/localization/useLocalization'
import { StoreRouteState, StoreSurfacePage } from '../pages/store-surface-primitives'
import { SessionReadinessPage } from './route-loaders'
import { hasAnyRole, isVisualMerchandiserOnly, type ShellState } from './shell-state'

export function RouteLoadingState() {
  const { t } = useLocalization()

  return (
    <RouteProgressState
      title={t('adminShell.routeLoadingTitle')}
      copy={t('adminShell.routeLoadingCopy')}
    />
  )
}

export function RouteProgressState(input: { title: string; copy: string }) {
  const statusLabel = `${input.title}. ${input.copy}`

  return (
    <section
      className="route-loading-state"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={statusLabel}
    >
      <span className="route-loading-orbit" aria-hidden="true" />
      <span className="sr-only">{statusLabel}</span>
    </section>
  )
}

export function StoreRouteGuard(input: {
  authSummary: AuthSessionSummary | null
  children: ReactNode
  allowVm?: boolean
  allowed?: boolean
  firstAllowedPath?: string
}) {
  if (isVisualMerchandiserOnly(input.authSummary) && !input.allowVm) {
    return <StoreForbiddenRoute firstAllowedPath="/store/checklists" />
  }

  if (input.allowed === false) {
    return <StoreForbiddenRoute firstAllowedPath={input.firstAllowedPath ?? '/store'} />
  }

  return <>{input.children}</>
}

export function SessionGate() {
  return <SessionReadinessPage />
}

export function AdminRouteGuard(input: {
  shellState: ShellState
  authSummary: AuthSessionSummary | null
  roles: string[]
  children: ReactNode
}) {
  if (input.shellState.mode === 'setup-required') {
    return <Navigate to="/auth/login" replace />
  }

  if (input.shellState.mode === 'verifying') {
    return <RouteVerifyingState />
  }

  if (input.shellState.mode === 'rejected') {
    return <RouteRejectedState shellState={input.shellState} />
  }

  if (!hasAnyRole(input.authSummary?.user.roleCodes ?? [], input.roles)) {
    return <ForbiddenRoute firstAllowedPath={input.shellState.firstAllowedPath} />
  }

  return <>{input.children}</>
}

function RouteVerifyingState() {
  const { t } = useLocalization()

  return (
    <RouteProgressState
      title={t('adminShell.routeVerifyingTitle')}
      copy={t('adminShell.routeVerifyingCopy')}
    />
  )
}

function RouteRejectedState(input: { shellState: ShellState }) {
  const { t } = useLocalization()

  return (
    <ScreenState
      title={t('adminShell.routeRejectedTitle')}
      copy={input.shellState.notice ?? input.shellState.errorCopy ?? t('adminShell.routeRejectedFallback')}
      tone="error"
    />
  )
}

function ForbiddenRoute(input: { firstAllowedPath: string }) {
  const { t } = useLocalization()

  return (
    <ScreenState
      title={t('adminShell.forbiddenTitle')}
      copy={t('adminShell.forbiddenCopy', { firstAllowedPath: input.firstAllowedPath })}
      tone="error"
    />
  )
}

function StoreForbiddenRoute(input: { firstAllowedPath: string }) {
  const { t } = useLocalization()

  return (
    <StoreSurfacePage ariaLabel={t('adminShell.forbiddenTitle')}>
      <StoreRouteState
        kind="forbidden"
        title={t('adminShell.forbiddenTitle')}
        titleAsHeading
        description={t('adminShell.forbiddenCopy', { firstAllowedPath: input.firstAllowedPath })}
      />
    </StoreSurfacePage>
  )
}
