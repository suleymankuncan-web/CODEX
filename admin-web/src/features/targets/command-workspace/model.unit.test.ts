import { describe, expect, test } from 'vitest'
import type { TargetWorkspaceResponse } from '../api'
import {
  buildTargetMetrics,
  filterTargetWorkspace,
  flattenTargetStores,
  mergeTargetWorkspacePages,
  sortTargetStores,
} from './model'

const response = (offset: number, stores: Array<{ id: string; name: string; status: 'pending' | 'missing' | 'approved' }>): TargetWorkspaceResponse => ({
  data: {
    period: '2026-07', periodStart: '2026-07-01', periodEnd: '2026-07-31', periodTimezone: 'Europe/Istanbul', historyYear: 2026,
    view: 'report_viewer', capabilities: { canCreateRequest: false, canApproveRequest: false },
    pagination: { total: 3, limit: stores.length, offset, hasMore: offset + stores.length < 3 },
    sections: { hierarchy: { status: 'available' }, summary: { status: 'available' }, personnel: { status: 'available' }, monthStatuses: { status: 'available' } },
    warnings: [], summary: { totalStores: 3, pendingStores: 1, approvedStores: 1, adjustedApprovedStores: 0, returnedStores: 0, missingStores: 1, totalTargetValue: '1000' },
    companies: [{ companyId: 'company-1', companyName: 'HR Axis', regions: [{ regionId: 'region-1', regionName: 'Marmara', regionManager: { displayName: 'Ada Yılmaz', identityStatus: 'resolved' }, stores: stores.map((item) => ({
      storeId: item.id, storeCode: item.id.toUpperCase(), storeName: item.name, city: null, storeStatus: 'active', status: item.status,
      capabilities: { canCreateRequest: false, canApproveRequest: false },
      request: item.status === 'missing' ? null : { requestId: `request-${item.id}`, status: item.status === 'approved' ? 'approved' : 'pending_region_approval', targetLabel: 'Aylık hedef', totalTargetValue: '1000', allocationCount: 1, requestReason: null, approvalMode: item.status === 'approved' ? 'direct' : null, approvedAt: null, approvalNote: null, createdAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z', allocations: [{ employeeId: 'employee-1', displayName: 'Deniz Ak', targetValue: '1000', note: null }] },
      personnel: [], monthStatuses: [],
    })) }] }],
  },
})

describe('Targets Command Canvas model', () => {
  test('AC-TGT-001/003: merges paginated hierarchy without dropping missing stores', () => {
    const workspace = mergeTargetWorkspacePages([
      response(0, [{ id: 'store-1', name: 'Mall', status: 'pending' }, { id: 'store-2', name: 'Novada', status: 'missing' }]),
      response(2, [{ id: 'store-3', name: 'Cadde', status: 'approved' }]),
    ])
    expect(flattenTargetStores(workspace).map((item) => item.store.storeId)).toEqual(['store-1', 'store-2', 'store-3'])
    expect(buildTargetMetrics(workspace)).toMatchObject({ storeCount: 3, pendingCount: 1, missingCount: 1, approvedCount: 1 })
  })

  test('AC-002: filters locally and preserves the authoritative workspace', () => {
    const workspace = mergeTargetWorkspacePages([response(0, [{ id: 'store-1', name: 'Mall', status: 'pending' }, { id: 'store-2', name: 'Novada', status: 'missing' }])])
    expect(flattenTargetStores(filterTargetWorkspace(workspace, { search: 'novada', status: 'missing' }))).toHaveLength(1)
    expect(flattenTargetStores(workspace)).toHaveLength(2)
  })

  test('EC-004/015: summary metrics stay authoritative and later partial sections remain unavailable', () => {
    const first = response(0, [{ id: 'store-1', name: 'Mall', status: 'pending' }, { id: 'store-2', name: 'Novada', status: 'missing' }])
    const second = response(2, [{ id: 'store-3', name: 'Cadde', status: 'approved' }])
    second.data.sections.personnel.status = 'unavailable'
    second.data.warnings = ['personnel_unavailable']
    const workspace = mergeTargetWorkspacePages([first, second])
    expect(buildTargetMetrics(workspace)).toMatchObject({ storeCount: 3, approvedCount: 1, pendingCount: 1, missingCount: 1 })
    expect(workspace.sections.personnel.status).toBe('unavailable')
    expect(workspace.warnings).toContain('personnel_unavailable')
  })

  test('AC-002: approved metric filter includes direct and adjusted approvals', () => {
    const workspace = mergeTargetWorkspacePages([response(0, [{ id: 'store-1', name: 'Mall', status: 'approved' }])])
    const adjusted = { ...workspace, companies: workspace.companies.map((company) => ({ ...company, regions: company.regions.map((region) => ({ ...region, stores: [...region.stores, { ...region.stores[0]!, storeId: 'store-2', status: 'adjusted_approved' as const }] })) })) }
    expect(flattenTargetStores(filterTargetWorkspace(adjusted, { search: '', status: 'approved_all' }))).toHaveLength(2)
  })

  test('AC-002: sorts target values numerically and deterministically', () => {
    const stores = flattenTargetStores(mergeTargetWorkspacePages([response(0, [{ id: 'store-2', name: 'Novada', status: 'missing' }, { id: 'store-1', name: 'Mall', status: 'pending' }])])).map((item) => item.store)
    expect(sortTargetStores(stores, { key: 'target', direction: 'descending' }).map((store) => store.storeId)).toEqual(['store-1', 'store-2'])
  })
})
