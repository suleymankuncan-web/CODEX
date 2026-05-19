import type { MobileChecklistToday } from '../features/checklists/api'

export type ChecklistCoverageRow = {
  store: MobileChecklistToday['stores'][number]
  template: MobileChecklistToday['templates'][number]
  active?: MobileChecklistToday['activeInstances'][number]
  summary?: MobileChecklistToday['monthlySummaries'][number]
  completedCount: number
}

export type ChecklistStoreVisitRow = {
  store: MobileChecklistToday['stores'][number]
  bm?: ChecklistCoverageRow
  vm?: ChecklistCoverageRow
  primary: ChecklistCoverageRow
}

export type ChecklistSession = ChecklistCoverageRow
export type ChecklistTone = 'calm' | 'warning' | 'accent' | 'danger' | 'neutral'
export type ChecklistTypeFilter = 'all' | 'BM_STORE_VISIT' | 'VM_STORE_VISIT'
export type ChecklistStatusFilter = 'all' | 'missing' | 'draft' | 'completed' | 'pending' | 'acknowledged'
export type ChecklistSortKey = 'priority' | 'store' | 'score' | 'date' | 'status'
export type ChecklistSortDirection = 'asc' | 'desc'
export type ChecklistSort = { key: ChecklistSortKey; direction: ChecklistSortDirection }
export type ChecklistTab = 'visits' | 'inbox' | 'history'
export type ChecklistActiveInstance = MobileChecklistToday['activeInstances'][number]
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
  sessionDirty: boolean
}

export type StoreChecklistsAction =
  | { type: 'setAckNotice'; message: string | null }
  | { type: 'acknowledgeSucceeded'; checklistInstanceId: string }
  | { type: 'startVisitSucceeded'; rowKey: string; instance: ChecklistActiveInstance }
  | { type: 'saveResponseSucceeded' }
  | { type: 'completeVisitSucceeded'; checklistInstanceId: string }
  | {
      type: 'openSession'
      rowKey: string
      scores: Record<string, number>
      comments: Record<string, string>
    }
  | { type: 'resetSessionDrafts' }
  | { type: 'closeSession' }
  | { type: 'completeVisitSubmitted' }
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
    selectedMonth: 'all',
    typeFilter: 'all',
    statusFilter: 'all',
    activeTab: resolveChecklistTabFromSearch(search),
    visitSort: { key: 'priority', direction: 'desc' },
    resultSort: { key: 'date', direction: 'desc' },
    localActiveInstances: {},
    sessionDirty: false,
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
    case 'saveResponseSucceeded':
      return { ...state, sessionDirty: false }
    case 'completeVisitSucceeded':
      return {
        ...state,
        localActiveInstances: Object.fromEntries(
          Object.entries(state.localActiveInstances).filter(
            ([, instance]) => instance.checklistInstanceId !== action.checklistInstanceId,
          ),
        ),
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
    case 'completeVisitSubmitted':
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
        selectedMonth: 'all',
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
  updates: { result?: string | null; tab?: ChecklistTab },
) {
  const params = new URLSearchParams(search)

  if (updates.tab) {
    params.set('tab', updates.tab)
  }

  if (updates.result !== undefined) {
    if (updates.result === null || updates.result.trim().length === 0) {
      params.delete('result')
    } else {
      params.set('result', updates.result)
    }
  }

  const nextSearch = params.toString()
  return nextSearch ? `?${nextSearch}` : ''
}

function resolveChecklistTabFromSearch(search: string): ChecklistTab {
  const tab = new URLSearchParams(search).get('tab')
  return tab === 'inbox' || tab === 'history' || tab === 'visits' ? tab : 'visits'
}

function resolveChecklistResultFromSearch(search: string) {
  const result = new URLSearchParams(search).get('result')
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

function toggleSort(current: ChecklistSort, key: ChecklistSortKey): ChecklistSort {
  if (current.key !== key) {
    return { key, direction: key === 'store' || key === 'status' ? 'asc' : 'desc' }
  }

  return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
}
