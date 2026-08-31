const PAGE_SIZE = 12

export type SnapshotSortValue = 'priority' | 'generated-desc' | 'reruns' | 'type'
export type SnapshotTypeFilter = '' | 'daily' | 'weekly' | 'monthly' | 'payroll' | 'compliance'
export type SnapshotRunStatusFilter = '' | 'queued' | 'running' | 'completed' | 'failed'

export type SnapshotsDashboardPageState = {
  search: string
  sortBy: SnapshotSortValue
  offset: number
  snapshotTypeFilter: SnapshotTypeFilter
  runStatusFilter: SnapshotRunStatusFilter
  feedback: string | null
}

export type SnapshotsDashboardPageAction =
  | { type: 'setSearch'; value: string }
  | { type: 'setSortBy'; value: SnapshotSortValue }
  | { type: 'setSnapshotTypeFilter'; value: SnapshotTypeFilter }
  | { type: 'setRunStatusFilter'; value: SnapshotRunStatusFilter }
  | { type: 'setFeedback'; value: string | null }
  | { type: 'previousPage' }
  | { type: 'nextPage' }
  | { type: 'clearFilters' }

export const initialSnapshotsDashboardPageState: SnapshotsDashboardPageState = {
  search: '',
  sortBy: 'priority',
  offset: 0,
  snapshotTypeFilter: '',
  runStatusFilter: '',
  feedback: null,
}

export function snapshotsDashboardPageReducer(
  state: SnapshotsDashboardPageState,
  action: SnapshotsDashboardPageAction,
): SnapshotsDashboardPageState {
  switch (action.type) {
    case 'setSearch':
      return { ...state, search: action.value, offset: 0 }
    case 'setSortBy':
      return { ...state, sortBy: action.value }
    case 'setSnapshotTypeFilter':
      return { ...state, offset: 0, snapshotTypeFilter: action.value }
    case 'setRunStatusFilter':
      return { ...state, offset: 0, runStatusFilter: action.value }
    case 'setFeedback':
      return { ...state, feedback: action.value }
    case 'previousPage':
      return { ...state, offset: Math.max(0, state.offset - PAGE_SIZE) }
    case 'nextPage':
      return { ...state, offset: state.offset + PAGE_SIZE }
    case 'clearFilters':
      return {
        ...state,
        search: '',
        offset: 0,
        snapshotTypeFilter: '',
        runStatusFilter: '',
      }
    default:
      return state
  }
}
