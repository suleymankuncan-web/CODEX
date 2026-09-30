import { describe, expect, it } from 'vitest'
import type { AuthSessionSummary } from '@/features/auth/api'
import { canReadCompanyCycle, companyStageCompanies } from './company-cycle-permission'

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
})
