import { describe, expect, it } from 'vitest'
import { netAchievement, personnelSalesDisplay, storeSalesDisplay } from './sales-display'
import type { IncentiveRow, IncentiveStore, IncentiveWorkspace } from './types'

describe('signed sales presentation does not alter the incentive basis', () => {
  it('retains negative net achievement and treats missing/zero targets as unknown', () => {
    expect(netAchievement('-500', '1000')).toBe('-50.00')
    expect(netAchievement(undefined, '1000')).toBeNull()
    expect(netAchievement('500', '0')).toBeNull()
  })
  it('shows own sales even when the manager incentive uses store turnover', () => {
    const row = { trackedSaleAmount: '500', trackedReturnAmount: '-700', trackedNetAmount: '-200', target: '1000', actual: '10000', dailyActualNetSales: '9000', achievementPct: '1000.00' } as IncentiveRow
    expect(personnelSalesDisplay(row)).toEqual({ sale: '500', returns: '-700', net: '-200', achievement: '-20.00', incentiveAchievement: '1000.00' })
  })
  it('never substitutes store turnover or zero for missing personnel movements', () => {
    const row = { target: '1000', actual: '10000', dailyActualNetSales: '9000' } as IncentiveRow
    expect(personnelSalesDisplay(row).net).toBeUndefined()
    expect(personnelSalesDisplay(row).achievement).toBeNull()
    expect(personnelSalesDisplay(row).incentiveAchievement).toBe('1000.00')
  })
  it('uses authoritative store net without adding outside-roster returns again', () => {
    const store = { trackedSaleAmount: '1000', trackedReturnAmount: '-1200', trackedNetAmount: '-200', storeTarget: '2000', outOfRosterReturns: [{ netAmount: '-100' }] } as IncentiveStore
    expect(storeSalesDisplay(store, {} as IncentiveWorkspace)).toEqual({ sale: '1000', returns: '-1200', net: '-200', achievement: '-10.00' })
  })
  it('preserves missing gross components while showing available store net', () => {
    const store = { dailyActualNetSales: '500', storeActualNetSales: '700', storeTarget: '1000' } as IncentiveStore
    expect(storeSalesDisplay(store, { salesTracking: { status: 'complete', lastLoadedDate: '2026-09-26' } } as IncentiveWorkspace).net).toBe('500')
    expect(storeSalesDisplay(store, {} as IncentiveWorkspace).sale).toBeUndefined()
  })
})
