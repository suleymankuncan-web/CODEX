import { describe, expect, test } from 'vitest'
import type { MyPerformanceSummary } from '../features/reports/api'
import { previousCalendarMonth, previousPersonnelPeriod, matchingPreviousPerformance } from './personnel-period-comparison'
import { createStoreMyPerformancePageState, createStoreMyPerformancePeriodHandlers, storeMyPerformancePageReducer } from './store-my-performance-model'

describe('personnel calendar regression cases', () => {
  test('month selection switches daily mode and applies months with no records', () => {
    let state = createStoreMyPerformancePageState({ initialLivePeriodType: 'daily', initialLivePeriodStart: '2026-09-05', initialLivePeriodEnd: '2026-09-05' })
    const handlers = createStoreMyPerformancePeriodHandlers({
      availableDailyPeriods: [], availableMonthlyPeriods: [], selectedLiveMonthKeys: [],
      selectedLiveYears: [], selectedLivePeriodType: 'daily',
      dispatch: action => { state = storeMyPerformancePageReducer(state, action) },
    })
    handlers.selectLiveMonth('2024-08')
    expect(state).toMatchObject({ selectedLivePeriodType: 'monthly', selectedLivePeriodStart: '2024-08-01', selectedLivePeriodEnd: '' })
  })
  test('daily comparisons refer to the same day of the previous month', () => {
    expect(previousPersonnelPeriod({ periodStart: '2026-09-05', periodEnd: '2026-09-05' })).toEqual({ periodType: 'daily', periodStart: '2026-08-05', periodEnd: '2026-08-05' })
    expect(previousCalendarMonth('2024-03-31')).toBe('2024-02-29')
    expect(previousCalendarMonth('2026-03-31')).toBe('2026-02-28')
  })
  test('monthly comparisons cross years and include the full previous month', () => {
    expect(previousPersonnelPeriod({ periodStart: '2026-01-01', periodEnd: '2026-01-31' })).toEqual({ periodType: 'monthly', periodStart: '2025-12-01', periodEnd: '2025-12-31' })
    expect(previousPersonnelPeriod({ periodStart: '2026-09-05', periodEnd: '2026-09-10' })).toEqual({ periodType: 'daily', periodStart: '2026-08-05', periodEnd: '2026-08-10' })
  })
  test('rejects unrelated or unavailable comparison data instead of using the latest row', () => {
    const data = (start: string, end = start) => ({ employee: { employeeId: 'a' }, period: { periodStart: start, periodEnd: end } }) as MyPerformanceSummary
    expect(matchingPreviousPerformance(data('2026-09-05'), data('2026-09-29'))).toBeUndefined()
    expect(matchingPreviousPerformance(data('2026-09-05'))).toBeUndefined()
    const previous = data('2026-08-05')
    expect(matchingPreviousPerformance(data('2026-09-05'), previous)).toBe(previous)
  })
})
