import { expect, type Locator, type Page } from './test-fixtures'
import { demoStoreId, demoRegionId, demoEmployeeId, regionSecondStoreId } from './store-surfaces-identities'
import { authSessionFixture, workflowInboxFixture, checklistAcknowledgementsFixture, mobileChecklistTodayFixture, storeFeedFixture, kpiConfigFixture, myPerformanceFixture, ownIncentivesFixture, storeIncentivesFixture, myPerformanceMayFixture } from './store-surfaces-profile-fixtures'
import { storeKpiHighlightsFixture, closedLeaderboardFixture, closedLeaderboardMonthlyPreviewFixture, rankingsFixture } from './store-surfaces-ranking-fixtures'
import { competitionFixture, targetDistributionRequestsFixture, storeTargetingPersonnelFixture, storeEmployeesFixture, positionOptionsFixture, competitionDetailFixture } from './store-surfaces-operations-fixtures'

export async function selectComboboxOption(page: Page, trigger: Locator, optionName: string | RegExp) {
  const option =
    typeof optionName === 'string'
      ? page.getByRole('option', { name: optionName, exact: true })
      : page.getByRole('option', { name: optionName })
  if ((await option.count()) === 0 || !(await option.first().isVisible())) {
    await trigger.click()
  }
  await option.click()
}

export async function routeRequestCenter(page: Page, items: Array<Record<string, unknown>>) {
  await page.unroute('**/api/workflow/request-center**')
  await page.route('**/api/workflow/request-center**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const bucket = requestUrl.searchParams.get('bucket') ?? 'open'
    const type = requestUrl.searchParams.get('type') ?? 'all'
    const status = requestUrl.searchParams.get('status') ?? 'all'
    const period = requestUrl.searchParams.get('period')
    const query = requestUrl.searchParams.get('q')?.toLocaleLowerCase('tr-TR') ?? ''
    const limit = Number(requestUrl.searchParams.get('limit') ?? 15)
    const offset = Number(requestUrl.searchParams.get('offset') ?? 0)
    const scopedItems = items.filter((item) => {
      if (type !== 'all' && item.requestType !== type) return false
      if (period && String(item.updatedAt).slice(0, 7) !== period) return false
      if (query && !JSON.stringify(item).toLocaleLowerCase('tr-TR').includes(query)) return false
      return true
    })
    const selectedItems = scopedItems.filter((item) => {
      const itemStatus = String(item.status)
      if (bucket === 'done' && itemStatus !== 'approved') return false
      if (bucket === 'open' && itemStatus === 'approved') return false
      if (status === 'pending' && ['approved', 'rejected'].includes(itemStatus)) return false
      if (status === 'returned' && itemStatus !== 'rejected') return false
      if (status === 'approved' && itemStatus !== 'approved') return false
      return true
    })

    await route.fulfill({
      json: {
        items: selectedItems.slice(offset, offset + limit).map((item, index) => ({
          createdAt: item.updatedAt,
          regionId: demoRegionId,
          regionName: 'Marmara',
          regionManagerNames: ['Mert Yalçın'],
          waitingSince: item.status === 'approved' ? null : item.updatedAt,
          nextOwner: item.status === 'pending_region_approval' ? 'region' : item.status === 'pending_hr_approval' ? 'hr' : item.status === 'rejected' ? 'store' : null,
          dueAt: null,
          isOverdue: false,
          events: [{ eventId: `fixture-event-${offset + index}`, type: 'created', occurredAt: item.updatedAt, actorDisplayName: null }],
          eventTotal: 1,
          ...item,
        })),
        meta: {
          count: Math.min(limit, Math.max(0, selectedItems.length - offset)),
          total: selectedItems.length,
          limit,
          offset,
        },
        summary: {
          open: scopedItems.filter((item) => item.status !== 'approved').length,
          done: scopedItems.filter((item) => item.status === 'approved').length,
          returned: scopedItems.filter((item) => item.status === 'rejected').length,
          overdue: scopedItems.filter((item) => item.isOverdue === true).length,
          periods: Array.from(new Set(scopedItems.map((item) => String(item.updatedAt).slice(0, 7)))),
        },
      },
    })
  })
}


export async function verifyStoreNavTransition(
  page: Page,
  storeNav: Locator,
  input: {
    linkName: string
    path: string
    ready: Locator
  },
) {
  await storeNav.getByRole('link', { name: input.linkName, exact: true }).click()

  await expect(page).toHaveURL(new RegExp(`${escapeRegex(input.path)}$`))
  await expect(input.ready).toBeVisible()
  await expectHealthyStoreTransition(page)
}

export async function expectHealthyStoreTransition(page: Page) {
  await expect(page.locator('body')).not.toContainText(
    /Rota yükleniyor|Sayfa geçişi tamamlanamadı|Bu rol için rota kullanılamaz|açılamadı|could not finish|could not be opened|unavailable/i,
  )
}

export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function createStoreAuthSession(input: {
  roleCodes: string[]
  readStoreIds: string[]
  readRegionIds?: string[]
  scopeStoreIds: string[]
  scopeRegionIds?: string[]
  actionStoreIds: string[]
  legacyAssignedStoreIds: string[]
  assignedStoreTypes?: Array<'company' | 'franchise' | 'operator'>
}) {
  return {
    ...authSessionFixture,
    user: {
      ...authSessionFixture.user,
      roleCodes: input.roleCodes,
      scope: {
        ...authSessionFixture.user.scope,
        regionIds: input.scopeRegionIds ?? [],
        storeIds: input.scopeStoreIds,
      },
      readScope: {
        ...authSessionFixture.user.readScope,
        regionIds: input.readRegionIds ?? [],
        storeIds: input.readStoreIds,
      },
      actionScope: {
        assignedStoreIds: input.actionStoreIds,
        assignedStoreTypes: input.assignedStoreTypes ?? [],
      },
      assignedStoreIds: input.legacyAssignedStoreIds,
    },
    scopeSummary: {
      ...authSessionFixture.scopeSummary,
      regionCount: (input.readRegionIds ?? []).length,
      storeCount: input.readStoreIds.length,
      assignedStoreCount: input.actionStoreIds.length,
    },
  }
}

export async function routeAuthSession(page: Page, authSession: ReturnType<typeof createStoreAuthSession>) {
  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSession })
  })
}

export async function routeRegionWorkforceReadCalls(page: Page, calls: string[]) {
  await page.route('**/api/store/workforce/workspace**', async (route) => {
    calls.push('workspace')
    const personnel = (storeId: string, displayName: string) => [{
      employeeId: storeId === demoStoreId ? demoEmployeeId : '00000000-0000-0000-0000-000000000203',
      displayName,
      positionId: '00000000-0000-0000-0000-000000000301',
      positionCode: 'SALES_ASSOCIATE', positionName: 'SatÄ±ÅŸ DanÄ±ÅŸmanÄ±',
      assignmentStartDate: '2025-12-01', employmentStatus: 'active',
    }]
    const items = [
      { storeId: demoStoreId, storeCode: 'IST-DEMO', storeName: 'IstinyePark Demo Store', norm: 5, active: 1, gap: 4, shortageDays: 7, personnel: personnel(demoStoreId, 'Store Personnel') },
      { storeId: regionSecondStoreId, storeCode: 'MAR-FORUM', storeName: 'Marmara Forum', norm: 2, active: 1, gap: 1, shortageDays: 3, personnel: personnel(regionSecondStoreId, 'Region Second Personnel') },
    ].map((item) => ({ companyId: '00000000-0000-0000-0000-000000000001', companyName: 'Company', regionId: demoRegionId, regionName: 'Marmara', regionManagerName: 'Region Manager', storeStatus: 'active', personnelTotal: 1, ...item }))
    await route.fulfill({ json: { data: { view: 'region_manager', summary: { totalStores: 2, activePersonnel: 2, shortageStores: 2, openPositions: 5, averageTenureDays: 200 }, stores: { items, total: 2, limit: 50, offset: 0, hasMore: false }, history: null, capabilities: { canCreateSellerCodeRequest: false, canCreateOffboardingRequest: false } } } })
  })
}

export function createStoreManagerWorkforceWorkspace() {
  const personnel = storeEmployeesFixture.items.map((item) => ({
    employeeId: item.employeeId,
    displayName: item.displayName,
    positionId: item.positionId,
    positionCode: item.positionCode,
    positionName: item.positionName,
    assignmentStartDate: item.assignmentStartDate,
    employmentStatus: 'active',
  }))
  return {
    view: 'store_manager',
    summary: { totalStores: 1, activePersonnel: personnel.length, shortageStores: 0, openPositions: 0, averageTenureDays: 365 },
    stores: { items: [{ companyId: '00000000-0000-0000-0000-000000000001', companyName: 'Company', regionId: demoRegionId, regionName: 'Marmara', regionManagerName: 'Manager', storeId: demoStoreId, storeCode: 'IST-DEMO', storeName: 'IstinyePark Demo Store', storeStatus: 'active', norm: personnel.length, active: personnel.length, gap: 0, shortageDays: null, personnel, personnelTotal: personnel.length }], total: 1, limit: 50, offset: 0, hasMore: false },
    history: null,
    capabilities: { canCreateSellerCodeRequest: true, canCreateOffboardingRequest: true },
  }
}

export function createTaskWorkspaceFixture() {
  return {
    view: 'store_manager',
    capabilities: {
      canStart: true,
      canUpdate: true,
      canComplete: true,
      canCancel: true,
    },
    items: [],
    summary: {
      retained: 0,
      actionable: 0,
      completed: 0,
      cancelled: 0,
      checklist: 0,
    },
    page: {
      total: 0,
      limit: 20,
      offset: 0,
      count: 0,
      hasMore: false,
    },
  }
}

export async function routeStoreSurfaceApi(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSessionFixture })
  })
  await page.route('**/api/store/workforce/workspace**', async (route) => {
    await route.fulfill({ json: { data: createStoreManagerWorkforceWorkspace() } })
  })
  await page.route('**/api/store/tasks/workspace**', async (route) => {
    await route.fulfill({ json: { data: createTaskWorkspaceFixture() } })
  })
  await page.route('**/api/store/tasks/*/events**', async (route) => {
    await route.fulfill({
      json: {
        data: {
          items: [],
          total: 0,
          limit: 20,
          offset: 0,
          hasMore: false,
        },
      },
    })
  })

  await page.route('**/api/feed?**', async (route) => {
    await route.fulfill({ json: storeFeedFixture })
  })

  await page.route('**/api/org/stores', async (route) => {
    await route.fulfill({
      json: {
        items: [
          {
            store_id: demoStoreId,
            store_code: 'IST-DEMO',
            store_name: 'IstinyePark Demo Store',
            region_id: demoRegionId,
            company_id: '00000000-0000-0000-0000-000000000001',
            status: 'active',
          },
        ],
        meta: { count: 1, total: 1, limit: 1, offset: 0 },
      },
    })
  })

  await page.route('**/api/reports/kpi-config', async (route) => {
    await route.fulfill({ json: kpiConfigFixture })
  })

  await page.route('**/api/reports/my-performance**', async (route) => {
    const requestUrl = new URL(route.request().url())
    await route.fulfill({
      json:
        requestUrl.searchParams.get('periodStart') === '2026-05-01'
          ? myPerformanceMayFixture
          : myPerformanceFixture,
    })
  })

  await page.route('**/api/store/me/incentives**', async (route) => {
    await route.fulfill({ json: ownIncentivesFixture })
  })

  await page.route('**/api/store/incentives**', async (route) => {
    await route.fulfill({ json: storeIncentivesFixture })
  })

  await page.route('**/api/reports/personnel-performance/**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const baseFixture =
      requestUrl.searchParams.get('periodStart') === '2026-05-01'
        ? myPerformanceMayFixture
        : myPerformanceFixture

    await route.fulfill({
      json: {
        ...baseFixture,
        employee: {
          ...baseFixture.employee,
          employeeId: demoEmployeeId,
          displayName: 'Store Personnel - 1',
          storeName: 'IstinyePark Demo Store',
        },
      },
    })
  })

  await page.route('**/api/reports/store-kpi-highlights**', async (route) => {
    await route.fulfill({ json: storeKpiHighlightsFixture })
  })

  await page.route('**/api/reports/kpis**', async (route) => {
    await route.fulfill({
      json: {
        items: storeKpiHighlightsFixture.metrics.map((metric) => ({
          snapshotRunId: 'snapshot-2026-04-24',
          storeId: demoStoreId,
          kpiId: `closed-${metric.code}`,
          kpiCode: metric.code,
          kpiName: metric.label,
          periodStart: '2026-04-24',
          periodEnd: '2026-04-24',
          targetValue: metric.targetValue === null ? null : String(metric.targetValue),
          actualValue: metric.actualValue === null ? null : String(metric.actualValue),
          achievementRate: metric.achievementRate === null ? null : String(metric.achievementRate),
          statusBand: metric.statusBand,
        })),
        meta: {
          count: storeKpiHighlightsFixture.metrics.length,
          total: storeKpiHighlightsFixture.metrics.length,
          limit: 50,
          offset: 0,
        },
      },
    })
  })

  await page.route('**/api/reports/store-score-breakdown**', async (route) => {
    await route.fulfill({
      json: {
        snapshotRunId: 'snapshot-2026-04-24',
        storeId: demoStoreId,
        scoreStatus: 'final',
        totalScore: 87,
        missingWeightPolicy: 'return_missing_weight_to_kpi',
        configuredWeights: {
          kpiPerformanceWeight: 90,
          bmChecklistWeight: 5,
          vmChecklistWeight: 5,
        },
        effectiveWeights: {
          kpiPerformanceWeight: 100,
          bmChecklistWeight: 0,
          vmChecklistWeight: 0,
        },
        components: {
          kpi: {
            included: true,
            score: 87,
            weight: 100,
            contribution: 87,
            status: 'included',
          },
          bmChecklist: {
            included: false,
            score: null,
            weight: 0,
            contribution: null,
            status: 'not_included',
            visitCount: 0,
          },
          vmChecklist: {
            included: false,
            score: null,
            weight: 0,
            contribution: null,
            status: 'not_included',
            visitCount: 0,
          },
        },
      },
    })
  })

  await page.route('**/api/reports/leaderboards/closed**', async (route) => {
    const requestUrl = new URL(route.request().url())
    await route.fulfill({
      json:
        requestUrl.searchParams.get('periodType') === 'monthly'
          ? closedLeaderboardMonthlyPreviewFixture
          : closedLeaderboardFixture,
    })
  })

  await page.route('**/api/reports/rankings**', async (route) => {
    await route.fulfill({ json: rankingsFixture })
  })

  await page.route('**/api/reports/snapshot-runs**', async (route) => {
    await route.fulfill({
      json: {
        items: [
          {
            snapshotRunId: 'snapshot-2026-04-24',
            snapshotDate: '2026-04-24',
            snapshotType: 'daily',
            periodStart: '2026-04-24',
            periodEnd: '2026-04-24',
            runStatus: 'completed',
            generatedAt: '2026-04-24T08:00:00.000Z',
            generatedBy: 'release-smoke',
          },
        ],
        meta: {
          count: 1,
          total: 1,
          limit: 30,
          offset: 0,
        },
      },
    })
  })

  await page.route('**/api/reports/store-monthly-package?**', async (route) => {
    await route.fulfill({
      json: {
        period: '2026-06',
        periodLabel: 'Haziran 2026',
        coverageLabel: '1-14 Haziran',
        isCurrentPeriod: true,
        storeCount: 30,
        sections: [
          { code: 'kpis', label: 'KPI kolonları', value: 'Skor, UPT, ATV, CR, HG%', status: 'ready' },
          { code: 'approval_scores', label: 'Onay skorları', value: 'GSM, BM Checklist, VM Checklist', status: 'ready' },
          { code: 'actions', label: 'Aksiyon durumu', value: 'Bitirildi, devam ediyor, bekliyor', status: 'ready' },
          { code: 'targets', label: 'Hedefler', value: 'Mağaza ve personel hedef durumu', status: 'ready' },
          { code: 'incentives', label: 'Primler', value: 'Hakediş ve kontrol durumu', status: 'ready' },
          { code: 'workforce', label: 'Norm Kadro', value: 'Aktif, norm, eksik gün, turnover', status: 'ready' },
          { code: 'visits', label: 'Ziyaret', value: 'Son ziyaret ve geçen gün', status: 'ready' },
        ],
        items: [
          {
            regionManager: 'Onur Kaytan',
            storeName: 'IstinyePark Demo Store',
            city: 'İstanbul',
            period: 'Haziran 2026',
            reportRange: '1-14 Haziran',
            score: '87,20',
            upt: '4,12',
            atv: '4.850,00',
            cr: '%22,4',
            hg: '%104,5',
            gsm: '%96',
            bmChecklist: '91',
            vmChecklist: '88',
            actionStatus: 'Devam ediyor',
            targetStatus: 'Onaylandı',
            incentiveStatus: 'Kontrol edildi',
            normFiili: '6 / 6',
            missingDays: 'Yok',
            turnover: 'Veri yok',
            lastVisit: '14 Haziran',
            daysSinceVisit: '7 gün',
            dataNote: '',
          },
        ],
      },
    })
  })

  await page.route('**/api/reports/store-monthly-package.xlsx?**', async (route) => {
    await route.fulfill({
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body: 'store-report-package',
    })
  })

  await page.route('**/api/workflow/inbox', async (route) => {
    await route.fulfill({ json: workflowInboxFixture })
  })

  await routeRequestCenter(
    page,
    targetDistributionRequestsFixture.items.map((item) => ({
      requestId: item.requestId,
      requestType: 'target',
      storeId: item.storeId,
      storeName: item.storeName,
      status: item.status,
      updatedAt: item.updatedAt,
      targetLabel: item.targetLabel,
      requestMonth: item.requestMonth,
      allocationCount: item.allocationCount,
      approvalMode: item.approvalMode,
      personDisplayName: null,
      nationalIdLast4: null,
      externalEmployeeRef: null,
    })),
  )

  await page.route('**/api/store-actions/plans**', async (route) => {
    await route.fulfill({
      json: {
        items: [],
        meta: { count: 0, total: 0, limit: 20, offset: 0 },
      },
    })
  })

  await page.route('**/api/checklists/acknowledgements/list', async (route) => {
    await route.fulfill({ json: checklistAcknowledgementsFixture })
  })

  await page.route('**/api/mobile/checklists/today', async (route) => {
    await route.fulfill({ json: mobileChecklistTodayFixture })
  })

  await page.route('**/api/target-distributions/requests**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: targetDistributionRequestsFixture })
      return
    }

    await route.fulfill({
      status: 403,
      json: { message: 'Target distribution write route is not mocked in this surface test.' },
    })
  })

  await page.route('**/api/target-distributions/store-personnel**', async (route) => {
    await route.fulfill({ json: storeTargetingPersonnelFixture })
  })

  await page.route('**/api/workforce/position-options**', async (route) => {
    await route.fulfill({ json: positionOptionsFixture })
  })

  await page.route('**/api/workforce/store-employees**', async (route) => {
    await route.fulfill({ json: storeEmployeesFixture })
  })

  await page.route('**/api/workforce/headcount-gap**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const storeId = requestUrl.searchParams.get('storeId') ?? demoStoreId
    await route.fulfill({
      json: {
        store_id: storeId,
        planned_headcount: '5.00',
        active_headcount: '1.00',
        headcount_gap: '4.00',
        planned_fte: '5.00',
        active_fte: '1.00',
        fte_gap: '4.00',
      },
    })
  })

  await page.route('**/api/workforce/seller-code-requests**', async (route) => {
    await route.fulfill({
      json: {
        items: [],
        meta: { count: 0, total: 0, limit: 50, offset: 0 },
      },
    })
  })

  await page.route('**/api/workforce/offboarding-requests**', async (route) => {
    await route.fulfill({
      json: {
        items: [],
        meta: { count: 0, total: 0, limit: 50, offset: 0 },
      },
    })
  })

  await page.route('**/api/competitions**', async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname

    if (request.method() === 'GET' && pathname.endsWith('/api/competitions')) {
      await route.fulfill({
        json: {
          items: [competitionFixture],
          meta: { count: 1, total: 1, limit: 50, offset: 0 },
        },
      })
      return
    }

    if (
      request.method() === 'GET' &&
      pathname.endsWith(`/api/competitions/${competitionFixture.competitionId}`)
    ) {
      await route.fulfill({ json: competitionDetailFixture })
      return
    }

    await route.fulfill({
      status: 403,
      json: { message: 'Store competition surface is read-only' },
    })
  })
}
