import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'src/pages/AuthManagementPage.tsx'), 'utf8')

describe('Auth Management user capabilities', () => {
  it('manages person-specific capability grants separately from role defaults', () => {
    expect(source).toContain('Kişisel yetkiler')
    expect(source).toContain('CapabilityAssignmentDialog')
    expect(source).toContain('getUserPermissionAssignments')
    expect(source).toContain('grantUserPermission')
    expect(source).toContain('revokeUserPermission')
  })

  it('keeps legacy final approval visible only for revocation', () => {
    expect(source).toContain('Eski prim final onayı · yalnız kaldırılabilir')
    expect(source).toContain('enabled: false')
    expect(source).toContain('INCENTIVE_SALES_DIRECTOR_APPROVAL')
    expect(source).toContain('INCENTIVE_GENERAL_MANAGER_APPROVAL')
  })
})
