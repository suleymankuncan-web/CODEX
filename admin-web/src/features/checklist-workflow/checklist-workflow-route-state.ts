export type ChecklistWorkflowTab = 'visits' | 'plan' | 'inbox' | 'history'
export type ChecklistWorkflowStatus =
  | 'missing'
  | 'draft'
  | 'missing_or_draft'
  | 'completed'
  | 'pending'
  | 'acknowledged'
export type ChecklistWorkflowDirectChecklist = 'bm' | 'vm'

export type ChecklistWorkflowOverlayState =
  | {
      kind: 'workflow'
      storeId: string
      tab: ChecklistWorkflowTab
      status?: ChecklistWorkflowStatus
      directChecklist?: ChecklistWorkflowDirectChecklist
    }
  | {
      kind: 'result'
      checklistInstanceId: string
      returnStoreId?: string
      returnTab?: ChecklistWorkflowTab
      returnStatus?: ChecklistWorkflowStatus
    }

type ResolvedChecklistWorkflowRouteState = {
  state: ChecklistWorkflowOverlayState | null
  normalizedSearch: string
  shouldReplace: boolean
}

const postgresUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const workflowTabs = new Set<ChecklistWorkflowTab>(['visits', 'plan', 'inbox', 'history'])
const workflowStatuses = new Set<ChecklistWorkflowStatus>([
  'missing',
  'draft',
  'missing_or_draft',
  'completed',
  'pending',
  'acknowledged',
])
const ownedRouteKeys = [
  'view',
  'tab',
  'result',
  'status',
  'overlay',
  'checklistInstanceId',
  'storeId',
  'workflowTab',
  'workflowStatus',
  'workflowChecklist',
] as const

export function buildChecklistWorkflowOverlaySearch(
  search: string,
  state: ChecklistWorkflowOverlayState | null,
) {
  const params = new URLSearchParams(search)
  for (const key of ownedRouteKeys) params.delete(key)

  if (state?.kind === 'workflow') {
    params.set('overlay', 'workflow')
    params.set('storeId', state.storeId)
    params.set('workflowTab', state.tab)
    if (state.status) params.set('workflowStatus', state.status)
    if (state.tab === 'visits' && state.directChecklist) params.set('workflowChecklist', state.directChecklist)
  } else if (state?.kind === 'result') {
    params.set('overlay', 'result')
    params.set('checklistInstanceId', state.checklistInstanceId)
    if (state.returnStoreId) params.set('storeId', state.returnStoreId)
    if (state.returnTab) params.set('workflowTab', state.returnTab)
    if (state.returnStatus) params.set('workflowStatus', state.returnStatus)
  }

  return toSearch(params)
}

export function resolveChecklistWorkflowRouteState(
  search: string,
): ResolvedChecklistWorkflowRouteState {
  const params = new URLSearchParams(search)
  const overlay = params.get('overlay')
  const legacyRequested =
    params.get('view') === 'workflow' ||
    params.has('result') ||
    (params.has('storeId') && (params.has('tab') || params.has('status')))

  let state: ChecklistWorkflowOverlayState | null = null
  const resultId = (params.get('checklistInstanceId') ?? params.get('result'))?.trim() ?? ''
  const storeId = params.get('storeId')?.trim() ?? ''

  if ((overlay === 'result' || params.has('result')) && isPostgresUuid(resultId)) {
    const returnStoreId = isPostgresUuid(storeId) ? storeId : undefined
    const returnStatus = resolveStatus(params.get('workflowStatus') ?? params.get('status'))
    state = {
      kind: 'result',
      checklistInstanceId: resultId,
      ...(returnStoreId
        ? {
            returnStoreId,
            returnTab: resolveTab(params.get('workflowTab') ?? params.get('tab')),
            ...(returnStatus ? { returnStatus } : {}),
          }
        : {}),
    }
  } else if ((overlay === 'workflow' || legacyRequested) && isPostgresUuid(storeId)) {
    const legacyTab = params.get('tab') === 'incomplete' ? 'visits' : params.get('tab')
    const tab = resolveTab(params.get('workflowTab') ?? legacyTab)
    const status = resolveStatus(
      params.get('workflowStatus') ??
        (params.get('tab') === 'incomplete' ? 'missing_or_draft' : params.get('status')),
    )
    const directChecklist = tab === 'visits'
      ? resolveDirectChecklist(params.get('workflowChecklist'))
      : undefined
    state = {
      kind: 'workflow',
      storeId,
      tab,
      ...(status ? { status } : {}),
      ...(directChecklist ? { directChecklist } : {}),
    }
  }

  const routeWasRequested = Boolean(overlay) || legacyRequested
  const normalizedSearch = routeWasRequested
    ? buildChecklistWorkflowOverlaySearch(search, state)
    : toSearch(params)

  return {
    state,
    normalizedSearch,
    shouldReplace: normalizedSearch !== normalizeSearch(search),
  }
}

function resolveTab(value: string | null): ChecklistWorkflowTab {
  return value && workflowTabs.has(value as ChecklistWorkflowTab)
    ? (value as ChecklistWorkflowTab)
    : 'visits'
}

function resolveStatus(value: string | null): ChecklistWorkflowStatus | undefined {
  return value && workflowStatuses.has(value as ChecklistWorkflowStatus)
    ? (value as ChecklistWorkflowStatus)
    : undefined
}

function resolveDirectChecklist(value: string | null): ChecklistWorkflowDirectChecklist | undefined {
  return value === 'bm' || value === 'vm' ? value : undefined
}

function isPostgresUuid(value: string) {
  return postgresUuidPattern.test(value)
}

function normalizeSearch(search: string) {
  return toSearch(new URLSearchParams(search))
}

function toSearch(params: URLSearchParams) {
  const value = params.toString()
  return value ? `?${value}` : ''
}
