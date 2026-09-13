import type { Page } from '@playwright/test'
import { expect, test } from './test-fixtures'
import {
  installGenericStoreApiFallbacks,
  installStoreContractSession,
} from './store-page-contract-fixtures'
import { createIncentiveWorkspace, routeIncentiveWorkspace } from './store-incentives-command-fixtures'

const allowlistedRoutes = [
  '/store/home',
  '/store/checklists',
  '/store/tasks',
  '/store/kpis',
  '/store/personnel/employee-contract-1',
  '/store/rankings',
  '/store/feed',
  '/store/competitions',
  '/store/approvals',
  '/store/incentives',
  '/store/targets',
  '/store/workforce',
  '/store/reports',
  '/store/settings',
] as const

const reportViewerPortfolioTimeoutMs = 60_000
const routeNavigationTimeoutMs = 15_000
const forbiddenAdminRoutes = [
  '/admin/inbox',
  '/admin/competitions',
  '/admin/reports',
  '/admin/targets',
  '/admin/session',
] as const

async function gotoReportViewerRoute(page: Page, routePath: string) {
  await page.goto(routePath, {
    timeout: routeNavigationTimeoutMs,
    waitUntil: 'load',
  })
}

test('Super Admin opens the Report Viewer checklist presentation without another role', async ({ page }) => {
  await installStoreContractSession(page, 'reportViewer', { roleCodes: ['SUPER_ADMIN'] })
  await installGenericStoreApiFallbacks(page)
  await routeCompanyChecklistWorkspace(page)

  await gotoReportViewerRoute(page, '/store/checklists')

  await expect(page.getByRole('heading', { name: 'Checklist Raporları' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /rota kullan|route not available/i })).toHaveCount(0)
  await expect(page.getByText('Sayfa geçişi tamamlanamadı')).toHaveCount(0)
  expect(await page.evaluate(() => window.location.pathname)).toBe('/store/checklists')
})

test('checklist directory preserves assigned identities and recovers from an empty search', async ({ page }) => {
  await installStoreContractSession(page, 'reportViewer')
  await installGenericStoreApiFallbacks(page)
  await routeCompanyChecklistWorkspace(page)
  await page.goto('/store/checklists')
  await expect(page.getByRole('button', { name: /Bölge Müdürü A/ })).toBeVisible()
  const search = page.getByRole('textbox', { name: 'Bölge müdürü ara', exact: true })
  await search.fill('no-match')
  await expect(page.getByText('Eşleşen bölge müdürü yok', { exact: true })).toBeVisible()
  await expect(search).toBeVisible()
  await search.fill('')
  await expect(page.getByRole('button', { name: /Bölge Müdürü A/ })).toBeVisible()
})

async function routeCompanyChecklistWorkspace(page: Page) {
  await page.route('**/api/checklists/command-canvas/regions**', async (route) => {
    await route.fulfill({ json: { data: {
      period: '2026-07',
      view: 'report_viewer',
      capabilities: { weeklyVisitPlanningAvailable: false, canMaintainWeeklyVisitPlan: false },
      metrics: {
        totalStores: 1,
        missingVisitStores: 0,
        storesWithOpenActions: 0,
        openActionCount: 0,
        completedCoverageStores: 1,
      },
      items: new URL(route.request().url()).searchParams.get('query') === 'no-match' ? [] : [{
        managerUserId: '80000000-0000-0000-0000-000000000012',
        regionId: 'region-contract-1',
        regionName: 'Marmara',
        regionManagers: [{ displayName: 'Bölge Müdürü A' }],
        metrics: {
          totalStores: 1,
          missingVisitStores: 0,
          storesWithOpenActions: 0,
          openActionCount: 0,
          completedCoverageStores: 1,
          blockedActionCount: 0,
        },
        visitAverageScore: 88,
        scoreSampleCount: 1,
        lastOperationalAt: '2026-07-14T10:00:00.000Z',
      }],
      page: { total: 1, limit: 20, offset: 0, hasMore: false },
    } } })
  })
  await page.route('**/api/checklists/command-canvas?**', async (route) => {
    await route.fulfill({ json: { data: {
      period: '2026-07',
      view: 'report_viewer',
      capabilities: { weeklyVisitPlanningAvailable: false, canMaintainWeeklyVisitPlan: false },
      metrics: { totalStores: 0, needsVisit: 0, active: 0, pending: 0, completed: 0 },
      items: [],
      page: { total: 0, limit: 30, offset: 0, hasMore: false },
    } } })
  })
}

test('Report Viewer sees the company read-only Store portfolio', async ({ page }) => {
  test.setTimeout(reportViewerPortfolioTimeoutMs)
  await installStoreContractSession(page, 'reportViewer')
  await installGenericStoreApiFallbacks(page)
  await routeIncentiveWorkspace(page, createIncentiveWorkspace('report_viewer'))
  await routeReportViewerWorkforce(page)

  const nav = page.locator('.store-command-nav')
  await gotoReportViewerRoute(page, '/store/home')
  for (const href of [
    '/store/home',
    '/store/checklists',
    '/store/tasks',
    '/store/kpis',
    '/store/rankings',
    '/store/feed',
    '/store/competitions',
    '/store/approvals',
    '/store/incentives',
    '/store/targets',
    '/store/workforce',
    '/store/reports',
    '/store/settings',
  ]) {
    await expect(nav.locator(`a[href="${href}"]`), `${href} should be visible for Report Viewer`).toBeVisible()
  }
  await expect(nav.locator('a[href="/store/me"]')).toHaveCount(0)
  await expect(nav.locator('a[href="/store/incentives"]')).toBeVisible()

  for (const routePath of allowlistedRoutes) {
    await gotoReportViewerRoute(page, routePath)
    await expect(page.getByRole('heading', { name: /rota kullan|route not available/i })).toHaveCount(0)
  }
  await gotoReportViewerRoute(page, '/store/workforce')
  await expect(page.getByText('Bölge Müdürü A').first()).toBeVisible()
  await expect(page.getByText('Bölge Müdürü B').first()).toBeVisible()
  await expect(page.getByRole('radio', { name: /Bölge Müdürü A.*2 mağaza/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Personel sicil talebi|İşten ayrılma talebi/ })).toHaveCount(0)
})

test('Report Viewer forbidden routes make no protected request and no action request is emitted', async ({ page }) => {
  test.setTimeout(reportViewerPortfolioTimeoutMs)
  await installStoreContractSession(page, 'reportViewer')
  await installGenericStoreApiFallbacks(page)
  await routeIncentiveWorkspace(page, createIncentiveWorkspace('report_viewer'))
  await routeReportViewerWorkforce(page)

  const protectedRequests: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (!url.pathname.startsWith('/api/')) return

    const method = request.method()
    const isForbiddenRoute =
      url.pathname === '/api/store/incentives' ||
      url.pathname === '/api/store/me/incentives'
    const isReadOnlyChecklistAcknowledgement =
      method === 'POST' && url.pathname === '/api/checklists/acknowledgements/list'
    const isActionOrMutation =
      method !== 'GET' && (
        url.pathname.startsWith('/api/target-distributions/') ||
        url.pathname.startsWith('/api/store-actions/') ||
        url.pathname.startsWith('/api/workforce/') ||
        url.pathname.startsWith('/api/checklists/') ||
        url.pathname.startsWith('/api/mobile/checklists/') ||
        url.pathname.startsWith('/api/competitions/')
      ) && !isReadOnlyChecklistAcknowledgement

    if (isForbiddenRoute || isActionOrMutation) {
      protectedRequests.push(`${method} ${url.pathname}`)
    }
  })

  for (const routePath of allowlistedRoutes) {
    await gotoReportViewerRoute(page, routePath)
  }
  const beforeForbiddenRoutes = protectedRequests.length

  await gotoReportViewerRoute(page, '/store/me')
  await expect(page.getByRole('heading', { name: /rota kullan|route not available/i })).toBeVisible()
  await gotoReportViewerRoute(page, '/store/incentives')
  await expect(page.getByRole('heading', { name: 'LUFIAN Mağaza Primleri', level: 1 })).toBeVisible()

  expect(protectedRequests.length).toBe(beforeForbiddenRoutes)
  expect(protectedRequests).toEqual([])
})

test('Report Viewer cannot open any Admin route family', async ({ page }) => {
  await installStoreContractSession(page, 'reportViewer')
  await installGenericStoreApiFallbacks(page)

  for (const routePath of forbiddenAdminRoutes) {
    await gotoReportViewerRoute(page, routePath)
    await expect(page.getByRole('heading', { name: /rota kullanılamaz|route not available/i }))
      .toBeVisible()
  }
})

async function routeReportViewerWorkforce(page: Page) {
  await page.route('**/api/org/region-managers', route => route.fulfill({ json: { items: [
    { userId: 'manager-a', displayName: 'Bölge Müdürü A', storeIds: ['viewer-store-1', 'viewer-store-3'] },
    { userId: 'manager-b', displayName: 'Bölge Müdürü B', storeIds: ['viewer-store-2'] },
  ] } }))
  await page.route('**/api/store/workforce/workspace**', async (route) => {
    const stores = [
      createWorkforceStore('viewer-store-1', 'Ankara Mağaza', 'viewer-region-1', 'Bölge Müdürü A'),
      createWorkforceStore('viewer-store-2', 'İzmir Mağaza', 'viewer-region-2', 'Bölge Müdürü B'),
      createWorkforceStore('viewer-store-3', 'Zonguldak Mağaza', 'viewer-region-1', 'Bölge Müdürü A'),
    ]
    await route.fulfill({ json: { data: {
      view: 'report_viewer',
      summary: { totalStores: 3, activePersonnel: 12, shortageStores: 0, openPositions: 0, averageTenureDays: 420 },
      stores: { items: stores, total: 3, limit: 50, offset: 0, hasMore: false },
      history: null,
      capabilities: { canCreateSellerCodeRequest: false, canCreateOffboardingRequest: false },
    } } })
  })
}

function createWorkforceStore(storeId: string, storeName: string, regionId: string, regionManagerName: string) {
  return {
    companyId: 'company-contract-1', companyName: 'HR Axis', regionId, regionName: regionManagerName,
    regionManagerName, storeId, storeCode: storeId, storeName, storeStatus: 'active', norm: 4, active: 4,
    averageTenureDays: 420, gap: 0, shortageDays: null, personnel: [], personnelTotal: 0,
    personnelLimit: 50, personnelOffset: 0, personnelHasMore: false,
  }
}
