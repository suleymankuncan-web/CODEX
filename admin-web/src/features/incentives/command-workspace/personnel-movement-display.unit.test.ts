import { describe, expect, it } from 'vitest'
import { isDepartedIncentiveRow, personnelMovementDisplay } from './personnel-movement-display'
import type { IncentiveRow, IncentiveStore } from './types'

const person = (id: string, target: string | null, sale: string | null, returns = '0', net = '0'): IncentiveRow => ({
  employeeId: id, displayName: id, participantType: 'personnel', target,
  trackedSaleAmount: sale, trackedReturnAmount: returns, trackedNetAmount: net,
  finalAmount: '100.00', currentEmploymentStatus: null, terminationDate: null,
} as IncentiveRow)
const store = (rows: IncentiveRow[], storeTarget: string | null = '1000'): IncentiveStore => ({
  rows, outOfRosterReturns: [], review: { periodCloseStatus: 'projection_only' },
  storeTarget,
  trackedSaleAmount: '100', trackedReturnAmount: '-150', trackedNetAmount: '-50',
} as unknown as IncentiveStore)

describe('incentive personnel presentation preserves all assigned personnel', () => {
  it('shows target holders independently of positive, zero or unavailable movement data', () => {
    const input = store([
      person('positive', '100', '50'),
      person('zero', '200', '0'),
      person('unknown', '300', null),
      person('targetless-seller', null, '500'),
    ])
    const before = structuredClone(input)
    const result = personnelMovementDisplay(input, true)
    expect(result.visibleRows.map(row => row.employeeId)).toEqual(['positive', 'zero', 'unknown', 'targetless-seller'])
    expect(result.targetlessCount).toBe(1)
    expect(input).toEqual(before)
  })

  it('uses the selected-month store target for the manager instead of a personal movement target', () => {
    const manager = { ...person('manager', null, null), participantType: 'store_manager' as const }
    expect(personnelMovementDisplay(store([manager], '1000'), false).visibleRows).toEqual([manager])
    expect(personnelMovementDisplay(store([manager], null), false).visibleRows).toEqual([manager])
  })

  it('keeps frozen targetless rows visible and preserves their immutable amounts', () => {
    const targetless = person('historical', null, '0', '-20', '-20')
    targetless.finalAmount = '75.00'
    const input = store([targetless, person('targeted', '100', '0')])
    input.review.periodCloseStatus = 'closed'
    const result = personnelMovementDisplay(input, true)
    expect(result.visibleRows.map(row => row.employeeId)).toEqual(['historical', 'targeted'])
    expect(input.rows[0]?.finalAmount).toBe('75.00')
  })

  it('labels departure only from an explicit effective terminated status', () => {
    const row = person('departed', '100', '0')
    expect(isDepartedIncentiveRow({ ...row, currentEmploymentStatus: 'terminated', terminationDate: '2026-09-26' }, '2026-09-27')).toBe(true)
    expect(isDepartedIncentiveRow({ ...row, currentEmploymentStatus: 'inactive', terminationDate: '2026-09-26' }, '2026-09-27')).toBe(false)
    expect(isDepartedIncentiveRow({ ...row, currentEmploymentStatus: 'terminated', terminationDate: null }, '2026-09-27')).toBe(false)
    expect(isDepartedIncentiveRow({ ...row, currentEmploymentStatus: 'terminated', terminationDate: '2026-09-28' }, '2026-09-27')).toBe(false)
  })

  it('keeps targetless sellers out of return-only detail without changing store totals', () => {
    const input = store([])
    input.outOfRosterReturns = [
      { employeeId: 'former-seller', personnelCode: 'OLD-2', displayName: 'Seller', saleAmount: '10', returnAmount: '-50', netAmount: '-40' },
      { employeeId: null, personnelCode: 'UNMAPPED-1', displayName: 'Unmapped', saleAmount: '0', returnAmount: '-40', netAmount: '-40' },
    ]
    const result = personnelMovementDisplay(input, true)
    expect(result.returns.map(row => row.personnelCode)).toEqual(['UNMAPPED-1'])
    expect(result.returnsTotal).toBe('-40.00')
    expect([input.trackedSaleAmount, input.trackedReturnAmount, input.trackedNetAmount]).toEqual(['100', '-150', '-50'])
  })

  it('deduplicates one employee across movement detail and dual participant rows', () => {
    const personnel = person('duplicate', '100', '0', '-30', '-30')
    const manager = { ...person('duplicate', null, '0', '-30', '-30'), participantType: 'store_manager' as const }
    const input = store([personnel, manager])
    input.outOfRosterReturns = [{
      employeeId: 'duplicate', personnelCode: 'OLD-7', displayName: 'Duplicate Person',
      saleAmount: '0', returnAmount: '-30', netAmount: '-30',
    }]

    const result = personnelMovementDisplay(input, true)

    expect(result.returns).toEqual([expect.objectContaining({ employeeId: 'duplicate', personnelCode: 'OLD-7' })])
    expect(result.returnsTotal).toBe('-30.00')
  })

  it('excludes a duplicate identity from return-only detail when any source has positive sales', () => {
    const input = store([person('duplicate-seller', '100', '5', '-40', '-35')])
    input.outOfRosterReturns = [{
      employeeId: 'duplicate-seller', personnelCode: 'OLD-8', displayName: 'Duplicate Seller',
      saleAmount: '0', returnAmount: '-40', netAmount: '-40',
    }]

    const result = personnelMovementDisplay(input, true)

    expect(result.returns).toEqual([])
    expect(result.returnsTotal).toBe('0.00')
  })

  it('keeps return detail unavailable instead of fabricating an empty zero state', () => {
    const result = personnelMovementDisplay(store([person('targeted', '100', null)]), false)
    expect(result.visibleRows.map(row => row.employeeId)).toEqual(['targeted'])
    expect(result.returns).toEqual([])
    expect(result.returnsTotal).toBeNull()
  })
})
