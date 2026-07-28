import { expect, test, type Page } from './test-fixtures'
import { checklistEvidenceOutputPath } from './checklist-evidence-output'
import { createStoreContractSession, installStoreContractSession } from './store-page-contract-fixtures'

const regionId = '11111111-1111-4111-8111-111111111111'
const storeId = '22222222-2222-4222-8222-222222222222'
test('Report Viewer expands one region and loads one store history lazily without mutations', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installStoreContractSession(page, 'reportViewer')
  const requests = { histories: 0, mutations: 0, plans: 0, stores: 0 }
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname.startsWith('/api/') && request.method() !== 'GET') requests.mutations += 1
    if (!url.pathname.startsWith('/api/checklists/command-canvas')) return
    if (url.pathname.endsWith('/operational-history')) requests.histories += 1
    if (url.pathname.endsWith('/visit-plans')) requests.plans += 1
    if (url.pathname === '/api/checklists/command-canvas') requests.stores += 1
  })
  await routeReportViewerRecords(page)

  await page.goto('/store/checklists')

  await expect(page.getByRole('heading', { name: 'Şirket Saha Görünümü' })).toBeVisible()
  await expect(page.getByText('Salt okunur')).toBeVisible()
  await expect.poll(() => requests.stores).toBe(0)
  await expect.poll(() => requests.histories).toBe(0)
  await expect.poll(() => requests.plans).toBe(0)

  await page.getByRole('button', { name: /Onur Kaytan/ }).click()
  await expect(page.getByText('Marmara Park').first()).toBeVisible()
  await expect(page.getByText('Ziyaret Tamamlandı')).toBeVisible()
  await expect.poll(() => requests.stores).toBe(1)
  await expect.poll(() => requests.histories).toBe(0)
  await expect.poll(() => requests.plans).toBe(1)

  const historyOpener = page.getByRole('button', { name: 'Mağaza kaydını aç' })
  await historyOpener.click()
  await expect(page.getByRole('dialog', { name: 'Marmara Park mağaza kaydı' })).toBeVisible()
  await expect(page.getByText('Checklist tamamlandı')).toBeVisible()
  const eventToggle = page.getByRole('button', { name: /Checklist tamamlandı/ })
  await eventToggle.click()
  await page.getByRole('button', { name: 'Kayıt detayını kapat' }).click()
  await expect(eventToggle).toBeFocused()
  await page.getByRole('button', { name: 'Mağaza kaydını kapat' }).click()
  await expect(historyOpener).toBeFocused()
  await expect.poll(() => requests.histories).toBe(1)
  expect(requests.mutations).toBe(0)

  await page.screenshot({ path: checklistEvidenceOutputPath(testInfo, 'checklist-command-cutover-v2/p5/report-viewer-desktop.png'), fullPage: true })
})

test('Report Viewer presentation wins for a mixed report-viewer and region-manager session', async ({ page }) => {
  await installStoreContractSession(page, 'reportViewer')
  const session = createStoreContractSession('reportViewer')
  session.user.roleCodes = ['REPORT_VIEWER', 'REGION_MANAGER']
  session.user.scope.regionIds = [regionId]
  session.user.readScope.regionIds = [regionId]
  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => route.fulfill({ json: session }))
  await routeReportViewerRecords(page)

  await page.goto('/store/checklists?view=workflow&tab=plan')

  await expect(page.getByRole('heading', { name: 'Şirket Saha Görünümü' })).toBeVisible()
  await expect(page.getByText('Salt okunur')).toBeVisible()
  await expect(page.getByText('Checklist Komuta Merkezi')).toHaveCount(0)
})

test('Region Manager opens the third store-record view and history remains lazy', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installStoreContractSession(page, 'regionManager')
  let historyRequests = 0
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('/operational-history')) historyRequests += 1
  })
  await routeReportViewerRecords(page)
  await page.route('**/api/checklists/command-canvas/visit-plans/regions**', async (route) => {
    await route.fulfill({ json: { data: { items: [{ regionId, regionName: 'Marmara' }], page: { total: 1, limit: 20, offset: 0, hasMore: false } } } })
  })

  await page.goto('/store/checklists')
  await page.getByRole('button', { name: 'Mağaza Kayıtları' }).click()

  await expect(page.getByText('Son kayıt hareketi')).toBeVisible()
  await expect(page.getByText('Görev atandı, çözülmesi bekleniyor')).toBeVisible()
  await expect.poll(() => historyRequests).toBe(0)
  await page.getByRole('button', { name: 'Kaydı görüntüle' }).click()
  await expect(page.getByRole('dialog', { name: 'Marmara Park mağaza kaydı' })).toBeVisible()
  await expect.poll(() => historyRequests).toBe(1)

  await page.screenshot({ path: checklistEvidenceOutputPath(testInfo, 'checklist-command-cutover-v2/p5/region-manager-records-desktop.png'), fullPage: true })
})

test('Store record owns mobile scrolling and appends the next bounded history page', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await installStoreContractSession(page, 'reportViewer')
  await routeReportViewerRecords(page)

  await page.goto('/store/checklists')
  await expect(page.getByRole('heading', { name: 'Şirket Saha Görünümü' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: checklistEvidenceOutputPath(testInfo, 'checklist-command-cutover-v2/p5/report-viewer-mobile-320.png'), fullPage: true })
  await page.getByRole('button', { name: /Onur Kaytan/ }).click()
  await page.getByRole('button', { name: 'Mağaza kaydını aç' }).click()
  const drawer = page.getByRole('dialog', { name: 'Marmara Park mağaza kaydı' })
  await expect(drawer).toBeVisible()
  const bounds = await drawer.boundingBox()
  expect(bounds?.width).toBe(320)
  expect(bounds?.height).toBe(844)
  await expect(page.getByRole('button', { name: '20 kayıt daha yükle' })).toBeVisible()
  await page.getByRole('button', { name: '20 kayıt daha yükle' }).click()
  await expect(page.getByRole('button', { name: /Plan revize edildi 10 Oca/ })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: checklistEvidenceOutputPath(testInfo, 'checklist-command-cutover-v2/p5/living-store-record-mobile-320.png'), fullPage: true })
})

test('Report Viewer exposes a fail-closed company-scope state without retrying forbidden access', async ({ page }) => {
  await installStoreContractSession(page, 'reportViewer')
  await page.route('**/api/checklists/command-canvas/regions**', async (route) => {
    await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'forbidden' }) })
  })

  await page.goto('/store/checklists')

  await expect(page.getByText('Şirket kapsamına erişilemiyor')).toBeVisible()
  await expect(page.getByText('Report Viewer hesabına yetkili şirket kapsamı tanımlanmamış.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tekrar dene' })).toHaveCount(0)
})

test('Report Viewer preserves nested reads and retries plan, store-page, and history cursor failures', async ({ page }) => {
  await installStoreContractSession(page, 'reportViewer')
  await routeReportViewerRecords(page)
  let planFails = true
  let nextStorePageFails = true
  let historyCursorFails = true

  await page.route('**/api/checklists/command-canvas/visit-plans?**', async (route) => {
    if (planFails) {
      await route.fulfill({ status: 503, json: { message: 'temporary plan failure' } })
      return
    }
    await route.fallback()
  })
  await page.route('**/api/checklists/command-canvas?**', async (route) => {
    const offset = Number(new URL(route.request().url()).searchParams.get('offset') ?? 0)
    if (offset === 30 && nextStorePageFails) {
      await route.fulfill({ status: 503, json: { message: 'temporary store failure' } })
      return
    }
    if (offset === 30) {
      await route.fulfill({ json: commandPage([], 200, false, 30) })
      return
    }
    await route.fulfill({ json: commandPage(Array.from({ length: 30 }, (_value, index) => commandRow(index + 1)), 200, true, 0) })
  })
  await page.route('**/api/checklists/command-canvas/stores/*/operational-history**', async (route) => {
    const cursor = new URL(route.request().url()).searchParams.get('cursor')
    if (cursor && historyCursorFails) {
      await route.fulfill({ status: 503, json: { message: 'temporary history failure' } })
      return
    }
    await route.fallback()
  })

  await page.goto('/store/checklists')
  await page.getByRole('button', { name: /Onur Kaytan/ }).click()
  await expect(page.getByRole('button', { name: 'Mağaza kaydını aç' })).toHaveCount(30)
  await expect(page.getByText('Haftalık plan okunamadı.')).toBeVisible()
  planFails = false
  await page.getByRole('button', { name: 'Tekrar dene' }).first().click()
  await expect(page.getByText('Ziyaret Tamamlandı')).toBeVisible()

  await page.getByRole('button', { name: 'Sonraki', exact: true }).first().click()
  await expect(page.getByRole('button', { name: 'Mağaza kaydını aç' })).toHaveCount(30)
  await expect(page.getByText('Yeni mağaza sayfası alınamadı; mevcut satırlar korunuyor.')).toBeVisible()
  nextStorePageFails = false
  await page.getByRole('button', { name: 'Tekrar dene' }).click()
  await expect(page.getByText('Bu bölgede mağaza yok')).toBeVisible()

  await page.getByRole('button', { name: 'Önceki', exact: true }).first().click()
  await page.getByRole('button', { name: 'Mağaza kaydını aç' }).first().click()
  await page.getByRole('button', { name: '20 kayıt daha yükle' }).click()
  await expect(page.getByText('Yeni kayıtlar yüklenemedi; mevcut kayıtlar korunuyor.')).toBeVisible()
  historyCursorFails = false
  await page.getByRole('button', { name: 'Tekrar dene' }).click()
  await expect(page.getByRole('button', { name: /Plan revize edildi 10 Oca/ })).toBeVisible()
})

test('Region Manager three-view command header remains keyboard reachable at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await installStoreContractSession(page, 'regionManager')
  await routeReportViewerRecords(page)
  await page.route('**/api/checklists/command-canvas/visit-plans/regions**', async (route) => {
    await route.fulfill({ json: { data: { items: [{ regionId, regionName: 'Çok Uzun Marmara Bölge Müdürlüğü Adı' }], page: { total: 1, limit: 20, offset: 0, hasMore: false } } } })
  })

  await page.goto('/store/checklists')
  const visits = page.getByRole('button', { name: 'Ziyaretler' })
  const plan = page.getByRole('button', { name: /Ziyaret Planı/ })
  const records = page.getByRole('button', { name: 'Mağaza Kayıtları' })
  await visits.focus()
  await page.keyboard.press('Tab')
  await expect(plan).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(records).toBeFocused()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('Report Viewer keeps populated rows during delayed server filters and captures responsive evidence', async ({ page }, testInfo) => {
  await installStoreContractSession(page, 'reportViewer')
  await routeReportViewerRecords(page)
  await page.route('**/api/checklists/command-canvas/regions**', async (route) => {
    if (new URL(route.request().url()).searchParams.get('signal') === 'missing_visit') {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    await route.fallback()
  })

  for (const viewport of [{ width: 1024, height: 768 }, { width: 390, height: 844 }] as const) {
    await page.setViewportSize(viewport)
    await page.goto('/store/checklists')
    await page.getByRole('button', { name: /Onur Kaytan/ }).click()
    const missingMetric = page.getByRole('button', { name: /Ziyaret eksiği/ }).first()
    const filteredResponse = page.waitForResponse((response) => new URL(response.url()).searchParams.get('signal') === 'missing_visit')
    await missingMetric.click()
    await expect(page.getByRole('heading', { name: 'Şirket Saha Görünümü' })).toBeVisible()
    await expect(missingMetric).toBeFocused()
    await filteredResponse
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: checklistEvidenceOutputPath(testInfo, `checklist-command-cutover-v2/p5/report-viewer-${viewport.width}x${viewport.height}.png`), fullPage: true })
  }
})

test('Region Manager records captures tablet and mobile role evidence without overflow', async ({ page }, testInfo) => {
  await installStoreContractSession(page, 'regionManager')
  await routeReportViewerRecords(page)
  await page.route('**/api/checklists/command-canvas/visit-plans/regions**', async (route) => {
    await route.fulfill({ json: { data: { items: [{ regionId, regionName: 'Marmara' }], page: { total: 1, limit: 20, offset: 0, hasMore: false } } } })
  })

  for (const viewport of [{ width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 320, height: 844 }] as const) {
    await page.setViewportSize(viewport)
    await page.goto('/store/checklists')
    await page.getByRole('button', { name: 'Mağaza Kayıtları' }).click()
    await expect(page.getByRole('button', { name: 'Kaydı görüntüle' }).first()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: checklistEvidenceOutputPath(testInfo, `checklist-command-cutover-v2/p5/region-manager-records-${viewport.width}x${viewport.height}.png`), fullPage: true })
  }
})

function commandRow(index: number) {
  return {
    storeId: `22222222-2222-4222-8222-${String(index).padStart(12, '0')}`,
    storeCode: `MP-${index}`,
    storeName: index === 1 ? 'Marmara Park' : `Marmara Park ${index}`,
    regionId,
    regionName: 'Marmara',
    regionManagers: [{ displayName: 'Onur Kaytan' }],
    bmScore: 88,
    vmScore: 91,
    bmCompletedAt: '2026-07-14T10:00:00.000Z',
    vmCompletedAt: '2026-07-13T10:00:00.000Z',
    lastCompletedVisitAt: '2026-07-14T10:00:00.000Z',
    elapsedDaysSinceLastVisit: 1,
    activeChecklistCount: 0,
    pendingAcknowledgementCount: 0,
    openActionCount: 1,
    blockedActionCount: 0,
    status: 'completed',
    reasonCodes: ['completed_period', 'open_actions'],
    lastOperationalAt: '2026-07-14T10:00:00.000Z',
  }
}

function commandPage(items: ReturnType<typeof commandRow>[], total: number, hasMore: boolean, offset: number) {
  return { data: { period: '2026-07', view: 'report_viewer', capabilities: { weeklyVisitPlanningAvailable: false, canMaintainWeeklyVisitPlan: false }, metrics: { totalStores: total, needsVisit: 0, active: 0, pending: 0, completed: total }, items, page: { total, limit: 30, offset, hasMore } } }
}

async function routeReportViewerRecords(page: Page) {
  await page.route('**/api/checklists/command-canvas/regions**', async (route) => {
    await route.fulfill({
      json: {
        data: {
          period: '2026-07',
          view: 'report_viewer',
          capabilities: { weeklyVisitPlanningAvailable: false, canMaintainWeeklyVisitPlan: false },
          metrics: {
            totalStores: 2,
            missingVisitStores: 0,
            storesWithOpenActions: 1,
            openActionCount: 1,
            completedCoverageStores: 1,
          },
          items: [{
            regionId,
            regionName: 'Marmara',
            regionManagers: [{ displayName: 'Onur Kaytan' }],
            metrics: {
              totalStores: 1,
              missingVisitStores: 0,
              storesWithOpenActions: 1,
              openActionCount: 1,
              completedCoverageStores: 1,
              blockedActionCount: 0,
            },
            visitAverageScore: 88,
            scoreSampleCount: 1,
            lastOperationalAt: '2026-07-14T10:00:00.000Z',
          }, {
            regionId: '33333333-3333-4333-8333-333333333333',
            regionName: 'Ege',
            regionManagers: [{ displayName: 'Derya Aydın' }],
            metrics: { totalStores: 1, missingVisitStores: 0, storesWithOpenActions: 0, openActionCount: 0, completedCoverageStores: 1, blockedActionCount: 0 },
            visitAverageScore: 90,
            scoreSampleCount: 1,
            lastOperationalAt: '2026-07-13T10:00:00.000Z',
          }],
          page: { total: 2, limit: 20, offset: 0, hasMore: false },
        },
      },
    })
  })
  await page.route('**/api/checklists/command-canvas?**', async (route) => {
    await route.fulfill({
      json: {
        data: {
          period: '2026-07',
          view: 'report_viewer',
          capabilities: { weeklyVisitPlanningAvailable: false, canMaintainWeeklyVisitPlan: false },
          metrics: { totalStores: 1, needsVisit: 0, active: 0, pending: 0, completed: 1 },
          items: [{
            storeId,
            storeCode: 'MP-01',
            storeName: 'Marmara Park',
            regionId,
            regionName: 'Marmara',
            regionManagers: [{ displayName: 'Onur Kaytan' }],
            bmScore: 88,
            vmScore: 91,
            bmCompletedAt: '2026-07-14T10:00:00.000Z',
            vmCompletedAt: '2026-07-13T10:00:00.000Z',
            lastCompletedVisitAt: '2026-07-14T10:00:00.000Z',
            elapsedDaysSinceLastVisit: 1,
            activeChecklistCount: 0,
            pendingAcknowledgementCount: 0,
            openActionCount: 1,
            blockedActionCount: 0,
            status: 'completed',
            reasonCodes: ['completed_period', 'open_actions'],
            lastOperationalAt: '2026-07-14T10:00:00.000Z',
          }],
          page: { total: 1, limit: 30, offset: 0, hasMore: false },
        },
      },
    })
  })
  await page.route('**/api/checklists/command-canvas/visit-plans?**', async (route) => {
    await route.fulfill({
      json: {
        data: {
          planId: null,
          regionId,
          regionName: 'Marmara',
          weekStart: '2026-07-13',
          revision: 0,
          revisedAt: null,
          view: 'report_viewer',
          capabilities: { canMaintainWeeklyVisitPlan: false },
          items: [{ planItemId: '44444444-4444-4444-8444-444444444444', storeId, storeCode: 'MP-01', storeName: 'Marmara Park', plannedDate: '2026-07-14', displayOrder: 0, status: 'completed', checklistInstanceId: '55555555-5555-4555-8555-555555555555', completedAt: '2026-07-14T10:00:00.000Z' }],
        },
      },
    })
  })
  await page.route('**/api/checklists/command-canvas/stores/*/operational-history**', async (route) => {
    const cursor = new URL(route.request().url()).searchParams.get('cursor')
    const firstPageItems = Array.from({ length: 20 }, (_value, index) => ({
      id: `opaque-event-${index + 1}`,
      kind: 'checklist_completed',
      occurredAt: `2026-07-${String(14 - Math.floor(index / 3)).padStart(2, '0')}T10:00:00.000Z`,
      title: index === 0 ? 'Checklist tamamlandı' : `Denetim kaydı ${index + 1}`,
      detail: null,
      actorSnapshot: { displayName: 'Onur Kaytan', roleLabel: 'Bölge Müdürü', assignmentLabel: 'Marmara', identityStatus: 'captured' },
      details: [],
    }))
    await route.fulfill({
      json: {
        data: {
          store: { id: storeId, name: 'Marmara Park', city: null, district: null },
          summary: { eventCount: 21, completedVisitCount: 20, assignedTaskCount: 0, openTaskCount: 0 },
          items: cursor ? [{ id: 'opaque-event-21', kind: 'visit_plan_revised', occurredAt: '2026-01-10T10:00:00.000Z', title: 'Plan revize edildi', detail: null, actorSnapshot: { displayName: 'Onur Kaytan', roleLabel: 'Bölge Müdürü', assignmentLabel: 'Marmara', identityStatus: 'captured' }, details: [] }] : firstPageItems,
          page: cursor ? { nextCursor: null, hasMore: false } : { nextCursor: 'opaque-cursor-2', hasMore: true },
        },
      },
    })
  })
}
