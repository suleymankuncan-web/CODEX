import { describe, expect, it } from 'vitest'
import {
  initialObservationRange,
  observationDate,
  validObservationRange,
} from './personnel-observations-model'

describe('personnel observation date bounds', () => {
  it('defaults to the last thirty local calendar days, inclusive', () => {
    const range = initialObservationRange(new Date(2026, 8, 7, 23, 59))
    expect(observationDate(range.from)).toBe('2026-08-09')
    expect(observationDate(range.to)).toBe('2026-09-07')
  })
  it('allows a single day and 366 inclusive days but no reversed, incomplete, or longer interval', () => {
    expect(validObservationRange('2026-09-07', '2026-09-07')).toBe(true)
    expect(validObservationRange('2024-01-01', '2024-12-31')).toBe(true)
    expect(validObservationRange('2024-01-01', '2025-01-01')).toBe(false)
    expect(validObservationRange('2026-09-07', '2026-09-06')).toBe(false)
    expect(validObservationRange('', '2026-09-07')).toBe(false)
  })
})
