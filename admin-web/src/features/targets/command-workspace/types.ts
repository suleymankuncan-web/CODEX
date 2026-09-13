import type { TargetWorkspace } from '../api'

export type TargetCommandWorkspace = TargetWorkspace
export type TargetCommandCompany = TargetWorkspace['companies'][number]
export type TargetCommandRegion = TargetCommandCompany['regions'][number]
export type TargetCommandStore = TargetCommandRegion['stores'][number]
export type TargetCommandStatusFilter = 'all' | 'approved_all' | TargetCommandStore['status']
export type TargetCommandSortKey = 'store' | 'target' | 'distributed' | 'personnel' | 'status'
export type TargetCommandSortState = {
  key: TargetCommandSortKey
  direction: 'ascending' | 'descending'
}

export type TargetManagerSelection = {
  items: import('@/features/org/region-manager-directory').RegionManagerDirectoryItem[]
  value: string
  onChange: (value: string) => void
  loading: boolean
  error: boolean
  onRetry: () => void
}
