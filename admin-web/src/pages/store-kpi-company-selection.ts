import { useQuery } from '@tanstack/react-query'
import type { AuthSessionSummary } from '../features/auth/api'
import { getOrgStores, type OrgStore } from '../features/workforce/api'
import { transientQueryRetryOptions } from '../lib/query-retry'

export type StoreKpiStoreOption = {
  storeId: string
  storeName: string
  storeCode: string
}

export function resolveCompanyStoreSelection(input: {
  isReportViewer: boolean
  selectedStoreId: string
  primaryStoreId?: string | undefined
  stores: OrgStore[]
}) {
  const options: StoreKpiStoreOption[] = input.stores
    .filter((store) => Boolean(store.store_id))
    .map((store) => ({
      storeCode: store.store_code,
      storeId: store.store_id,
      storeName: store.store_name || store.store_code || store.store_id,
    }))
  const selectedOption = options.find((option) => option.storeId === input.selectedStoreId)

  if (!input.isReportViewer) {
    return {
      effectiveStoreId: input.selectedStoreId || input.primaryStoreId,
      options,
      selectedStoreId: input.selectedStoreId,
    }
  }

  const selectedStoreId = selectedOption?.storeId ?? options[0]?.storeId ?? ''
  return {
    effectiveStoreId: selectedStoreId || undefined,
    options,
    selectedStoreId,
  }
}

export function useReportViewerStoreSelection(input: {
  authSummary: AuthSessionSummary | null
  primaryStoreId?: string | undefined
  reportingAllowed: boolean
  searchParams: URLSearchParams
  setSearchParams: (nextParams: URLSearchParams, options?: { replace?: boolean }) => void
}) {
  const roleCodes = input.authSummary?.user.roleCodes ?? []
  const isReportViewer =
    roleCodes.includes('REPORT_VIEWER') &&
    !roleCodes.includes('STORE_MANAGER') &&
    !roleCodes.includes('REGION_MANAGER') &&
    !roleCodes.includes('SUPER_ADMIN')
  const readCompanyIds = input.authSummary?.user.readScope.companyIds ?? input.authSummary?.user.scope.companyIds ?? []
  const companyStoreQuery = useQuery({
    queryKey: ['store-kpi-company-stores', readCompanyIds.join('|')],
    queryFn: getOrgStores,
    enabled: input.reportingAllowed && isReportViewer,
    ...transientQueryRetryOptions,
  })
  const rawSelectedStoreId = input.searchParams.get('storeId')?.trim() ?? ''
  const selection = resolveCompanyStoreSelection({
    isReportViewer,
    primaryStoreId: input.primaryStoreId,
    selectedStoreId: rawSelectedStoreId,
    stores: companyStoreQuery.data?.items ?? [],
  })
  const setSelectedStoreId = (value: string) => {
    const nextParams = new URLSearchParams(input.searchParams)
    if (value) nextParams.set('storeId', value)
    else nextParams.delete('storeId')
    input.setSearchParams(nextParams, { replace: true })
  }

  return {
    companyStoreQuery,
    effectiveStoreId: selection.effectiveStoreId,
    isReportViewer,
    selectedStoreId: selection.selectedStoreId,
    setSelectedStoreId,
    storeOptions: selection.options,
    storeSelectionReady: !isReportViewer || companyStoreQuery.isSuccess,
  }
}
