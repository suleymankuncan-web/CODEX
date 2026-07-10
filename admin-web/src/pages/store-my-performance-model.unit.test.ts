import { describe, expect, test } from 'vitest'
import {
  createStoreMyPerformancePageState,
  getPeriodDateKey,
  storeMyPerformancePageReducer,
} from './store-my-performance-model'

describe('Store My Performance page state', () => {
  test('normalizes an ISO period start to its stable date key', () => {
    expect(getPeriodDateKey(' 2026-07-10T23:59:59.000Z ')).toBe('2026-07-10')
    expect(getPeriodDateKey('July 10, 2026')).toBe('')
  })

  test('switches a live selection to daily without changing the selected source', () => {
    const initial = createStoreMyPerformancePageState({
      initialLivePeriodStart: ' 2026-07-01T00:00:00.000Z ',
      initialLivePeriodType: 'monthly',
    })

    const next = storeMyPerformancePageReducer(initial, {
      type: 'setLiveDaySelection',
      dayStarts: ['2026-07-10T00:00:00.000Z'],
      periodStart: '2026-07-10T00:00:00.000Z',
    })

    expect(next).toMatchObject({
      sourceMode: 'live',
      selectedLivePeriodType: 'daily',
      selectedLivePeriodStart: '2026-07-10T00:00:00.000Z',
      selectedLiveDayStarts: ['2026-07-10T00:00:00.000Z'],
    })
  })
})
