import { afterEach, describe, expect, test, vi } from 'vitest'
import { createInitialStoreRankingsPageState, currentRankingPeriod } from './store-rankings-page-model'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('rankings Istanbul month defaults', () => {
  test.each([
    ['2026-09-30T20:59:59Z', '2026-09-01'],
    ['2026-09-30T21:00:00Z', '2026-10-01'],
    ['2026-12-31T21:30:00Z', '2027-01-01'],
  ])('uses business month at %s in a UTC environment', (instant, expected) => {
    vi.stubEnv('TZ', 'UTC')
    vi.useFakeTimers().setSystemTime(new Date(instant))
    expect(currentRankingPeriod()).toBe(expected)
    expect(createInitialStoreRankingsPageState(new URLSearchParams()).periodStart).toBe(expected)
  })

  test('keeps an explicitly requested historic month across the business boundary', () => {
    vi.stubEnv('TZ', 'UTC')
    vi.useFakeTimers().setSystemTime(new Date('2026-09-30T21:30:00Z'))
    expect(createInitialStoreRankingsPageState(new URLSearchParams('period=2026-08-01')).periodStart).toBe('2026-08-01')
  })
})
