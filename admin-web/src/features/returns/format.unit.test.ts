import { describe, expect, it } from 'vitest'
import { returnDate, returnMoney, returnStatus } from './format'
import type { StoreReturnRow } from './api'

describe('return evidence presentation', () => {
  it('retains negative currency and separates unavailable from zero', () => {
    expect(returnMoney('-650.00', 'tr')).toContain('-₺650,00')
    expect(returnMoney(null, 'tr')).toBe('—')
    expect(returnMoney('0.00', 'tr')).toContain('₺0,00')
    expect(returnMoney('invalid', 'en')).toBe('—')
  })
  it('shows external information before financial category and keeps unresolved explicit', () => {
    expect(returnStatus({ direction: 'external', category: 'cross_store' } as StoreReturnRow, 'tr')).toBe('Dış mağazada iade · Bilgi')
    expect(returnStatus({ direction: 'received', category: 'out_of_norm' } as StoreReturnRow, 'tr')).toBe('Norm Dışı İade')
    expect(returnStatus({ direction: 'received', category: 'review_required' } as StoreReturnRow, 'en')).toBe('Review Required')
  })
  it('preserves the return business date across month/year boundaries', () => {
    expect(returnDate('2026-12-31', 'tr')).toContain('31 Ara 2026')
    expect(returnDate('2027-01-01', 'en')).toBe('1 Jan 2027')
  })
})
