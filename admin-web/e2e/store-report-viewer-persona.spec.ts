import type { Page } from '@playwright/test'
import { expect, test } from './test-fixtures'
import {
  installGenericStoreApiFallbacks,
  installStoreContractSession,
} from './store-page-contract-fixtures'

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
  '/store/targets',
  '/store/workforce',
  '/store/reports',
  '/store/settings',
] as const

const reportViewerPortfolioTimeoutMs = 60_000
const routeNavigationTimeoutMs = 15_000

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
    '/store/targets',
    '/store/workforce',
    '/store/reports',
    '/store/settings',
  ]) {
    await expect(nav.locator(`a[href="${href}"]`), `${href} should be visible for Report Viewer`).toBeVisible()
  }
  await expect(nav.locator('a[href="/store/me"]')).toHaveCount(0)
  await expect(nav.locator('a[href="/store/incentives"]')).toHaveCount(0)

  for (const routePath of allowlistedRoutes) {
    await gotoReportViewerRoute(page, routePath)
    await expect(page.getByRole('heading', { name: /rota kullan|route not available/i })).toHaveCount(0)
  }
})

test('Report Viewer forbidden routes make no protected request and no action request is emitted', async ({ page }) => {
  test.setTimeout(reportViewerPortfolioTimeoutMs)
  await installStoreContractSession(page, 'reportViewer')
  await installGenericStoreApiFallbacks(page)

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
  await expect(page.getByRole('heading', { name: /rota kullan|route not available/i })).toBeVisible()

  expect(protectedRequests.length).toBe(beforeForbiddenRoutes)
  expect(protectedRequests).toEqual([])
})
