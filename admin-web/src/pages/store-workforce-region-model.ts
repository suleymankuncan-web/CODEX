import type { StoreEmployee, StoreHeadcountGap } from '../features/workforce/api'
import type { deriveWorkforceSummary } from './store-workforce-model'

export type RegionStoreRow = {
  storeId: string
  storeLabel: string
  employees: StoreEmployee[]
  headcountGap: StoreHeadcountGap
  isLoading: boolean
  isError: boolean
  summary: ReturnType<typeof deriveWorkforceSummary>
}
