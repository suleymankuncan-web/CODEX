import { Component, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useLocalization } from '../features/localization/useLocalization'

const routeChunkReloadKeyPrefix = 'store-ops-route-reload:'

type RouteRecoveryLabels = {
  title: string
  copy: string
  chunkCopy: string
  reload: string
  home: string
}

type RouteRecoveryBoundaryProps = {
  children: ReactNode
  firstAllowedPath: string
}

type RouteErrorBoundaryProps = RouteRecoveryBoundaryProps & {
  labels: RouteRecoveryLabels
  resetKey: string
}

type RouteErrorBoundaryState = {
  error: unknown
}

export function RouteRecoveryBoundary(input: RouteRecoveryBoundaryProps) {
  const location = useLocation()
  const { t } = useLocalization()

  return (
    <RouteErrorBoundary
      firstAllowedPath={input.firstAllowedPath}
      labels={{
        title: t('adminShell.routeErrorTitle'),
        copy: t('adminShell.routeErrorCopy'),
        chunkCopy: t('adminShell.routeErrorChunkCopy'),
        reload: t('adminShell.routeErrorReload'),
        home: t('adminShell.routeErrorHome'),
      }}
      resetKey={`${location.pathname}${location.search}`}
    >
      {input.children}
    </RouteErrorBoundary>
  )
}

class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: unknown): RouteErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: unknown) {
    if (isRouteChunkLoadError(error) && markRouteChunkReloadAttempt(this.props.resetKey)) {
      window.location.reload()
    }
  }

  componentDidUpdate(previousProps: RouteErrorBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  render() {
    if (this.state.error) {
      return (
        <RouteRecoveryState
          chunkError={isRouteChunkLoadError(this.state.error)}
          firstAllowedPath={this.props.firstAllowedPath}
          labels={this.props.labels}
        />
      )
    }

    return this.props.children
  }
}

function isRouteChunkLoadError(error: unknown) {
  const errorName = error instanceof Error ? error.name : ''
  const errorMessage = error instanceof Error ? error.message : String(error ?? '')
  const normalized = `${errorName} ${errorMessage}`.toLowerCase()

  return [
    'chunkloaderror',
    'failed to fetch dynamically imported module',
    'importing a module script failed',
    'error loading dynamically imported module',
    'loading chunk',
  ].some((marker) => normalized.includes(marker))
}

function markRouteChunkReloadAttempt(resetKey: string) {
  if (typeof window === 'undefined') return false

  try {
    const storageKey = `${routeChunkReloadKeyPrefix}${resetKey}`
    if (window.sessionStorage.getItem(storageKey)) return false
    window.sessionStorage.setItem(storageKey, '1')
    return true
  } catch {
    return false
  }
}

function RouteRecoveryState(input: {
  chunkError: boolean
  firstAllowedPath: string
  labels: RouteRecoveryLabels
}) {
  return (
    <section className="screen-state screen-state-error route-recovery-state">
      <h2>{input.labels.title}</h2>
      <p>{input.chunkError ? input.labels.chunkCopy : input.labels.copy}</p>
      <div className="route-recovery-actions">
        <button className="back-link" type="button" onClick={() => window.location.reload()}>
          {input.labels.reload}
        </button>
        <Link className="back-link" to={input.firstAllowedPath}>
          {input.labels.home}
        </Link>
      </div>
    </section>
  )
}
