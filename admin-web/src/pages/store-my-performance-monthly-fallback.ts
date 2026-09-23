import type { MyPerformanceQueryInput, MyPerformanceSummary } from '../features/reports/api'

type PerformanceFetcher = (input: MyPerformanceQueryInput) => Promise<MyPerformanceSummary>

function monthKey(value: string | undefined) {
  const match = /^(\d{4})-(\d{2})-\d{2}/.exec(value ?? '')
  return match && Number(match[2]) >= 1 && Number(match[2]) <= 12 ? `${match[1]}-${match[2]}` : ''
}

function monthEnd(key: string) {
  return new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0)).toISOString().slice(0, 10)
}

/** The monthly leaderboard uses daily facts when a monthly KPI row is absent or older. */
export async function fetchPerformanceWithDailyMonthFallback(
  input: MyPerformanceQueryInput,
  fetchPerformance: PerformanceFetcher,
): Promise<MyPerformanceSummary> {
  const primary = await fetchPerformance(input)
  if (input.mode !== 'live' || input.periodType !== 'monthly' || input.periodEnd) return primary

  const dailyMonths = [...new Set(primary.availablePeriods
    .filter(period => period.periodType === 'daily')
    .map(period => monthKey(period.periodStart))
    .filter(Boolean))].sort()
  const requestedMonth = input.periodStart ? monthKey(input.periodStart) : ''
  const candidateMonth = requestedMonth || dailyMonths.at(-1) || ''
  if (!candidateMonth || !dailyMonths.includes(candidateMonth)) return primary

  const primaryMonth = monthKey(primary.period?.periodStart)
  if (primaryMonth && primaryMonth > candidateMonth) return primary

  const periodStart = `${candidateMonth}-01`
  const periodEnd = monthEnd(candidateMonth)
  const daily = await fetchPerformance({
    ...input,
    periodType: 'daily',
    periodStart,
    periodEnd,
  })
  if (
    daily.period?.periodStart.slice(0, 10) !== periodStart ||
    daily.period?.periodEnd.slice(0, 10) !== periodEnd ||
    !daily.metrics.some(metric => metric.actualValue != null)
  ) return primary

  return daily
}
