import { describe, expect, it } from 'vitest'
import type { AuthSessionSummary } from './api'
import {
  getStoreQueryScopeSignature,
  retainScopedPlaceholder,
  storeChecklistCommandRegionsQueryKey,
  storeChecklistOperationalHistoryQueryKey,
} from './store-query-scope'

function session(version: string, companyIds = ['company-a', 'company-b']) {
  return { authenticated: true, user: { userId: 'mixed-role-user', authorizationContextVersion: version, roleCodes: ['REPORT_VIEWER', 'REGION_MANAGER'], scope: { companyIds, regionIds: ['region-a'], storeIds: [] }, readScope: { companyIds, regionIds: ['region-a'], storeIds: [] }, actionScope: { assignedStoreIds: [], assignedStoreTypes: [] }, assignedStoreIds: [] } } as unknown as AuthSessionSummary
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

  it('partitions Report Viewer cache by authorized company scope even under the same version', () => {
    const version = `v1:${'a'.repeat(64)}`
    const companyA = getStoreQueryScopeSignature(session(version, ['company-a']))
    const companyB = getStoreQueryScopeSignature(session(version, ['company-b']))

    expect(companyA).not.toBe(companyB)
    expect(companyA).toContain('readCompanies:company-a')
  })

  it('keeps region and store-history reads in separate scoped cache families', () => {
    const auth = session(`v1:${'c'.repeat(64)}`, ['company-a'])
    expect(storeChecklistCommandRegionsQueryKey(auth, { period: '2026-07', offset: 0 })[0])
      .toBe('checklist-command-regions')
    expect(storeChecklistOperationalHistoryQueryKey(
      auth,
      'store-a',
      '6m',
      ['checklist_completed', 'task_assigned'],
    )).toEqual([
      'checklist-operational-history',
      getStoreQueryScopeSignature(auth),
      'store-a',
      '6m',
      'checklist_completed,task_assigned',
    ])
  })

  it('retains placeholder data only inside the same authorization scope and filter boundary', () => {
    const previous = { data: 'company-a' }
    const scopeA = getStoreQueryScopeSignature(session('v1:a', ['company-a']))
    const scopeB = getStoreQueryScopeSignature(session('v1:b', ['company-b']))

    expect(retainScopedPlaceholder(previous, ['query', scopeA], scopeA)).toBe(previous)
    expect(retainScopedPlaceholder(previous, ['query', scopeA], scopeB)).toBeUndefined()
    expect(retainScopedPlaceholder(previous, ['query', scopeA], scopeA, false)).toBeUndefined()
  })
})
