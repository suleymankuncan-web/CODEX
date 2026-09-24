import { describe, expect, test } from 'vitest'
import type { IncentiveWorkspace } from './types'
import {
  buildIncentiveMetrics,
  calculateRateProposal,
  countAdjustedIncentivePersonnel,
  filterIncentiveWorkspace,
  getSubmitManagerOptions,
  hasIncentiveAmountChange,
  isBelowIncentiveThreshold,
  isEarnedAtIncentiveThreshold,
  isIncentiveManagerGroupSubmitReady,
  scopeIncentiveWorkspaceToManager,
  sumMoney,
} from './model'

const workspace: IncentiveWorkspace = {
  period: '2026-06',
  periodStart: '2026-06-01',
  periodEnd: '2026-06-30',
  periodTimezone: 'Europe/Istanbul',
  salesTracking: { throughDate: '2026-06-30', lastLoadedDate: null, status: 'complete' },
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
  managerGroups: [
    {
      companyId: 'company-a', managerUserId: 'manager-1',
      managerName: 'Süleyman Öztürk',
      capabilities: { canSubmitPackage: true },
      package: { status: 'not_submitted', submittedAt: null, reviewedAt: null, reviewNote: null },
      stores: [
        {
          storeId: 'store-a', storeCode: 'MOI', storeName: 'Mall of İstanbul', city: null,
          storeTarget: '1000.00', storeActualNetSales: '1100.00', storeAchievementPct: '110.0000', dailyActualNetSales: null, dailyAchievementPct: null,
          capabilities: { canMarkStoreReview: true, canCreateCorrection: true, canVoidCorrection: true },
          review: { status: 'reviewed', reviewedAt: '2026-07-01T10:00:00.000Z', periodCloseStatus: 'closed' },
          rows: [{
            employeeId: 'employee-a', displayName: 'Derya Uslu', participantType: 'personnel',
            positionCode: 'SALES_ASSOCIATE', target: '500.00', actual: '550.00', dailyActualNetSales: null, dailyAchievementPct: null, achievementPct: '110.0000',
            rate: '0.0150', calculatedAmount: '8.25', finalAmount: '10.25', signedDifferenceAmount: '2.00',
            status: 'corrected', correction: null, correctionRecords: [],
          }],
        },
      ],
    },
    {
      companyId: 'company-a', managerUserId: 'manager-2', managerName: 'Ayşe Kaya',
      capabilities: { canSubmitPackage: false },
      package: { status: 'not_submitted', submittedAt: null, reviewedAt: null, reviewNote: null },
      stores: [{
        storeId: 'store-b', storeCode: null, storeName: 'Capacity AVM', city: null,
        storeTarget: null, storeActualNetSales: null, storeAchievementPct: null, dailyActualNetSales: null, dailyAchievementPct: null,
        capabilities: { canMarkStoreReview: true, canCreateCorrection: true, canVoidCorrection: true },
        review: { status: 'pending_review', reviewedAt: null, periodCloseStatus: 'projection_only' }, rows: [],
      }],
    },
  ],
}

describe('Incentives Command Canvas model', () => {
  test('counts real amount adjustments once per person and does not interpret missing amounts as zero', () => {
    const row = workspace.managerGroups[0]!.stores[0]!.rows[0]!
    expect(countAdjustedIncentivePersonnel([row, { ...row, participantType: 'store_manager' }, { ...row, employeeId: 'unchanged', finalAmount: row.calculatedAmount }, { ...row, employeeId: 'missing', calculatedAmount: null }])).toBe(1)
    expect(hasIncentiveAmountChange('0.00', '0')).toBe(false)
    expect(hasIncentiveAmountChange('12.0000', '12.00')).toBe(false)
    expect(hasIncentiveAmountChange(null, '12.00')).toBe(false)
    expect(hasIncentiveAmountChange('invalid', '12.00')).toBe(false)
    expect(hasIncentiveAmountChange('12.00', '0.00')).toBe(true)
    expect(hasIncentiveAmountChange('12.00', '12.01')).toBe(true)
  })
  test('scopes stores by manager identity even when the directory store list disagrees', () => {
    const scoped = scopeIncentiveWorkspaceToManager(workspace, {
      userId: 'manager-2',
      displayName: 'Gerçek Bölge Müdürü',
      storeIds: ['store-a'],
    })

    expect(scoped.managerGroups).toHaveLength(1)
    expect(scoped.managerGroups[0]?.stores.map((store) => store.storeId)).toEqual(['store-b'])
    expect(scoped.managerGroups[0]?.managerName).toBe('Ayşe Kaya')
    expect(scopeIncentiveWorkspaceToManager(workspace, null)).toBe(workspace)
  })

  test('derives honest metrics from the complete authorized workspace', () => {
    expect(buildIncentiveMetrics(workspace)).toEqual({
      finalTotal: '10.25',
      pendingReviewCount: 1,
      correctionCount: 1,
      reviewedStoreCount: 1,
      storeCount: 2,
      managerCount: 2,
    })
  })

  test('distinguishes unavailable money from a real zero total', () => {
    expect(sumMoney([null, undefined, 'invalid'])).toBeNull()
    expect(sumMoney(['0.00', null])).toBe('0.00')
  })

  test('colors only known achievement below 80% and earned incentives at the inclusive threshold', () => {
    expect(isBelowIncentiveThreshold('79.99')).toBe(true)
    expect(isBelowIncentiveThreshold('80.00')).toBe(false)
    expect(isBelowIncentiveThreshold(null)).toBe(false)
    expect(isBelowIncentiveThreshold('')).toBe(false)
    expect(isEarnedAtIncentiveThreshold('12.00', '80.00')).toBe(true)
    expect(isEarnedAtIncentiveThreshold('12.00', '79.99')).toBe(false)
    expect(isEarnedAtIncentiveThreshold('0.00', '100.00')).toBe(false)
    expect(isEarnedAtIncentiveThreshold(null, '100.00')).toBe(false)
  })

  test('calculates rate proposals with backend-compatible decimal truncation', () => {
    expect(calculateRateProposal('1593440.00', '0.0150')).toBe('23901.60')
    expect(calculateRateProposal('10.99', '0.0065')).toBe('0.07')
    expect(calculateRateProposal(null, '0.0150')).toBeNull()
  })

  test('filters locally without changing the authoritative workspace', () => {
    const result = filterIncentiveWorkspace(workspace, { search: 'mall', status: 'corrected' })
    expect(result.managerGroups).toHaveLength(1)
    expect(result.managerGroups[0]?.stores[0]?.storeId).toBe('store-a')
    expect(workspace.managerGroups).toHaveLength(2)
  })

  test('earning filter includes only stores with a positive final entitlement', () => {
    const result = filterIncentiveWorkspace(workspace, { search: '', status: 'earning' })
    expect(result.managerGroups).toHaveLength(1)
    expect(result.managerGroups[0]?.stores.map((store) => store.storeId)).toEqual(['store-a'])
  })

  test('identifies available packages by company and manager, never by region id', () => {
    expect(getSubmitManagerOptions(workspace)).toEqual([
      { companyId: 'company-a', managerUserId: 'manager-1', label: 'Süleyman Öztürk' },
      { companyId: 'company-a', managerUserId: 'manager-2', label: 'Ayşe Kaya' },
    ])
  })

  test('requires every assigned store in the manager package to be reviewed and closed', () => {
    expect(isIncentiveManagerGroupSubmitReady(workspace.managerGroups[0])).toBe(true)
    expect(isIncentiveManagerGroupSubmitReady(workspace.managerGroups[1])).toBe(false)
    expect(getSubmitManagerOptions(workspace)).toContainEqual({ companyId: 'company-a', managerUserId: 'manager-2', label: 'Ayşe Kaya' })
  })
})
