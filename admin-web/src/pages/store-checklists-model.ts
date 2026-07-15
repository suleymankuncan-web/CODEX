import type { MobileChecklistToday } from '../features/checklists/api'

export type ChecklistCoverageRow = {
  store: MobileChecklistToday['stores'][number]
  template: MobileChecklistToday['templates'][number]
  active: MobileChecklistToday['activeInstances'][number] | undefined
  summary: MobileChecklistToday['monthlySummaries'][number] | undefined
  completedAt: string | null
  completedCount: number
  completedScore: number | null
  localCompletedScore: number | null
}

export type ChecklistStoreVisitRow = {
  store: MobileChecklistToday['stores'][number]
  bm: ChecklistCoverageRow | undefined
  vm: ChecklistCoverageRow | undefined
  primary: ChecklistCoverageRow
}

export type ChecklistSession = ChecklistCoverageRow
export type ChecklistTone = 'calm' | 'warning' | 'accent' | 'danger' | 'neutral'
export type ChecklistTypeFilter = 'all' | 'BM_STORE_VISIT' | 'VM_STORE_VISIT'
export type ChecklistStatusFilter =
  | 'all'
  | 'missing'
  | 'draft'
  | 'missing_or_draft'
  | 'completed'
  | 'pending'
  | 'acknowledged'
export type ChecklistSortKey = 'priority' | 'store' | 'score' | 'date' | 'status'
export type ChecklistSortDirection = 'asc' | 'desc'
export type ChecklistSort = { key: ChecklistSortKey; direction: ChecklistSortDirection }
export type ChecklistTab = 'visits' | 'plan' | 'inbox' | 'history'
export type ChecklistActiveInstance = MobileChecklistToday['activeInstances'][number]
export type ChecklistCompletedInstance = {
  checklistInstanceId: string
  checklistTemplateId: string
  completedAt: string | null
  storeId: string
  totalScore: number | null
}
export type ChecklistTabOption = {
  key: ChecklistTab
  label: string
  count: number
  tone: ChecklistTone
}
export type ChecklistResponseDraft = {
  checklistInstanceId: string
  templateItemId: string
  scoreValue: number
  commentText?: string
}
export type ChecklistDraftHydration = {
  comments: Record<string, string>
  scores: Record<string, number>
}
export type ChecklistVisitStartVariables = {
  checklistTemplateId: string
  storeId: string
}

const CHECKLIST_COMMAND_NOTICE_KEY = 'store-checklists-command-notice'

export type StoreChecklistsState = {
  ackNotes: Record<string, string>
  ackNotice: string | null
  scores: Record<string, number>
  comments: Record<string, string>
  selectedSessionKey: string | null
  selectedResultId: string | null
  searchQuery: string
  selectedMonth: string
  typeFilter: ChecklistTypeFilter
  statusFilter: ChecklistStatusFilter
  activeTab: ChecklistTab
  visitSort: ChecklistSort
  resultSort: ChecklistSort
  localActiveInstances: Record<string, ChecklistActiveInstance>
  localCompletedRows: Record<string, number>
  localCompletedInstances: Record<string, ChecklistCompletedInstance>
  sessionDirty: boolean
}

export type StoreChecklistsAction =
  | { type: 'setAckNotice'; message: string | null }
  | { type: 'acknowledgeSucceeded'; checklistInstanceId: string }
  | { type: 'startVisitSucceeded'; rowKey: string; instance: ChecklistActiveInstance }
  | {
      type: 'saveResponseSucceeded'
      draft: ChecklistResponseDraft
      updatedAt: string | null
    }
  | {
      type: 'completeVisitSucceeded'
      completedInstance: ChecklistCompletedInstance
      rowKey: string
    }
  | {
      type: 'openSession'
      rowKey: string
      scores: Record<string, number>
      comments: Record<string, string>
    }
  | { type: 'resetSessionDrafts' }
  | { type: 'closeSession' }
  | { type: 'setScoreDraft'; templateItemId: string; score: number | null }
  | { type: 'setCommentDraft'; templateItemId: string; comment: string }
  | { type: 'setAckNote'; checklistInstanceId: string; note: string }
  | { type: 'selectTab'; tab: ChecklistTab }
  | { type: 'openResult'; tab: ChecklistTab; checklistInstanceId: string }
  | { type: 'closeResult' }
  | { type: 'clearFilters'; typeFilter: ChecklistTypeFilter }
  | { type: 'setSearchQuery'; value: string }
  | { type: 'setSelectedMonth'; value: string }
  | { type: 'setTypeFilter'; value: ChecklistTypeFilter }
  | { type: 'setStatusFilter'; value: ChecklistStatusFilter }
  | { type: 'toggleVisitSort'; key: ChecklistSortKey }
  | { type: 'toggleResultSort'; key: ChecklistSortKey }

export function createInitialStoreChecklistsState(search: string): StoreChecklistsState {
  return {
    ackNotes: {},
    ackNotice: takeChecklistCommandNotice(),
    scores: {},
    comments: {},
    selectedSessionKey: null,
    selectedResultId: resolveChecklistResultFromSearch(search),
    searchQuery: '',
    selectedMonth: getCurrentMonthKey(),
    typeFilter: 'all',
    statusFilter: resolveChecklistStatusFromSearch(search),
    activeTab: resolveChecklistTabFromSearch(search),
    visitSort: { key: 'priority', direction: 'desc' },
    resultSort: { key: 'date', direction: 'desc' },
    localActiveInstances: {},
    localCompletedRows: {},
    localCompletedInstances: {},
    sessionDirty: false,
  }
}

export function upsertChecklistActiveResponse(
  instance: ChecklistActiveInstance,
  draft: ChecklistResponseDraft,
  updatedAt: string | null,
): ChecklistActiveInstance {
  const response = {
    templateItemId: draft.templateItemId,
    scoreValue: draft.scoreValue,
    commentText: draft.commentText ?? null,
  }
  const existingResponse = instance.responses.some(
    (item) => item.templateItemId === draft.templateItemId,
  )

  return {
    ...instance,
    updatedAt,
    responses: existingResponse
      ? instance.responses.map((item) =>
          item.templateItemId === draft.templateItemId ? response : item,
        )
      : [...instance.responses, response],
  }
}

export function mergeChecklistActiveInstanceOverlay(
  queryActive: ChecklistActiveInstance | undefined,
  localActive: ChecklistActiveInstance | undefined,
): ChecklistActiveInstance | undefined {
  if (!localActive) return queryActive
  if (!queryActive) return localActive
  if (queryActive.checklistInstanceId !== localActive.checklistInstanceId) return queryActive

  const responsesByItem = new Map(queryActive.responses.map((response) => [response.templateItemId, response]))
  for (const response of localActive.responses) {
    responsesByItem.set(response.templateItemId, response)
  }

  return {
    ...queryActive,
    updatedAt: localActive.updatedAt ?? queryActive.updatedAt,
    responses: [...responsesByItem.values()],
  }
}

export function storeChecklistsReducer(
  state: StoreChecklistsState,
  action: StoreChecklistsAction,
): StoreChecklistsState {
  switch (action.type) {
    case 'setAckNotice':
      return { ...state, ackNotice: action.message }
    case 'acknowledgeSucceeded': {
      const nextAckNotes = { ...state.ackNotes }
      delete nextAckNotes[action.checklistInstanceId]
      return { ...state, ackNotes: nextAckNotes, selectedResultId: null, activeTab: 'history' }
    }
    case 'startVisitSucceeded':
      return {
        ...state,
        localActiveInstances: {
          ...state.localActiveInstances,
          [action.rowKey]: action.instance,
        },
        scores: {},
        comments: {},
        selectedSessionKey: action.rowKey,
        sessionDirty: false,
      }
    case 'saveResponseSucceeded': {
      let updatedLocalInstance = false
      const localActiveInstances = { ...state.localActiveInstances }

      for (const [key, instance] of Object.entries(state.localActiveInstances)) {
        if (instance.checklistInstanceId !== action.draft.checklistInstanceId) continue
        localActiveInstances[key] = upsertChecklistActiveResponse(instance, action.draft, action.updatedAt)
        updatedLocalInstance = true
      }

      return {
        ...state,
        ...(updatedLocalInstance ? { localActiveInstances } : {}),
        sessionDirty: false,
      }
    }
    case 'completeVisitSucceeded':
      return {
        ...state,
        localActiveInstances: Object.fromEntries(
          Object.entries(state.localActiveInstances).filter(
            ([, instance]) =>
              instance.checklistInstanceId !== action.completedInstance.checklistInstanceId,
          ),
        ),
        localCompletedRows: {
          ...state.localCompletedRows,
          [action.rowKey]: Math.max((state.localCompletedRows[action.rowKey] ?? 0) + 1, 1),
        },
        localCompletedInstances: {
          ...state.localCompletedInstances,
          [action.completedInstance.checklistInstanceId]: action.completedInstance,
        },
        selectedSessionKey: null,
        sessionDirty: false,
      }
    case 'openSession':
      return {
        ...state,
        selectedSessionKey: action.rowKey,
        scores: action.scores,
        comments: action.comments,
        sessionDirty: false,
      }
    case 'resetSessionDrafts':
      return { ...state, scores: {}, comments: {}, selectedSessionKey: null, sessionDirty: false }
    case 'closeSession':
      return { ...state, selectedSessionKey: null, sessionDirty: false }
    case 'setScoreDraft': {
      const nextScores = { ...state.scores }
      if (action.score === null) {
        delete nextScores[action.templateItemId]
      } else {
        nextScores[action.templateItemId] = action.score
      }
      return { ...state, scores: nextScores, sessionDirty: true }
    }
    case 'setCommentDraft':
      return {
        ...state,
        comments: { ...state.comments, [action.templateItemId]: action.comment },
        sessionDirty: true,
      }
    case 'setAckNote':
      return {
        ...state,
        ackNotes: { ...state.ackNotes, [action.checklistInstanceId]: action.note },
      }
    case 'selectTab':
      return { ...state, activeTab: action.tab, selectedResultId: null }
    case 'openResult':
      return { ...state, activeTab: action.tab, selectedResultId: action.checklistInstanceId }
    case 'closeResult':
      return { ...state, selectedResultId: null }
    case 'clearFilters':
      return {
        ...state,
        searchQuery: '',
        selectedMonth: getCurrentMonthKey(),
        typeFilter: action.typeFilter,
        statusFilter: 'all',
      }
    case 'setSearchQuery':
      return { ...state, searchQuery: action.value }
    case 'setSelectedMonth':
      return { ...state, selectedMonth: action.value }
    case 'setTypeFilter':
      return { ...state, typeFilter: action.value }
    case 'setStatusFilter':
      return { ...state, statusFilter: action.value }
    case 'toggleVisitSort':
      return { ...state, visitSort: toggleSort(state.visitSort, action.key) }
    case 'toggleResultSort':
      return { ...state, resultSort: toggleSort(state.resultSort, action.key) }
    default:
      return state
  }
}

export function buildChecklistSearch(
  search: string,
  updates: { result?: string | null; status?: ChecklistStatusFilter | null; tab?: ChecklistTab },
) {
  const params = new URLSearchParams(search)
  const usesCommandOverlay = params.has('overlay')

  if (updates.tab) {
    params.set(usesCommandOverlay ? 'workflowTab' : 'tab', updates.tab)
    if (usesCommandOverlay) params.delete('tab')
  }

  if (updates.result !== undefined) {
    if (updates.result === null || updates.result.trim().length === 0) {
      params.delete(usesCommandOverlay ? 'checklistInstanceId' : 'result')
      if (usesCommandOverlay) {
        if (params.has('storeId')) params.set('overlay', 'workflow')
        else params.delete('overlay')
      }
    } else {
      if (usesCommandOverlay) {
        const returnStoreId = params.get('storeId')
        const returnTab = params.get('workflowTab')
        const returnStatus = params.get('workflowStatus')
        params.delete('overlay')
        params.delete('checklistInstanceId')
        params.delete('storeId')
        params.delete('workflowTab')
        params.delete('workflowStatus')
        params.set('overlay', 'result')
        params.set('checklistInstanceId', updates.result)
        if (returnStoreId) params.set('storeId', returnStoreId)
        if (returnTab) params.set('workflowTab', returnTab)
        if (returnStatus) params.set('workflowStatus', returnStatus)
        params.delete('result')
      } else {
        params.set('result', updates.result)
      }
    }
  }

  if (updates.status !== undefined) {
    if (updates.status === null || updates.status === 'all') {
      params.delete(usesCommandOverlay ? 'workflowStatus' : 'status')
    } else {
      params.set(usesCommandOverlay ? 'workflowStatus' : 'status', updates.status)
    }
    if (usesCommandOverlay) params.delete('status')
  }

  const nextSearch = params.toString()
  return nextSearch ? `?${nextSearch}` : ''
}

function resolveChecklistTabFromSearch(search: string): ChecklistTab {
  const params = new URLSearchParams(search)
  const tab = params.get('workflowTab') ?? params.get('tab')
  return tab === 'inbox' || tab === 'history' || tab === 'plan' || tab === 'visits'
    ? tab
    : 'visits'
}

function resolveChecklistStatusFromSearch(search: string): ChecklistStatusFilter {
  const params = new URLSearchParams(search)
  if (params.get('tab') === 'incomplete') return 'missing_or_draft'

  const status = params.get('workflowStatus') ?? params.get('status')
  return status === 'missing' ||
    status === 'draft' ||
    status === 'missing_or_draft' ||
    status === 'completed' ||
    status === 'pending' ||
    status === 'acknowledged'
    ? status
    : 'all'
}

function resolveChecklistResultFromSearch(search: string) {
  const params = new URLSearchParams(search)
  const result = params.get('checklistInstanceId') ?? params.get('result')
  return result && result.trim().length > 0 ? result : null
}

function takeChecklistCommandNotice() {
  if (typeof window === 'undefined') return null
  const notice = window.sessionStorage.getItem(CHECKLIST_COMMAND_NOTICE_KEY)
  if (notice) {
    window.sessionStorage.removeItem(CHECKLIST_COMMAND_NOTICE_KEY)
  }
  return notice
}

export function storeChecklistCommandNotice(message: string) {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(CHECKLIST_COMMAND_NOTICE_KEY, message)
}

function getCurrentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function toggleSort(current: ChecklistSort, key: ChecklistSortKey): ChecklistSort {
  if (current.key !== key) {
    return { key, direction: key === 'store' || key === 'status' ? 'asc' : 'desc' }
  }

  return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
}
