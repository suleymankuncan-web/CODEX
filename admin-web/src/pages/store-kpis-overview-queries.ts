import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { SetURLSearchParams } from 'react-router'
import { getRankings, type RankingSummary } from '../features/reports/api'
import { transientQueryRetryOptions } from '../lib/query-retry'
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
  const [reportViewerPeriodStart, setReportViewerPeriodStartState] = useState('')
  const queryClient = useQueryClient()
  const [reportViewerPage, setReportViewerPage] = useState(0)
  const [reportViewerRiskPage, setReportViewerRiskPage] = useState(0)
  const [reportViewerRiskOnly, setReportViewerRiskOnlyState] = useState(false)
  const [regionOverviewPage, setRegionOverviewPage] = useState(0)
  const [regionOverviewSort, setRegionOverviewSortState] = useState<{
    sortKey: StoreKpisRegionSortKey
    sortDirection: StoreKpisRegionSortDirection
  }>({ sortKey: 'score', sortDirection: 'desc' })
  const reportViewerPageSize = 20
  const regionOverviewPageSize = 50
  const activeReportViewerPeriodStart = reportViewerPeriodStart || input.activeRoutePeriodStart
  const activeRegionOverviewPeriodStart = input.regionPeriodModel.activePeriodStart

  const setReportViewerPeriodStart = (value: string) => {
    setReportViewerPeriodStartState(value)
    setReportViewerPage(0)
    setReportViewerRiskPage(0)
    const nextParams = new URLSearchParams(input.searchParams)
    if (value) nextParams.set('periodStart', value)
    else nextParams.delete('periodStart')
    nextParams.delete('storeId')
    input.setSearchParams(nextParams, { replace: true })
  }
  const setReportViewerRiskOnly = (value: boolean) => {
    setReportViewerRiskOnlyState(value)
  }
  const setRegionOverviewPeriodStart = (value: string) => {
    setRegionOverviewPage(0)
    input.regionPeriodModel.setPeriodStart(value)
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
    queryKey: ['store-kpis-region-overview', 'monthly', activeRegionOverviewPeriodStart, input.regionManagerUserId, regionOverviewPage, regionOverviewPageSize],
    queryFn: () => getRankings({
      periodType: 'monthly',
      ...(activeRegionOverviewPeriodStart ? { periodStart: activeRegionOverviewPeriodStart } : {}),
      ...(input.regionManagerUserId ? { regionManagerUserId: input.regionManagerUserId } : {}),
      sortKey: 'score', sortDirection: 'desc', limit: regionOverviewPageSize,
      offset: regionOverviewPage * regionOverviewPageSize,
    }),
    enabled: input.reportingAllowed && input.isRegionManagerOverview && Boolean(input.regionManagerUserId) && Boolean(activeRegionOverviewPeriodStart),
    ...transientQueryRetryOptions,
    initialData: () => queryClient.getQueriesData<RankingSummary>({
      queryKey: ['store-kpis-region-overview', 'monthly', activeRegionOverviewPeriodStart],
    }).find(([, data]) => data)?.[1],
    initialDataUpdatedAt: 0,
  })
  const reportViewerOverviewQuery = useQuery({
    queryKey: ['store-kpis-company-overview', 'monthly', activeReportViewerPeriodStart || 'latest', reportViewerPage, reportViewerRiskPage, reportViewerPageSize],
    queryFn: () => getRankings({
      periodType: 'monthly',
      ...(activeReportViewerPeriodStart ? { periodStart: activeReportViewerPeriodStart } : {}),
      sortKey: 'score', sortDirection: 'desc', limit: 1, offset: 0,
      regionManagerLimit: reportViewerPageSize,
      regionManagerOffset: reportViewerPage * reportViewerPageSize,
      regionManagerRiskOffset: reportViewerRiskPage * reportViewerPageSize,
    }),
    enabled: input.reportingAllowed && input.isReportViewerOverview,
    ...transientQueryRetryOptions,
    initialData: () => queryClient.getQueriesData<RankingSummary>({
      queryKey: ['store-kpis-company-overview', 'monthly', activeReportViewerPeriodStart || 'latest'],
    }).find(([, data]) => data)?.[1],
    initialDataUpdatedAt: 0,
  })

  return {
    activeRegionOverviewPeriodStart,
    activeReportViewerPeriodStart,
    effectiveRegionOverviewQuery: activeRegionOverviewPeriodStart ? regionOverviewQuery : input.regionPeriodModel.seedQuery,
    regionOverviewPage, regionOverviewPageSize, regionOverviewSort,
    reportViewerOverviewQuery, reportViewerPage, reportViewerPageSize, reportViewerRiskOnly, reportViewerRiskPage,
    setRegionOverviewPage, setRegionOverviewPeriodStart, setRegionOverviewSort,
    setReportViewerPage, setReportViewerPeriodStart, setReportViewerRiskOnly, setReportViewerRiskPage,
  }
}
