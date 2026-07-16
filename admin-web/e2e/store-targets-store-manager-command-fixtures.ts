import type { Page } from './test-fixtures'

export const storeManagerStoreId = '20000000-0000-4000-8000-000000000201'

type StoreManagerTargetOptions = {
  basisError?: boolean
  approvedRequestReason?: string
  divergentLocalRequest?: boolean
  failSubmit?: boolean
  holdBasis?: boolean
  inheritedJune?: boolean
  longNames?: boolean
  multipleStores?: boolean
  noPersonnel?: boolean
  partial?: boolean
  statusOverride?: 'returned' | 'revision_conflict' | 'stale_reference' | 'unknown'
}

export async function routeStoreManagerTargetCommand(page: Page, options: StoreManagerTargetOptions = {}) {
  const payloads: unknown[] = []
  const basisRequests: string[] = []
  let failWorkspaceRefetch = false
  let releaseBasis = () => undefined
  const basisGate = options.holdBasis
    ? new Promise<void>((resolve) => {
        releaseBasis = resolve
      })
    : Promise.resolve()
  await page.route('**/api/store/targets/workspace**', async (route) => {
    if (failWorkspaceRefetch) {
      await route.fulfill({ status: 500, json: { message: 'workspace refresh unavailable' } })
      return
    }
    const url = new URL(route.request().url())
    await route.fulfill({
      json: workspace(url.searchParams.get('period') ?? '2026-07', options),
    })
  })
  await page.route('**/api/target-distributions/revision-basis**', async (route) => {
    basisRequests.push(route.request().url())
    await basisGate
    if (options.basisError) {
      await route.fulfill({ status: 500, json: { message: 'revision basis unavailable' } })
      return
    }
    const requestMonth = new URL(route.request().url()).searchParams.get('requestMonth')
    await route.fulfill({
      json: {
        requestMonth: requestMonth ?? '2026-07-01',
        storeId: storeManagerStoreId,
        periodClosed: false,
        items:
          requestMonth === '2026-06-01'
            ? [
                {
                  targetReferenceId: 'reference-1',
                  employeeId: 'employee-1',
                  displayName: 'Derya Uslu',
                  targetValue: 4000000,
                  note: null,
                },
                {
                  targetReferenceId: 'reference-2',
                  employeeId: 'employee-2',
                  displayName: 'Can Erdem',
                  targetValue: 4000000,
                  note: null,
                },
                {
                  targetReferenceId: 'reference-3',
                  employeeId: 'employee-former',
                  displayName: 'Eski Personel',
                  targetValue: 1000000,
                  note: null,
                },
              ]
            : [],
      },
    })
  })
  await page.route('**/api/target-distributions/requests', async (route) => {
    if (route.request().method() === 'POST') {
      payloads.push(route.request().postDataJSON())
      if (options.failSubmit) {
        await route.fulfill({
          status: 500,
          json: { message: 'internal target submission failed' },
        })
        return
      }
      await route.fulfill({
        json: {
          command: { status: 'accepted', message: 'saved' },
          data: { request: {} },
        },
      })
      return
    }
    await route.fallback()
  })
  return {
    get payloads() {
      return payloads
    },
    get basisRequests() {
      return basisRequests
    },
    failWorkspaceRefresh() {
      failWorkspaceRefetch = true
    },
    restoreWorkspaceRefresh() {
      failWorkspaceRefetch = false
    },
    releaseBasis,
  }
}

function workspace(period: string, options: StoreManagerTargetOptions) {
  const approved = period === '2026-06'
  const pending = period === '2026-08'
  const request =
    approved && !options.inheritedJune
      ? targetRequest('approved', options.approvedRequestReason ?? null, options.divergentLocalRequest ?? false)
      : pending
        ? targetRequest('pending_region_approval')
        : null
  const status =
    options.statusOverride ?? (approved && !options.inheritedJune ? 'approved' : pending ? 'pending' : 'missing')
  const result = {
    data: {
      period,
      periodStart: `${period}-01`,
      periodEnd: `${period}-28`,
      periodTimezone: 'Europe/Istanbul',
      historyYear: Number(period.slice(0, 4)),
      view: 'store_manager',
      capabilities: { canCreateRequest: true, canApproveRequest: false },
      pagination: { total: 1, limit: 1, offset: 0, hasMore: false },
      sections: {
        hierarchy: { status: 'available' },
        summary: { status: 'available' },
        personnel: { status: options.partial ? 'unavailable' : 'available' },
        monthStatuses: { status: 'available' },
      },
      warnings: options.partial ? ['personnel_unavailable'] : [],
      summary: {
        totalStores: 1,
        pendingStores: pending ? 1 : 0,
        approvedStores: approved ? 1 : 0,
        adjustedApprovedStores: 0,
        returnedStores: 0,
        missingStores: request ? 0 : 1,
        totalTargetValue: request?.totalTargetValue ?? '0',
      },
      companies: [
        {
          companyId: 'company-1',
          companyName: 'HR Axis',
          regions: [
            {
              regionId: 'region-1',
              regionName: 'İstanbul Avrupa',
              regionManager: {
                displayName: 'Süleyman Öztürk',
                identityStatus: 'resolved',
              },
              stores: [
                {
                  storeId: storeManagerStoreId,
                  storeCode: 'MOI',
                  storeName: options.longNames
                    ? 'İstanbul Uluslararası Finans ve Yaşam Merkezi Mağazası'
                    : 'Mall of İstanbul',
                  city: null,
                  storeStatus: 'active',
                  status,
                  capabilities: {
                    canCreateRequest: !pending,
                    canApproveRequest: false,
                  },
                  request,
                  personnel: options.noPersonnel
                    ? []
                    : [
                        {
                          employeeId: 'employee-1',
                          displayName: options.longNames ? 'Derya Nur Uslu Karahisarlıoğlu' : 'Derya Uslu',
                          positionCode: 'SALES',
                          positionLabel: 'Satış danışmanı',
                          targetValue: approved ? '5000000' : null,
                          eligibilityStatus: 'targetable',
                        },
                        {
                          employeeId: 'employee-2',
                          displayName: 'Can Erdem',
                          positionCode: 'SALES',
                          positionLabel: 'Satış danışmanı',
                          targetValue: approved ? '4000000' : null,
                          eligibilityStatus: 'targetable',
                        },
                        ...(approved && !options.inheritedJune
                          ? [
                              {
                                employeeId: 'employee-former',
                                displayName: 'Eski Personel',
                                positionCode: null,
                                positionLabel: null,
                                targetValue: '1000000',
                                eligibilityStatus: 'historical_allocation' as const,
                              },
                            ]
                          : []),
                      ],
                  monthStatuses: Array.from({ length: 12 }, (_, index) => {
                    const month = `2026-${String(index + 1).padStart(2, '0')}`
                    return month === '2026-06'
                      ? {
                          period: month,
                          status: 'approved',
                          approvalStatus: 'approved',
                          isApproved: true,
                        }
                      : month === '2026-08'
                        ? {
                            period: month,
                            status: 'pending',
                            approvalStatus: null,
                            isApproved: false,
                          }
                        : {
                            period: month,
                            status: 'unknown',
                            approvalStatus: null,
                            isApproved: false,
                          }
                  }),
                },
              ],
            },
          ],
        },
      ],
    },
  }
  if (options.multipleStores) {
    const stores = result.data.companies[0].regions[0].stores
    stores.push({
      ...stores[0],
      storeId: '20000000-0000-4000-8000-000000000202',
      storeCode: 'SECOND',
      storeName: 'İkinci Yetkili Mağaza',
      status: 'missing',
      request: null,
      personnel: [],
    })
    result.data.pagination.total = 2
    result.data.summary.totalStores = 2
    result.data.summary.missingStores += 1
  }
  return result
}

function targetRequest(
  status: 'approved' | 'pending_region_approval',
  requestReason: string | null = null,
  divergent = false,
) {
  return {
    requestId: `request-${status}`,
    status,
    targetLabel: 'Aylık personel hedef dağıtımı',
    totalTargetValue: divergent ? '7000000' : '9000000',
    allocationCount: divergent ? 1 : 3,
    requestReason,
    approvalMode: status === 'approved' ? 'direct' : null,
    approvedAt: status === 'approved' ? '2026-06-10T09:00:00Z' : null,
    approvalNote: null,
    createdAt: '2026-06-01T09:00:00Z',
    updatedAt: '2026-06-10T09:00:00Z',
    allocations: divergent
      ? [
          {
            employeeId: 'employee-1',
            displayName: 'Derya Uslu',
            targetValue: '7000000',
            note: null,
          },
        ]
      : [
          {
            employeeId: 'employee-1',
            displayName: 'Derya Uslu',
            targetValue: '4000000',
            note: null,
          },
          {
            employeeId: 'employee-2',
            displayName: 'Can Erdem',
            targetValue: '4000000',
            note: null,
          },
          {
            employeeId: 'employee-former',
            displayName: 'Eski Personel',
            targetValue: '1000000',
            note: null,
          },
        ],
  }
}
