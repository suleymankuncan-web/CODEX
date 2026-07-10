import { describe, expect, test } from 'vitest'
import type { SalesTargetIncentiveRegionCorrection, SalesTargetIncentiveRow } from '../features/incentives/api'
import { getRegionEffectiveEarnedAmount, sumMoney } from './store-incentives-region-manager-model'

function createCorrection(
  status: SalesTargetIncentiveRegionCorrection['status'],
  finalAmount: string,
): SalesTargetIncentiveRegionCorrection {
  return {
    correctionId: 'correction-1',
    status,
    targetScope: 'final_snapshot',
    beforeAmount: '12.50',
    adjustmentAmount: '2.25',
    finalAmount,
    reasonNote: 'Unit-test fixture',
    createdByUserId: 'user-1',
    createdAt: '2026-07-10T00:00:00.000Z',
    submittedAt: null,
    reviewedAt: null,
    reviewNote: null,
  }
}

function createRow(overrides: Partial<SalesTargetIncentiveRow> = {}): SalesTargetIncentiveRow {
  return {
    employeeId: 'employee-1',
    displayName: 'Test Employee',
    participantType: 'personnel',
    positionCode: 'SALES_ASSOCIATE',
    normalizedFromPositionCode: null,
    target: null,
    actualPositiveSales: null,
    achievementPct: null,
    storeAchievementPct: null,
    storeGatePassed: null,
    rate: null,
    rawEarnedAmount: '10.00',
    payableAmount: '12.50',
    correctionAmount: null,
    adjustmentAmount: null,
    finalAmount: null,
    status: 'closed',
    blockedReason: null,
    rateTableVersion: 'unit-test',
    explanation: 'Unit-test fixture',
    regionCorrection: null,
    ...overrides,
  }
}

describe('Region Manager incentive model', () => {
  test('adds decimal strings as cents without floating-point drift', () => {
    expect(sumMoney(['0.10', '0.20', '10,03'])).toBe('10.33')
  })

  test('uses a non-void regional correction but falls back after it is voided', () => {
    expect(
      getRegionEffectiveEarnedAmount(
        createRow({ regionCorrection: createCorrection('submitted', '14.75') }),
      ),
    ).toBe('14.75')
    expect(
      getRegionEffectiveEarnedAmount(
        createRow({ regionCorrection: createCorrection('voided', '14.75') }),
      ),
    ).toBe('12.50')
  })
})
