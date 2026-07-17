import { expect, test, type Page } from './test-fixtures'
import { routeStoreManagerTargetCommand } from './store-targets-store-manager-command-fixtures'

const companyId = '00000000-0000-0000-0000-000000000001'
const storeId = '00000000-0000-0000-0000-000000000100'
const regionId = '00000000-0000-0000-0000-000000000010'
const employeeId = '00000000-0000-0000-0000-000000000202'
const checklistInstanceId = '11111111-1111-4111-8111-111111111111'
const checklistTemplateId = '22222222-2222-4222-8222-222222222222'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'store-manager-persona-user',
        mockRoleCodes: 'STORE_MANAGER',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })

  await routeStoreManagerApi(page)
})

test('store manager sees pilot routes and stays blocked from reports', async ({ page }) => {
  await page.goto('/store/home')

  const nav = page.locator('.store-command-nav')
  await expect(nav.getByRole('link', { name: 'Ana Sayfa' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Türkiye Sıralaması' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Mağaza KPI' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Checklist' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Talep Merkezi' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Hedefler' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Primler' })).toHaveCount(0)
  await expect(nav.getByRole('link', { name: 'Norm Kadro' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Görevler' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Duyurular' })).toBeVisible()
  await expect(nav.getByRole('link', { name: /Ayarlar/ })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Raporlar' })).toHaveCount(0)

  await page.goto('/store/reports')
  await expect(page.getByRole('heading', { name: /rota kullan|Route not available/i })).toBeVisible()
})

test('store manager can acknowledge completed checklist work and refresh the task queue', async ({ page }) => {
  let acknowledged = false
  let workflowRequests = 0
  let acknowledgementRequests = 0

  await page.route('**/api/workflow/inbox', async (route) => {
    workflowRequests += 1
    await route.fulfill({
      json: {
        items: acknowledged ? [] : [workflowChecklistItem],
        meta: { count: acknowledged ? 0 : 1, total: acknowledged ? 0 : 1, limit: 30, offset: 0 },
      },
    })
  })
  await page.route('**/api/checklists/acknowledgements/list', async (route) => {
    acknowledgementRequests += 1
    await route.fulfill({
      json: {
        items: [
          {
            ...checklistAcknowledgementItem,
            acknowledgement: acknowledged
              ? {
                  checklistAcknowledgementId: 'ack-bm-1',
                  acknowledgedByUserId: 'store-manager-persona-user',
                  acknowledgementNote: 'Mağaza sonucu gördü.',
                  acknowledgedAt: '2026-05-12T11:00:00.000Z',
                }
              : null,
          },
        ],
        meta: { count: 1, total: 1, limit: 50, offset: 0 },
      },
    })
  })
  await page.route('**/api/checklists/instances/*/acknowledge', async (route) => {
    expect(route.request().method()).toBe('POST')
    acknowledged = true
    await route.fulfill({
      json: {
        command: { status: 'acknowledged', message: 'Checklist instance acknowledged' },
        data: {
          acknowledgement: {
            checklistAcknowledgementId: 'ack-bm-1',
            acknowledgedByUserId: 'store-manager-persona-user',
            acknowledgementNote: 'Mağaza sonucu gördü.',
            acknowledgedAt: '2026-05-12T11:00:00.000Z',
          },
        },
      },
    })
  })

  await page.goto('/store/tasks')
  await expect(page.getByTestId('store-task-queue-row').filter({ hasText: 'BM Result' })).toBeVisible()

  await page.getByTestId('store-task-queue-row').filter({ hasText: 'BM Result' }).click()
  await page.getByRole('dialog', { name: 'Görev detayı' }).getByRole('link', { name: 'Kaynağı aç' }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'BM Result' })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Kabul ettim' }).click()

  await expect.poll(() => acknowledged).toBe(true)
  await page.goto('/store/tasks')

  await expect.poll(() => workflowRequests).toBeGreaterThanOrEqual(2)
  await expect.poll(() => acknowledgementRequests).toBeGreaterThanOrEqual(1)
  await expect(page.getByTestId('store-task-queue-row').filter({ hasText: 'BM Result' })).toHaveCount(0)
})

test('store manager critical pages keep correct workflow boundaries', async ({ page }) => {
  await routeStoreManagerTargetCommand(page)
  await page.goto('/store/targets?tab=distribution')
  await expect(page.locator('[data-command-canvas-page].target-store-manager-page')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Mağaza Hedef Dağılımı' })).toBeVisible()
  await expect(page).toHaveURL(/tab=distribution/)
  await expect(page).not.toHaveURL(/tab=approval/)

  await page.goto('/store/incentives')
  await expect(page.getByTestId('store-incentives-page')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: /rota kullan|Route not available/i })).toBeVisible()

  await page.goto('/store/workforce')
  await expect(page.getByTestId('store-workforce-page')).toBeVisible()
  await expect(page.getByTestId('store-workforce-personnel-list').getByText('Store Personnel').first()).toBeVisible()
  await expect(page.locator('body')).not.toContainText(storeId)
  await expect(page.locator('body')).not.toContainText(employeeId)

  await page.goto('/store/feed')
  await expect(page.getByRole('heading', { name: 'Duyurular' })).toBeVisible()
  await expect(page.getByText('Pilot mağaza duyurusu')).toBeVisible()
  await expect(page.getByRole('textbox', { name: /Ne paylaşmak istiyorsun/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Paylaş' })).toHaveCount(0)
})

async function routeStoreManagerApi(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: storeManagerSession })
  })
  await page.route('**/api/store/workforce/workspace**', async (route) => {
    await route.fulfill({ json: { data: {
      view: 'store_manager',
      summary: { totalStores: 1, activePersonnel: 1, shortageStores: 0, openPositions: 0, averageTenureDays: 365 },
      stores: { items: [{ companyId, companyName: 'Company', regionId, regionName: 'Marmara', regionManagerName: 'Manager', storeId, storeCode: 'IST-DEMO', storeName: 'IstinyePark Demo Store', storeStatus: 'active', norm: 1, active: 1, gap: 0, shortageDays: null, personnel: [{ employeeId, displayName: 'Store Personnel', positionId: '00000000-0000-4000-8000-000000000301', positionCode: 'SALES', positionName: 'SatÄ±ÅŸ DanÄ±ÅŸmanÄ±', assignmentStartDate: '2025-01-01', employmentStatus: 'active' }], personnelTotal: 1 }], total: 1, limit: 50, offset: 0, hasMore: false },
      history: null,
      capabilities: { canCreateSellerCodeRequest: true, canCreateOffboardingRequest: true },
    } } })
  })
  await page.route('**/api/feed**', async (route) => {
    await route.fulfill({ json: feedFixture })
  })
  await page.route('**/api/org/stores', async (route) => {
    await route.fulfill({ json: storesFixture })
  })
  await page.route('**/api/workflow/inbox', async (route) => {
    await route.fulfill({ json: { items: [workflowKpiItem], meta: { count: 1, total: 1, limit: 30, offset: 0 } } })
  })
  await page.route('**/api/workflow/request-center**', async (route) => {
    await route.fulfill({
      json: {
        items: [],
        meta: { count: 0, total: 0, limit: 15, offset: 0 },
        summary: { open: 0, done: 0, returned: 0, periods: [] },
      },
    })
  })
  await page.route('**/api/store-actions/plans**', async (route) => {
    await route.fulfill({ json: { items: [], meta: { count: 0, total: 0, limit: 20, offset: 0 } } })
  })
  await page.route('**/api/store/tasks/workspace**', async (route) => {
    await route.fulfill({ json: { data: {
      view: 'store_manager',
      capabilities: { canStart: true, canUpdate: true, canComplete: true, canCancel: true },
      items: [],
      summary: { retained: 0, actionable: 0, completed: 0, cancelled: 0, checklist: 0 },
      page: { total: 0, limit: 20, offset: 0, count: 0, hasMore: false },
    } } })
  })
  await page.route('**/api/checklists/acknowledgements/list', async (route) => {
    await route.fulfill({ json: { items: [checklistAcknowledgementItem], meta: { count: 1, total: 1, limit: 50, offset: 0 } } })
  })
  await page.route('**/api/mobile/checklists/today', async (route) => {
    await route.fulfill({ json: mobileChecklistTodayFixture })
  })
  await page.route('**/api/checklists/command-canvas**', async (route) => {
    await route.fulfill({ json: { data: { period: '2026-07', view: 'store_manager', capabilities: { weeklyVisitPlanningAvailable: false, canMaintainWeeklyVisitPlan: false }, metrics: { totalStores: 1, needsVisit: 0, active: 0, pending: 1, completed: 1 }, items: [{ storeId, storeCode: 'IST-DEMO', storeName: 'IstinyePark Demo Store', regionId, regionName: 'Marmara', regionManagers: [{ displayName: 'Pilot Bölge Müdürü' }], bmScore: 82, vmScore: null, bmCompletedAt: '2026-05-12T09:00:00.000Z', vmCompletedAt: null, lastCompletedVisitAt: '2026-05-12T09:00:00.000Z', elapsedDaysSinceLastVisit: 64, activeChecklistCount: 0, pendingAcknowledgementCount: 1, openActionCount: 0, blockedActionCount: 0, status: 'pending', reasonCodes: ['pending_acknowledgement'], lastOperationalAt: '2026-05-12T09:00:00.000Z' }], page: { total: 1, limit: 30, offset: 0, hasMore: false } } } })
  })
  await page.route('**/api/target-distributions/requests**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: targetRequestsFixture })
      return
    }
    await route.fulfill({ status: 403, json: { message: 'Target distribution write is not part of this smoke.' } })
  })
  await page.route('**/api/target-distributions/coverage**', async (route) => {
    await route.fulfill({ json: targetCoverageFixture })
  })
  await page.route('**/api/target-distributions/store-personnel**', async (route) => {
    await route.fulfill({ json: targetPersonnelFixture })
  })
  await page.route('**/api/store/incentives**', async (route) => {
    await route.fulfill({ json: storeIncentivesFixture })
  })
  await page.route('**/api/store/me/incentives**', async (route) => {
    await route.fulfill({ json: ownIncentiveFixture })
  })
  await page.route('**/api/workforce/position-options**', async (route) => {
    await route.fulfill({ json: { items: ['Mağaza Müdürü', 'Satış Danışmanı'] } })
  })
  await page.route('**/api/workforce/store-employees**', async (route) => {
    await route.fulfill({ json: storeEmployeesFixture })
  })
  await page.route('**/api/workforce/headcount-gap**', async (route) => {
    await route.fulfill({
      json: {
        store_id: storeId,
        planned_headcount: '2.00',
        active_headcount: '2.00',
        headcount_gap: '0.00',
        planned_fte: '2.00',
        active_fte: '2.00',
        fte_gap: '0.00',
      },
    })
  })
  await page.route('**/api/workforce/seller-code-requests**', async (route) => {
    await route.fulfill({ json: { items: [], meta: { count: 0, total: 0, limit: 50, offset: 0 } } })
  })
  await page.route('**/api/workforce/offboarding-requests**', async (route) => {
    await route.fulfill({ json: { items: [], meta: { count: 0, total: 0, limit: 50, offset: 0 } } })
  })
  await page.route('**/api/reports/store-kpi-highlights**', async (route) => {
    await route.fulfill({ json: storeKpiHighlightsFixture })
  })
  await page.route('**/api/reports/rankings**', async (route) => {
    await route.fulfill({ json: rankingsFixture })
  })
  await page.route('**/api/reports/snapshot-runs**', async (route) => {
    await route.fulfill({ json: snapshotRunsFixture })
  })
}

const storeManagerSession = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'store-manager-persona-user',
    employeeId,
    roleCodes: ['STORE_MANAGER'],
    scope: { companyIds: [companyId], regionIds: [regionId], storeIds: [storeId] },
    readScope: { companyIds: [companyId], regionIds: [regionId], storeIds: [storeId] },
    actionScope: { assignedStoreIds: [storeId], assignedStoreTypes: ['company'] },
    assignedStoreIds: [storeId],
  },
  scopeSummary: { companyCount: 1, regionCount: 1, storeCount: 1, assignedStoreCount: 1 },
}

const storesFixture = {
  items: [{ store_id: storeId, store_code: 'IST-DEMO', store_name: 'IstinyePark Demo Store', region_id: regionId, company_id: companyId, status: 'active' }],
  meta: { count: 1, total: 1, limit: 1, offset: 0 },
}

const feedFixture = {
  items: [{
    feedPostId: 'feed-1',
    postType: 'announcement',
    title: null,
    body: 'Pilot mağaza duyurusu',
    linkLabel: null,
    linkUrl: null,
    visibilityScopeType: 'store',
    visibilityScopeIds: [storeId],
    isPinned: true,
    publishStatus: 'published',
    publishedAt: '2026-06-01T08:00:00.000Z',
    startsAt: null,
    endsAt: null,
    metricCode: null,
    metricLabel: null,
    challengeStartsOn: null,
    challengeEndsOn: null,
    targetRoute: null,
    createdByUserId: 'region-user-1',
    updatedByUserId: 'region-user-1',
    createdAt: '2026-06-01T08:00:00.000Z',
    updatedAt: '2026-06-01T08:00:00.000Z',
  }],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}

const workflowKpiItem = {
  itemType: 'task',
  sourceType: 'kpi_exception',
  sourceId: 'snapshot-store-kpi',
  title: 'UPT takibi',
  summary: 'IstinyePark Demo Store için KPI takibi gerekiyor',
  storeId,
  storeName: 'IstinyePark Demo Store',
  workflowStatus: 'at_risk',
  inboxStatus: 'needs_attention',
  urgency: 'high',
  createdAt: '2026-06-02T08:00:00.000Z',
  needsAttentionAt: '2026-06-02T08:00:00.000Z',
  actorRole: 'STORE_MANAGER',
  primaryActionLabel: 'Detay aç',
  secondaryActionLabel: 'Plan aç',
  deepLink: '/store/kpis',
}

const workflowChecklistItem = {
  itemType: 'acknowledgement',
  sourceType: 'checklist_receipt',
  sourceId: checklistInstanceId,
  title: 'BM Result',
  summary: 'IstinyePark Demo Store tamamlanan checklist sonucu',
  storeId,
  storeName: 'IstinyePark Demo Store',
  workflowStatus: 'completed',
  inboxStatus: 'needs_attention',
  urgency: 'medium',
  createdAt: '2026-05-12T09:00:00.000Z',
  needsAttentionAt: '2026-05-12T09:00:00.000Z',
  actorRole: 'STORE_MANAGER',
  primaryActionLabel: 'Kabul ettim',
  secondaryActionLabel: 'Checklist sonucunu aç',
  deepLink: `/store/checklists?overlay=result&checklistInstanceId=${checklistInstanceId}&storeId=${storeId}&workflowTab=inbox`,
}

const checklistAcknowledgementItem = {
  checklistInstanceId,
  checklistTemplateId,
  templateName: 'BM Result',
  templateType: 'BM_STORE_VISIT',
  category: 'BM',
  storeId,
  storeName: 'IstinyePark Demo Store',
  completedByUserId: 'region-user-1',
  completedAt: '2026-05-12T09:00:00.000Z',
  status: 'completed',
  totalScore: 82,
  complianceRate: 0.82,
  responses: [
    {
      checklistItemId: 'item-1',
      sectionTitle: 'Vitrin',
      itemLabel: 'Vitrin konsepti standartlara uygun mu?',
      scoreValue: 7,
      maxScore: 10,
      note: 'Takip edilmeli',
      weightPercent: 100,
    },
  ],
  acknowledgement: null,
}

const mobileChecklistTodayFixture = {
  data: {
    stores: [{ storeId, storeName: 'IstinyePark Demo Store' }],
    templates: [],
    activeInstances: [],
    completedThisMonth: [],
    pendingAcknowledgements: [],
    monthlySummaries: [],
  },
}

const targetRequestsFixture = {
  items: [{
    requestId: 'target-request-1',
    companyId,
    regionId,
    storeId,
    storeName: 'IstinyePark Demo Store',
    requestMonth: '2026-05-01',
    targetLabel: 'Mayıs hedef dağıtımı',
    totalTargetValue: 145000,
    allocationCount: 1,
    status: 'pending_region_approval',
    requestReason: 'Mağaza hedef dağıtımı',
    allocations: [{ employeeId, assigneeLabel: 'Store Personnel', targetValue: 145000, note: null }],
    submittedByUserId: 'store-manager-persona-user',
    approvedByUserId: null,
    approvedAt: null,
    approvalNote: null,
    createdAt: '2026-05-10T08:00:00.000Z',
    updatedAt: '2026-05-10T08:00:00.000Z',
  }],
  meta: { count: 1, total: 1, limit: 30, offset: 0 },
}

const targetCoverageFixture = {
  items: [{
    storeId,
    storeName: 'IstinyePark Demo Store',
    employeeId,
    displayName: 'Store Personnel',
    externalEmployeeRef: 'FM8001',
    targetReferenceId: null,
    targetValue: null,
    pendingRequestId: 'target-request-1',
    pendingTargetValue: 145000,
    staleTargetReferenceId: null,
    targetStatus: 'pending_region_approval',
  }],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
  summary: {
    requestMonth: '2026-05-01',
    totalEmployees: 1,
    coveredEmployees: 0,
    missingEmployees: 0,
    pendingEmployees: 1,
    conflictEmployees: 0,
    staleEmployees: 0,
    uncoveredEmployees: 1,
    coverageRate: 0,
  },
}

const targetPersonnelFixture = {
  items: [{ employeeId, displayName: 'Store Personnel', externalEmployeeRef: 'FM8001', periodStart: '2026-05-01', periodEnd: '2026-05-31', netSalesValue: 145000 }],
  meta: { count: 1, total: 1, limit: 30, offset: 0 },
}

const storeIncentivesFixture = {
  data: {
    period: '2026-06',
    periodStart: '2026-06-01',
    periodEnd: '2026-06-30',
    periodTimezone: 'Europe/Istanbul',
    roleScope: 'store',
    regionWorkflow: null,
    projections: [{
      period: '2026-06',
      periodTimezone: 'Europe/Istanbul',
      closeCutoffAt: null,
      ruleVersionId: 'sales-target-incentive-v1',
      regionId,
      storeId,
      storeName: 'IstinyePark Demo Store',
      storeOwnershipType: 'company',
      roleScope: 'store',
      storeTarget: '1000000.00',
      storeActualNetSales: '1150000.00',
      storeAchievementPct: '115.00',
      storeGatePassed: true,
      calculationState: 'projected',
      blockedReason: null,
      lastImportAt: '2026-06-15T08:00:00.000Z',
      review: null,
      rows: [{
        employeeId,
        displayName: 'Store Personnel',
        participantType: 'personnel',
        positionCode: 'SALES_ASSOCIATE',
        normalizedFromPositionCode: null,
        target: '100000.00',
        actualPositiveSales: '110000.00',
        achievementPct: '110.00',
        storeAchievementPct: '115.00',
        storeGatePassed: true,
        rate: '0.0165',
        rawEarnedAmount: '1815.00',
        payableAmount: '1815.00',
        correctionAmount: null,
        adjustmentAmount: null,
        finalAmount: '1815.00',
        status: 'projected',
        blockedReason: null,
        rateTableVersion: 'personnel-sales-target-v1.0.0',
        explanation: 'Personel hedefi ve mağaza barajı üzerinden hesaplandı.',
        regionCorrection: null,
      }],
    }],
  },
}

const ownIncentiveFixture = {
  data: {
    period: '2026-06',
    row: null,
    rateTable: [],
  },
}

const storeEmployeesFixture = {
  items: [{
    employeeId,
    displayName: 'Store Personnel',
    externalEmployeeRef: 'FM8001',
    storeId,
    storeName: 'IstinyePark Demo Store',
    positionName: 'Satış Danışmanı',
    positionCode: 'SALES_ASSOCIATE',
    assignmentStartDate: '2025-12-01',
    employmentStartDate: '2025-12-01',
    sellerCode: 'FM8001',
    isActive: true,
  }],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}

const storeKpiHighlightsFixture = {
  storeId,
  storeName: 'IstinyePark Demo Store',
  periodStart: '2026-06-01',
  periodEnd: '2026-06-30',
  metrics: [],
  storeScore: { score: 88, rank: 12 },
}

const rankingsFixture = {
  items: [],
  meta: { count: 0, total: 0, limit: 100, offset: 0 },
  period: { periodStart: '2026-06-01', periodEnd: '2026-06-30', periodType: 'monthly' },
}

const snapshotRunsFixture = {
  items: [{ snapshotRunId: 'snapshot-2026-06', snapshotDate: '2026-06-15', snapshotType: 'monthly', periodStart: '2026-06-01', periodEnd: '2026-06-30', runStatus: 'completed', generatedAt: '2026-06-15T08:00:00.000Z', generatedBy: 'release-smoke' }],
  meta: { count: 1, total: 1, limit: 30, offset: 0 },
}
