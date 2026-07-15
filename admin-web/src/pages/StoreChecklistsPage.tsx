import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { resolveStorePersona } from '../app/store-route-registry'
import type { AuthSessionSummary } from '../features/auth/api'
import { hasAnyRole } from '../features/auth/authorization'
import { ReportViewerChecklistCommandPage } from '../features/checklist-command/ReportViewerChecklistCommandPage'
import { RegionManagerChecklistCommandPage } from '../features/checklist-command/RegionManagerChecklistCommandPage'
import { ChecklistWorkflowLegacySurface } from '../features/checklist-workflow/ChecklistWorkflowLegacySurface'
import { ChecklistWorkflowCommandOverlay } from '../features/checklist-workflow/ChecklistWorkflowCommandOverlay'
import {
  buildChecklistWorkflowOverlaySearch,
  resolveChecklistWorkflowRouteState,
} from '../features/checklist-workflow/checklist-workflow-route-state'

export function StoreChecklistsPage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const persona = resolveStorePersona(input.authSummary)
  const workflowRoute = resolveChecklistWorkflowRouteState(location.search)
  const overlayTriggerRef = useRef<HTMLElement | null>(null)
  const isReportViewer = hasAnyRole(input.authSummary, ['REPORT_VIEWER'])

  useEffect(() => {
    if (isReportViewer || persona !== 'regionManager' || !workflowRoute.shouldReplace) return
    navigate(
      { pathname: location.pathname, search: workflowRoute.normalizedSearch },
      { replace: true },
    )
  }, [isReportViewer, location.pathname, navigate, persona, workflowRoute.normalizedSearch, workflowRoute.shouldReplace])

  if (isReportViewer) {
    return <ReportViewerChecklistCommandPage authSummary={input.authSummary} />
  }

  if (persona === 'regionManager') {
    return (
      <>
        <RegionManagerChecklistCommandPage
          authSummary={input.authSummary}
          onOpenWorkflow={(storeId) => {
            overlayTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
            navigate({
              pathname: location.pathname,
              search: buildChecklistWorkflowOverlaySearch(location.search, {
                kind: 'workflow',
                storeId,
                tab: 'visits',
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
              })
            }}
          />
        ) : null}
      </>
    )
  }

  return <ChecklistWorkflowLegacySurface {...input} />
}
