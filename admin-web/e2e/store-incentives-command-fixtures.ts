import type { Page } from './test-fixtures'

export const incentiveRegionA = '10000000-0000-4000-8000-000000000001'
export const incentiveRegionB = '10000000-0000-4000-8000-000000000002'
export const incentiveStoreA = '20000000-0000-4000-8000-000000000001'
export const incentiveStoreB = '20000000-0000-4000-8000-000000000002'
export const incentiveStoreC = '20000000-0000-4000-8000-000000000003'
const employeeA = '30000000-0000-4000-8000-000000000001'
const employeeB = '30000000-0000-4000-8000-000000000002'

export function createIncentiveWorkspace(
  view: 'region_manager' | 'report_viewer',
  options: { partial?: boolean; allReviewed?: boolean; multipleRegions?: boolean; draftCorrection?: boolean; prototypeParity?: boolean } = {},
) {
  const canAct = view === 'region_manager'
  const prototypeStores = options.prototypeParity ? createPrototypeParityStores(canAct, options) : null
  const firstRegion = region({
    regionId: incentiveRegionA,
    regionName: 'İstanbul Avrupa',
    managerName: 'Süleyman Öztürk',
    canAct,
    stores: prototypeStores ? (view === 'report_viewer' ? prototypeStores.slice(0, 2) : prototypeStores) : [
      store({
        storeId: incentiveStoreA, storeName: 'Mall of İstanbul', storeCode: 'MOI', canAct,
        reviewed: true,
        rows: [
          row({ employeeId: employeeA, displayName: 'Süleyman Öztürk', participantType: 'store_manager', rate: '0.0070', calculated: '61050.78', final: '63000.00', correction: true, correctionStatus: options.draftCorrection ? 'draft' : 'admin_approved' }),
          row({ employeeId: employeeB, displayName: 'Derya Uslu', participantType: 'personnel', rate: '0.0150', calculated: '23901.60', final: '23901.60' }),
        ],
      }),
      store({ storeId: incentiveStoreB, storeName: 'Marmara Forum', storeCode: 'MRM', canAct, reviewed: options.allReviewed ?? false, rows: [row({ employeeId: '30000000-0000-4000-8000-000000000003', displayName: 'Can Erdem', participantType: 'personnel', rate: '0.0065', calculated: '7092.80', final: '7092.80' })] }),
    ],
  })
  const regions = [firstRegion]
  if (options.prototypeParity && view === 'report_viewer' && prototypeStores) {
    regions.push(region({
      regionId: incentiveRegionB,
      regionName: 'İstanbul Kuzey',
      managerName: 'Deniz Akar',
      canAct,
      stores: prototypeStores.slice(2, 4),
    }))
    regions.push(region({
      regionId: '10000000-0000-4000-8000-000000000003',
      regionName: 'İstanbul Merkez',
      managerName: 'Burak Yılmaz',
      canAct,
      stores: prototypeStores.slice(4, 6),
    }))
  } else if (options.multipleRegions) {
    regions.push(region({
      regionId: incentiveRegionB,
      regionName: 'İstanbul Anadolu',
      managerName: 'Ayşe Kaya',
      canAct,
      stores: [store({ storeId: incentiveStoreC, storeName: 'Akasya AVM', storeCode: 'AKS', canAct, reviewed: true, rows: [] })],
    }))
  }
  return {
    data: {
      period: '2026-06', periodStart: '2026-06-01', periodEnd: '2026-06-30', periodTimezone: 'Europe/Istanbul', view,
      capabilities: capabilities(canAct),
      sections: {
        core: { status: 'complete' },
        storeMetadata: { status: options.partial ? 'unavailable' : 'complete' },
        rateMetadata: { status: 'complete' },
        correctionActors: { status: 'complete' },
      },
      rateMetadata: {
        status: 'resolved', ruleVersionCode: 'sales-target-incentive-v1.0.0', effectiveFrom: '2026-01-01',
        periodTimezone: 'Europe/Istanbul', bracketBoundaryPolicy: 'lower_inclusive_upper_exclusive',
        tables: [
          { audience: 'manager', version: 'manager-v1', brackets: [
            { minAchievementPct: '80', maxAchievementPct: '85', rate: '0.0020', displayLabel: '%80–%84,99' },
            { minAchievementPct: '85', maxAchievementPct: '90', rate: '0.0030', displayLabel: '%85–%89,99' },
            { minAchievementPct: '90', maxAchievementPct: '95', rate: '0.0040', displayLabel: '%90–%94,99' },
            { minAchievementPct: '95', maxAchievementPct: '100', rate: '0.0050', displayLabel: '%95–%99,99' },
            { minAchievementPct: '100', maxAchievementPct: '110', rate: '0.0070', displayLabel: '%100–%109,99' },
            { minAchievementPct: '110', maxAchievementPct: null, rate: '0.0100', displayLabel: '%110 ve üzeri' },
          ] },
          { audience: 'personnel', version: 'personnel-v1', brackets: [
            { minAchievementPct: '80', maxAchievementPct: '90', rate: '0.0050', displayLabel: '%80–%89,99' },
            { minAchievementPct: '90', maxAchievementPct: '95', rate: '0.0065', displayLabel: '%90–%94,99' },
            { minAchievementPct: '95', maxAchievementPct: '100', rate: '0.0075', displayLabel: '%95–%99,99' },
            { minAchievementPct: '100', maxAchievementPct: '110', rate: '0.0150', displayLabel: '%100–%109,99' },
            { minAchievementPct: '110', maxAchievementPct: null, rate: '0.0165', displayLabel: '%110 ve üzeri' },
          ] },
        ],
      },
      regions,
    },
  }
}

function createPrototypeParityStores(canAct: boolean, options: { allReviewed?: boolean; draftCorrection?: boolean }) {
  return [
    store({
      storeId: incentiveStoreA, storeName: 'Mall of İstanbul', storeCode: 'MOI', city: 'İstanbul', canAct, reviewed: true,
      target: '8200000.00', actual: '8721540.00',
      rows: [
        row({ employeeId: employeeA, displayName: 'Süleyman Öztürk', participantType: 'store_manager', positionCode: 'STORE_MANAGER', target: '8200000.00', actual: '8721540.00', rate: '0.0070', calculated: '61050.78', final: '63000.00', correction: true, correctionStatus: options.draftCorrection ? 'draft' : 'admin_approved' }),
        row({ employeeId: employeeB, displayName: 'Derya Uslu', participantType: 'personnel', positionCode: 'SENIOR_SALES_CONSULTANT', target: '1450000.00', actual: '1593440.00', rate: '0.0150', calculated: '23901.60', final: '23901.60' }),
        row({ employeeId: '30000000-0000-4000-8000-000000000010', displayName: 'Can Erdem', participantType: 'personnel', positionCode: 'SALES_ASSOCIATE', target: '1200000.00', actual: '1091200.00', rate: '0.0065', calculated: '7092.80', final: '7092.80' }),
      ],
    }),
    store({
      storeId: incentiveStoreB, storeName: 'Marmara Forum', storeCode: 'MRM', city: 'İstanbul', canAct, reviewed: options.allReviewed ?? false,
      target: '7600000.00', actual: '7334600.00',
      rows: [
        row({ employeeId: '30000000-0000-4000-8000-000000000011', displayName: 'Alaattin Haşim', participantType: 'store_manager', target: '7600000.00', actual: '7334600.00', rate: '0.0050', calculated: '36673.00', final: '36673.00' }),
        row({ employeeId: '30000000-0000-4000-8000-000000000012', displayName: 'Elif Kara', participantType: 'personnel', positionCode: 'ASSISTANT_MANAGER', target: '1350000.00', actual: '1402900.00', rate: '0.0075', calculated: '10521.75', final: '10521.75' }),
      ],
    }),
    store({
      storeId: incentiveStoreC, storeName: 'İstinyePark', storeCode: 'IST', city: 'İstanbul', canAct, reviewed: true,
      target: '9100000.00', actual: '10182700.00',
      rows: [
        row({ employeeId: '30000000-0000-4000-8000-000000000013', displayName: 'Nehir Kara', participantType: 'store_manager', target: '9100000.00', actual: '10182700.00', rate: '0.0100', calculated: '101827.00', final: '101827.00' }),
        row({ employeeId: '30000000-0000-4000-8000-000000000014', displayName: 'Pelin Acar', participantType: 'personnel', positionCode: 'SENIOR_SALES_CONSULTANT', target: '1600000.00', actual: '1812340.00', rate: '0.0165', calculated: '29903.61', final: '29903.61' }),
      ],
    }),
    store({
      storeId: '20000000-0000-4000-8000-000000000004', storeName: 'Aqua Florya', storeCode: 'AFL', city: 'İstanbul', canAct, reviewed: false,
      target: '4800000.00', actual: '3764200.00',
      rows: [
        row({ employeeId: '30000000-0000-4000-8000-000000000015', displayName: 'Emre Korkmaz', participantType: 'store_manager', target: '4800000.00', actual: '3764200.00', rate: '0.0000', calculated: '0.00', final: '0.00' }),
        row({ employeeId: '30000000-0000-4000-8000-000000000016', displayName: 'Buse Demir', participantType: 'personnel', target: '920000.00', actual: '733100.00', rate: '0.0000', calculated: '0.00', final: '0.00' }),
      ],
    }),
    store({
      storeId: '20000000-0000-4000-8000-000000000005', storeName: 'Bağdat Caddesi', storeCode: 'BCD', city: 'İstanbul', canAct, reviewed: true,
      target: '6700000.00', actual: '7421500.00',
      rows: [
        row({ employeeId: '30000000-0000-4000-8000-000000000017', displayName: 'Ayşe Demir', participantType: 'store_manager', target: '6700000.00', actual: '7421500.00', rate: '0.0100', calculated: '74215.00', final: '76000.00', correction: true }),
        row({ employeeId: '30000000-0000-4000-8000-000000000018', displayName: 'Cem Aksoy', participantType: 'personnel', target: '1200000.00', actual: '1320000.00', rate: '0.0165', calculated: '21780.00', final: '21780.00' }),
        row({ employeeId: '30000000-0000-4000-8000-000000000019', displayName: 'Aylin Çelik', participantType: 'personnel', positionCode: 'ASSISTANT_MANAGER', target: '1300000.00', actual: '1524870.00', rate: '0.0165', calculated: '25160.36', final: '26000.00', correction: true }),
      ],
    }),
    store({
      storeId: '20000000-0000-4000-8000-000000000006', storeName: 'Capacity AVM', storeCode: 'CAP', city: 'İstanbul', canAct, reviewed: false,
      target: '5900000.00', actual: '4720000.00',
      rows: [
        row({ employeeId: '30000000-0000-4000-8000-000000000020', displayName: 'Mert Alcan', participantType: 'store_manager', target: '5900000.00', actual: '5488760.00', rate: '0.0040', calculated: '21955.04', final: '21955.04' }),
        row({ employeeId: '30000000-0000-4000-8000-000000000021', displayName: 'Cansu Tunç', participantType: 'personnel', target: '1050000.00', actual: '1011220.00', rate: '0.0065', calculated: '6572.93', final: '6572.93' }),
      ],
    }),
  ]
}

export async function routeIncentiveWorkspace(page: Page, fixture: ReturnType<typeof createIncentiveWorkspace>) {
  await page.route('**/api/store/incentives/workspace**', async (route) => {
    await route.fulfill({ json: fixture })
  })
}

export async function routeIncentiveCommands(
  page: Page,
  requests: Array<{ path: string; body: unknown }>,
  delayMs = 0,
  failPaths: ReadonlySet<string> = new Set(),
) {
  await page.route('**/api/store/incentives/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (request.method() === 'GET') { await route.fallback(); return }
    requests.push({ path, body: request.postDataJSON() })
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs))
    if (failPaths.has(path)) {
      await route.fulfill({ status: 409, json: { message: 'Command rejected by workflow guard' } })
      return
    }
    if (path.endsWith('/store-reviews')) {
      await route.fulfill({ json: { data: { period: '2026-06', storeId: incentiveStoreB, reviewStatus: 'reviewed', reviewedByUserId: 'user', reviewedAt: '2026-07-01T10:00:00.000Z' } } })
      return
    }
    if (path.endsWith('/corrections/void')) {
      await route.fulfill({ json: { data: { correctionId: '40000000-0000-4000-8000-000000000001', status: 'voided' } } })
      return
    }
    if (path.endsWith('/corrections')) {
      await route.fulfill({ json: { data: { correctionId: '40000000-0000-4000-8000-000000000002', status: 'draft' } } })
      return
    }
    await route.fulfill({ json: { data: { period: '2026-06', regionId: incentiveRegionA, regionPackageId: '50000000-0000-4000-8000-000000000001', regionPackageStatus: 'submitted', submittedAt: '2026-07-01T10:00:00.000Z', reviewedAt: null, reviewNote: null } } })
  })
}

function region(input: { regionId: string; regionName: string; managerName: string; canAct: boolean; stores: ReturnType<typeof store>[] }) {
  return {
    regionId: input.regionId, regionName: input.regionName, regionManager: { displayName: input.managerName },
    capabilities: { canSubmitPackage: input.canAct },
    package: { status: 'not_submitted', submittedAt: null, reviewedAt: null, reviewNote: null },
    stores: input.stores,
  }
}

function store(input: { storeId: string; storeName: string; storeCode: string; city?: string | null; target?: string; actual?: string; canAct: boolean; reviewed: boolean; rows: ReturnType<typeof row>[] }) {
  const target = input.target ?? '8200000.00'
  const actual = input.actual ?? '8721540.00'
  return {
    storeId: input.storeId, storeCode: input.storeCode, storeName: input.storeName, city: input.city ?? null,
    storeTarget: target, storeActualNetSales: actual, storeAchievementPct: target === '0.00' ? null : ((Number(actual) / Number(target)) * 100).toFixed(4),
    capabilities: {
      canMarkStoreReview: input.canAct,
      canCreateCorrection: input.canAct,
      canVoidCorrection: input.canAct && input.rows.some((item) => item.correction?.status === 'draft' || item.correction?.status === 'admin_returned'),
    },
    review: { status: input.reviewed ? 'reviewed' : 'pending_review', reviewedAt: input.reviewed ? '2026-07-01T09:00:00.000Z' : null, periodCloseStatus: 'closed' },
    rows: input.rows,
  }
}

function row(input: {
  employeeId: string
  displayName: string
  participantType: 'store_manager' | 'personnel'
  rate: string
  calculated: string
  final: string
  correction?: boolean
  correctionStatus?: 'draft' | 'admin_approved'
  positionCode?: string
  target?: string
  actual?: string
}) {
  const delta = input.correction ? '1949.22' : '0.00'
  const correction = input.correction ? {
    correctionId: '40000000-0000-4000-8000-000000000001', status: input.correctionStatus ?? 'admin_approved', beforeAmount: input.calculated,
    adjustmentAmount: delta, finalAmount: input.final, reasonNote: 'Dönem içi mağaza desteği doğrulandı.',
    createdAt: '2026-06-30T10:00:00.000Z', submittedAt: '2026-06-30T10:00:00.000Z', reviewedAt: '2026-07-01T10:00:00.000Z', reviewNote: 'Onaylandı',
    actor: { displayName: 'Süleyman Öztürk', roleCode: 'REGION_MANAGER', identityStatus: 'resolved' },
  } : null
  return {
    employeeId: input.employeeId, displayName: input.displayName, participantType: input.participantType,
    positionCode: input.positionCode ?? (input.participantType === 'store_manager' ? 'STORE_MANAGER' : 'SALES_ASSOCIATE'),
    target: input.target ?? (input.participantType === 'store_manager' ? '8200000.00' : '1450000.00'),
    actual: input.actual ?? (input.participantType === 'store_manager' ? '8721540.00' : '1593440.00'), achievementPct: '109.8900',
    rate: input.rate, calculatedAmount: input.calculated, finalAmount: input.final, signedDifferenceAmount: delta,
    status: input.correction ? 'corrected' : 'projected', correction, correctionRecords: correction ? [correction] : [],
  }
}

function capabilities(enabled: boolean) {
  return { canMarkStoreReview: enabled, canCreateCorrection: enabled, canVoidCorrection: enabled, canSubmitPackage: enabled }
}
