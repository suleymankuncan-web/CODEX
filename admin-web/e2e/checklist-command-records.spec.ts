import { expect, test, type Page } from './test-fixtures'
import { checklistEvidenceOutputPath } from './checklist-evidence-output'
import { createStoreContractSession, installStoreContractSession, storeIds } from './store-page-contract-fixtures'

const regionId = '11111111-1111-4111-8111-111111111111'
const storeId = '22222222-2222-4222-8222-222222222222'
const reportViewerManagers = [
  { managerName: 'Onur Kaytan', managerUserId: '10000000-0000-4000-8000-000000000001', regionId, regionName: 'Onur Kaytan Sorumluluğu' },
  { managerName: 'Derya Aydın', managerUserId: '10000000-0000-4000-8000-000000000002', regionId: '33333333-3333-4333-8333-333333333333', regionName: 'Derya Aydın Sorumluluğu' },
  { managerName: 'Eda Doğanay', managerUserId: '10000000-0000-4000-8000-000000000003', regionId: '44444444-4444-4444-8444-444444444444', regionName: 'Eda Doğanay Sorumluluğu' },
  { managerName: 'Selin Arslan', managerUserId: '10000000-0000-4000-8000-000000000004', regionId: '66666666-6666-4666-8666-666666666666', regionName: 'Selin Arslan Sorumluluğu' },
  { managerName: 'Mert Yalçın', managerUserId: '10000000-0000-4000-8000-000000000005', regionId: '77777777-7777-4777-8777-777777777777', regionName: 'Mert Yalçın Sorumluluğu' },
  { managerName: 'Zeynep Aksoy', managerUserId: '10000000-0000-4000-8000-000000000006', regionId: '88888888-8888-4888-8888-888888888888', regionName: 'Zeynep Aksoy Sorumluluğu' },
  { managerName: 'Burak Demir', managerUserId: '10000000-0000-4000-8000-000000000007', regionId: '99999999-9999-4999-8999-999999999999', regionName: 'Burak Demir Sorumluluğu' },
  { managerName: 'Ceren Kılıç', managerUserId: '10000000-0000-4000-8000-000000000008', regionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', regionName: 'Ceren Kılıç Sorumluluğu' },
] as const
test('Report Viewer keeps manager selection, visit plan, stores, and history in a dedicated read-only workspace', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installStoreContractSession(page, 'reportViewer')
  const requests = { histories: 0, mutations: 0, plans: 0, planManagerUserIds: [] as Array<string | null>, stores: 0 }
  page.on('request', (request) => {
    const url = new URL(request.url())
    const readOnlyPost = request.method() === 'POST' && url.pathname === '/api/checklists/acknowledgements/list'
    if (url.pathname.startsWith('/api/') && request.method() !== 'GET' && !readOnlyPost) requests.mutations += 1
    if (!url.pathname.startsWith('/api/checklists/command-canvas')) return
    if (url.pathname.endsWith('/operational-history')) requests.histories += 1
    if (url.pathname.endsWith('/visit-plans')) {
      requests.plans += 1
      requests.planManagerUserIds.push(url.searchParams.get('managerUserId'))
    }
    if (url.pathname === '/api/checklists/command-canvas') requests.stores += 1
  })
  await routeReportViewerRecords(page, { delayedManagerUserId: reportViewerManagers[1].managerUserId, storeDelayMs: 350 })

  await page.goto('/store/checklists')

  await expect(page.getByRole('heading', { name: 'Checklist Raporları' }).first()).toBeVisible()
  const periodTrigger = page.getByRole('button', { name: /DÖNEM Ağustos 2026/ })
  await periodTrigger.click()
  const periodDialog = page.getByRole('dialog', { name: 'Raporlama dönemi' })
  await expect(periodDialog).toBeVisible()
  await periodDialog.getByRole('button', { name: 'Sonraki yıl' }).click()
  await expect(periodDialog.getByText('2027', { exact: true })).toBeVisible()
  await periodDialog.getByRole('button', { name: 'Tarih filtresini kapat' }).click()
  await expect(periodDialog).toHaveCount(0)
  await expect(periodTrigger).toBeFocused()
  const onurManager = page.getByRole('button', { name: /Onur Kaytan/ })
  await expect(onurManager).toBeVisible()
  await expect(onurManager).toHaveAttribute('aria-current', 'true')
  await expect(page.getByLabel('Onur Kaytan ortalama checklist puanı: 82')).toBeVisible()
  const deryaManager = page.getByRole('button', { name: /Derya Aydın/ })
  await expect(deryaManager).toBeVisible()
  await expect(page.getByText('Marmara', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Ege', { exact: true })).toHaveCount(0)
  await expect(page.getByText('HAFTALIK PLAN', { exact: true })).toHaveCount(0)
  await expect.poll(() => requests.stores).toBe(1)
  await expect.poll(() => requests.histories).toBe(0)
  await expect.poll(() => requests.plans).toBe(0)

  await deryaManager.click()
  await expect(deryaManager).toHaveAttribute('aria-current', 'true')
  await expect(page.getByTestId('report-viewer-active-manager')).toHaveText('Derya Aydın')
  await expect(page.getByText('Mağazalar yükleniyor')).toBeVisible()
  await expect(page.getByText('Derya Aydın Mağaza 01')).toBeVisible()
  await expect.poll(() => requests.stores).toBe(2)
  await expect.poll(() => requests.plans).toBe(0)
  await onurManager.click()
  await expect(page.getByTestId('report-viewer-active-manager')).toHaveText('Onur Kaytan')

  await expect(page.getByRole('heading', { name: 'Saha Kontrolleri' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Bölge müdürlerine dön' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Sonuçlar' }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Ziyaret Takvimi' }).click()
  const visitCalendar = page.getByRole('dialog', { name: 'Ziyaret Takvimi' })
  await expect(visitCalendar).toBeVisible()
  await expect(visitCalendar.getByText('HAFTALIK PLAN', { exact: true })).toBeVisible()
  await expect(visitCalendar.getByText('Ziyaret Tamamlandı').first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Checklist Başlat|Devam et/ })).toHaveCount(0)
  await expect.poll(() => requests.stores).toBe(2)
  await expect.poll(() => requests.histories).toBe(0)
  await expect.poll(() => requests.plans).toBe(1)
  expect(requests.planManagerUserIds).toEqual([reportViewerManagers[0].managerUserId])
  await page.screenshot({ path: checklistEvidenceOutputPath(testInfo, 'checklist-command-cutover-v2/p5/report-viewer-calendar-desktop.png'), fullPage: true })
  await page.getByRole('button', { name: 'Ziyaret takvimini kapat' }).click()

  const historyOpener = page.getByRole('button', { name: 'Sonuçlar' }).first()
  const historyRequest = page.waitForRequest((request) => new URL(request.url()).pathname.endsWith('/operational-history'))
  await historyOpener.click()
  const historyUrl = new URL((await historyRequest).url())
  expect(historyUrl.searchParams.get('range')).toBe('all')
  expect(historyUrl.searchParams.get('kinds')).toBe('checklist_completed,task_assigned,task_resolved,visit_completed')
  const recordDialog = page.getByRole('dialog', { name: 'Marmara Park mağaza kaydı' })
  await expect(recordDialog).toBeVisible()
  await expect(recordDialog.getByText('Toplam Ziyaret Sayısı')).toBeVisible()
  await expect(recordDialog.getByText('Toplam Denetim Sayısı')).toBeVisible()
  await expect(recordDialog.getByText('Toplam Görev Sayısı')).toBeVisible()
  await expect(recordDialog.getByText('Toplam Çözülen Görev Sayısı')).toBeVisible()
  await expect(recordDialog.getByText('Açık Görev Sayısı')).toBeVisible()
  await expect(recordDialog.getByText('Dönem')).toHaveCount(0)
  await expect(recordDialog.getByText('Kayıt türleri')).toHaveCount(0)
  await expect(recordDialog.getByText('Ziyaret planı güncellendi')).toHaveCount(0)
  await expect(recordDialog.getByText('Denetim tamamlandı')).toBeVisible()
  await expect(recordDialog.getByText('Ziyaret tamamlandı')).toBeVisible()
  await expect(recordDialog.getByText('Görev atandı')).toBeVisible()
  await expect(recordDialog.getByText('Görev çözüldü')).toBeVisible()
  await expect(recordDialog.getByRole('button', { name: /Denetim tamamlandı/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Mağaza kaydını kapat' }).click()
  await expect(historyOpener).toBeFocused()
  await expect.poll(() => requests.histories).toBe(1)
  expect(requests.mutations).toBe(0)

  await page.screenshot({ path: checklistEvidenceOutputPath(testInfo, 'checklist-command-cutover-v2/p5/report-viewer-desktop.png'), fullPage: true })
})

test('Report Viewer keeps visible store rows while a new search loads in the background', async ({ page }) => {
  await installStoreContractSession(page, 'reportViewer')
  await routeReportViewerRecords(page, { searchStoreDelayMs: 350 })

  await page.goto('/store/checklists')
  await expect(page.getByText('Marmara Park')).toBeVisible()

  await page.getByRole('textbox', { name: 'Mağaza ara' }).fill('Mağaza 20')
  await expect(page.getByText('Marmara Park')).toBeVisible()
  await expect(page.getByText('Mağazalar yükleniyor')).toHaveCount(0)
  await expect(page.getByText('Onur Kaytan Mağaza 20')).toBeVisible()
  await expect(page.getByText('Marmara Park')).toHaveCount(0)
})

test('Report Viewer manager search is server-backed and resets the selected manager', async ({ page }) => {
  await installStoreContractSession(page, 'reportViewer')
  const regionRequests: URL[] = []
  let mutations = 0
  await routeReportViewerRecords(page)
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname.endsWith('/command-canvas/regions')) regionRequests.push(url)
    const readOnlyPost = request.method() === 'POST' && url.pathname === '/api/checklists/acknowledgements/list'
    if (url.pathname.startsWith('/api/') && request.method() !== 'GET' && !readOnlyPost) mutations += 1
  })

  await page.goto('/store/checklists')
  await page.getByRole('button', { name: /Derya Aydın/ }).click()
  await expect(page.getByTestId('report-viewer-active-manager')).toHaveText('Derya Aydın')

  const search = page.getByRole('textbox', { name: 'Bölge müdürü ara' })
  await expect(search).toHaveAttribute('maxlength', '120')
  await search.fill('Eda')
  await expect.poll(() => regionRequests.some((url) => url.searchParams.get('query') === 'Eda' && url.searchParams.get('offset') === '0')).toBe(true)
  const edaManager = page.getByRole('button', { name: /Eda Doğanay/ })
  await expect(edaManager).toHaveAttribute('aria-current', 'true')
  await expect(page.getByRole('button', { name: /Onur Kaytan/ })).toHaveCount(0)
  expect(mutations).toBe(0)
})

test('Report Viewer manager search keeps retained rows and exposes a retryable error', async ({ page }) => {
  await installStoreContractSession(page, 'reportViewer')
  await routeReportViewerRecords(page)
  let searchFails = true
  await page.route('**/api/checklists/command-canvas/regions**', async (route) => {
    const query = new URL(route.request().url()).searchParams.get('query')?.trim()
    if (query === 'Eda' && searchFails) {
      await route.fulfill({ status: 503, json: { message: 'temporary manager search failure' } })
      return
    }
    await route.fallback()
  })

  await page.goto('/store/checklists')
  await page.getByRole('textbox', { name: 'Bölge müdürü ara' }).fill('Eda')
  await expect(page.getByRole('button', { name: /Onur Kaytan/ })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Yeni bölge müdürü verileri alınamadı')

  searchFails = false
  await page.getByRole('alert').getByRole('button', { name: 'Tekrar dene' }).click()
  await expect(page.getByRole('button', { name: /Eda Doğanay/ })).toHaveAttribute('aria-current', 'true')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('Report Viewer suppresses retained manager rows after post-load authorization revocation', async ({ page }) => {
  await installStoreContractSession(page, 'reportViewer')
  await routeReportViewerRecords(page)
  let revoked = false
  await page.route('**/api/checklists/command-canvas/regions**', async (route) => {
    if (revoked) {
      await route.fulfill({ status: 403, json: { message: 'manager scope revoked' } })
      return
    }
    await route.fallback()
  })

  await page.goto('/store/checklists')
  await expect(page.getByRole('button', { name: /Onur Kaytan/ })).toBeVisible()

  revoked = true
  await page.getByRole('textbox', { name: 'Bölge müdürü ara' }).fill('Derya')
  await expect(page.getByText('Şirket kapsamına erişilemiyor')).toBeVisible()
  await expect(page.getByRole('button', { name: /Onur Kaytan/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Derya Aydın/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Tekrar dene' })).toHaveCount(0)
})

test('Report Viewer suppresses retained store facts after post-load authorization revocation', async ({ page }) => {
  await installStoreContractSession(page, 'reportViewer')
  await routeReportViewerRecords(page)
  let revoked = false
  await page.route('**/api/checklists/command-canvas?**', async (route) => {
    if (revoked) {
      await route.fulfill({ status: 401, json: { message: 'store scope revoked' } })
      return
    }
    await route.fallback()
  })

  await page.goto('/store/checklists')
  await expect(page.getByText('Marmara Park')).toBeVisible()

  revoked = true
  await page.getByRole('textbox', { name: 'Mağaza ara' }).fill('Mağaza 02')
  await expect(page.getByText('Mağazalara erişilemiyor')).toBeVisible()
  await expect(page.getByText('Marmara Park')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Tekrar dene' })).toHaveCount(0)
})

test('Report Viewer does not reuse same-manager rows across reporting periods', async ({ page }) => {
  await installStoreContractSession(page, 'reportViewer')
  await routeReportViewerRecords(page, { periodAwareStoreRows: true, periodSwitchDelayMs: 800 })
  await page.goto('/store/checklists')

  await expect(page.getByText('Ağustos 2026 Marmara Park')).toBeVisible()
  const periodTrigger = page.getByRole('button', { name: 'DÖNEM Ağustos 2026' })
  await periodTrigger.click()
  const periodDialog = page.getByRole('dialog', { name: 'Raporlama dönemi' })
  await periodDialog.getByRole('button', { name: 'Temmuz', exact: true }).click()
  const periodRequest = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/checklists/command-canvas' && url.searchParams.get('period') === '2026-07'
  })
  await periodDialog.getByRole('button', { name: 'Uygula' }).click()
  await periodRequest
  await expect(page.getByRole('button', { name: 'DÖNEM Temmuz 2026' })).toHaveAttribute('aria-label', 'DÖNEM Temmuz 2026')
  await expect(page.getByText('Mağazalar yükleniyor')).toBeVisible()
  await expect(page.getByText('Ağustos 2026 Marmara Park')).toHaveCount(0, { timeout: 250 })
  await expect(page.getByText('Temmuz 2026 Marmara Park')).toBeVisible()
})

test('Report Viewer omits unresolved identities without retrying them into fake managers', async ({ page }) => {
  await installStoreContractSession(page, 'reportViewer')
  await routeReportViewerRecords(page, { initialUnresolvedManagers: true })

  await page.goto('/store/checklists')

  await expect(page.getByRole('button', { name: /Onur Kaytan/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Derya Aydın/ })).toBeVisible()
  await expect(page.getByText('Bölge müdürü tanımlı değil')).toHaveCount(0)
  await expect(page.getByText('Bilinmiyor', { exact: true })).toHaveCount(0)
})

test('Report Viewer store history leaves its loading state after an initial failure and retries', async ({ page }) => {
  await installStoreContractSession(page, 'reportViewer')
  await routeReportViewerRecords(page)
  let historyFails = true
  await page.route('**/api/checklists/command-canvas/stores/*/operational-history**', async (route) => {
    if (historyFails) {
      await route.fulfill({ status: 503, json: { message: 'temporary history failure' } })
      return
    }
    await route.fallback()
  })

  await page.goto('/store/checklists')
  await page.getByRole('button', { name: 'Sonuçlar' }).first().click()
  const recordDialog = page.getByRole('dialog', { name: 'Marmara Park mağaza kaydı' })
  await expect(recordDialog.getByText('Mağaza kaydı açılamadı')).toBeVisible()
  await expect(recordDialog.getByText('Mağaza kaydı yükleniyor')).toHaveCount(0)

  historyFails = false
  await recordDialog.getByRole('button', { name: 'Tekrar dene' }).click()
  await expect(recordDialog.getByText('Denetim tamamlandı')).toBeVisible()
})

test('Report Viewer column headers request the selected store sorting', async ({ page }) => {
  await installStoreContractSession(page, 'reportViewer')
  await routeReportViewerRecords(page)
  await page.goto('/store/checklists')

  const scoreHeader = page.getByRole('columnheader', { name: /Puan/ })
  await expect(scoreHeader).toHaveAttribute('aria-sort', 'none')
  const sortedRequest = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/checklists/command-canvas' && url.searchParams.get('sort') === 'bm_score_desc'
  })
  await scoreHeader.getByRole('button', { name: /Puan/ }).click()
  await sortedRequest
  await expect(scoreHeader).toHaveAttribute('aria-sort', 'descending')
  const ascendingRequest = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/checklists/command-canvas' && url.searchParams.get('sort') === 'bm_score_asc'
  })
  await scoreHeader.getByRole('button', { name: /Puan/ }).click()
  await ascendingRequest
  await expect(scoreHeader).toHaveAttribute('aria-sort', 'ascending')
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

  await expect(page.getByRole('heading', { name: 'Checklist Raporları' }).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Saha Kontrolleri' })).toHaveCount(0)
})

test('Region Manager opens store history from the persistent Results action', async ({ page }, testInfo) => {
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
  await expect(page.getByRole('button', { name: 'Mağaza Kayıtları' })).toHaveCount(0)
  const storeRow = page.getByTestId('checklist-command-row').filter({ hasText: 'Marmara Park' })
  await expect(storeRow.getByRole('button', { name: 'Sonuçlar' })).toBeVisible()
  await expect.poll(() => historyRequests).toBe(0)
  await storeRow.getByRole('button', { name: 'Sonuçlar' }).click()
  await expect(page.getByRole('dialog', { name: 'Marmara Park mağaza kaydı' })).toBeVisible()
  await expect.poll(() => historyRequests).toBe(1)

  await page.screenshot({ path: checklistEvidenceOutputPath(testInfo, 'checklist-command-cutover-v2/p5/region-manager-record-drawer-desktop.png') })
  await page.screenshot({ path: checklistEvidenceOutputPath(testInfo, 'checklist-command-cutover-v2/p5/region-manager-records-desktop.png'), fullPage: true })
})

test('Region Manager opens the current workspace immediately when planning regions are empty', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager', { actionStoreIds: [storeIds[0]] })
  let commandRequests = 0

  await page.route('**/api/checklists/command-canvas/visit-plans/regions**', async (route) => {
    await route.fulfill({
      json: { data: { items: [], page: { total: 0, limit: 20, offset: 0, hasMore: false } } },
    })
  })
  await page.route('**/api/checklists/command-canvas?**', async (route) => {
    commandRequests += 1
    const row = { ...commandRow(1), storeId: storeIds[0], storeName: 'İstanbul MOI AVM' }
    await route.fulfill({
      json: {
        data: {
          ...commandPage([row], 1, false, 0).data,
          view: 'region_manager',
          capabilities: { weeklyVisitPlanningAvailable: false, canMaintainWeeklyVisitPlan: false },
        },
      },
    })
  })

  await page.goto('/store/checklists')

  await expect(page.getByRole('heading', { name: 'Saha Kontrolleri' })).toBeVisible()
  await expect(page.getByText(/· Sorumlu mağazalar$/)).toBeVisible()
  await expect(page.getByTestId('checklist-command-row').getByText('İstanbul MOI AVM')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tekrar dene' })).toHaveCount(0)
  await expect(page.getByTestId('checklist-command-metrics')).toHaveCount(0)
  await expect(page.getByLabel('Haftalık ziyaret planı')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Başlat' })).toBeVisible()
  await expect.poll(() => commandRequests).toBe(1)

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('button', { name: 'Başlat' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('Store record owns mobile scrolling and appends the next bounded history page', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await installStoreContractSession(page, 'reportViewer')
  await routeReportViewerRecords(page)

  await page.goto('/store/checklists')
  await expect(page.getByRole('heading', { name: 'Checklist Raporları' }).first()).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: checklistEvidenceOutputPath(testInfo, 'checklist-command-cutover-v2/p5/report-viewer-mobile-320.png'), fullPage: true })
  await page.getByRole('button', { name: 'Sonuçlar' }).first().click()
  const drawer = page.getByRole('dialog', { name: 'Marmara Park mağaza kaydı' })
  await expect(drawer).toBeVisible()
  const bounds = await drawer.boundingBox()
  expect(bounds?.width).toBe(320)
  expect(bounds?.height).toBe(844)
  expect(bounds?.x).toBe(0)
  expect(bounds?.y).toBe(0)
  await page.screenshot({ path: checklistEvidenceOutputPath(testInfo, 'checklist-command-cutover-v2/p5/living-store-record-mobile-viewport.png') })
  await expect(page.getByRole('button', { name: '20 kayıt daha yükle' })).toBeVisible()
  await page.getByRole('button', { name: '20 kayıt daha yükle' }).click()
  await expect(page.locator('.checklist-record-history-event').filter({ hasText: 'Görev çözüldü' }).filter({ hasText: '10 Oca' }).first()).toBeVisible()
  await expect(page.getByText('Ziyaret planı güncellendi')).toHaveCount(0)
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
    if (offset === 20 && nextStorePageFails) {
      await route.fulfill({ status: 503, json: { message: 'temporary store failure' } })
      return
    }
    if (offset === 20) {
      await route.fulfill({ json: commandPage([], 200, false, 20) })
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
  await expect(page.getByRole('button', { name: 'Sonuçlar' })).toHaveCount(30)
  await page.getByRole('button', { name: 'Ziyaret Takvimi' }).click()
  await expect(page.getByText('Ziyaret planı yüklenemedi.').first()).toBeVisible()
  planFails = false
  await page.getByRole('button', { name: 'Tekrar dene' }).first().click()
  await expect(page.getByText('Ziyaret Tamamlandı').first()).toBeVisible()
  await page.getByRole('button', { name: 'Ziyaret takvimini kapat' }).click()

  await page.getByRole('button', { name: 'Sonraki sayfa', exact: true }).click()
  await expect(page.getByText('Mağazalar açılamadı')).toBeVisible()
  nextStorePageFails = false
  await page.getByRole('button', { name: 'Tekrar dene', exact: true }).click()
  await expect(page.getByText('Mağaza bulunamadı')).toBeVisible()

  await page.getByRole('button', { name: 'Önceki sayfa', exact: true }).click()
  await page.getByRole('button', { name: 'Sonuçlar' }).first().click()
  await page.getByRole('button', { name: '20 kayıt daha yükle' }).click()
  await expect(page.getByText('Yeni kayıtlar yüklenemedi; mevcut kayıtlar korunuyor.')).toBeVisible()
  historyCursorFails = false
  await page.getByRole('dialog', { name: 'Marmara Park mağaza kaydı' }).getByRole('button', { name: 'Tekrar dene', exact: true }).click()
  await expect(page.locator('.checklist-record-history-event').filter({ hasText: 'Görev çözüldü' }).filter({ hasText: '10 Oca' }).first()).toBeVisible()
})

test('Region Manager unified page normalizes legacy plan links at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await installStoreContractSession(page, 'regionManager')
  await routeReportViewerRecords(page)
  await page.route('**/api/checklists/command-canvas/visit-plans/regions**', async (route) => {
    await route.fulfill({ json: { data: { items: [{ regionId, regionName: 'Çok Uzun Marmara Bölge Müdürlüğü Adı' }], page: { total: 1, limit: 20, offset: 0, hasMore: false } } } })
  })

  await page.goto('/store/checklists?canvasView=plan')
  await expect(page).toHaveURL(/\/store\/checklists$/)
  await expect(page.getByRole('button', { name: 'Ziyaretler', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Ziyaret Planı/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Mağaza Kayıtları' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Saha Kontrolleri' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('Report Viewer dedicated manager workspace stays responsive', async ({ page }, testInfo) => {
  await installStoreContractSession(page, 'reportViewer')
  await routeReportViewerRecords(page)
  for (const viewport of [{ width: 1024, height: 768 }, { width: 390, height: 844 }] as const) {
    await page.setViewportSize(viewport)
    await page.goto('/store/checklists')
    await expect(page.getByRole('heading', { name: 'Checklist Raporları' }).first()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await expect(page.getByText('HAFTALIK PLAN', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Sonuçlar' }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Ziyaret Takvimi' }).click()
    await expect(page.getByRole('dialog', { name: 'Ziyaret Takvimi' })).toBeVisible()
    await expect(page.getByText('HAFTALIK PLAN', { exact: true })).toHaveCount(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: checklistEvidenceOutputPath(testInfo, `checklist-command-cutover-v2/p5/report-viewer-calendar-${viewport.width}x${viewport.height}.png`), fullPage: true })
    await page.getByRole('button', { name: 'Ziyaret takvimini kapat' }).click()
    await expect(page.getByRole('heading', { name: 'Saha Kontrolleri' })).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: checklistEvidenceOutputPath(testInfo, `checklist-command-cutover-v2/p5/report-viewer-${viewport.width}x${viewport.height}.png`), fullPage: true })
  }
})

test('Region Manager merged Results action stays responsive without overflow', async ({ page }, testInfo) => {
  await installStoreContractSession(page, 'regionManager')
  await routeReportViewerRecords(page)
  await page.route('**/api/checklists/command-canvas/visit-plans/regions**', async (route) => {
    await route.fulfill({ json: { data: { items: [{ regionId, regionName: 'Marmara' }], page: { total: 1, limit: 20, offset: 0, hasMore: false } } } })
  })

  for (const viewport of [{ width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 320, height: 844 }] as const) {
    await page.setViewportSize(viewport)
    await page.goto('/store/checklists')
    const resultsAction = page.getByRole('button', { name: 'Sonuçlar' }).first()
    await expect(resultsAction).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await resultsAction.click()
    await expect(page.getByRole('dialog', { name: 'Marmara Park mağaza kaydı' })).toBeVisible()
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

function formatPeriodLabel(period: string) {
  const [year, month] = period.split('-')
  const monthLabel = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'][Number(month) - 1]
  return monthLabel ? `${monthLabel} ${year}` : period
}

async function routeReportViewerRecords(page: Page, options: { delayedManagerUserId?: string; initialUnresolvedManagers?: boolean; periodAwareStoreRows?: boolean; periodSwitchDelayMs?: number; searchStoreDelayMs?: number; storeDelayMs?: number } = {}) {
  let regionRequestCount = 0
  await page.route('**/api/checklists/command-canvas/regions**', async (route) => {
    regionRequestCount += 1
    const requestUrl = new URL(route.request().url())
    const managerQuery = requestUrl.searchParams.get('query')?.trim().toLocaleLowerCase('tr-TR') ?? ''
    const unresolved = options.initialUnresolvedManagers && regionRequestCount === 1
    const filteredManagers = reportViewerManagers
      .map((manager, managerIndex) => ({ manager, managerIndex }))
      .filter(({ manager }) => !managerQuery || manager.managerName.toLocaleLowerCase('tr-TR').includes(managerQuery))
    await route.fulfill({
      json: {
        data: {
          period: '2026-07',
          view: 'report_viewer',
          capabilities: { weeklyVisitPlanningAvailable: false, canMaintainWeeklyVisitPlan: false },
          metrics: {
            totalStores: 160,
            missingVisitStores: 0,
            storesWithOpenActions: 8,
            openActionCount: 8,
            completedCoverageStores: 160,
          },
          items: filteredManagers.map(({ manager, managerIndex }) => ({
            managerUserId: manager.managerUserId,
            regionId: manager.regionId,
            regionName: manager.regionName,
            regionManagers: unresolved && managerIndex === 0 ? [{ displayName: 'Bilinmiyor' }] : [{ displayName: manager.managerName }],
            metrics: { totalStores: 20, missingVisitStores: 0, storesWithOpenActions: 1, openActionCount: 1, completedCoverageStores: 20, blockedActionCount: 0 },
            visitAverageScore: 82 + managerIndex,
            scoreSampleCount: 20,
            lastOperationalAt: `2026-07-${String(14 - managerIndex).padStart(2, '0')}T10:00:00.000Z`,
          })),
          page: { total: filteredManagers.length, limit: 20, offset: 0, hasMore: false },
        },
      },
    })
  })
  await page.route('**/api/checklists/command-canvas?**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const requestedManagerUserId = requestUrl.searchParams.get('managerUserId')
    const requestedPeriod = requestUrl.searchParams.get('period') ?? '2026-07'
    const query = requestUrl.searchParams.get('query')?.toLocaleLowerCase('tr-TR') ?? ''
    if (requestedManagerUserId === options.delayedManagerUserId) {
      await new Promise((resolve) => setTimeout(resolve, options.storeDelayMs ?? 250))
    }
    if (query && options.searchStoreDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.searchStoreDelayMs))
    }
    if (options.periodSwitchDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.periodSwitchDelayMs))
    }
    const managerIndex = Math.max(0, reportViewerManagers.findIndex((manager) => manager.managerUserId === requestedManagerUserId))
    const manager = reportViewerManagers[managerIndex]
    const periodLabel = options.periodAwareStoreRows ? formatPeriodLabel(requestedPeriod) : ''
    const items = Array.from({ length: 20 }, (_value, index) => {
      const storeNumber = index + 1
      const score = [94, 86, 78, 69, 57, null][index % 6]
      const completedAt = score === null ? null : `2026-08-${String(28 - (index % 6)).padStart(2, '0')}T10:00:00.000Z`
      return {
        ...commandRow(storeNumber),
        storeId: managerIndex === 0 && index === 0 ? storeId : `22222222-${String(managerIndex + 1).padStart(4, '0')}-4222-8222-${String(storeNumber).padStart(12, '0')}`,
        storeCode: `SYN-${String(managerIndex + 1).padStart(2, '0')}-${String(storeNumber).padStart(2, '0')}`,
        storeName: managerIndex === 0 && index === 0
          ? (periodLabel ? `${periodLabel} Marmara Park` : 'Marmara Park')
          : `${periodLabel ? `${periodLabel} ` : ''}${manager.managerName} Mağaza ${String(storeNumber).padStart(2, '0')}`,
        regionId: manager.regionId,
        regionName: manager.regionName,
        regionManagers: [{ displayName: manager.managerName }],
        bmScore: score,
        bmCompletedAt: completedAt,
        lastCompletedVisitAt: completedAt,
        elapsedDaysSinceLastVisit: completedAt === null ? null : index % 6,
        status: completedAt === null ? 'needs_visit' : 'completed',
      }
    }).filter((item) => !query || item.storeName.toLocaleLowerCase('tr-TR').includes(query))
    await route.fulfill({
      json: {
        data: {
          period: options.periodAwareStoreRows ? requestedPeriod : '2026-07',
          view: 'report_viewer',
          capabilities: { weeklyVisitPlanningAvailable: false, canMaintainWeeklyVisitPlan: false },
          metrics: { totalStores: items.length, needsVisit: 0, active: 0, pending: 0, completed: items.length },
          items,
          page: { total: items.length, limit: 20, offset: 0, hasMore: false },
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
    const firstPageItems = Array.from({ length: 20 }, (_value, index) => {
      const event = index === 0
        ? { kind: 'checklist_completed', title: 'Denetim tamamlandı' }
        : index === 1
          ? { kind: 'visit_completed', title: 'Ziyaret tamamlandı' }
          : index === 2
            ? { kind: 'task_assigned', title: 'Görev atandı' }
            : index === 3
              ? { kind: 'task_resolved', title: 'Görev çözüldü' }
              : { kind: 'checklist_completed', title: `Denetim kaydı ${index + 1}` }
      return {
        id: `opaque-event-${index + 1}`,
        ...event,
        occurredAt: `2026-07-${String(14 - Math.floor(index / 3)).padStart(2, '0')}T10:00:00.000Z`,
        detail: null,
        actorSnapshot: { displayName: 'Onur Kaytan', roleLabel: 'Bölge Müdürü', assignmentLabel: 'Marmara', identityStatus: 'captured' },
        details: [],
      }
    })
    await route.fulfill({
      json: {
        data: {
          store: { id: storeId, name: 'Marmara Park', city: null, district: null },
          summary: { eventCount: 21, completedAuditCount: 17, completedVisitCount: 18, assignedTaskCount: 1, resolvedTaskCount: 2, openTaskCount: 1 },
          items: cursor ? [{ id: 'opaque-event-21', kind: 'task_resolved', occurredAt: '2026-01-10T10:00:00.000Z', title: 'Görev çözüldü', detail: null, actorSnapshot: { displayName: 'Onur Kaytan', roleLabel: 'Bölge Müdürü', assignmentLabel: 'Marmara', identityStatus: 'captured' }, details: [] }] : firstPageItems,
          page: cursor ? { nextCursor: null, hasMore: false } : { nextCursor: 'opaque-cursor-2', hasMore: true },
        },
      },
    })
  })
}
