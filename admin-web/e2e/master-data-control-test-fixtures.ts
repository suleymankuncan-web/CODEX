import type { Page } from '@playwright/test'

export async function routeMasterDataControlApi(page: Page) {
  await page.route('**/api/integrations/master-data-quality/issues?**', async (route) => {
    await route.fulfill({ json: masterDataQualityIssuesFixture })
  })

  await page.route('**/api/integrations/master-data-quality/audit?**', async (route) => {
    await route.fulfill({ json: masterDataQualityAuditFixture })
  })

  await page.route('**/api/integrations/store-master-lookups', async (route) => {
    await route.fulfill({ json: storeMasterLookupsFixture })
  })

  await page.route('**/api/integrations/store-master?**', async (route) => {
    await route.fulfill({ json: storeMasterFixture })
  })

  await page.route('**/api/integrations/personnel-master-lookups', async (route) => {
    await route.fulfill({ json: personnelMasterLookupsFixture })
  })

  await page.route('**/api/integrations/personnel-master?**', async (route) => {
    await route.fulfill({ json: personnelMasterFixture })
  })
}

const storeId = '00000000-0000-0000-0000-000000000100'
const regionId = '00000000-0000-0000-0000-000000000010'
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
  regions: [{ regionId, regionCode: 'PILOT', regionName: 'Pilot Bolgesi' }],
}

const storeMasterFixture = {
  items: [
    {
      storeId,
      storeCode: 'PILOT-100',
      storeName: 'Accepted personnel baseline',
      storeType: 'company',
      status: 'active',
      kpiImportEnabled: true,
      regionId,
      regionName: 'Pilot Bolgesi',
      updatedAt: '2026-06-30T10:00:00.000Z',
    },
  ],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}

const personnelMasterLookupsFixture = {
  stores: [
    {
      storeId,
      storeCode: 'PILOT-100',
      storeName: 'Accepted personnel baseline',
      regionId,
      regionName: 'Pilot Bolgesi',
    },
  ],
  positions: [
    {
      positionId,
      positionCode: 'SALES',
      positionName: 'Satis Danismani',
      isManagerial: false,
    },
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

const personnelMasterFixture = {
  items: [
    {
      employeeId,
      externalEmployeeRef: 'CORP-100',
      firstName: 'Pilot',
      lastName: 'Personel',
      displayName: 'Pilot Personel',
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
  ],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}
