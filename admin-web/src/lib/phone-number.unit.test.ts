import { describe, expect, it } from 'vitest'
import { formatPersonnelPhone, nationalPhoneDigits } from './phone-number'

describe('personnel phone entry', () => {
  it.each(['5391234567', '05391234567', '+90 (539) 123 45 67'])('normalizes %s without a leading zero', (value) => {
    expect(formatPersonnelPhone(value)).toBe('(539) 123 45 67')
    expect(nationalPhoneDigits(value)).toBe('5391234567')
  })
  it('preserves empty and partial input', () => {
    expect(formatPersonnelPhone('')).toBe('')
    expect(formatPersonnelPhone('53')).toBe('(53')
    expect(formatPersonnelPhone('5391')).toBe('(539) 1')
  })
})
