import { describe, expect, it } from 'vitest'
import type { AuthSessionSummary } from '@/features/auth/api'
import { canReadCompanyCycle, companyStageCompanies } from './company-cycle-permission'
import { canOpenStoreIncentives } from '@/app/store-route-registry'

const auth = (role: string, permission: string) => ({ user: { roleCodes: [role],
  roleScopes: { [role]: { companyIds: ['owned'], regionIds: [], storeIds: [] } },
  permissionScopes: { [permission]: { companyIds: ['owned', 'foreign'], regionIds: [], storeIds: [] } },
  readScope: { companyIds: ['owned', 'foreign'], regionIds: [], storeIds: [], allowGlobalScope: true },
} }) as unknown as AuthSessionSummary
describe('active company stage capability', () => {
  it('allows HR-only scoped company access without Report Viewer', () => {
    const session = auth('HR_ADMIN', 'INCENTIVE_HR_APPROVAL')
    expect(companyStageCompanies(session, 'hr')).toEqual(['owned'])
    expect(canReadCompanyCycle(session)).toBe(true)
    expect(companyStageCompanies(session, 'payroll')).toEqual([])
  })
  it('never promotes the legacy final grant into a stage', () => {
    expect(canReadCompanyCycle(auth('REPORT_VIEWER', 'INCENTIVE_FINAL_APPROVAL'))).toBe(false)
  })
  it('fails closed for missing persona scope and mismatched HR permission persona', () => {
    const session = auth('HR_ADMIN', 'INCENTIVE_HR_APPROVAL'); delete session.user.roleScopes
    expect(canReadCompanyCycle(session)).toBe(false)
    expect(canReadCompanyCycle(auth('REPORT_VIEWER', 'INCENTIVE_HR_APPROVAL'))).toBe(false)
  })
  it('opens the HR route only for a capability in the same persona company', () => {
    const session = auth('HR_ADMIN', 'INCENTIVE_HR_APPROVAL')
    expect(canOpenStoreIncentives(session)).toBe(true)
    session.user.permissionScopes!.INCENTIVE_HR_APPROVAL!.companyIds = ['foreign']
    expect(canOpenStoreIncentives(session)).toBe(false)
    expect(canOpenStoreIncentives(auth('HR_ADMIN', 'INCENTIVE_FINAL_APPROVAL'))).toBe(false)
  })
  it('preserves legacy RM and viewer access without opening the store manager route', () => {
    expect(canOpenStoreIncentives(auth('REGION_MANAGER', ''))).toBe(true)
    expect(canOpenStoreIncentives(auth('REPORT_VIEWER', ''))).toBe(true)
    expect(canOpenStoreIncentives(auth('STORE_MANAGER', 'INCENTIVE_HR_APPROVAL'))).toBe(false)
    expect(canOpenStoreIncentives(null)).toBe(false)
  })
})
