import { describe, expect, it } from 'vitest'
import type { PersonnelRankingRow } from '../features/reports/api'
import { personnelStoreScoreImpact } from './store-kpis-personnel-impact'

describe('personnel store score impact display', () => {
  const row = { storeId: 'store-1', visibility: 'detail', storeScoreShare: 43 / 95 } as PersonnelRankingRow
  it('allocates from the selected displayed store score', () => {
    expect(personnelStoreScoreImpact(row, 'store-1', 95)).toBeCloseTo(43)
    expect(personnelStoreScoreImpact(row, 'store-1', 0)).toBe(0)
    expect(personnelStoreScoreImpact({ ...row, storeScoreShare: 0 }, 'store-1', 95)).toBe(0)
  })
  it('keeps missing, masked, invalid and other-store data unavailable', () => {
    expect(personnelStoreScoreImpact(row, 'store-2', 95)).toBeNull()
    expect(personnelStoreScoreImpact(row, 'store-1', null)).toBeNull()
    expect(personnelStoreScoreImpact({ ...row, visibility: 'summary' }, 'store-1', 95)).toBeNull()
    const missingShare = { ...row }
    delete missingShare.storeScoreShare
    expect(personnelStoreScoreImpact(missingShare, 'store-1', 95)).toBeNull()
    for (const storeScoreShare of [null, NaN, -1, 1.1]) {
      expect(personnelStoreScoreImpact({ ...row, storeScoreShare }, 'store-1', 95)).toBeNull()
    }
  })
})
