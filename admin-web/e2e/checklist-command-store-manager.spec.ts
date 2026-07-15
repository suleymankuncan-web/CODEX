import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Page } from './test-fixtures'
import { createStoreContractSession, installGenericStoreApiFallbacks, installStoreContractSession } from './store-page-contract-fixtures'

const storeA = '11111111-1111-4111-8111-111111111111'
const storeB = '22222222-2222-4222-8222-222222222222'
const evidenceDir = join(process.cwd(), '..', 'docs', 'evidence', 'checklist-command-cutover-v2', 'p6')

test.beforeEach(async ({ page }) => {
  await installStoreContractSession(page, 'storeManager')
  await installGenericStoreApiFallbacks(page)
  const session = createStoreContractSession('storeManager')
  session.user.scope.storeIds = [storeA, storeB]
  session.user.readScope.storeIds = [storeA, storeB]
  session.user.actionScope.assignedStoreIds = [storeA, storeB]
  session.user.assignedStoreIds = [storeA, storeB]
  session.scopeSummary.storeCount = 2
  session.scopeSummary.assignedStoreCount = 2
  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => route.fulfill({ json: session }))
  await routeStoreManagerCommand(page)
})

test('Store Manager sees every authorized store explicitly without region, company, or plan controls', async ({ page }) => {
  const requests = { command: 0, plan: 0, regions: 0 }
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname
    if (path === '/api/checklists/command-canvas') requests.command += 1
    if (path.includes('/visit-plans')) requests.plan += 1
    if (path.endsWith('/command-canvas/regions')) requests.regions += 1
  })

  await page.goto('/store/checklists')

  await expect(page.getByRole('heading', { name: 'Mağaza Kontrol Merkezi' })).toBeVisible()
  await expect(page.getByText('Marmara Park')).toBeVisible()
  await expect(page.getByText('İstinyePark İzmir')).toBeVisible()
  await expect(page.getByText('Yalnız sorumlu olduğunuz mağazaların checklist, onay ve görev durumu')).toBeVisible()
  await expect(page.locator('.store-checklists-command-page')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Ziyaret Planı/ })).toHaveCount(0)
  await expect.poll(() => requests.command).toBe(1)
  expect(requests.plan).toBe(0)
  expect(requests.regions).toBe(0)
})

test('Store Manager opens checklist and acknowledgement overlays and focus returns to the selected store card', async ({ page }) => {
  await page.goto('/store/checklists')
  const checklistButton = page.getByRole('button', { name: 'Checklistleri aç' }).nth(1)
  await checklistButton.click()
  await expect(page).toHaveURL(new RegExp(`overlay=workflow.*storeId=${storeB}.*workflowTab=visits`))
  await expect(page.getByRole('dialog', { name: 'Checklist akışı' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(checklistButton).toBeFocused()

  const approvalButton = page.getByRole('button', { name: 'Bekleyen onaylar' })
  await approvalButton.click()
  await expect(page).toHaveURL(/workflowTab=inbox/)
  await expect(page.getByRole('dialog', { name: 'Checklist akışı' })).toBeVisible()
})

test('Store Manager opens its scoped Living Store Record and returns focus on close', async ({ page }) => {
  await page.goto('/store/checklists')
  const opener = page.getByRole('button', { name: 'Mağaza kaydı' }).first()
  await opener.click()
  await expect(page.getByRole('dialog', { name: 'Marmara Park mağaza kaydı' })).toBeVisible()
  await expect(page.getByText('Checklist tamamlandı')).toBeVisible()
  await page.getByRole('button', { name: 'Mağaza kaydını kapat' }).click()
  await expect(opener).toBeFocused()
})

test('Store Manager role surface remains bounded at all acceptance viewports', async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 320, height: 844 }] as const) {
    await page.setViewportSize(viewport)
    await page.goto('/store/checklists')
    await expect(page.getByRole('heading', { name: 'Mağaza Kontrol Merkezi' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    mkdirSync(evidenceDir, { recursive: true })
    await page.screenshot({ path: join(evidenceDir, `store-manager-${viewport.width}x${viewport.height}.png`), fullPage: true })
  }
})

test('Store Manager fails closed when the command API rejects its store scope', async ({ page }) => {
  await page.route('**/api/checklists/command-canvas?**', async (route) => route.fulfill({ status: 403, json: { message: 'forbidden' } }))
  await page.goto('/store/checklists')
  await expect(page.getByText('Mağaza kapsamına erişilemiyor')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tekrar dene' })).toHaveCount(0)
})

async function routeStoreManagerCommand(page: Page) {
  await page.route('**/api/checklists/command-canvas?**', async (route) => {
    await route.fulfill({
      json: {
        data: {
          period: '2026-07',
          view: 'store_manager',
          capabilities: { weeklyVisitPlanningAvailable: false, canMaintainWeeklyVisitPlan: false },
          metrics: { totalStores: 2, needsVisit: 0, active: 1, pending: 0, completed: 1 },
          items: [row(storeA, 'MP-01', 'Marmara Park', 1, 1, 'completed'), row(storeB, 'IP-02', 'İstinyePark İzmir', 0, 0, 'active')],
          page: { total: 2, limit: 30, offset: 0, hasMore: false },
        },
      },
    })
  })
  await page.route('**/api/checklists/command-canvas/stores/*/operational-history**', async (route) => {
    await route.fulfill({ json: { data: { store: { id: storeA, name: 'Marmara Park', city: null, district: null }, summary: { eventCount: 1, completedVisitCount: 1, assignedTaskCount: 0, openTaskCount: 0 }, items: [{ id: 'opaque-event', kind: 'checklist_completed', occurredAt: '2026-07-14T10:00:00.000Z', title: 'Checklist tamamlandı', detail: null, actorSnapshot: { displayName: 'Onur Kaytan', roleLabel: 'Bölge Müdürü', assignmentLabel: 'Marmara', identityStatus: 'captured' }, details: [] }], page: { nextCursor: null, hasMore: false } } } })
  })
}

function row(id: string, code: string, name: string, pendingAcknowledgementCount: number, openActionCount: number, status: 'completed' | 'active') {
  return { storeId: id, storeCode: code, storeName: name, regionId: 'region-1', regionName: 'Marmara', regionManagers: [{ displayName: 'Onur Kaytan' }], bmScore: status === 'completed' ? 88 : null, vmScore: status === 'completed' ? 91 : null, bmCompletedAt: status === 'completed' ? '2026-07-14T10:00:00.000Z' : null, vmCompletedAt: status === 'completed' ? '2026-07-13T10:00:00.000Z' : null, lastCompletedVisitAt: status === 'completed' ? '2026-07-14T10:00:00.000Z' : null, elapsedDaysSinceLastVisit: status === 'completed' ? 1 : null, activeChecklistCount: status === 'active' ? 1 : 0, pendingAcknowledgementCount, openActionCount, blockedActionCount: 0, status, reasonCodes: status === 'completed' ? ['completed_period'] : ['active_checklist'], lastOperationalAt: '2026-07-14T10:00:00.000Z' }
}
