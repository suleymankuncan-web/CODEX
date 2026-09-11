import type { MyPerformanceSummary } from '../features/reports/api'

/** Shift calendar months with day clamping (31 March -> 28/29 February). */
export function previousCalendarMonth(date: string) {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return ''
  const lastDay = new Date(Date.UTC(year, month - 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, month - 2, Math.min(day, lastDay))).toISOString().slice(0, 10)
}

export function previousPersonnelPeriod(period: MyPerformanceSummary['period']) {
  if (!period) return null
  const start = period.periodStart.slice(0, 10)
  const end = period.periodEnd.slice(0, 10)
  const periodStart = previousCalendarMonth(start)
  const fullMonth = start.endsWith('-01') && end === new Date(Date.UTC(
    Number(start.slice(0, 4)), Number(start.slice(5, 7)), 0,
  )).toISOString().slice(0, 10)
  return {
    periodType: fullMonth ? 'monthly' as const : 'daily' as const,
    periodStart,
    periodEnd: fullMonth ? new Date(Date.UTC(
      Number(periodStart.slice(0, 4)), Number(periodStart.slice(5, 7)), 0,
    )).toISOString().slice(0, 10) : previousCalendarMonth(end),
  }
}

export function matchingPreviousPerformance(current: MyPerformanceSummary, previous?: MyPerformanceSummary) {
  const expected = previousPersonnelPeriod(current.period)
  return expected && previous?.employee?.employeeId === current.employee?.employeeId &&
    previous?.period?.periodStart.slice(0, 10) === expected.periodStart &&
    previous.period.periodEnd.slice(0, 10) === expected.periodEnd ? previous : undefined
}
