import type { Page, Route } from './test-fixtures'

export const targetStoreA = '20000000-0000-4000-8000-000000000101'
export const targetStoreB = '20000000-0000-4000-8000-000000000102'
export const targetStoreC = '20000000-0000-4000-8000-000000000103'

export function createTargetWorkspace(view: 'region_manager' | 'report_viewer', options: { directUnbalanced?: boolean; partial?: boolean; offset?: number } = {}) {
  const canApprove = view === 'region_manager'
  const allStores = [
    store(targetStoreA, 'Mall of İstanbul', 'MOI', 'pending', canApprove),
    store(targetStoreB, 'Edirne Novada', 'NOV', 'missing', canApprove),
    store(targetStoreC, 'İstinyePark', 'IST', 'approved', canApprove),
  ]
  if (options.directUnbalanced && allStores[0]?.request) allStores[0].request.allocations[0]!.targetValue = '0.00'
  const offset = options.offset ?? 0
  const stores = offset === 0 ? allStores.slice(0, 2) : allStores.slice(2)
  const regions = view === 'report_viewer'
    ? [region('region-a', 'İstanbul Avrupa', 'Süleyman Öztürk', stores.filter((item) => item.storeId !== targetStoreC)), region('region-b', 'İstanbul Kuzey', 'Deniz Akar', stores.filter((item) => item.storeId === targetStoreC))].filter((item) => item.stores.length)
    : [region('region-a', 'İstanbul Avrupa', 'Süleyman Öztürk', stores)]
  return { data: {
    period: '2026-07', periodStart: '2026-07-01', periodEnd: '2026-07-31', periodTimezone: 'Europe/Istanbul', historyYear: 2026, view,
    capabilities: { canCreateRequest: false, canApproveRequest: canApprove },
    pagination: { total: 3, limit: stores.length, offset, hasMore: offset + stores.length < 3 },
    sections: { hierarchy: { status: 'available' }, summary: { status: 'available' }, personnel: { status: options.partial ? 'unavailable' : 'available' }, monthStatuses: { status: 'available' } },
    warnings: options.partial ? ['personnel_unavailable'] : [],
    summary: { totalStores: 3, pendingStores: 1, approvedStores: 1, adjustedApprovedStores: 0, returnedStores: 0, missingStores: 1, totalTargetValue: '17300000.00' },
    companies: [{ companyId: 'company-1', companyName: 'HR Axis', regions }],
  } }
}

export async function routeTargetWorkspace(page: Page, view: 'region_manager' | 'report_viewer', options: { directUnbalanced?: boolean; partial?: boolean; partialPage2?: boolean } = {}) {
  let reads = 0
  const mutations: string[] = []
  let approvedPayload: unknown = null
  await page.route('**/api/store/targets/workspace**', async (route) => {
    reads += 1
    const offset = Number(new URL(route.request().url()).searchParams.get('offset') ?? '0')
    await route.fulfill({ json: createTargetWorkspace(view, { directUnbalanced: options.directUnbalanced, partial: options.partial || (options.partialPage2 && offset > 0), offset }) })
  })
  await page.route('**/api/target-distributions/requests/*/approve', async (route) => {
    mutations.push(route.request().method())
    approvedPayload = route.request().postDataJSON()
    await route.fulfill({ json: { command: { status: 'approved', message: 'approved' }, data: { request: {} } } })
  })
  return { get reads() { return reads }, get mutations() { return mutations }, get approvedPayload() { return approvedPayload } }
}

function region(regionId: string, regionName: string, displayName: string, stores: ReturnType<typeof store>[]) {
  return { regionId, regionName, regionManager: { displayName, identityStatus: 'resolved' as const }, stores }
}

function store(storeId: string, storeName: string, storeCode: string, status: 'pending' | 'missing' | 'approved', canApprove: boolean) {
  const request = status === 'missing' ? null : {
    requestId: `request-${storeCode}`, status: status === 'approved' ? 'approved' as const : 'pending_region_approval' as const,
    targetLabel: 'Aylık personel hedef dağıtımı', totalTargetValue: status === 'approved' ? '9100000.00' : '8200000.00', allocationCount: 2,
    requestReason: status === 'pending' ? 'Temmuz kadro değişimi dikkate alındı.' : null, approvalMode: status === 'approved' ? 'direct' as const : null,
    approvedAt: status === 'approved' ? '2026-07-10T09:00:00Z' : null, approvalNote: null, createdAt: '2026-07-08T09:42:00Z', updatedAt: '2026-07-11T09:42:00Z',
    allocations: [{ employeeId: 'employee-1', displayName: 'Derya Uslu', targetValue: status === 'approved' ? '5000000.00' : '4200000.00', note: null }, { employeeId: 'employee-2', displayName: 'Can Erdem', targetValue: '4000000.00', note: null }],
  }
  const personnel = status === 'missing'
    ? [{ employeeId: 'employee-3', displayName: 'Yeni Personel', positionCode: 'SALES', positionLabel: 'Satış danışmanı', targetValue: null, eligibilityStatus: 'targetable' as const }]
    : [
        { employeeId: 'employee-1', displayName: 'Derya Uslu', positionCode: 'SALES', positionLabel: 'Satış danışmanı', targetValue: request?.allocations[0]?.targetValue ?? null, eligibilityStatus: 'targetable' as const },
        { employeeId: 'employee-2', displayName: 'Can Erdem', positionCode: 'SALES', positionLabel: 'Satış danışmanı', targetValue: request?.allocations[1]?.targetValue ?? null, eligibilityStatus: 'targetable' as const },
      ]
  return { storeId, storeCode, storeName, city: null, storeStatus: 'active', status, capabilities: { canCreateRequest: false, canApproveRequest: canApprove && status === 'pending' }, request, personnel, monthStatuses: [] }
}
