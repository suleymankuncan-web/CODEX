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
  await expect(page.locator('.workforce-region-divider').filter({ hasText: 'Bölge Müdürü A' })).toHaveCount(1)
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
  await expect(page.getByRole('heading', { name: 'Şirket Prim Görünümü' })).toBeVisible()

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
