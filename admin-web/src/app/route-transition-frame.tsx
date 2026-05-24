import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useLocalization } from '../features/localization/useLocalization'

const ROUTE_TRANSITION_MIN_MS = 360

export function RouteTransitionFrame(input: { children: ReactNode }) {
  const location = useLocation()
  const { t } = useLocalization()
  const routeLoadingTitle = t('adminShell.routeLoadingTitle')
  const routeLoadingCopy = t('adminShell.routeLoadingCopy')
  const routeKey = `${location.pathname}${location.search}`
  const [settledRouteKey, setSettledRouteKey] = useState(routeKey)
  const isTransitioning = settledRouteKey !== routeKey

  useEffect(() => {
    if (settledRouteKey === routeKey) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setSettledRouteKey(routeKey)
    }, ROUTE_TRANSITION_MIN_MS)

    return () => window.clearTimeout(timeoutId)
  }, [routeKey, settledRouteKey])

  return (
    <div
      aria-busy={isTransitioning}
      className={`route-transition-frame${isTransitioning ? ' route-transition-frame-active' : ''}`}
    >
      <div className="route-transition-content" aria-hidden={isTransitioning ? true : undefined}>
        {input.children}
      </div>
      {isTransitioning ? (
        <div className="route-transition-layer" data-testid="route-transition" role="status" aria-live="polite">
          <div className="route-transition-compact" aria-label={`${routeLoadingTitle}. ${routeLoadingCopy}`}>
            <span className="route-transition-orbit" aria-hidden="true" />
            <span>{routeLoadingTitle}</span>
          </div>
        </div>
      ) : null}
    </div>
  )
}
