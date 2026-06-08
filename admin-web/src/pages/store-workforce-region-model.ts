import type { StoreEmployee } from '../features/workforce/api'
import type { deriveWorkforceSummary } from './store-workforce-model'

export type RegionStoreRow = {
  storeId: string
  storeLabel: string
  employees: StoreEmployee[]
  isLoading: boolean
  isError: boolean
  summary: ReturnType<typeof deriveWorkforceSummary>
}
