import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { SetURLSearchParams } from 'react-router'
import { getRankings, type RankingSummary } from '../features/reports/api'
import { transientQueryRetryOptions } from '../lib/query-retry'
import { useDebouncedSearchPage } from '../lib/use-debounced-search-page'
import type { useRegionOverviewPeriodModel } from './store-kpis-region-period-model'
import type { StoreKpisRegionSortDirection, StoreKpisRegionSortKey } from './store-kpi-highlights-model'

export function useStoreKpisOverviewQueries(input: {
  activeRoutePeriodStart: string
  isRegionManagerOverview: boolean
  isReportViewerOverview: boolean
  regionManagerUserId: string
  regionPeriodModel: ReturnType<typeof useRegionOverviewPeriodModel>
  reportingAllowed: boolean
  searchParams: URLSearchParams
  setSearchParams: SetURLSearchParams
}) {
  const kpiDateRangeEnd = input.searchParams.get('periodEnd') || ''
  const { page: reportViewerPage, setPage: setReportViewerPage, search: reportViewerManagerSearch, setSearch: setReportViewerManagerSearchState, querySearch: managerQuerySearch } = useDebouncedSearchPage()
  const [reportViewerRiskPage, setReportViewerRiskPage] = useState(0)
  const [reportViewerRiskOnly, setReportViewerRiskOnlyState] = useState(false)
  const { page: regionOverviewPage, setPage: setRegionOverviewPage, search: regionOverviewSearch, setSearch: setRegionOverviewSearchState, querySearch: regionQuerySearch } = useDebouncedSearchPage()
  const [regionOverviewSort, setRegionOverviewSortState] = useState<{
    sortKey: StoreKpisRegionSortKey
    sortDirection: StoreKpisRegionSortDirection
  }>({ sortKey: 'score', sortDirection: 'desc' })
  const reportViewerPageSize = 20
  const regionOverviewPageSize = 50
  const activeReportViewerPeriodStart = input.activeRoutePeriodStart
  const activeRegionOverviewPeriodStart = input.regionPeriodModel.activePeriodStart

  const setReportViewerPeriodStart = (value: string) => {
    setReportViewerPage(0)
    setReportViewerRiskPage(0)
    setReportViewerManagerSearchState('')
    const nextParams = new URLSearchParams(input.searchParams)
    if (value) nextParams.set('periodStart', value)
    else nextParams.delete('periodStart')
    nextParams.delete('periodEnd')
    nextParams.delete('periodType')
    nextParams.delete('storeId')
    input.setSearchParams(nextParams, { replace: true })
  }
  const setKpiDateRange = (start: string, end: string) => {
    setRegionOverviewPage(0); setReportViewerPage(0); setReportViewerRiskPage(0)
    setReportViewerManagerSearchState('')
    const next = new URLSearchParams(input.searchParams)
    next.set('periodStart', start); next.set('periodEnd', end); next.set('periodType', 'daily')
    input.setSearchParams(next, { replace: true })
  }
  const setReportViewerRiskOnly = (value: boolean) => {
    setReportViewerRiskOnlyState(value)
  }
  const setReportViewerManagerSearch = (value: string) => {
    setReportViewerRiskPage(0)
    setReportViewerManagerSearchState(value)
  }
  const setRegionOverviewPeriodStart = (value: string) => {
    setRegionOverviewPage(0)
    input.regionPeriodModel.setPeriodStart(value)
  }
  const setRegionOverviewSearch = (value: string) => {
    setRegionOverviewSearchState(value)
  }
  const setRegionOverviewSort = (
    sortKey: StoreKpisRegionSortKey,
    sortDirection?: StoreKpisRegionSortDirection,
  ) => {
    setRegionOverviewPage(0)
    setRegionOverviewSortState((current) => ({
      sortKey,
      sortDirection:
        sortDirection ??
        (current.sortKey === sortKey && current.sortDirection === 'desc' ? 'asc' : 'desc'),
    }))
  }

  const regionOverviewQuery = useQuery({
    queryKey: ['store-kpis-region-overview', kpiDateRangeEnd || 'monthly', activeRegionOverviewPeriodStart, input.regionManagerUserId, regionQuerySearch, regionOverviewPage, regionOverviewPageSize],
    queryFn: ({ signal }) => getRankings({
      periodType: kpiDateRangeEnd ? 'daily' : 'monthly',
      ...(kpiDateRangeEnd ? { periodEnd: kpiDateRangeEnd } : {}),
      ...(activeRegionOverviewPeriodStart ? { periodStart: activeRegionOverviewPeriodStart } : {}),
      ...(input.regionManagerUserId ? { regionManagerUserId: input.regionManagerUserId } : {}),
      ...(regionQuerySearch ? { search: regionQuerySearch } : {}),
      sortKey: 'score', sortDirection: 'desc', limit: regionOverviewPageSize,
      offset: regionOverviewPage * regionOverviewPageSize,
    }, { signal }),
    enabled: input.reportingAllowed && input.isRegionManagerOverview && Boolean(input.regionManagerUserId) && Boolean(activeRegionOverviewPeriodStart),
    ...transientQueryRetryOptions,
    placeholderData: (previous: RankingSummary | undefined, query) =>
      query?.queryKey[1] === (kpiDateRangeEnd || 'monthly') && query.queryKey[2] === activeRegionOverviewPeriodStart && query.queryKey[3] === input.regionManagerUserId ? previous : undefined,
  })
  const regionOverviewSummaryQuery = useQuery({
    queryKey: ['store-kpis-region-overview', kpiDateRangeEnd || 'monthly', activeRegionOverviewPeriodStart, input.regionManagerUserId, '', 0, regionOverviewPageSize],
    queryFn: ({ signal }) => getRankings({
      periodType: kpiDateRangeEnd ? 'daily' : 'monthly',
      ...(kpiDateRangeEnd ? { periodEnd: kpiDateRangeEnd } : {}),
      ...(activeRegionOverviewPeriodStart ? { periodStart: activeRegionOverviewPeriodStart } : {}),
      ...(input.regionManagerUserId ? { regionManagerUserId: input.regionManagerUserId } : {}),
      sortKey: 'score', sortDirection: 'desc', limit: regionOverviewPageSize, offset: 0,
    }, { signal }),
    enabled: input.reportingAllowed && input.isRegionManagerOverview && Boolean(input.regionManagerUserId) && Boolean(activeRegionOverviewPeriodStart),
    ...transientQueryRetryOptions,
  })
  const reportViewerOverviewQuery = useQuery({
    queryKey: ['store-kpis-company-overview', kpiDateRangeEnd || 'monthly', activeReportViewerPeriodStart || 'latest', input.regionManagerUserId, managerQuerySearch, reportViewerPage, reportViewerRiskPage, reportViewerPageSize],
    queryFn: ({ signal }) => getRankings({
      periodType: kpiDateRangeEnd ? 'daily' : 'monthly',
      ...(kpiDateRangeEnd ? { periodEnd: kpiDateRangeEnd } : {}),
      ...(activeReportViewerPeriodStart ? { periodStart: activeReportViewerPeriodStart } : {}),
      ...(managerQuerySearch ? { regionManagerSearch: managerQuerySearch } : {}),
      sortKey: 'score', sortDirection: 'desc', limit: 1, offset: 0,
      regionManagerLimit: reportViewerPageSize,
      regionManagerOffset: reportViewerPage * reportViewerPageSize,
      regionManagerRiskOffset: reportViewerRiskPage * reportViewerPageSize,
    }, { signal }),
    enabled: input.reportingAllowed && input.isReportViewerOverview,
    ...transientQueryRetryOptions,
    placeholderData: (previous: RankingSummary | undefined, query) =>
      query?.queryKey[1] === (kpiDateRangeEnd || 'monthly') && query.queryKey[2] === (activeReportViewerPeriodStart || 'latest') && query.queryKey[3] === input.regionManagerUserId ? previous : undefined,
  })

  return {
    activeRegionOverviewPeriodStart,
    activeReportViewerPeriodStart,
    effectiveRegionOverviewQuery: activeRegionOverviewPeriodStart ? regionOverviewQuery : input.regionPeriodModel.seedQuery,
    kpiDateRangeEnd, setKpiDateRange,
    regionOverviewPage, regionOverviewPageSize, regionOverviewSearch, regionOverviewSort,
    regionOverviewSummaryQuery,
    reportViewerOverviewQuery, reportViewerPage, reportViewerPageSize, reportViewerManagerSearch, reportViewerRiskOnly, reportViewerRiskPage,
    setRegionOverviewPage, setRegionOverviewPeriodStart, setRegionOverviewSearch, setRegionOverviewSort,
    setReportViewerPage, setReportViewerPeriodStart, setReportViewerManagerSearch, setReportViewerRiskOnly, setReportViewerRiskPage,
  }
}
