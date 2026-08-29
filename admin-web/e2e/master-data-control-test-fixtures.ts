import type { Page } from '@playwright/test'

export async function routeMasterDataControlApi(page: Page) {
  await routeMasterDataQualityApi(page)

  await page.route('**/api/integrations/store-master-lookups', async (route) => {
    await route.fulfill({ json: storeMasterLookupsFixture })
  })

  await page.route('**/api/integrations/store-master?**', async (route) => {
    await route.fulfill({ json: buildStoreMasterFixture(new URL(route.request().url())) })
  })

  await page.route('**/api/integrations/personnel-master-lookups', async (route) => {
    await route.fulfill({ json: personnelMasterLookupsFixture })
  })

  await page.route('**/api/integrations/personnel-master.xlsx', async (route) => {
    await route.fulfill({
      body: Buffer.from('synthetic-xlsx'),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      headers: { 'Content-Disposition': 'attachment; filename="personel-listesi-2026-08-28.xlsx"' },
    })
  })

  await page.route('**/api/integrations/personnel-master?**', async (route) => {
    await route.fulfill({ json: buildPersonnelMasterFixture(new URL(route.request().url())) })
  })
}

export async function routeMasterDataQualityApi(page: Page) {
  await page.route('**/api/integrations/master-data-quality/issues?**', async (route) => {
    await route.fulfill({ json: masterDataQualityIssuesFixture })
  })

  await page.route('**/api/integrations/master-data-quality/audit?**', async (route) => {
    await route.fulfill({ json: masterDataQualityAuditFixture })
  })
}

const storeId = '00000000-0000-0000-0000-000000000100'
const regionId = '00000000-0000-0000-0000-000000000010'
const secondRegionId = '00000000-0000-0000-0000-000000000011'
const employeeId = '00000000-0000-0000-0000-000000000200'
const positionId = '00000000-0000-0000-0000-000000000400'

const masterDataQualityIssuesFixture = {
  items: [
    {
      id: 'admin-routing-master-data-issue',
      issueCode: 'store_missing_region_assignment',
      severity: 'critical',
      entityType: 'store',
      entityId: storeId,
      entityLabel: 'Accepted personnel baseline',
      secondaryLabel: 'Magaza kaydi',
      problemLabel: 'Bolge muduru atamasi eksik',
      recommendedAction: 'Magaza bolgesini ve sorumlu yoneticiyi secin.',
      affectedModules: ['KPI', 'Hedefler', 'Primler'],
      lastSeenAt: '2026-06-30T10:00:00.000Z',
      source: 'store-master',
    },
  ],
  summary: {
    severity: { critical: 1, warning: 0, info: 0 },
    entityType: { store: 1, personnel: 0, assignment: 0, import: 0 },
  },
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}

const masterDataQualityAuditFixture = {
  items: [
    {
      eventId: 'admin-routing-master-data-audit',
      eventType: 'store_master_updated',
      entityType: 'store',
      entityId: storeId,
      entityLabel: 'Accepted personnel baseline',
      actorLabel: 'Admin',
      occurredAt: '2026-06-30T10:30:00.000Z',
      summary: 'Magaza bolgesi guncellendi.',
      metadata: {},
    },
  ],
  meta: { count: 1, total: 1, limit: 30, offset: 0 },
}

const storeMasterLookupsFixture = {
  storeTypes: [
    { value: 'company', label: 'Sirket magazasi' },
    { value: 'franchise', label: 'Bayi' },
    { value: 'operator', label: 'Isletme' },
  ],
  statuses: [
    { value: 'active', label: 'Aktif' },
    { value: 'inactive', label: 'Pasif' },
    { value: 'closed', label: 'Kapali' },
  ],
  regions: [
    { regionId, regionCode: 'PILOT', regionName: 'Pilot Bolgesi' },
    { regionId: secondRegionId, regionCode: 'NORTH', regionName: 'Kuzey Bolgesi' },
  ],
  regionManagers: [
    {
      assignmentId: '00000000-0000-0000-0000-000000000501',
      userId: '00000000-0000-0000-0000-000000000502',
      displayName: 'Eda Doğanay',
      email: 'eda.doganay@example.com',
      regionId,
      regionCode: 'PILOT',
      regionName: 'Pilot Bolgesi',
    },
    {
      assignmentId: '00000000-0000-0000-0000-000000000511',
      userId: '00000000-0000-0000-0000-000000000512',
      displayName: 'Can Yılmaz',
      email: 'can.yilmaz@example.com',
      regionId: secondRegionId,
      regionCode: 'NORTH',
      regionName: 'Kuzey Bolgesi',
    },
  ],
}

const storeMasterItems = [
  {
      storeId,
      storeCode: 'PILOT-100',
      storeName: 'Accepted personnel baseline',
      storeType: 'company',
      status: 'active',
      kpiImportEnabled: true,
      regionId,
      regionName: 'Pilot Bolgesi',
      regionManagerUserId: '00000000-0000-0000-0000-000000000502',
      regionManagerName: 'onprem.region-manager',
      updatedAt: '2026-06-30T10:00:00.000Z',
  },
  ...Array.from({ length: 24 }, (_, index) => {
    const number = String(index + 1).padStart(3, '0')
    return {
      storeId: `00000000-0000-0000-0002-${String(index + 1).padStart(12, '0')}`,
      storeCode: `MAG-${number}`,
      storeName: `Mağaza ${number}`,
      storeType: 'company',
      status: 'active',
      kpiImportEnabled: true,
      regionId,
      regionName: 'Pilot Bolgesi',
      regionManagerUserId: '00000000-0000-0000-0000-000000000502',
      regionManagerName: 'onprem.region-manager',
      updatedAt: '2026-06-30T10:00:00.000Z',
    }
  }),
]

const personnelMasterLookupsFixture = {
  stores: [
    {
      storeId,
      storeCode: 'PILOT-100',
      storeName: 'Accepted personnel baseline',
      regionId,
      regionName: 'Pilot Bolgesi',
    },
    ...Array.from({ length: 159 }, (_, index) => {
      const number = String(index + 1).padStart(3, '0')
      return {
        storeId: `00000000-0000-0000-0001-${String(index + 1).padStart(12, '0')}`,
        storeCode: `SUBE-${number}`,
        storeName: `Şube ${number}`,
        regionId,
        regionName: 'Pilot Bolgesi',
      }
    }),
  ],
  positions: [
    {
      positionId,
      positionCode: 'SALES_ASSOCIATE',
      positionName: 'Satış Danışmanı',
      isManagerial: false,
    },
    { positionId: '00000000-0000-0000-0000-000000000401', positionCode: 'STORE_MANAGER', positionName: 'Mağaza Müdürü', isManagerial: true },
    { positionId: '00000000-0000-0000-0000-000000000402', positionCode: 'ASSISTANT_MANAGER', positionName: 'Mağaza Müdür Yardımcısı', isManagerial: true },
    { positionId: '00000000-0000-0000-0000-000000000403', positionCode: 'SENIOR_SALES_CONSULTANT', positionName: 'Uzman Satış Danışmanı', isManagerial: false },
    { positionId: '00000000-0000-0000-0000-000000000404', positionCode: 'CASHIER_SUPERVISOR', positionName: 'Kasa Sorumlusu', isManagerial: false },
  ],
  employmentStatuses: [
    { value: 'active', label: 'Aktif' },
    { value: 'inactive', label: 'Pasif' },
    { value: 'terminated', label: 'Ayrildi' },
  ],
  employmentTypes: [
    { value: 'full_time', label: 'Tam zamanli' },
    { value: 'part_time', label: 'Yari zamanli' },
    { value: 'temporary', label: 'Gecici' },
  ],
}

const personnelMasterItems = [
  {
      employeeId,
      externalEmployeeRef: 'CORP-100',
      firstName: 'Pilot',
      lastName: 'Personel',
      displayName: 'Pilot Personel',
      nationalIdLast4: '8901',
      phoneNumber: '+90 555 111 22 33',
      hireDate: '2025-06-28',
      terminationDate: null,
      employmentStatus: 'active',
      employmentType: 'full_time',
      assignmentId: '00000000-0000-0000-0000-000000000300',
      assignmentStartDate: '2025-06-28',
      storeId,
      storeCode: 'PILOT-100',
      storeName: 'Accepted personnel baseline',
      regionId,
      regionName: 'Pilot Bolgesi',
      positionId,
      positionCode: 'SALES',
      positionName: 'Satis Danismani',
      updatedAt: '2026-06-30T10:00:00.000Z',
  },
  ...Array.from({ length: 24 }, (_, index) => buildPersonnelFixture(index + 1, 'active')),
  ...Array.from({ length: 2 }, (_, index) => buildPersonnelFixture(index + 30, 'inactive')),
  ...Array.from({ length: 3 }, (_, index) => buildPersonnelFixture(index + 40, 'terminated')),
]

function buildPersonnelFixture(index: number, employmentStatus: 'active' | 'inactive' | 'terminated') {
  const number = String(index).padStart(3, '0')
  return {
    employeeId: `00000000-0000-0000-0003-${String(index).padStart(12, '0')}`,
    externalEmployeeRef: `EMP-${number}`,
    firstName: `Personel ${number}`,
    lastName: 'Demo',
    displayName: `Personel ${number} Demo`,
    nationalIdLast4: String(8000 + index).slice(-4),
    phoneNumber: `+90 555 100 ${number.slice(0, 1)}${number.slice(1)}`,
    hireDate: '2025-06-28',
    terminationDate: employmentStatus === 'terminated' ? '2026-08-27' : null,
    employmentStatus,
    employmentType: 'full_time',
    assignmentId: employmentStatus === 'terminated' ? null : `00000000-0000-0000-0004-${String(index).padStart(12, '0')}`,
    assignmentStartDate: employmentStatus === 'terminated' ? null : '2025-06-28',
    storeId,
    storeCode: 'PILOT-100',
    storeName: 'Accepted personnel baseline',
    regionId,
    regionName: 'Pilot Bolgesi',
    positionId,
    positionCode: 'SALES',
    positionName: 'Satis Danismani',
    updatedAt: '2026-06-30T10:00:00.000Z',
  }
}

function buildStoreMasterFixture(url: URL) {
  const query = (url.searchParams.get('q') ?? '').trim().toLocaleLowerCase('tr-TR')
  const filtered = query
    ? storeMasterItems.filter((item) => `${item.storeName} ${item.storeCode}`.toLocaleLowerCase('tr-TR').includes(query))
    : storeMasterItems
  return paginate(filtered, url)
}

function buildPersonnelMasterFixture(url: URL) {
  const query = (url.searchParams.get('q') ?? '').trim().toLocaleLowerCase('tr-TR')
  const status = url.searchParams.get('status')
  const filtered = personnelMasterItems.filter((item) => {
    if (status && item.employmentStatus !== status) return false
    if (!query) return true
    return `${item.displayName} ${item.externalEmployeeRef ?? ''} ${item.phoneNumber ?? ''} ${item.storeName ?? ''}`
      .toLocaleLowerCase('tr-TR')
      .includes(query)
  })
  return paginate(filtered, url)
}

function paginate<T>(items: T[], url: URL) {
  const limit = Math.max(1, Number(url.searchParams.get('limit') ?? 20))
  const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0))
  const pageItems = items.slice(offset, offset + limit)
  return {
    items: pageItems,
    meta: { count: pageItems.length, total: items.length, limit, offset },
  }
}
