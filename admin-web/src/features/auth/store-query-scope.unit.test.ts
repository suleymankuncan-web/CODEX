import { describe, expect, it } from 'vitest'
import type { AuthSessionSummary } from './api'
import { getStoreQueryScopeSignature } from './store-query-scope'

function session(version: string) {
  return { authenticated: true, user: { userId: 'mixed-role-user', authorizationContextVersion: version, roleCodes: ['REPORT_VIEWER', 'REGION_MANAGER'], scope: { companyIds: ['company-a', 'company-b'], regionIds: ['region-a'], storeIds: [] }, readScope: { companyIds: ['company-a', 'company-b'], regionIds: ['region-a'], storeIds: [] }, actionScope: { assignedStoreIds: [], assignedStoreTypes: [] }, assignedStoreIds: [] } } as unknown as AuthSessionSummary
}

describe('store query scope signature', () => {
  it('does not reuse store cache when role partitions change under the same aggregate scope', () => {
    const versionA = `v1:${'a'.repeat(64)}`
    const versionB = `v1:${'b'.repeat(64)}`
    const baseline = getStoreQueryScopeSignature(session(versionA))
    const repartitioned = getStoreQueryScopeSignature(session(versionB))
    expect(repartitioned).not.toBe(baseline)
    expect(baseline).toContain(`authorization:${versionA}`)
  })
})
