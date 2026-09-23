import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRankings } from '../features/reports/api'
import { transientQueryRetryOptions } from '../lib/query-retry'
import type { StoreKpiHighlightsPageModel } from './store-kpi-highlights-model'
import { StoreKpisManagerOverview } from './store-kpis-manager-overview'
import { StoreErrorState } from './store-surface-primitives'

// All roles use the same store detail; only the authorized data scope varies.
export function StoreKpisStoreDetail({ model }: { model: StoreKpiHighlightsPageModel }) {
  const [personnelPageState, setPersonnelPageState] = useState({ page: 0, scopeKey: '' })
  const [personnelSearchState, setPersonnelSearchState] = useState({ value: '', scopeKey: '' })
  const personnelPageSize = 50
  const storeId = model.effectiveStoreId ?? ''
  const periodStart = model.liveSummary?.period?.periodStart ?? model.livePeriodStart
  const personnelScopeKey = `${storeId}|${model.livePeriodType}|${periodStart || 'latest-monthly'}|${model.kpiDateRangeEnd}`
  const personnelSearch = personnelSearchState.scopeKey === personnelScopeKey ? personnelSearchState.value : ''
  const personnelPage = personnelPageState.scopeKey === personnelScopeKey ? personnelPageState.page : 0
  const setPersonnelPage = (page: number) => setPersonnelPageState({ page, scopeKey: personnelScopeKey })
  const setPersonnelSearch = (value: string) => {
    setPersonnelPageState({ page: 0, scopeKey: personnelScopeKey })
    setPersonnelSearchState({ value, scopeKey: personnelScopeKey })
  }
  const personnelRankingQuery = useQuery({
    queryKey: ['store-kpis-personnel-ranking', storeId || 'no-store', periodStart || 'latest-monthly', personnelSearch.trim(), personnelPage, personnelPageSize, model.livePeriodType, model.kpiDateRangeEnd],
    queryFn: () =>
      getRankings({
        periodType: model.livePeriodType,
        ...(model.kpiDateRangeEnd ? { periodEnd: model.kpiDateRangeEnd } : {}),
        ...(periodStart ? { periodStart } : {}),
        ...(storeId ? { storeId } : {}),
        ...(personnelSearch.trim() ? { search: personnelSearch.trim() } : {}),
        limit: personnelPageSize,
        offset: personnelPage * personnelPageSize,
        managedPersonnelLimit: personnelPageSize,
        managedPersonnelOffset: personnelPage * personnelPageSize,
      }),
    enabled: model.reportingAllowed && model.viewMode === 'live' && Boolean(storeId),
    ...transientQueryRetryOptions,
    placeholderData: (previous, query) =>
      query?.queryKey[1] === (storeId || 'no-store') &&
      query.queryKey[2] === (periodStart || 'latest-monthly') &&
      query.queryKey[3] === personnelSearch.trim() &&
      query.queryKey[6] === model.livePeriodType && query.queryKey[7] === model.kpiDateRangeEnd ? previous : undefined,
  })
  const personnelLeaderboard = personnelRankingQuery.data?.personnelLeaderboard
  const storeFilteredPersonnelRows = personnelLeaderboard?.items ?? []
  const managedPersonnelRows = personnelLeaderboard?.managedStorePersonnel ?? []
  const useServerPersonnelPage =
    model.hasGlobalDetailDefault || model.storeKpiSurfaceMode === 'regionStoreDetail' || model.isReportViewerStoreDetail
  const personnelRows =
    model.viewMode === 'live'
      ? useServerPersonnelPage
        ? storeFilteredPersonnelRows
        : managedPersonnelRows
      : []
  const personnelTotal = useServerPersonnelPage
    ? personnelLeaderboard?.meta.total ?? 0
    : personnelLeaderboard?.managedStorePersonnelMeta?.total ?? managedPersonnelRows.length
  const personnelOffset = useServerPersonnelPage
    ? personnelLeaderboard?.meta.offset
    : personnelLeaderboard?.managedStorePersonnelMeta?.offset
  const displayedPersonnelPage = personnelOffset === undefined ? personnelPage : Math.floor(personnelOffset / personnelPageSize)
  const failedQueries = [model.configQuery, model.liveKpiQuery, model.dailySnapshotQuery, model.closedKpiQuery]
    .filter(query => query.isError && Boolean(query.data))
  return <StoreKpisManagerOverview
    key={`${storeId}|${periodStart}|${model.kpiDateRangeEnd}|${model.viewMode}`}
    model={model}
    personnel={{ rows: personnelRows, total: personnelTotal, page: displayedPersonnelPage, pageSize: personnelPageSize, search: personnelSearch, onSearchChange: setPersonnelSearch, onPageChange: setPersonnelPage, query: personnelRankingQuery }}
    backgroundError={failedQueries.length ? <StoreErrorState
      title={model.t('storeKpis.rowsErrorTitle')}
      description={model.t('storeKpis.backgroundError')}
      action={{ label: model.t('storeKpis.retry'), onClick: () => void Promise.all(failedQueries.map(query => query.refetch())) }}
    /> : null}
  />
}
