import { describe, expect, it } from 'vitest'
import {
  buildMembershipBindingInput,
  createMembershipDraft,
  validateMembershipDraft,
} from './auth-membership-dialog-model'

const employee = {
  employeeId: '70000000-0000-4000-8000-000000000101',
  displayName: 'Ayşe Demir',
  email: 'ayse.demir@example.com',
  storeId: '10000000-0000-4000-8000-000000000021',
}

describe('auth membership dialog model', () => {
  it('builds one atomic store-manager binding from the selected employee store', () => {
    const draft = {
      ...createMembershipDraft(),
      employee,
      providerSubject: 'user_clerk_101',
      username: 'ayse.demir',
      email: employee.email,
      roleCode: 'STORE_MANAGER' as const,
      storeIds: [employee.storeId],
    }

    expect(validateMembershipDraft(draft)).toBeNull()
    expect(buildMembershipBindingInput(draft)).toEqual({
      employeeId: employee.employeeId,
      authProvider: 'clerk',
      providerSubject: 'user_clerk_101',
      username: 'ayse.demir',
      email: employee.email,
      roleCode: 'STORE_MANAGER',
      storeIds: [employee.storeId],
    })
  })

  it('rejects a store manager whose selected store differs from the active employee store', () => {
    const draft = {
      ...createMembershipDraft(),
      employee,
      providerSubject: 'user_clerk_101',
      username: 'ayse.demir',
      email: employee.email,
      roleCode: 'STORE_MANAGER' as const,
      storeIds: ['10000000-0000-4000-8000-000000000099'],
    }

    expect(validateMembershipDraft(draft)).toBe('Mağaza müdürü personelin aktif mağazasına bağlanmalıdır.')
  })

  it('keeps the provider payload limited to the existing atomic endpoint contract', () => {
    const draft = {
      ...createMembershipDraft(),
      employee,
      authProvider: 'oidc' as const,
      providerSubject: 'oidc-subject-101',
      username: 'ayse.demir',
      email: employee.email,
      roleCode: 'REGION_MANAGER' as const,
      storeIds: [
        '10000000-0000-4000-8000-000000000021',
        '10000000-0000-4000-8000-000000000022',
      ],
    }

    expect(buildMembershipBindingInput(draft)).toEqual({
      employeeId: employee.employeeId,
      authProvider: 'oidc',
      providerSubject: 'oidc-subject-101',
      username: 'ayse.demir',
      email: employee.email,
      roleCode: 'REGION_MANAGER',
      storeIds: [
        '10000000-0000-4000-8000-000000000021',
        '10000000-0000-4000-8000-000000000022',
      ],
    })
  })
})
