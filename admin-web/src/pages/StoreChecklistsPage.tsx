import { useLocation, useNavigate } from 'react-router-dom'
import { resolveStorePersona } from '../app/store-route-registry'
import type { AuthSessionSummary } from '../features/auth/api'
import { RegionManagerChecklistCommandPage } from '../features/checklist-command/RegionManagerChecklistCommandPage'
import { ChecklistWorkflowLegacySurface } from '../features/checklist-workflow/ChecklistWorkflowLegacySurface'

export function StoreChecklistsPage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const params = new URLSearchParams(location.search)
  const showLegacyWorkflow =
    params.get('view') === 'workflow' ||
    params.has('tab') ||
    params.has('result') ||
    params.has('status')

  if (resolveStorePersona(input.authSummary) === 'regionManager' && !showLegacyWorkflow) {
    return (
      <RegionManagerChecklistCommandPage
        authSummary={input.authSummary}
        onOpenWorkflow={(storeId) => {
          const next = new URLSearchParams(location.search)
          next.set('view', 'workflow')
          next.set('storeId', storeId)
          navigate({ pathname: location.pathname, search: `?${next.toString()}` })
        }}
        onOpenResult={(checklistInstanceId) => {
          const next = new URLSearchParams(location.search)
          next.set('view', 'workflow')
          next.set('result', checklistInstanceId)
          next.delete('storeId')
          navigate({ pathname: location.pathname, search: `?${next.toString()}` })
        }}
      />
    )
  }

  return <ChecklistWorkflowLegacySurface {...input} />
}
