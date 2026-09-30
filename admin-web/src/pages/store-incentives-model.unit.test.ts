import { describe, expect, it } from 'vitest'
import type { SalesTargetIncentiveRow } from '../features/incentives/api'
import { buildAdminIncentiveExcelRows, getEffectiveFinalAmount, getPrimaryEarnedAmount } from './store-incentives-model'

const row: SalesTargetIncentiveRow = {
  employeeId: 'employee', displayName: 'Person', participantType: 'personnel', positionCode: 'SALES_ASSOCIATE',
  normalizedFromPositionCode: null, target: '1000', actualPositiveSales: '1100', achievementPct: '110',
  storeAchievementPct: '110', storeGatePassed: true, rate: '0.01', rawEarnedAmount: '110.00', payableAmount: '110.00',
  correctionAmount: null, adjustmentAmount: '15.00', finalAmount: '125.00', status: 'adjusted', blockedReason: null,
  rateTableVersion: 'v1', explanation: 'Calculated', regionCorrection: null,
}
const excluded = { ...row, participation: { included: false, reasonNote: 'Excluded', revisionNo: 2, finalSnapshotId: 'snapshot', source: 'draft' as const } }

describe('legacy financial participation display and export', () => {
  it('never restores excluded money from payable/raw fallbacks, including old null-final responses', () => {
    expect(getPrimaryEarnedAmount(excluded)).toBe('0.00')
    expect(getPrimaryEarnedAmount({ ...excluded, finalAmount: null })).toBe('0.00')
    expect(getEffectiveFinalAmount({ ...excluded, finalAmount: null })).toBe('0.00')
  })
  it('retains no-exclusion fallbacks and explicit zero amounts', () => {
    expect(getPrimaryEarnedAmount(row)).toBe('125.00')
    expect(getPrimaryEarnedAmount({ ...row, finalAmount: null })).toBe('110.00')
    expect(getPrimaryEarnedAmount({ ...row, finalAmount: '0.00' })).toBe('0.00')
    expect(getPrimaryEarnedAmount({ ...row, finalAmount: null, payableAmount: null })).toBe('110.00')
    expect(getEffectiveFinalAmount({ ...row, finalAmount: null, payableAmount: null })).toBeNull()
  })
  it('exports zero final contribution while retaining calculated and approved amounts', () => {
    const exported = buildAdminIncentiveExcelRows({ locale: 'tr', period: '2026-05', periodLabel: 'Mayıs',
      rows: [{ projection: { storeName: 'Store' }, row: { ...excluded, finalAmount: null } }] })[0]
    if (!exported) throw new Error('Expected the excluded personnel export row')
    expect(exported.Nihai).toBe('0,00 TL')
    expect(exported['Ham hak ediş']).toBe('110,00 TL')
    expect(exported['Hak ediş']).toBe('110,00 TL')
    expect(exported['Kapanış düzeltmesi']).toBe('15,00 TL')
  })
})
