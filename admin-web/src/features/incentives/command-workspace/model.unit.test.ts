import { describe, expect, test } from 'vitest'
import type { IncentiveWorkspace } from './types'
import {
  buildIncentiveMetrics,
  calculateRateProposal,
  filterIncentiveWorkspace,
  getSubmitRegionOptions,
  sumMoney,
} from './model'

const workspace: IncentiveWorkspace = {
  period: '2026-06',
  periodStart: '2026-06-01',
  periodEnd: '2026-06-30',
  periodTimezone: 'Europe/Istanbul',
  view: 'region_manager',
  capabilities: {
    canMarkStoreReview: true,
    canCreateCorrection: true,
    canVoidCorrection: true,
    canSubmitPackage: true,
  },
  sections: {
    core: { status: 'complete' },
    storeMetadata: { status: 'complete' },
    rateMetadata: { status: 'complete' },
    correctionActors: { status: 'complete' },
  },
  rateMetadata: {
    status: 'resolved',
    ruleVersionCode: 'rule-v1',
    effectiveFrom: '2026-01-01',
    periodTimezone: 'Europe/Istanbul',
    bracketBoundaryPolicy: 'lower_inclusive_upper_exclusive',
    tables: [],
  },
  regions: [
    {
      regionId: 'region-a',
      regionName: 'Avrupa',
      regionManager: { displayName: 'Süleyman Öztürk' },
      capabilities: { canSubmitPackage: true },
      package: { status: 'not_submitted', submittedAt: null, reviewedAt: null, reviewNote: null },
      stores: [
        {
          storeId: 'store-a', storeCode: 'MOI', storeName: 'Mall of İstanbul', city: null,
          storeTarget: '1000.00', storeActualNetSales: '1100.00', storeAchievementPct: '110.0000',
          capabilities: { canMarkStoreReview: true, canCreateCorrection: true, canVoidCorrection: true },
          review: { status: 'reviewed', reviewedAt: '2026-07-01T10:00:00.000Z', periodCloseStatus: 'closed' },
          rows: [{
            employeeId: 'employee-a', displayName: 'Derya Uslu', participantType: 'personnel',
            positionCode: 'SALES_ASSOCIATE', target: '500.00', actual: '550.00', achievementPct: '110.0000',
            rate: '0.0150', calculatedAmount: '8.25', finalAmount: '10.25', signedDifferenceAmount: '2.00',
            status: 'corrected', correction: null, correctionRecords: [],
          }],
        },
      ],
    },
    {
      regionId: 'region-b', regionName: 'Anadolu', regionManager: { displayName: 'Ayşe Kaya' },
      capabilities: { canSubmitPackage: true },
      package: { status: 'not_submitted', submittedAt: null, reviewedAt: null, reviewNote: null },
      stores: [{
        storeId: 'store-b', storeCode: null, storeName: 'Capacity AVM', city: null,
        storeTarget: null, storeActualNetSales: null, storeAchievementPct: null,
        capabilities: { canMarkStoreReview: true, canCreateCorrection: true, canVoidCorrection: true },
        review: { status: 'pending_review', reviewedAt: null, periodCloseStatus: 'projection_only' }, rows: [],
      }],
    },
  ],
}

describe('Incentives Command Canvas model', () => {
  test('derives honest metrics from the complete authorized workspace', () => {
    expect(buildIncentiveMetrics(workspace)).toEqual({
      finalTotal: '10.25',
      pendingReviewCount: 1,
      correctionCount: 1,
      reviewedStoreCount: 1,
      storeCount: 2,
      regionCount: 2,
    })
  })

  test('distinguishes unavailable money from a real zero total', () => {
    expect(sumMoney([null, undefined, 'invalid'])).toBeNull()
    expect(sumMoney(['0.00', null])).toBe('0.00')
  })

  test('calculates rate proposals with backend-compatible decimal truncation', () => {
    expect(calculateRateProposal('1593440.00', '0.0150')).toBe('23901.60')
    expect(calculateRateProposal('10.99', '0.0065')).toBe('0.07')
    expect(calculateRateProposal(null, '0.0150')).toBeNull()
  })

  test('filters locally without changing the authoritative workspace', () => {
    const result = filterIncentiveWorkspace(workspace, { search: 'mall', status: 'corrected' })
    expect(result.regions).toHaveLength(1)
    expect(result.regions[0]?.stores[0]?.storeId).toBe('store-a')
    expect(workspace.regions).toHaveLength(2)
  })

  test('earning filter includes only stores with a positive final entitlement', () => {
    const result = filterIncentiveWorkspace(workspace, { search: '', status: 'earning' })
    expect(result.regions).toHaveLength(1)
    expect(result.regions[0]?.stores.map((store) => store.storeId)).toEqual(['store-a'])
  })

  test('requires an explicit region choice when more than one package is actionable', () => {
    expect(getSubmitRegionOptions(workspace)).toEqual([
      { regionId: 'region-a', label: 'Avrupa' },
      { regionId: 'region-b', label: 'Anadolu' },
    ])
  })
})
