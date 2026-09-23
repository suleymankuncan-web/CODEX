import { describe, expect, test, vi } from 'vitest'
import type { MyPerformanceSummary } from '../features/reports/api'
import { fetchPerformanceWithDailyMonthFallback } from './store-my-performance-monthly-fallback'

function summary(input: {
  period?: { periodStart: string; periodEnd: string } | null
  dailyDates?: string[]
  actualValue?: number | null
}): MyPerformanceSummary {
  return {
    period: input.period ?? null,
    availablePeriods: (input.dailyDates ?? []).map(date => ({ periodType: 'daily', periodStart: date, periodEnd: date })),
    metrics: [{ code: 'ATV', actualValue: input.actualValue ?? null }],
  } as MyPerformanceSummary
}

describe('live monthly performance from daily facts', () => {
  test('opens an explicitly selected September month from daily personnel data', async () => {
    const emptyMonth = summary({ dailyDates: ['2026-09-13'] })
    const september = summary({ period: { periodStart: '2026-09-01', periodEnd: '2026-09-30' }, actualValue: 4255.51 })
    const fetch = vi.fn().mockResolvedValueOnce(emptyMonth).mockResolvedValueOnce(september)

    await expect(fetchPerformanceWithDailyMonthFallback({ mode: 'live', periodType: 'monthly', periodStart: '2026-09-01' }, fetch)).resolves.toBe(september)
    expect(fetch).toHaveBeenNthCalledWith(2, {
      mode: 'live', periodType: 'daily', periodStart: '2026-09-01', periodEnd: '2026-09-30',
    })
  })

  test('prefers a newer daily-backed month over an older monthly KPI row', async () => {
    const august = summary({ period: { periodStart: '2026-08-01', periodEnd: '2026-08-31' }, dailyDates: ['2026-09-13'], actualValue: 100 })
    const september = summary({ period: { periodStart: '2026-09-01', periodEnd: '2026-09-30' }, actualValue: 200 })
    const fetch = vi.fn().mockResolvedValueOnce(august).mockResolvedValueOnce(september)

    await expect(fetchPerformanceWithDailyMonthFallback({ mode: 'live', periodType: 'monthly' }, fetch)).resolves.toBe(september)
  })

  test('keeps an empty selected month empty and does not substitute another month', async () => {
    const empty = summary({ dailyDates: ['2026-09-13'] })
    const fetch = vi.fn().mockResolvedValue(empty)

    await expect(fetchPerformanceWithDailyMonthFallback({ mode: 'live', periodType: 'monthly', periodStart: '2026-10-01' }, fetch)).resolves.toBe(empty)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  test('does not replace a recorded month with an empty daily aggregate', async () => {
    const recorded = summary({ period: { periodStart: '2026-09-01', periodEnd: '2026-09-30' }, dailyDates: ['2026-09-13'], actualValue: 100 })
    const emptyAggregate = summary({ period: { periodStart: '2026-09-01', periodEnd: '2026-09-30' } })
    const fetch = vi.fn().mockResolvedValueOnce(recorded).mockResolvedValueOnce(emptyAggregate)

    await expect(fetchPerformanceWithDailyMonthFallback({ mode: 'live', periodType: 'monthly', periodStart: '2026-09-01' }, fetch)).resolves.toBe(recorded)
  })

  test('keeps the monthly response when the optional daily aggregate request fails', async () => {
    const recorded = summary({ period: { periodStart: '2026-09-01', periodEnd: '2026-09-30' }, dailyDates: ['2026-09-13'], actualValue: 100 })
    const fetch = vi.fn().mockResolvedValueOnce(recorded).mockRejectedValueOnce(new Error('temporary daily read failure'))

    await expect(fetchPerformanceWithDailyMonthFallback({ mode: 'live', periodType: 'monthly', periodStart: '2026-09-01' }, fetch)).resolves.toBe(recorded)
  })

  test('leaves closed snapshots and exact daily periods unchanged', async () => {
    const result = summary({ period: { periodStart: '2026-09-13', periodEnd: '2026-09-13' }, dailyDates: ['2026-09-13'] })
    const fetch = vi.fn().mockResolvedValue(result)

    await fetchPerformanceWithDailyMonthFallback({ mode: 'closed', snapshotDate: '2026-09-13' }, fetch)
    await fetchPerformanceWithDailyMonthFallback({ mode: 'live', periodType: 'daily', periodStart: '2026-09-13' }, fetch)
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
