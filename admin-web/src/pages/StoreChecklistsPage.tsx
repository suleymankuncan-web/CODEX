import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { resolveStorePersona } from '../app/store-route-registry'
import type { AuthSessionSummary } from '../features/auth/api'
import { hasAnyRole } from '../features/auth/authorization'
import { ReportViewerChecklistCommandPage } from '../features/checklist-command/ReportViewerChecklistCommandPage'
import { RegionManagerChecklistCommandPage } from '../features/checklist-command/RegionManagerChecklistCommandPage'
import {
  StoreManagerChecklistCommandPage,
  SuperAdminChecklistCommandPage,
  VisualMerchandiserChecklistCommandPage,
} from '../features/checklist-command/StoreManagerChecklistCommandPage'
import { ChecklistWorkflowCommandOverlay } from '../features/checklist-workflow/ChecklistWorkflowCommandOverlay'
import {
  buildChecklistWorkflowOverlaySearch,
  resolveChecklistWorkflowRouteState,
} from '../features/checklist-workflow/checklist-workflow-route-state'
import { StoreErrorState, StoreSurfacePage } from './store-surface-primitives'

export function StoreChecklistsPage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const persona = resolveStorePersona(input.authSummary)
  const workflowRoute = resolveChecklistWorkflowRouteState(location.search)
  const routeParams = new URLSearchParams(location.search)
  const requestedCanvasView = routeParams.get('canvasView')
  const legacyStandalonePlan = routeParams.get('tab') === 'plan' && !routeParams.has('storeId')
  const canvasView = requestedCanvasView === 'plan' || requestedCanvasView === 'records'
    ? requestedCanvasView
    : legacyStandalonePlan
      ? 'plan'
      : 'visits'
  const overlayTriggerRef = useRef<HTMLElement | null>(null)
  const isReportViewer = hasAnyRole(input.authSummary, ['REPORT_VIEWER'])

  useEffect(() => {
    if (isReportViewer || !['regionManager', 'storeManager', 'visualMerchandiser', 'admin'].includes(persona) || !workflowRoute.shouldReplace) return
    navigate(
      { pathname: location.pathname, search: workflowRoute.normalizedSearch },
      { replace: true },
    )
  }, [isReportViewer, location.pathname, navigate, persona, workflowRoute.normalizedSearch, workflowRoute.shouldReplace])

  useEffect(() => {
    if (persona !== 'regionManager' || !legacyStandalonePlan) return
    const params = new URLSearchParams(location.search)
    params.delete('tab')
    params.set('canvasView', 'plan')
    navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: true })
  }, [legacyStandalonePlan, location.pathname, location.search, navigate, persona])

  if (isReportViewer) {
    return <ReportViewerChecklistCommandPage authSummary={input.authSummary} />
  }

  if (persona === 'regionManager') {
    return (
      <>
        <RegionManagerChecklistCommandPage
          authSummary={input.authSummary}
          activeView={canvasView}
          onActiveViewChange={(view) => {
            const params = new URLSearchParams(location.search)
            params.delete('tab')
            if (view === 'visits') params.delete('canvasView')
            else params.set('canvasView', view)
            navigate({ pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : '' })
          }}
          onOpenWorkflow={(storeId, tab = 'visits', directChecklist) => {
            overlayTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
            navigate({
              pathname: location.pathname,
              search: buildChecklistWorkflowOverlaySearch(location.search, {
                kind: 'workflow',
                storeId,
                tab,
                ...(directChecklist ? { directChecklist } : {}),
              }),
            })
          }}
          onOpenResult={(checklistInstanceId) => {
            overlayTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
            navigate({
              pathname: location.pathname,
              search: buildChecklistWorkflowOverlaySearch(location.search, {
                kind: 'result',
                checklistInstanceId,
              }),
            })
          }}
        />
        {workflowRoute.state ? (
          <ChecklistWorkflowCommandOverlay
            authSummary={input.authSummary}
            routeState={workflowRoute.state}
            returnFocusRef={overlayTriggerRef}
            onClose={() => {
              navigate({
                pathname: location.pathname,
                search: buildChecklistWorkflowOverlaySearch(location.search, null),
              }, { replace: true })
            }}
          />
        ) : null}
      </>
    )
  }

  const OperatorPage = persona === 'storeManager'
    ? StoreManagerChecklistCommandPage
    : persona === 'visualMerchandiser'
      ? VisualMerchandiserChecklistCommandPage
      : persona === 'admin' && hasAnyRole(input.authSummary, ['SUPER_ADMIN'])
        ? SuperAdminChecklistCommandPage
        : null

  if (OperatorPage) {
    return (
      <>
        <OperatorPage
          authSummary={input.authSummary}
          onOpenWorkflow={(storeId, tab, trigger, directChecklist) => {
            overlayTriggerRef.current = trigger
            navigate({
              pathname: location.pathname,
              search: buildChecklistWorkflowOverlaySearch(location.search, {
                kind: 'workflow',
                storeId,
                tab,
                ...(directChecklist ? { directChecklist } : {}),
              }),
            })
          }}
        />
        {workflowRoute.state ? (
          <ChecklistWorkflowCommandOverlay
            authSummary={input.authSummary}
            routeState={workflowRoute.state}
            returnFocusRef={overlayTriggerRef}
            onClose={() => {
              navigate({
                pathname: location.pathname,
                search: buildChecklistWorkflowOverlaySearch(location.search, null),
              }, { replace: true })
            }}
          />
        ) : null}
      </>
    )
  }

  return <StoreSurfacePage ariaLabel="Checklist erişimi"><StoreErrorState title="Checklist erişimi bulunamadı" description="Bu rol için yetkili checklist kapsamı bulunmuyor." /></StoreSurfacePage>
}
