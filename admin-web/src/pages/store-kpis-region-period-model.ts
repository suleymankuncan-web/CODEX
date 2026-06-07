import { useQuery } from '@tanstack/react-query'
import { getRankings } from '../features/reports/api'
import { transientQueryRetryOptions } from '../lib/query-retry'

type RankingAvailablePeriod = {
  periodType: string
  periodStart: string
}

type SetSearchParams = (
  nextInit: URLSearchParams,
  navigateOptions?: { replace?: boolean },
) => void

export function useRegionOverviewPeriodModel(input: {
  isRegionManagerOverview: boolean
  regionManagerUserId: string
  reportingAllowed: boolean
  routePeriodStart: string
  searchParams: URLSearchParams
  setSearchParams: SetSearchParams
}) {
  const seedQuery = useQuery({
    queryKey: [
      'store-kpis-region-overview',
      'monthly',
      'period-seed',
      input.regionManagerUserId,
      0,
    ],
    queryFn: () =>
      getRankings({
        periodType: 'monthly',
        ...(input.regionManagerUserId ? { regionManagerUserId: input.regionManagerUserId } : {}),
        limit: 100,
        offset: 0,
      }),
    enabled:
      input.reportingAllowed &&
      input.isRegionManagerOverview &&
      Boolean(input.regionManagerUserId) &&
      input.routePeriodStart.length === 0,
    ...transientQueryRetryOptions,
  })
  const latestMonthlyPeriodStart = getLatestMonthlyPeriodStart(seedQuery.data?.availablePeriods)
  const activePeriodStart = input.routePeriodStart || latestMonthlyPeriodStart

  const setPeriodStart = (value: string) => {
    const nextParams = new URLSearchParams(input.searchParams)
    if (value) {
      nextParams.set('periodStart', value)
    } else {
      nextParams.delete('periodStart')
    }
    input.setSearchParams(nextParams, { replace: true })
  }

  return {
    activePeriodStart,
    seedQuery,
    setPeriodStart,
  }
}

function getLatestMonthlyPeriodStart(periods: readonly RankingAvailablePeriod[] | undefined) {
  return (
    periods
      ?.filter((period) => period.periodType === 'monthly' && period.periodStart)
      .map((period) => period.periodStart)
      .sort((left, right) => right.localeCompare(left))[0] ?? ''
  )
}
