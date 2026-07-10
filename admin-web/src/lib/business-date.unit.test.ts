import { describe, expect, it } from 'vitest'
import {
  addCalendarDaysToDateInput,
  getBusinessDateInputValue,
  getBusinessDateParts,
  getBusinessMonthInputValue,
} from './business-date'

describe('Europe/Istanbul business date', () => {
  it('uses the Istanbul day and month at 00:30 local time', () => {
    const now = new Date('2026-06-30T21:30:00.000Z')

    expect(getBusinessDateParts(now)).toEqual({ year: 2026, month: 7, day: 1 })
    expect(getBusinessDateInputValue(now)).toBe('2026-07-01')
    expect(getBusinessMonthInputValue(now)).toBe('2026-07')
  })

  it('crosses the Istanbul year boundary independently of the host timezone', () => {
    const now = new Date('2026-12-31T21:00:00.000Z')

    expect(getBusinessDateInputValue(now)).toBe('2027-01-01')
    expect(getBusinessMonthInputValue(now)).toBe('2027-01')
  })

  it('adds date-only calendar days across month and year boundaries', () => {
    expect(addCalendarDaysToDateInput('2026-12-25', 14)).toBe('2027-01-08')
  })

  it('rejects invalid date-only inputs and non-integer offsets', () => {
    expect(() => addCalendarDaysToDateInput('2026-02-30', 1)).toThrow('Invalid date-only value')
    expect(() => addCalendarDaysToDateInput('2026-02-01', 1.5)).toThrow('integer')
  })
})
