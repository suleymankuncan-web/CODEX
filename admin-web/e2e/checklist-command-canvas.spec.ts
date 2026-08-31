import { expect, test, type Locator, type Page } from './test-fixtures'
import { checklistEvidenceOutputPath } from './checklist-evidence-output'
import { installStoreContractSession as installBaseStoreContractSession } from './store-page-contract-fixtures'

const checklistActionStoreIds = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
]

function installStoreContractSession(page: Page, persona: 'regionManager') {
  return installBaseStoreContractSession(page, persona, { actionStoreIds: checklistActionStoreIds })
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-15T09:00:00+03:00'))
})

test('region manager command canvas reads bounded real rows and applies server controls', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installStoreContractSession(page, 'regionManager')
  const requests: URL[] = []
  await routeChecklistCommand(page, requests)

  await page.goto('/store/checklists')

  const desktopNavigation = page.locator('.store-command-nav')
  await expect(desktopNavigation).toBeVisible()
  await expect(desktopNavigation.getByRole('link', { name: 'Ana Sayfa', exact: true })).toBeVisible()
  await expect(desktopNavigation.locator('.store-command-nav-label', { hasText: 'Ana Sayfa' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Saha Kontrolleri' })).toBeVisible()
  const parityGeometry = await page.locator('.checklist-command-parity').evaluate((root) => {
    const surface = root.querySelector<HTMLElement>('[data-testid="checklist-command-surface"]')
    const header = root.querySelector<HTMLElement>('[data-testid="region-manager-checklist-header"]')
    const unifiedPlan = root.querySelector<HTMLElement>('.checklist-command-unified-plan')
    const row = root.querySelector<HTMLElement>('[data-testid="checklist-command-row"]')
    if (!surface || !header || !unifiedPlan || !row) throw new Error('missing checklist workspace surface')
    return {
      rootRect: root.getBoundingClientRect().toJSON(),
      headerRect: header.getBoundingClientRect().toJSON(),
      planRect: unifiedPlan.getBoundingClientRect().toJSON(),
      surfaceRect: surface.getBoundingClientRect().toJSON(),
      fontFamily: getComputedStyle(root).fontFamily,
      surfaceRadius: getComputedStyle(surface).borderRadius,
      headerRadius: getComputedStyle(header).borderRadius,
      rowMinHeight: getComputedStyle(row).minHeight,
    }
  })
  expect(parityGeometry).toMatchObject({
    fontFamily: expect.stringContaining('DM Sans'),
    surfaceRadius: '14px',
    headerRadius: '14px',
    rowMinHeight: '64px',
  })
  expect(parityGeometry.rootRect.width).toBeLessThanOrEqual(1280)
  expect(parityGeometry.planRect.y).toBeGreaterThanOrEqual(parityGeometry.headerRect.y + parityGeometry.headerRect.height)
  expect(parityGeometry.surfaceRect.y).toBeGreaterThanOrEqual(parityGeometry.planRect.y + parityGeometry.planRect.height)
  await expect(page.getByText('Marmara Park').first()).toBeVisible()
  await expect(page.getByText('88').first()).toBeVisible()
  await expect(page.getByText('Ziyaret eksik').first()).toBeVisible()
  await expect(page.getByText('4 gün').first()).toBeVisible()
  await expect(page.locator('.checklist-command-desktop-list .score-vm')).toHaveCount(0)
  await expect(page.locator('.checklist-command-table-head').getByRole('button', { name: 'Geçen süre' })).toBeVisible()
  await expect(page.locator('.checklist-command-compact-sort')).toHaveCount(0)
  await expect(page.getByTestId('checklist-command-search').getByRole('textbox')).toHaveCSS('text-align', 'start')
  await page.locator('.checklist-command-table-head').getByRole('button', { name: 'Geçen süre' }).click()
  await expect.poll(() => requests.some((url) => url.searchParams.get('sort') === 'elapsed_desc')).toBe(true)
  const visitDateCell = page.locator('.checklist-command-date').first()
  await expect(visitDateCell).toBeVisible()
  expect(await visitDateCell.evaluate((element) => getComputedStyle(element).fontSize)).toBe('12px')

  await expect(page.locator('.checklist-command-toolbar')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Kolonlar/ })).toHaveCount(0)

  await page.getByRole('button', { name: /Temmuz 2026/ }).click()
  await expect(page.getByRole('dialog', { name: /Raporlama dönemi/ })).toBeVisible()
  await page.getByRole('button', { name: 'Ağustos' }).click()
  await page.getByRole('button', { name: /Uygula/ }).click()
  await expect.poll(() => requests.some((url) => url.searchParams.get('period') === '2026-08')).toBe(true)
  await page.getByRole('button', { name: /Ağustos 2026/ }).click()
  await page.getByRole('heading', { name: 'Saha Kontrolleri' }).click()
  await expect(page.getByRole('dialog', { name: /Raporlama dönemi/ })).toHaveCount(0)

  await page.screenshot({
    path: checklistEvidenceOutputPath(testInfo, 'checklist-command-canvas-visits-parity-v1-2026-07-14/region-manager-command-canvas-desktop.png'),
    fullPage: true,
  })

  const workflowButton = page.locator('[data-testid="checklist-command-row"]').first().getByRole('button', { name: /^(Başlat|Devam et)$/ })
  await workflowButton.click()
  await expect(page).toHaveURL(
    /\/store\/checklists\?overlay=workflow&storeId=11111111-1111-4111-8111-111111111111&workflowTab=visits&workflowChecklist=bm/,
  )
  await expect(page.locator('h1', { hasText: 'Saha Kontrolleri' })).toHaveCount(1)
  const checklistSession = page.getByRole('dialog', { name: 'Checklist Oturumu' })
  await expect(checklistSession).toBeVisible()
  await expect(page.getByRole('dialog', { name: /Checklist akışı/ })).toHaveCount(0)
  await expect(checklistSession.getByRole('heading', { name: 'Marmara Park' })).toBeVisible()
  const workflowGeometry = await checklistSession.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return {
      bottom: rect.bottom,
      height: rect.height,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      width: rect.width,
      viewportHeight: document.documentElement.clientHeight,
      viewportWidth: document.documentElement.clientWidth,
    }
  })
  expect(workflowGeometry.width).toBeLessThanOrEqual(760)
  expect(workflowGeometry.height).toBeLessThanOrEqual(workflowGeometry.viewportHeight)
  expect(workflowGeometry.left).toBeGreaterThanOrEqual(0)
  expect(workflowGeometry.right).toBeLessThanOrEqual(workflowGeometry.viewportWidth)
  await page.screenshot({
    path: checklistEvidenceOutputPath(testInfo, 'checklist-command-cutover-v2/p7/workflow-drawer-desktop.png'),
    fullPage: true,
  })
  await expect(page.locator('.store-checklists-command-page')).toHaveCount(0)
  await page.keyboard.press('Escape')
  const closeConfirmation = page.getByRole('alertdialog', { name: 'Checklist kapatılsın mı?' })
  await expect(closeConfirmation).toBeVisible()
  await closeConfirmation.getByRole('button', { name: "Checklist'e dön" }).click()
  await expect(closeConfirmation).toHaveCount(0)
  await expect(checklistSession).toBeVisible()
  await expect.poll(() => checklistSession.evaluate((element) => element.contains(document.activeElement))).toBe(true)
  await checklistSession.getByRole('button', { name: 'Kapat' }).click()
  await expect(closeConfirmation).toBeVisible()
  await closeConfirmation.getByRole('button', { name: 'Checklisti kapat' }).click()
  await expect(checklistSession).toHaveCount(0)
  await expect(workflowButton).toBeFocused()
  await expect(page).not.toHaveURL(/overlay=/)

  await page.route('**/api/checklists/command-canvas/stores/*/operational-history**', async (route) => {
    const requestedStoreId = new URL(route.request().url()).pathname.split('/').at(-2) ?? ''
    await route.fulfill({
      json: {
        data: {
          store: { id: requestedStoreId, name: 'Marmara Park', city: null, district: null },
          summary: { eventCount: 0, completedAuditCount: 0, completedVisitCount: 0, assignedTaskCount: 0, resolvedTaskCount: 0, openTaskCount: 0 },
          items: [],
          page: { nextCursor: null, hasMore: false },
        },
      },
    })
  })
  const resultButton = page.getByRole('button', { name: 'Sonuçlar' }).first()
  await resultButton.click()
  await expect(page).not.toHaveURL(/overlay=/)
  const resultDrawer = page.getByRole('dialog', { name: /Marmara Park mağaza kaydı/ })
  await expect(resultDrawer).toBeVisible()
  await expect(resultDrawer.getByText('Henüz kayıt yok')).toBeVisible()
  await page.screenshot({
    path: checklistEvidenceOutputPath(testInfo, 'checklist-command-cutover-v2/p7/result-drawer-desktop.png'),
    fullPage: true,
  })
})

test('region manager legacy workflow deep links normalize above Command Canvas without legacy DOM', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await routeChecklistCommand(page, [])

  await page.goto('/store/checklists?view=workflow&storeId=11111111-1111-4111-8111-111111111111&tab=visits')

  await expect(page).toHaveURL(
    /\/store\/checklists\?overlay=workflow&storeId=11111111-1111-4111-8111-111111111111&workflowTab=visits/,
  )
  await expect(page.locator('h1', { hasText: 'Saha Kontrolleri' })).toHaveCount(1)
  await expect(page.getByRole('dialog', { name: /Checklist akışı/ })).toBeVisible()
  await expect(page.locator('.store-checklists-command-page')).toHaveCount(0)
})

test('crafted direct checklist intent outside visits is normalized without starting a checklist', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await routeChecklistCommand(page, [])
  let startRequests = 0
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/api/mobile/checklists/instances')) {
      startRequests += 1
    }
  })

  await page.goto('/store/checklists?overlay=workflow&storeId=11111111-1111-4111-8111-111111111111&workflowTab=history&workflowChecklist=bm')

  await expect(page).toHaveURL(/workflowTab=history$/)
  await expect(page).not.toHaveURL(/workflowChecklist=/)
  await expect(page.getByRole('dialog', { name: /Checklist/ })).toBeVisible()
  await expect.poll(() => startRequests).toBe(0)
})

test('read-visible but action-unassigned region store cannot auto-start a direct checklist', async ({ page }) => {
  await installBaseStoreContractSession(page, 'regionManager')
  await routeChecklistCommand(page, [])
  let startRequests = 0
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/api/mobile/checklists/instances')) {
      startRequests += 1
    }
  })

  await page.goto('/store/checklists?overlay=workflow&storeId=11111111-1111-4111-8111-111111111111&workflowTab=visits&workflowChecklist=bm')

  await expect(page.getByRole('dialog', { name: /Checklist/ })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Checklist Oturumu' })).toHaveCount(0)
  await expect.poll(() => startRequests).toBe(0)
})

test('BM-complete and VM-missing region row can start another BM checklist in the same month', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await routeChecklistCommand(page, [], [], undefined, 0, { bmCompletedVmMissing: true })
  let startRequests = 0
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/api/mobile/checklists/instances')) {
      startRequests += 1
    }
  })

  await page.goto('/store/checklists')
  const row = page.getByTestId('checklist-command-row').filter({ hasText: 'Marmara Park' })
  await expect(row.getByText('Bu ay eksik')).toHaveCount(0)
  await expect(row.getByRole('button', { name: 'Sonuçlar' })).toBeVisible()
  await row.getByRole('button', { name: 'Başlat', exact: true }).click()

  await expect(page).toHaveURL(/workflowTab=visits/)
  await expect(page).toHaveURL(/workflowChecklist=bm/)
  await expect(page.getByRole('dialog', { name: 'Checklist Oturumu' })).toBeVisible()
  await expect(page.getByText('VM Checklist', { exact: true })).toHaveCount(0)
  await expect.poll(() => startRequests).toBe(1)
})

test('region manager command canvas stays bounded as mobile cards with 30-row pages', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.clock.setFixedTime(new Date('2026-07-16T09:00:00+03:00'))
  await installStoreContractSession(page, 'regionManager')
  await routeChecklistCommand(page, [])

  await page.goto('/store/checklists')

  const mobileNavigation = page.locator('.store-command-nav')
  await expect(mobileNavigation).toBeVisible()
  const mobileHomeLink = mobileNavigation.getByRole('link', { name: 'Ana Sayfa', exact: true })
  await expect(mobileHomeLink).toBeVisible()
  await mobileHomeLink.click()
  await expect(page).toHaveURL(/\/store\/home$/)
  await page.goto('/store/checklists')
  await expect(page.getByRole('heading', { name: 'Saha Kontrolleri' })).toBeVisible()
  await expect(page.locator('[data-testid="checklist-command-row"]')).toHaveCount(2)
  await expect(page.locator('.week-planner-mobile-days > button')).toHaveCount(6)
  await expect(page.locator('.week-planner-mobile-days > button.is-active')).toContainText('Perşembe')
  await expect(page.locator('.week-planner-mobile-days > button.is-active')).toContainText('16 Tem')
  await expect(page.locator('.week-planner-grid > .week-day:visible')).toHaveCount(1)
  await expect(page.getByText('1-2 / 2 mağaza')).toBeVisible()
  expect(await page.getByPlaceholder('Mağaza veya durum ara').evaluate((element) => getComputedStyle(element).fontSize)).toBe('16px')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)

  await page.screenshot({
    path: checklistEvidenceOutputPath(testInfo, 'checklist-command-canvas-visits-parity-v1-2026-07-14/region-manager-command-canvas-mobile-390.png'),
    fullPage: true,
  })

  await page.getByRole('button', { name: 'Başlat', exact: true }).first().click()
  const checklistSession = page.getByRole('dialog', { name: 'Checklist Oturumu' })
  await expect(checklistSession).toBeVisible()
  await expect(page.getByRole('dialog', { name: /Checklist akışı/ })).toHaveCount(0)
  const drawerGeometry = await checklistSession.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return { height: rect.height, left: rect.left, top: rect.top, width: rect.width }
  })
  expect(drawerGeometry).toEqual({ height: 844, left: 0, top: 0, width: 390 })
  await page.screenshot({
    path: checklistEvidenceOutputPath(testInfo, 'checklist-command-cutover-v2/p7/workflow-drawer-mobile-390.png'),
    fullPage: true,
  })
})

test('region manager plans a full Monday-Saturday week and saves one real API snapshot', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installStoreContractSession(page, 'regionManager')
  const requests: URL[] = []
  const savedBodies: unknown[] = []
  await routeChecklistCommand(page, requests, savedBodies)

  await page.goto('/store/checklists')

  await expect(page.getByRole('heading', { name: 'Saha Kontrolleri' })).toBeVisible()
  await expect(page.getByText('Ziyaret Tamamlandı')).toBeVisible()
  await expect(page.getByText('Ziyaret Bekleniyor').first()).toBeVisible()
  await expect(page.getByText('Ziyaret Yapılmadı').first()).toBeVisible()
  await expect(page.getByText('Pazar plan dışı')).toBeVisible()
  const waitingVisitTone = await page.locator('.week-visit--waiting').first().evaluate((element) => ({
    backgroundColor: getComputedStyle(element).backgroundColor,
    borderColor: getComputedStyle(element).borderColor,
    outcomeColor: getComputedStyle(element.querySelector('.week-visit-outcome')!).color,
  }))
  const plannedVisitTone = await page.locator('.week-visit--planned').first().evaluate((element) => ({
    backgroundColor: getComputedStyle(element).backgroundColor,
    borderColor: getComputedStyle(element).borderColor,
    outcomeColor: getComputedStyle(element.querySelector('.week-visit-outcome')!).color,
  }))
  expect(plannedVisitTone).toEqual(waitingVisitTone)
  const waitingVisitIcons = await page.locator('.week-visit--waiting .week-visit-outcome svg, .week-visit--planned .week-visit-outcome svg').evaluateAll((elements) => elements.map((element) => element.getAttribute('class')))
  expect(waitingVisitIcons.length).toBeGreaterThan(1)
  expect(waitingVisitIcons.every((className) => className?.includes('lucide-clock-3'))).toBe(true)

  await page.getByRole('button', { name: 'Haftayı Planla' }).click()
  const dialog = page.getByRole('dialog', { name: 'Ziyaret planını oluşturun' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Plan kapsamı')).toBeVisible()
  await expect(dialog.getByText('Sorumlu')).toHaveCount(0)
  const saveButton = dialog.getByRole('button', { name: 'Ziyaret Planını Kaydet' })
  const plannerTokenStyles = await saveButton.evaluate((element) => ({
    backgroundColor: getComputedStyle(element).backgroundColor,
    color: getComputedStyle(element).color,
  }))
  expect(plannerTokenStyles).toEqual({
    backgroundColor: 'rgb(112, 73, 232)',
    color: 'rgb(255, 255, 255)',
  })
  await page.screenshot({
    path: checklistEvidenceOutputPath(testInfo, 'checklist-command-cutover-v2/p7/weekly-plan-dialog-desktop.png'),
    fullPage: true,
  })

  await dialog.getByRole('button', { name: 'Pazartesi, 13 Tem' }).click()
  await dialog.getByRole('button', { name: /Marmara Park mağazasını/ }).click()
  await expect(dialog.getByText('Marmara Park')).toHaveCount(3)
  await dialog.getByRole('button', { name: /Ziyaret Planını Kaydet/ }).click()

  await expect(dialog).toHaveCount(0)
  await expect.poll(() => savedBodies.length).toBe(1)
  expect(savedBodies[0]).toMatchObject({
    expectedRevision: 3,
    items: expect.arrayContaining([
      expect.objectContaining({ storeId: '11111111-1111-4111-8111-111111111111', plannedDate: '2026-07-13' }),
      expect.objectContaining({ storeId: '11111111-1111-4111-8111-111111111111', plannedDate: '2026-07-15' }),
    ]),
  })
})

test('weekly calendar store opens visit actions and records an attendance-only visit', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installStoreContractSession(page, 'regionManager')
  const requests: URL[] = []
  await routeChecklistCommand(page, requests)

  await page.goto('/store/checklists')
  const completedVisit = page.locator('.week-visit--completed').filter({ hasText: 'Mall of İstanbul' }).first()
  await completedVisit.click()
  const completedDialog = page.getByRole('dialog', { name: 'Mall of İstanbul' })
  await expect(completedDialog.getByText('Checklist Yapıldı · Ziyaret Tamamlandı')).toBeVisible()
  await completedDialog.getByRole('button', { name: 'Kapat' }).click()

  const missedVisit = page.locator('.week-visit--missed').filter({ hasText: 'Mall of İstanbul' }).first()
  await expect(missedVisit).toBeVisible()
  await missedVisit.click()
  const missedDialog = page.getByRole('dialog', { name: 'Mall of İstanbul' })
  await expect(missedDialog.getByText('Ziyaret Yapılmadı')).toBeVisible()
  await expect(missedDialog.getByText(/geriye dönük checklist veya ziyaret tamamlama/)).toBeVisible()
  await expect(missedDialog.locator('.week-visit-action-actions > button')).toHaveCount(2)
  await expect(missedDialog.getByRole('button', { name: 'Checklisti Başlat' })).toBeDisabled()
  await expect(missedDialog.getByRole('button', { name: 'Ziyareti Tamamla' })).toBeDisabled()
  await missedDialog.getByRole('button', { name: 'Kapat' }).click()

  const plannedVisit = page.locator('.week-visit').filter({ hasText: 'Marmara Park' }).first()
  await expect(plannedVisit).toBeVisible()
  await plannedVisit.click()

  const actionDialog = page.getByRole('dialog', { name: 'Marmara Park' })
  await expect(actionDialog).toBeVisible()
  await expect(actionDialog.locator('.week-visit-action-actions > button')).toHaveCount(2)
  await expect(actionDialog.getByRole('button', { name: 'Checklisti Başlat' })).toBeVisible()
  await expect(actionDialog.getByRole('button', { name: 'Ziyareti Tamamla' })).toBeVisible()
  await expect(actionDialog.getByRole('button', { name: 'Sonucu gör' })).toHaveCount(0)
  await actionDialog.getByRole('button', { name: 'Checklisti Başlat' }).click()
  const actionConfirmation = page.getByRole('alertdialog', { name: 'İşlemi onaylıyor musunuz?' })
  await expect(actionConfirmation).toBeVisible()
  await expect(actionConfirmation.getByText(/Checklisti Başlat işlemini/)).toBeVisible()
  await actionConfirmation.getByRole('button', { name: 'Vazgeç' }).click()
  await expect(actionConfirmation).toHaveCount(0)
  await expect(actionDialog).toBeVisible()
  await actionDialog.getByRole('button', { name: 'Ziyareti Tamamla' }).click()
  await expect(page.getByRole('alertdialog', { name: 'İşlemi onaylıyor musunuz?' })).toBeVisible()
  await expect.poll(() => requests.some((url) => url.pathname.endsWith('/visit-plans/items/44444444-4444-4444-8444-000000000001/complete'))).toBe(false)
  await page.getByRole('alertdialog', { name: 'İşlemi onaylıyor musunuz?' }).getByRole('button', { name: 'Onayla' }).click()
  await expect(actionDialog).toHaveCount(0)
  await expect.poll(() => requests.some((url) => url.pathname.endsWith('/visit-plans/items/44444444-4444-4444-8444-000000000001/complete'))).toBe(true)
})

test('store records expose score and completed checklist result directly on the history row', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installStoreContractSession(page, 'regionManager')
  await routeChecklistCommand(page, [])

  const storeId = '22222222-2222-4222-8222-222222222222'
  const checklistInstanceId = '77777777-7777-4777-8777-777777777777'
  await page.route(`**/api/checklists/command-canvas/stores/${storeId}/operational-history**`, async (route) => {
    await route.fulfill({
      json: {
        data: {
          store: { id: storeId, name: 'Mall of İstanbul', city: null, district: null },
          summary: { eventCount: 1, completedAuditCount: 1, completedVisitCount: 1, assignedTaskCount: 0, resolvedTaskCount: 0, openTaskCount: 0 },
          items: [{
            id: 'evt_checklist_completed_1',
            kind: 'checklist_completed',
            occurredAt: '2026-07-11T10:00:00.000Z',
            title: 'Denetim tamamlandı',
            detail: 'Mağaza denetimi tamamlandı.',
            actorSnapshot: { displayName: 'Pilot Bölge Müdürü', roleLabel: null, assignmentLabel: null, identityStatus: 'captured' },
            details: [{ label: 'Denetim türü', value: 'Bölge Müdürü ziyareti' }],
          }],
          page: { nextCursor: null, hasMore: false },
        },
      },
    })
  })
  await page.route('**/api/checklists/acknowledgements/list**', async (route) => {
    await route.fulfill({
      json: {
        items: [{
          checklistInstanceId,
          checklistTemplateId: 'template-command-bm',
          templateName: 'BM Store Visit',
          templateType: 'BM_STORE_VISIT',
          category: 'BM',
          storeId,
          storeName: 'Mall of İstanbul',
          completedByUserId: '90000000-0000-4000-8000-000000000017',
          completedAt: '2026-07-11T10:00:00.000Z',
          status: 'completed',
          totalScore: 88,
          complianceRate: 88,
          responses: [],
          acknowledgement: null,
        }],
        meta: { count: 1, limit: 50, offset: 0, total: 1 },
      },
    })
  })

  await page.goto('/store/checklists')
  const recordRow = page.getByTestId('checklist-command-row').filter({ hasText: 'Mall of İstanbul' })
  await recordRow.getByRole('button', { name: 'Sonuçlar' }).click()

  const drawer = page.getByRole('dialog', { name: /Mall of İstanbul mağaza kaydı/ })
  await expect(drawer).toBeVisible()
  await expect(drawer.getByLabel('Checklist puanı: 88 puan')).toBeVisible()
  await expect(drawer.getByRole('button', { name: 'Sonucu Gör' })).toBeVisible()
  await page.screenshot({ path: checklistEvidenceOutputPath(testInfo, 'checklist-command-cutover-v2/p5/region-manager-record-detail-desktop.png') })
  await drawer.getByRole('button', { name: 'Sonucu Gör' }).click()
  await expect(page).toHaveURL(new RegExp(`overlay=result&checklistInstanceId=${checklistInstanceId}`))
})

test('closing a visit-plan result never reveals the workflow drawer', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installStoreContractSession(page, 'regionManager')
  await routeChecklistCommand(page, [], [], undefined, 0, { singleCompletedOccurrence: true })
  const storeId = '22222222-2222-4222-8222-222222222222'
  await page.route(`**/api/checklists/command-canvas/stores/${storeId}/operational-history**`, async (route) => {
    await route.fulfill({
      json: {
        data: {
          store: { id: storeId, name: 'Mall of İstanbul', city: null, district: null },
          summary: { eventCount: 1, completedAuditCount: 1, completedVisitCount: 1, assignedTaskCount: 0, resolvedTaskCount: 0, openTaskCount: 0 },
          items: [{
            id: 'evt_checklist_completed_close',
            kind: 'checklist_completed',
            occurredAt: '2026-07-14T09:00:00.000Z',
            title: 'Denetim tamamlandı',
            detail: 'Mağaza denetimi tamamlandı.',
            actorSnapshot: { displayName: 'Pilot Bölge Müdürü', roleLabel: null, assignmentLabel: null, identityStatus: 'captured' },
            details: [{ label: 'Denetim türü', value: 'Bölge Müdürü ziyareti' }],
          }],
          page: { nextCursor: null, hasMore: false },
        },
      },
    })
  })
  await page.route('**/api/checklists/acknowledgements/list**', async (route) => {
    await route.fulfill({
      json: {
        items: [{
          checklistInstanceId: '55555555-5555-4555-8555-555555555555',
          checklistTemplateId: 'template-command-bm',
          templateName: 'BM Store Visit',
          templateType: 'BM_STORE_VISIT',
          category: 'BM',
          storeId: '22222222-2222-4222-8222-222222222222',
          storeName: 'Mall of İstanbul',
          completedByUserId: '90000000-0000-4000-8000-000000000017',
          completedByDisplayName: 'Eda Doğanay',
          completedAt: '2026-07-14T09:00:00.000Z',
          status: 'completed',
          totalScore: 88,
          complianceRate: 88,
          responses: [],
          acknowledgement: null,
        }],
        meta: { count: 1, limit: 50, offset: 0, total: 1 },
      },
    })
  })

  await page.goto('/store/checklists')
  const row = page.getByTestId('checklist-command-row').filter({ hasText: 'Mall of İstanbul' })
  await row.getByRole('button', { name: 'Sonuçlar' }).click()
  const historyDrawer = page.getByRole('dialog', { name: /Mall of İstanbul mağaza kaydı/ })
  await historyDrawer.getByRole('button', { name: 'Sonucu Gör' }).first().click()

  const resultModal = page.locator('.store-checklist-result-modal')
  await expect(resultModal).toBeVisible()
  await expect(resultModal.getByText('Eda Doğanay', { exact: true })).toBeVisible()
  await page.evaluate(() => {
    const probe = {
      observer: new MutationObserver(() => {
        if (document.querySelector('.checklist-workflow-command-drawer')) probe.seen = true
      }),
      seen: false,
    }
    probe.observer.observe(document.documentElement, { childList: true, subtree: true })
    ;(window as Window & { __workflowDrawerProbe?: typeof probe }).__workflowDrawerProbe = probe
  })

  await resultModal.getByRole('button', { name: 'Kapat' }).click()
  await expect(resultModal).toHaveCount(0)
  await expect(page).not.toHaveURL(/overlay=result/)
  await page.waitForTimeout(500)

  const workflowDrawerWasVisible = await page.evaluate(() => {
    const probe = (window as Window & {
      __workflowDrawerProbe?: { observer: MutationObserver; seen: boolean }
    }).__workflowDrawerProbe
    probe?.observer.disconnect()
    return probe?.seen ?? false
  })
  expect(workflowDrawerWasVisible).toBe(false)
})

for (const viewport of [
  { width: 390, height: 844, evidence: 'weekly-plan-dialog-mobile-390.png' },
  { width: 320, height: 720 },
  { width: 320, height: 844 },
] as const) {
  test(`weekly planner pages 35 scoped stores and keeps the save action reachable at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    await installStoreContractSession(page, 'regionManager')
    const requests: URL[] = []
    await routeChecklistCommand(page, requests)

    await page.goto('/store/checklists')
    await page.getByRole('button', { name: 'Haftayı Planla' }).click()

    const dialog = page.getByRole('dialog', { name: 'Ziyaret planını oluşturun' })
    await expect(dialog.locator('.week-plan-result-row')).toHaveCount(20)
    await expect(dialog.getByText('1 / 2')).toBeVisible()
    await assertMobileWeeklyPlannerReachability(dialog, viewport)
    await Promise.all([
      page.waitForRequest((request) => {
        const url = new URL(request.url())
        return url.pathname.endsWith('/visit-plans/candidates') && url.searchParams.get('offset') === '20'
      }),
      dialog.getByRole('button', { name: 'Sonraki', exact: true }).click(),
    ])
    await expect.poll(() => requests.some((url) => url.pathname.endsWith('/visit-plans/candidates') && url.searchParams.get('offset') === '20')).toBe(true)
    await expect(dialog.getByText('2 / 2')).toBeVisible()
    await expect(dialog.locator('.week-plan-result-row')).toHaveCount(15)
    await assertMobileWeeklyPlannerReachability(dialog, viewport)
    if (viewport.evidence) {
      await page.screenshot({
        path: checklistEvidenceOutputPath(testInfo, `checklist-command-cutover-v2/p7/${viewport.evidence}`),
        fullPage: true,
      })
    }
  })
}

async function assertMobileWeeklyPlannerReachability(
  dialog: Locator,
  viewport: { width: number; height: number },
) {
  const results = dialog.locator('.week-plan-results')
  await results.evaluate((element) => { element.scrollTop = 0 })
  const candidateViewport = await results.evaluate((element) => {
    const firstRow = element.querySelector<HTMLElement>('.week-plan-result-row')
    const lastRow = element.querySelector<HTMLElement>('.week-plan-result-row:last-child')
    const firstAction = firstRow?.querySelector<HTMLElement>('button')
    if (!firstRow || !lastRow) throw new Error('missing candidate rows')
    const container = element.getBoundingClientRect()
    const first = firstRow.getBoundingClientRect()
    const rowHeight = first.height
    const isWithin = (row: DOMRect) => row.top >= container.top && row.bottom <= container.bottom
    const actionVisible = firstAction ? isWithin(firstAction.getBoundingClientRect()) : false
    return {
      clientHeight: element.clientHeight,
      firstActionVisible: actionVisible,
      firstVisible: isWithin(first),
      rowHeight,
      scrollHeight: element.scrollHeight,
    }
  })
  expect(candidateViewport.clientHeight).toBeGreaterThanOrEqual(candidateViewport.rowHeight * 2)
  expect(candidateViewport.scrollHeight).toBeGreaterThan(candidateViewport.clientHeight)
  expect(candidateViewport.firstVisible).toBe(true)
  expect(candidateViewport.firstActionVisible).toBe(true)
  await results.evaluate((element) => { element.scrollTop = element.scrollHeight })
  await expect.poll(() => results.evaluate((element) => {
    const row = element.querySelector<HTMLElement>('.week-plan-result-row:last-child')
    const action = row?.querySelector<HTMLElement>('button')
    if (!row || !action) return false
    const container = element.getBoundingClientRect()
    const candidate = row.getBoundingClientRect()
    const actionRect = action.getBoundingClientRect()
    return candidate.top >= container.top
      && candidate.bottom <= container.bottom
      && actionRect.top >= container.top
      && actionRect.bottom <= container.bottom
      && Boolean(row.textContent?.trim())
  })).toBe(true)

  const saveButton = dialog.getByRole('button', { name: 'Ziyaret Planını Kaydet' })
  await expect(saveButton).toBeVisible()
  const saveGeometry = await saveButton.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return { bottom: rect.bottom, left: rect.left, right: rect.right }
  })
  expect(saveGeometry.left).toBeGreaterThanOrEqual(0)
  expect(saveGeometry.right).toBeLessThanOrEqual(viewport.width)
  expect(saveGeometry.bottom).toBeLessThanOrEqual(viewport.height)
  const dialogGeometry = await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return { bottom: rect.bottom, width: rect.width }
  })
  expect(dialogGeometry.width).toBeCloseTo(viewport.width, 0)
  expect(dialogGeometry.bottom).toBeCloseTo(viewport.height, 0)
  const pageOverflow = await dialog.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(pageOverflow).toBeLessThanOrEqual(1)
}

test('explicit region context survives a zero-row command filter', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installStoreContractSession(page, 'regionManager')
  const requests: URL[] = []
  await routeChecklistCommand(page, requests, [], [
    { regionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', regionName: 'Marmara' },
    { regionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', regionName: 'Ege' },
  ])

  await page.goto('/store/checklists')
  await page.locator('.checklist-region-trigger').click()
  await page.getByRole('button', { name: 'Ege' }).click()
  await expect.poll(() => requests.some((url) => url.pathname.endsWith('/command-canvas') && url.searchParams.get('regionId') === 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')).toBe(true)

  await page.getByTestId('checklist-command-search').getByRole('textbox').fill('bulunmaz')
  await expect(page.getByText('Bu filtrelerde mağaza yok')).toBeVisible()
  await expect(page.getByRole('button', { name: /Ziyaret Planı/ })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Saha ziyaretlerini günlere yerleştirin' })).toBeVisible()
})

test('switching regions never exposes the previous region rows under a pending or failed request', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installStoreContractSession(page, 'regionManager')
  const marmaraId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const egeId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  await routeChecklistCommand(page, [], [], [
    { regionId: marmaraId, regionName: 'Marmara' },
    { regionId: egeId, regionName: 'Ege' },
  ], 0, {
    commandRegionDelays: { [egeId]: 500 },
    commandRegionStatuses: { [egeId]: 400 },
  })

  await page.goto('/store/checklists')
  await page.locator('.checklist-region-trigger').click()
  await page.getByRole('button', { name: 'Marmara' }).click()
  await expect(page.getByText('Marmara Park').first()).toBeVisible()

  await page.locator('.checklist-region-trigger').click()
  await page.getByRole('button', { name: 'Ege' }).click()
  await expect(page.getByText('Marmara Park')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Tekrar dene/ })).toBeVisible()
  await expect(page.getByText('Marmara Park')).toHaveCount(0)
})

test('server filters retain current rows until the replacement succeeds', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installStoreContractSession(page, 'regionManager')
  await routeChecklistCommand(page, [], [], undefined, 600)

  await page.goto('/store/checklists')
  await expect(page.getByText('Marmara Park').first()).toBeVisible()
  await page.getByTestId('checklist-command-search').getByRole('textbox').fill('gecikmeli')
  await expect(page.getByText('Marmara Park').first()).toBeVisible()
  await expect(page.getByText('Güncelleniyor…')).toBeVisible()
  await expect(page.getByText('Marmara Park').first()).toBeVisible()
})

test('failed server filters retain current rows and expose an inline retry', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installStoreContractSession(page, 'regionManager')
  await routeChecklistCommand(page, [], [], undefined, 0, { commandFilterStatus: 400 })

  await page.goto('/store/checklists')
  await expect(page.getByText('Marmara Park').first()).toBeVisible()
  await page.getByTestId('checklist-command-search').getByRole('textbox').fill('hata')
  await expect(page.getByText('Marmara Park').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Yeniden dene' })).toBeVisible()
  await expect(page.getByText('Marmara Park').first()).toBeVisible()
})

test('unified page keeps the weekly planner first without a duplicated store list', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installStoreContractSession(page, 'regionManager')
  await routeChecklistCommand(page, [])

  await page.goto('/store/checklists')
  await expect(page.getByRole('button', { name: /Yıllık Ziyaretler/ })).toBeVisible()
  await expect(page.locator('.canvas-plan-surface')).toHaveCount(0)
  await expect(page.locator('.decision-rail--plan')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Planla', exact: true })).toHaveCount(0)
  const order = await page.locator('.checklist-command-parity').evaluate((root) => {
    const header = root.querySelector<HTMLElement>('[data-testid="region-manager-checklist-header"]')
    const week = root.querySelector<HTMLElement>('.week-planner')
    const visits = root.querySelector<HTMLElement>('[data-testid="checklist-command-surface"]')
    if (!header || !week || !visits) throw new Error('missing checklist workspace landmark')
    return { headerY: header.getBoundingClientRect().y, weekY: week.getBoundingClientRect().y, visitsY: visits.getBoundingClientRect().y }
  })
  expect(order.headerY).toBeLessThan(order.weekY)
  expect(order.weekY).toBeLessThan(order.visitsY)
})

test('period picker remains keyboard accessible while the plan toolbar stays minimal', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installStoreContractSession(page, 'regionManager')
  await routeChecklistCommand(page, [])

  await page.goto('/store/checklists')
  const periodTrigger = page.locator('.checklist-command-period-trigger')
  await periodTrigger.click()
  const periodDialog = page.getByRole('dialog', { name: 'Raporlama dönemi' })
  await expect(periodDialog).toBeVisible()
  await periodDialog.getByRole('button', { name: 'Temmuz' }).focus()
  await page.keyboard.press('Escape')
  await expect(periodDialog).toHaveCount(0)
  await expect(periodTrigger).toBeFocused()

  await expect(page.locator('.checklist-command-toolbar')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Kolonlar/ })).toHaveCount(0)

  await expect(page.locator('.canvas-plan-command')).toHaveCount(0)
  await expect(page.locator('.canvas-plan-head')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Yıllık Ziyaretler/ })).toBeVisible()
})

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
  { width: 320, height: 720 },
] as const) {
  test(`region manager period picker stays within the viewport and hit-testable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await installStoreContractSession(page, 'regionManager')
    await routeChecklistCommand(page, [])
    await page.goto('/store/checklists')

    await assertPeriodPickerGeometry(page, viewport)
  })
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
  { width: 320, height: 720 },
] as const) {
  test(`region manager no-selection period picker stays within the viewport at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await installStoreContractSession(page, 'regionManager')
    await routeChecklistCommand(page, [], [], [
      { regionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', regionName: 'Marmara' },
      { regionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', regionName: 'Ege' },
    ])
    await page.goto('/store/checklists')
    await expect(page.getByText('Mağaza sorumluluğunu seçin')).toBeVisible()

    await assertPeriodPickerGeometry(page, viewport)
  })
}

async function assertPeriodPickerGeometry(page: Page, viewport: { width: number; height: number }) {
  const periodTrigger = page.locator('.checklist-command-period-trigger')
  await expect(periodTrigger).toBeVisible()
  await periodTrigger.click()
  const periodDialog = page.getByRole('dialog', { name: 'Raporlama dönemi' })
  await expect(periodDialog).toBeVisible()

  const bounds = await periodDialog.boundingBox()
  expect(bounds).not.toBeNull()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.y).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width)
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height)

  for (const control of [
    periodDialog.getByRole('button', { name: 'Tarih filtresini kapat' }),
    periodDialog.getByRole('button', { name: 'Temmuz' }),
    periodDialog.getByRole('button', { name: 'Uygula' }),
  ]) {
    await control.scrollIntoViewIfNeeded()
    await expect(control).toBeVisible()
    const hit = await control.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
      return Boolean(target && (target === element || element.contains(target)))
    })
    expect(hit).toBe(true)
  }

  await periodDialog.getByRole('button', { name: 'Tarih filtresini kapat' }).click()
  await expect(periodDialog).toHaveCount(0)
}

test('annual visit history shows only completed region visits and supports year month and store filters', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installStoreContractSession(page, 'regionManager')
  await routeChecklistCommand(page, [], [], undefined, 0, {
    annualPlanItems: [
      { storeId: '22222222-2222-4222-8222-222222222222', plannedDate: '2026-08-26', displayOrder: 0, status: 'completed', checklistInstanceId: null, visitCompletedAt: '2026-08-26T09:00:00.000Z' },
      { storeId: '11111111-1111-4111-8111-111111111111', plannedDate: '2026-08-24', displayOrder: 1, status: 'completed', checklistInstanceId: null, visitCompletedAt: '2026-08-24T09:00:00.000Z' },
      { storeId: '11111111-1111-4111-8111-111111111111', plannedDate: '2026-08-25', displayOrder: 2, status: 'completed', checklistInstanceId: null, visitCompletedAt: '2026-08-25T09:00:00.000Z' },
      { storeId: '11111111-1111-4111-8111-111111111111', plannedDate: '2026-08-27', displayOrder: 3, status: 'completed', checklistInstanceId: null, visitCompletedAt: '2026-08-27T09:00:00.000Z' },
    ],
  })

  await page.goto('/store/checklists')
  await page.getByRole('button', { name: /Yıllık Ziyaretler/ }).click()
  let history = page.getByRole('dialog', { name: '2026 Ziyaret Takvimi' })
  await expect(history).toBeVisible()
  await expect(history.locator('[data-calendar-date]')).toHaveCount(0)
  await expect(history.getByText('Planlandı', { exact: true })).toHaveCount(0)
  await expect(history.getByText('Yapılmadı', { exact: true })).toHaveCount(0)
  const annualSummary = history.getByRole('region', { name: 'Yıllık ziyaret özeti' })
  await expect(annualSummary.locator('dd')).toHaveText(['5', '2', '1'])
  await expect(history.getByRole('button', { name: 'Temmuz, 1 ziyaret' })).toBeVisible()
  await expect(history.getByRole('button', { name: 'Ağustos, 4 ziyaret' })).toBeVisible()
  const visitLog = history.getByRole('complementary', { name: 'Ziyaret akışı' })
  await expect(visitLog.getByRole('listitem')).toHaveCount(5)
  await page.screenshot({
    path: checklistEvidenceOutputPath(testInfo, 'checklist-command-cutover-v2/p7/annual-visit-history-desktop.png'),
    fullPage: true,
  })
  const storeSearch = history.getByRole('textbox', { name: 'Ziyaretlerde mağaza ara' })
  await storeSearch.fill('Mall')
  await expect(visitLog.getByRole('listitem')).toHaveCount(2)
  await expect(visitLog.getByRole('listitem')).toContainText(['Mall of İstanbul26 Ağustos 2026', 'Mall of İstanbul14 Temmuz 2026'])
  await storeSearch.fill('')
  await history.getByRole('button', { name: 'Ağustos, 4 ziyaret' }).click()
  await expect(visitLog.getByRole('listitem')).toHaveCount(4)
  await expect(visitLog.locator('header')).toContainText('Ağustos 2026')
  await expect(visitLog.locator('header')).toContainText('4')
  await history.getByRole('button', { name: 'Önceki yıl' }).click()
  history = page.getByRole('dialog', { name: '2025 Ziyaret Takvimi' })
  await expect(history.getByText('Bu dönemde tamamlanmış ziyaret bulunmuyor.')).toBeVisible()
  await history.getByRole('button', { name: 'Sonraki yıl' }).click()
  history = page.getByRole('dialog', { name: '2026 Ziyaret Takvimi' })
  await expect(history.getByRole('complementary', { name: 'Ziyaret akışı' }).getByRole('listitem')).toHaveCount(5)
  await page.setViewportSize({ width: 375, height: 812 })
  const mobileOverflow = await history.evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }))
  expect(mobileOverflow.scrollWidth).toBeLessThanOrEqual(mobileOverflow.clientWidth)
  await page.screenshot({
    path: checklistEvidenceOutputPath(testInfo, 'checklist-command-cutover-v2/p7/annual-visit-history-mobile.png'),
    fullPage: true,
  })
  await page.setViewportSize({ width: 844, height: 390 })
  const landscapeOverflow = await history.evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }))
  expect(landscapeOverflow.scrollWidth).toBeLessThanOrEqual(landscapeOverflow.clientWidth)
  await history.getByRole('button', { name: 'Kapat' }).click()
  await expect(history).toHaveCount(0)
})

test('weekly planner reuses the idempotency key when an uncertain save is retried unchanged', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installStoreContractSession(page, 'regionManager')
  const savedBodies: unknown[] = []
  await routeChecklistCommand(page, [], savedBodies, undefined, 0, { saveResponses: ['error', 'success'] })

  await page.goto('/store/checklists')
  await page.getByRole('button', { name: 'Haftayı Planla' }).click()
  const dialog = page.getByRole('dialog', { name: 'Ziyaret planını oluşturun' })
  await dialog.getByRole('button', { name: 'Pazartesi, 13 Tem' }).click()
  await dialog.getByRole('button', { name: /Marmara Park mağazasını/ }).click()
  await dialog.getByRole('button', { name: 'Ziyaret Planını Kaydet' }).click()

  await expect(dialog.getByRole('alert')).toBeVisible()
  await dialog.getByRole('button', { name: 'Ziyaret Planını Kaydet' }).click()
  await expect(dialog).toHaveCount(0)
  await expect.poll(() => savedBodies.length).toBe(2)
  const first = savedBodies[0] as { idempotencyKey: string }
  const second = savedBodies[1] as { idempotencyKey: string }
  expect(first.idempotencyKey).toBeTruthy()
  expect(second.idempotencyKey).toBe(first.idempotencyKey)
})

test('weekly planner preserves the draft across 409 reconciliation and saves against the latest revision', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installStoreContractSession(page, 'regionManager')
  const savedBodies: unknown[] = []
  await routeChecklistCommand(page, [], savedBodies, undefined, 0, {
    planGetRevisions: [3, 4],
    planGetItems: [
      defaultPlanItems(),
      [
        ...defaultPlanItems(),
        { storeId: '77777777-7777-4777-8777-777777777777', plannedDate: '2026-07-17', displayOrder: 3, status: 'waiting' },
      ],
    ],
    saveResponses: ['conflict', 'success'],
  })

  await page.goto('/store/checklists')
  await page.getByRole('button', { name: 'Haftayı Planla' }).click()
  const dialog = page.getByRole('dialog', { name: 'Ziyaret planını oluşturun' })
  await dialog.getByRole('button', { name: 'Pazartesi, 13 Tem' }).click()
  await dialog.getByRole('button', { name: /Marmara Park mağazasını/ }).click()
  await expect(dialog.getByText('5 ziyaret', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Ziyaret Planını Kaydet' }).click()

  await expect(dialog.getByRole('alert')).toContainText('Planın daha yeni bir sürümü var')
  await dialog.getByRole('button', { name: 'Güncel planı al ve taslağı yeniden uygula' }).click()
  await expect(dialog.getByText('6 ziyaret', { exact: true })).toBeVisible()
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Ziyaret Planını Kaydet' }).click()

  await expect(dialog).toHaveCount(0)
  await expect.poll(() => savedBodies.length).toBe(2)
  expect(savedBodies[1]).toMatchObject({
    expectedRevision: 4,
    items: expect.arrayContaining([
      expect.objectContaining({ storeId: '11111111-1111-4111-8111-111111111111', plannedDate: '2026-07-13' }),
      expect.objectContaining({ storeId: '77777777-7777-4777-8777-777777777777', plannedDate: '2026-07-17' }),
    ]),
  })
})

test('weekly planner requires an explicit choice for same-store concurrent changes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installStoreContractSession(page, 'regionManager')
  const savedBodies: unknown[] = []
  await routeChecklistCommand(page, [], savedBodies, undefined, 0, {
    planGetRevisions: [3, 4],
    planGetItems: [
      defaultPlanItems(),
      [
        defaultPlanItems()[0]!,
        { storeId: '11111111-1111-4111-8111-111111111111', plannedDate: '2026-07-17', displayOrder: 1, status: 'waiting' },
        defaultPlanItems()[2]!,
      ],
    ],
    saveResponses: ['conflict', 'success'],
  })

  await page.goto('/store/checklists')
  await page.getByRole('button', { name: 'Haftayı Planla' }).click()
  const dialog = page.getByRole('dialog', { name: 'Ziyaret planını oluşturun' })
  await dialog.getByRole('button', { name: 'Pazartesi, 13 Tem' }).click()
  await dialog.getByRole('button', { name: /Marmara Park mağazasını/ }).click()
  await dialog.getByRole('button', { name: 'Ziyaret Planını Kaydet' }).click()
  await dialog.getByRole('button', { name: 'Güncel planı al ve taslağı yeniden uygula' }).click()

  await expect(dialog.getByRole('alert')).toContainText('Aynı mağazada çakışan değişiklik var')
  await expect(dialog.getByRole('button', { name: 'Ziyaret Planını Kaydet' })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Benim taslağımı koru' }).click()
  await dialog.getByRole('button', { name: 'Ziyaret Planını Kaydet' }).click()

  await expect.poll(() => savedBodies.length).toBe(2)
  expect(savedBodies[1]).toMatchObject({ expectedRevision: 4 })
  expect((savedBodies[1] as { items: Array<{ storeId: string; plannedDate: string }> }).items).not.toContainEqual(
    expect.objectContaining({ storeId: '11111111-1111-4111-8111-111111111111', plannedDate: '2026-07-17' }),
  )
})

test('region manager checklist rows do not expose the VM score column', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installStoreContractSession(page, 'regionManager')
  await routeChecklistCommand(page, [], [], undefined, 0, { completedNullScore: true })

  await page.goto('/store/checklists')
  const desktopRow = page.getByTestId('checklist-command-row').filter({ hasText: 'Marmara Park' })
  await expect(desktopRow.locator('.score-vm')).toHaveCount(0)
  await expect(page.locator('.checklist-command-partial-notice')).toHaveCount(0)

  await page.setViewportSize({ width: 390, height: 844 })
  const mobileCard = page.locator('.checklist-command-mobile-card').filter({ hasText: 'Marmara Park' })
  await expect(mobileCard.locator('.score-vm')).toHaveCount(0)
})

test('annual visit history keeps multiple completed visits without showing planned entries', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installStoreContractSession(page, 'regionManager')
  await routeChecklistCommand(page, [], [], undefined, 0, { multipleCompletedOccurrences: true })

  await page.goto('/store/checklists')
  await expect(page.locator('.canvas-plan-surface')).toHaveCount(0)
  await page.getByRole('button', { name: /Yıllık Ziyaretler/ }).click()
  const history = page.getByRole('dialog', { name: '2026 Ziyaret Takvimi' })
  await history.getByRole('textbox', { name: 'Ziyaretlerde mağaza ara' }).fill('Mall')
  const visits = history.getByRole('complementary', { name: 'Ziyaret akışı' }).getByRole('listitem')
  await expect(visits).toHaveCount(2)
  await expect(visits).toContainText(['Mall of İstanbul14 Temmuz 2026', 'Mall of İstanbul14 Temmuz 2026'])
  await expect(history.getByText('Planlandı', { exact: true })).toHaveCount(0)
})

test('weekly planner keeps 200 scoped candidates bounded to server pages', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await installStoreContractSession(page, 'regionManager')
  await routeChecklistCommand(page, [], [], undefined, 0, { candidateTotal: 200 })

  await page.goto('/store/checklists')
  await page.getByRole('button', { name: 'Haftayı Planla' }).click()
  const dialog = page.getByRole('dialog', { name: 'Ziyaret planını oluşturun' })
  await expect(dialog.locator('.week-plan-result-row')).toHaveCount(20)
  await expect(dialog.getByText('1 / 10')).toBeVisible()
  for (let pageNumber = 2; pageNumber <= 10; pageNumber += 1) {
    await dialog.getByRole('button', { name: 'Sonraki', exact: true }).click()
    await expect(dialog.getByText(`${pageNumber} / 10`)).toBeVisible()
  }
  await expect(dialog.locator('.week-plan-result-row')).toHaveCount(20)
  await expect(dialog.getByText('Mağaza 200')).toBeVisible()
})

test('weekly planner renders forbidden plan and candidate failures without leaking stale data', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installStoreContractSession(page, 'regionManager')
  await routeChecklistCommand(page, [], [], undefined, 0, { planStatus: 403 })

  await page.goto('/store/checklists')
  await expect(page.getByText('Ziyaret planı yüklenemedi.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tekrar dene' }).first()).toBeVisible()

  await page.unrouteAll({ behavior: 'wait' })
  await installStoreContractSession(page, 'regionManager')
  await routeChecklistCommand(page, [], [], undefined, 0, { candidateStatus: 403 })
  await page.reload()
  await page.getByRole('button', { name: 'Haftayı Planla' }).click()
  const dialog = page.getByRole('dialog', { name: 'Ziyaret planını oluşturun' })
  await expect(dialog.getByText('Mağazalar yüklenemedi')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Tekrar dene' })).toBeVisible()
})

test('dirty weekly drafts require confirmation on Escape and restore focus after discard', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installStoreContractSession(page, 'regionManager')
  await routeChecklistCommand(page, [])

  await page.goto('/store/checklists')
  const planWeek = page.getByRole('button', { name: 'Haftayı Planla' })
  await planWeek.click()
  const dialog = page.getByRole('dialog', { name: 'Ziyaret planını oluşturun' })
  await dialog.getByRole('button', { name: 'Pazartesi, 13 Tem' }).click()
  await dialog.getByRole('button', { name: /Marmara Park mağazasını/ }).click()
  await expect(dialog.getByText('Kaydedilmemiş değişiklik var')).toBeVisible()

  await page.keyboard.press('Escape')
  const confirm = page.getByRole('alertdialog', { name: 'Değişiklikler kaybolsun mu?' })
  await expect(confirm).toBeVisible()
  await expect.poll(() => confirm.evaluate((element) => element.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Tab')
  await expect.poll(() => confirm.evaluate((element) => element.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Shift+Tab')
  await expect.poll(() => confirm.evaluate((element) => element.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(confirm).toHaveCount(0)
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('5 ziyaret')
  await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true)

  await page.keyboard.press('Escape')
  await expect(confirm).toBeVisible()
  await confirm.getByRole('button', { name: 'Planlamaya dön' }).click()
  await expect(confirm).toHaveCount(0)
  await expect(dialog).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(confirm).toBeVisible()
  await confirm.getByRole('button', { name: 'Taslağı sil' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(planWeek).toBeFocused()
})

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
  { width: 320, height: 844 },
] as const) {
  test(`unified checklist page preserves its responsive frame at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    await page.clock.setFixedTime(new Date('2026-07-14T09:00:00+03:00'))
    await installStoreContractSession(page, 'regionManager')
    await routeChecklistCommand(page, [])

    await page.goto('/store/checklists')
    await expect(page.getByRole('region', { name: 'Saha ziyaretlerini günlere yerleştirin' })).toBeVisible()
    await expect(page.locator('.canvas-plan-surface')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Yıllık Ziyaretler/ })).toBeVisible()
    const geometry = await page.locator('.checklist-command-parity').evaluate((root) => {
      const header = root.querySelector<HTMLElement>('[data-testid="region-manager-checklist-header"]')
      const week = root.querySelector<HTMLElement>('.week-planner')
      const surface = root.querySelector<HTMLElement>('[data-testid="checklist-command-surface"]')
      if (!header || !week || !surface) throw new Error('missing checklist workspace landmark')
      const rect = (element: HTMLElement) => {
        const value = element.getBoundingClientRect()
        return { x: value.x, y: value.y, width: value.width, height: value.height }
      }
      return {
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        root: rect(root as HTMLElement),
        header: rect(header),
        week: rect(week),
        surface: rect(surface),
      }
    })
    const expectParityDelta = (actual: number, accepted: number) => {
      expect.soft(Math.abs(actual - accepted)).toBeLessThanOrEqual(2)
    }
    expect(geometry.root.width).toBeLessThanOrEqual(viewport.width)
    expectParityDelta(geometry.week.width, geometry.root.width)
    expectParityDelta(geometry.surface.width, geometry.root.width)
    expect(geometry.week.y).toBeGreaterThanOrEqual(geometry.header.y + geometry.header.height)
    expect(geometry.week.y).toBeLessThan(geometry.surface.y)
    expect(geometry.documentOverflow).toBeLessThanOrEqual(1)

    await page.screenshot({
      path: checklistEvidenceOutputPath(testInfo, `checklist-command-canvas-plan-parity-v1-2026-07-14/production-plan-${viewport.width}x${viewport.height}.png`),
      fullPage: true,
    })
  })
}

for (const viewport of [
  { width: 1024, height: 768, evidence: 'region-manager-command-canvas-tablet-1024.png' },
  { width: 320, height: 720, evidence: 'region-manager-command-canvas-mobile-320.png' },
] as const) {
  test(`region manager command canvas has no horizontal overflow at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    await installStoreContractSession(page, 'regionManager')
    await routeChecklistCommand(page, [])

    await page.goto('/store/checklists')

    await expect(page.getByRole('heading', { name: 'Saha Kontrolleri' })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
    const firstActionBox = await page.getByRole('button', { name: /^(Başlat|Devam et)$/ }).first().boundingBox()
    expect(firstActionBox).not.toBeNull()
    expect((firstActionBox?.x ?? viewport.width) + (firstActionBox?.width ?? 0)).toBeLessThanOrEqual(viewport.width)
    await page.screenshot({
      path: checklistEvidenceOutputPath(testInfo, `checklist-command-canvas-visits-parity-v1-2026-07-14/${viewport.evidence}`),
      fullPage: true,
    })
  })
}

async function routeChecklistCommand(
  page: Page,
  requests: URL[],
  savedBodies: unknown[] = [],
  regionOptions = [{ regionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', regionName: 'Marmara' }],
  commandDelayMs = 0,
  behavior: {
    bmCompletedVmMissing?: boolean
    candidateStatus?: number
    candidateTotal?: number
    commandFilterStatus?: number
    commandRegionDelays?: Record<string, number>
    commandRegionStatuses?: Record<string, number>
    completedNullScore?: boolean
    multipleCompletedOccurrences?: boolean
    singleCompletedOccurrence?: boolean
    planStatus?: number
    periodStatus?: number
    periodFilterStatus?: number
    annualPlanItems?: Array<{ storeId: string; plannedDate: string; displayOrder: number; status?: 'waiting' | 'missed' | 'completed' | 'planned'; checklistInstanceId?: string | null; visitCompletedAt?: string | null }>
    planGetItems?: Array<Array<{ storeId: string; plannedDate: string; displayOrder: number; status?: 'waiting' | 'missed' | 'completed' }>>
    planGetRevisions?: number[]
    saveResponses?: Array<'conflict' | 'error' | 'success'>
  } = {},
) {
  let planGetCount = 0
  let saveCount = 0
  await page.route('**/api/checklists/command-canvas**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    requests.push(url)
    if (request.method() === 'GET' && url.pathname.endsWith('/visit-plans/regions')) {
      await route.fulfill({ json: buildRegionOptionsResponse(regionOptions) })
      return
    }
    if (request.method() === 'GET' && url.pathname.endsWith('/visit-plans/period')) {
      if (behavior.periodStatus) {
        await route.fulfill({ status: behavior.periodStatus, json: { message: 'period unavailable' } })
        return
      }
      if (behavior.periodFilterStatus && url.searchParams.get('risk') === 'high') {
        await route.fulfill({ status: behavior.periodFilterStatus, json: { message: 'period filter unavailable' } })
        return
      }
      const requestedPeriod = url.searchParams.get('period') ?? '2026-07'
      if (requestedPeriod !== '2026-07') {
        const annualItems = behavior.annualPlanItems?.filter((item) => item.plannedDate.startsWith(`${requestedPeriod}-`)) ?? []
        await route.fulfill({ json: buildVisitPlanPeriodResponse(false, requestedPeriod, annualItems) })
        return
      }
      await route.fulfill({
        json: buildVisitPlanPeriodResponse(
          behavior.multipleCompletedOccurrences,
          '2026-07',
          undefined,
          behavior.singleCompletedOccurrence,
        ),
      })
      return
    }
    if (request.method() === 'GET' && url.pathname.endsWith('/visit-plans/candidates')) {
      if (behavior.candidateStatus) {
        await route.fulfill({ status: behavior.candidateStatus, json: { message: 'candidates unavailable' } })
        return
      }
      const stores = buildPlannerStores(behavior.candidateTotal)
      const limit = Number(url.searchParams.get('limit') ?? 20)
      const offset = Number(url.searchParams.get('offset') ?? 0)
      await route.fulfill({ json: buildCandidateResponse(stores.slice(offset, offset + limit), stores.length, limit, offset) })
      return
    }
    if (request.method() === 'PUT' && /\/visit-plans\/[^/]+\/\d{4}-\d{2}-\d{2}$/.test(url.pathname)) {
      const body = request.postDataJSON()
      savedBodies.push(body)
      const response = behavior.saveResponses?.[saveCount] ?? 'success'
      saveCount += 1
      if (response === 'conflict') {
        await route.fulfill({ status: 409, json: { message: 'revision conflict' } })
        return
      }
      if (response === 'error') {
        await route.fulfill({ status: 503, json: { message: 'delivery uncertain' } })
        return
      }
      await route.fulfill({ json: buildVisitPlanResponse(body.items, body.expectedRevision + 1) })
      return
    }
    if (request.method() === 'POST' && /\/visit-plans\/items\/[^/]+\/complete$/.test(url.pathname)) {
      const planItemId = url.pathname.split('/').at(-2)
      await route.fulfill({ json: { data: { planItemId, completedAt: '2026-07-15T10:00:00.000Z' } } })
      return
    }
    if (request.method() === 'GET' && url.pathname.endsWith('/visit-plans')) {
      if (behavior.planStatus) {
        await route.fulfill({ status: behavior.planStatus, json: { message: 'plan unavailable' } })
        return
      }
      const revision = behavior.planGetRevisions?.[Math.min(planGetCount, behavior.planGetRevisions.length - 1)] ?? 3
      planGetCount += 1
      const planItems = behavior.planGetItems?.[Math.min(planGetCount - 1, behavior.planGetItems.length - 1)] ?? defaultPlanItems()
      await route.fulfill({ json: buildVisitPlanResponse(planItems, revision) })
      return
    }
    const requestedRegionId = url.searchParams.get('regionId') ?? ''
    const regionDelay = behavior.commandRegionDelays?.[requestedRegionId] ?? 0
    if (regionDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, regionDelay))
    }
    const regionStatus = behavior.commandRegionStatuses?.[requestedRegionId]
    if (regionStatus) {
      await route.fulfill({ status: regionStatus, json: { message: 'region command unavailable' } })
      return
    }
    if (commandDelayMs > 0 && url.searchParams.get('query') === 'gecikmeli') {
      await new Promise((resolve) => setTimeout(resolve, commandDelayMs))
    }
    if (behavior.commandFilterStatus && url.searchParams.get('query') === 'hata') {
      await route.fulfill({ status: behavior.commandFilterStatus, json: { message: 'command filter unavailable' } })
      return
    }
    if (url.searchParams.get('query') === 'bulunmaz') {
      await route.fulfill({ json: buildCommandResponse([], 0, 30) })
      return
    }
    await route.fulfill({
      json: {
        data: {
          period: '2026-07',
          view: 'region_manager',
          capabilities: {
            weeklyVisitPlanningAvailable: true,
            canMaintainWeeklyVisitPlan: true,
          },
          metrics: {
            totalStores: 2,
            needsVisit: behavior.bmCompletedVmMissing ? 0 : 1,
            active: 0,
            pending: 0,
            completed: behavior.bmCompletedVmMissing ? 2 : 1,
          },
          items: [
            {
              storeId: '11111111-1111-4111-8111-111111111111',
              storeCode: 'ST-001',
              storeName: 'Marmara Park',
              regionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              regionName: 'Marmara',
              regionManagers: [{ displayName: 'Pilot Bölge Müdürü' }],
              bmScore: behavior.bmCompletedVmMissing ? 92 : null,
              vmScore: behavior.bmCompletedVmMissing ? null : behavior.completedNullScore ? null : 92,
              bmCompletedAt: behavior.bmCompletedVmMissing ? '2026-07-10T09:00:00.000Z' : null,
              vmCompletedAt: behavior.bmCompletedVmMissing ? null : behavior.completedNullScore ? '2026-07-10T10:00:00.000Z' : '2026-07-10T09:00:00.000Z',
              lastCompletedVisitAt: '2026-07-10T09:00:00.000Z',
              elapsedDaysSinceLastVisit: 4,
              activeChecklistCount: 0,
              activeBmChecklistCount: 0,
              activeVmChecklistCount: 0,
              pendingAcknowledgementCount: 0,
              pendingBmAcknowledgementCount: 0,
              pendingVmAcknowledgementCount: 0,
              openActionCount: 0,
              blockedActionCount: 0,
              status: behavior.bmCompletedVmMissing ? 'completed' : 'needs_visit',
              reasonCodes: [behavior.bmCompletedVmMissing ? 'missing_vm_visit' : 'missing_bm_visit'],
              lastOperationalAt: '2026-07-10T09:00:00.000Z',
            },
            {
              storeId: '22222222-2222-4222-8222-222222222222',
              storeCode: 'ST-002',
              storeName: 'Mall of İstanbul',
              regionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              regionName: 'Marmara',
              regionManagers: [{ displayName: 'Pilot Bölge Müdürü' }],
              bmScore: 88,
              vmScore: 84,
              bmCompletedAt: '2026-07-11T09:00:00.000Z',
              vmCompletedAt: '2026-07-11T10:00:00.000Z',
              lastCompletedVisitAt: '2026-07-11T10:00:00.000Z',
              elapsedDaysSinceLastVisit: 3,
              activeChecklistCount: 0,
              activeBmChecklistCount: 0,
              activeVmChecklistCount: 0,
              pendingAcknowledgementCount: 0,
              pendingBmAcknowledgementCount: 0,
              pendingVmAcknowledgementCount: 0,
              openActionCount: 0,
              blockedActionCount: 0,
              status: 'completed',
              reasonCodes: ['completed_period'],
              lastOperationalAt: '2026-07-11T10:00:00.000Z',
            },
          ],
          page: { total: 2, limit: 30, offset: 0, hasMore: false },
        },
      },
    })
  })
  await page.route('**/api/mobile/checklists/today', async (route) => {
    await route.fulfill({ json: createChecklistTodayFixture() })
  })
  await page.route('**/api/mobile/checklists/instances', async (route) => {
    await route.fulfill({
      status: 201,
      json: {
        command: { status: 'created', message: 'Checklist başlatıldı' },
        data: {
          checklistInstance: {
            checklist_instance_id: '33333333-3333-4333-8333-333333333333',
            status: 'in_progress',
            created_at: '2026-07-15T09:00:00.000Z',
          },
        },
      },
    })
  })
  await page.route('**/api/checklists/acknowledgements/list**', async (route) => {
    await route.fulfill({ json: { items: [], meta: { count: 0, limit: 50, offset: 0, total: 0 } } })
  })
  await page.route('**/api/workflow/inbox**', async (route) => {
    await route.fulfill({ json: { items: [], meta: { count: 0, limit: 30, offset: 0, total: 0 } } })
  })
}

function createChecklistTodayFixture() {
  return {
    data: {
      activeInstances: [],
      completedThisMonth: [],
      monthlySummaries: [],
      pendingAcknowledgements: [],
      stores: [
        {
          city: 'İstanbul',
          storeId: '11111111-1111-4111-8111-111111111111',
          storeName: 'Marmara Park',
        },
      ],
      templates: [
        {
          checklistTemplateId: 'template-command-bm',
          items: [],
          templateCode: 'BM_STORE_VISIT_2026',
          templateName: 'BM Mağaza Ziyareti',
          templateType: 'BM_STORE_VISIT',
          versionNo: 1,
        },
        {
          checklistTemplateId: 'template-command-vm',
          items: [],
          templateCode: 'VM_STORE_VISIT_2026',
          templateName: 'VM Mağaza Ziyareti',
          templateType: 'VM_STORE_VISIT',
          versionNo: 1,
        },
      ],
    },
  }
}

function buildRegionOptionsResponse(items: Array<{ regionId: string; regionName: string }>) {
  return {
    data: {
      view: 'region_manager',
      capabilities: { canMaintainWeeklyVisitPlan: true },
      items,
      page: { total: items.length, limit: 20, offset: 0, hasMore: false },
    },
  }
}

function buildCandidateResponse(
  stores: ReturnType<typeof buildPlannerStores>,
  total: number,
  limit: number,
  offset: number,
) {
  return {
    data: {
      regionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      regionName: 'Marmara',
      view: 'region_manager',
      capabilities: { canMaintainWeeklyVisitPlan: true },
      items: stores.map((store) => ({
        storeId: store.storeId,
        storeCode: store.storeCode,
        storeName: store.storeName,
        regionId: store.regionId,
        regionName: store.regionName,
      })),
      page: { total, limit, offset, hasMore: offset + stores.length < total },
    },
  }
}

function buildVisitPlanPeriodResponse(
  multipleCompletedOccurrences = false,
  period = '2026-07',
  periodItemsOverride?: Array<{ storeId: string; plannedDate: string; displayOrder: number; status?: 'waiting' | 'missed' | 'completed' | 'planned'; checklistInstanceId?: string | null; visitCompletedAt?: string | null }>,
  singleCompletedOccurrence = false,
) {
  const periodItems = periodItemsOverride ?? (multipleCompletedOccurrences
    ? [
        defaultPlanItems()[0]!,
        defaultPlanItems()[1]!,
        { ...defaultPlanItems()[2]!, status: 'completed' as const },
      ]
    : singleCompletedOccurrence
      ? [defaultPlanItems()[0]!]
      : defaultPlanItems())
  const weekly = buildVisitPlanResponse(periodItems, 3).data
  const byStore = new Map<string, typeof weekly.items>()
  for (const item of weekly.items) byStore.set(item.storeId, [...(byStore.get(item.storeId) ?? []), item])
  const rows = [
    {
      storeId: '11111111-1111-4111-8111-111111111111', storeCode: 'ST-001', storeName: 'Marmara Park',
      bmScore: 92, vmScore: null, risk: 'high', reasonCodes: ['missing_current_month_visit'], planStatus: 'waiting',
      lastCompletedVisitAt: '2026-07-10T09:00:00.000Z', elapsedDaysSinceLastVisit: 4,
    },
    {
      storeId: '22222222-2222-4222-8222-222222222222', storeCode: 'ST-002', storeName: 'Mall of İstanbul',
      bmScore: 88, vmScore: 84, risk: 'medium', reasonCodes: ['watch_checklist_result'], planStatus: multipleCompletedOccurrences || singleCompletedOccurrence ? 'completed' : 'mixed',
      lastCompletedVisitAt: '2026-07-11T10:00:00.000Z', elapsedDaysSinceLastVisit: 3,
    },
    {
      storeId: '33333333-3333-4333-8333-333333333333', storeCode: 'ST-003', storeName: 'Pilot Temiz Mağaza',
      bmScore: 94, vmScore: 91, risk: 'low', reasonCodes: ['strong_score'], planStatus: 'unplanned',
      lastCompletedVisitAt: '2026-07-12T10:00:00.000Z', elapsedDaysSinceLastVisit: 2,
    },
  ].map((row) => ({
    ...row,
    regionId: weekly.regionId,
    regionName: weekly.regionName,
    planItems: (byStore.get(row.storeId) ?? []).map((item) => ({ ...item, planId: weekly.planId, revision: weekly.revision, weekStart: weekly.weekStart })),
  }))
  return {
    data: {
      period, regionId: weekly.regionId, regionName: weekly.regionName, view: 'region_manager',
      capabilities: { canMaintainWeeklyVisitPlan: true },
      metrics: { totalStores: 3, high: 1, medium: 1, low: 1, planned: 2, unplanned: 1, waiting: 1, missed: 1, completed: 1 },
      items: rows,
      page: { total: 3, limit: 30, offset: 0, hasMore: false },
    },
  }
}

function defaultPlanItems() {
  return [
    { storeId: '22222222-2222-4222-8222-222222222222', plannedDate: '2026-07-14', displayOrder: 0, status: 'completed' as const },
    { storeId: '11111111-1111-4111-8111-111111111111', plannedDate: '2026-07-15', displayOrder: 1, status: 'waiting' as const },
    { storeId: '22222222-2222-4222-8222-222222222222', plannedDate: '2026-07-16', displayOrder: 2, status: 'planned' as const },
    { storeId: '22222222-2222-4222-8222-222222222222', plannedDate: '2026-07-13', displayOrder: 3, status: 'missed' as const },
  ]
}

function buildPlannerStores(total = 35) {
  return Array.from({ length: total }, (_value, index) => ({
    storeId: index === 0 ? '11111111-1111-4111-8111-111111111111' : `66666666-6666-4666-8666-${String(index).padStart(12, '0')}`,
    storeCode: `ST-${String(index + 1).padStart(3, '0')}`,
    storeName: index === 0 ? 'Marmara Park' : `Pilot Mağaza ${index + 1}`,
    regionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    regionName: 'Marmara',
    regionManagers: [{ displayName: 'Pilot Bölge Müdürü' }],
    bmScore: index % 3 === 0 ? null : 80 + (index % 15),
    vmScore: index % 4 === 0 ? null : 78 + (index % 17),
    bmCompletedAt: null,
    vmCompletedAt: null,
    lastCompletedVisitAt: null,
    elapsedDaysSinceLastVisit: null,
    activeChecklistCount: 0,
    activeBmChecklistCount: 0,
    activeVmChecklistCount: 0,
    pendingAcknowledgementCount: 0,
    pendingBmAcknowledgementCount: 0,
    pendingVmAcknowledgementCount: 0,
    openActionCount: 0,
    blockedActionCount: 0,
    status: index % 3 === 0 ? 'needs_visit' : 'completed',
    reasonCodes: index % 3 === 0 ? ['missing_bm_visit'] : ['completed_period'],
    lastOperationalAt: null,
  }))
}

function buildCommandResponse(items: ReturnType<typeof buildPlannerStores>, total: number, limit: number) {
  return {
    data: {
      period: '2026-07', view: 'region_manager',
      capabilities: { weeklyVisitPlanningAvailable: true, canMaintainWeeklyVisitPlan: true },
      metrics: { totalStores: total, needsVisit: items.filter((item) => item.status === 'needs_visit').length, active: 0, pending: 0, completed: items.filter((item) => item.status === 'completed').length },
      items,
      page: { total, limit, offset: 0, hasMore: false },
    },
  }
}

function buildVisitPlanResponse(
  items: Array<{ storeId: string; plannedDate: string; displayOrder: number; status?: 'planned' | 'waiting' | 'missed' | 'completed'; checklistInstanceId?: string | null; visitCompletedAt?: string | null }>,
  revision: number,
) {
  return {
    data: {
      planId: '33333333-3333-4333-8333-333333333333',
      regionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      regionName: 'Marmara',
      weekStart: '2026-07-13',
      revision,
      revisedAt: '2026-07-13T08:00:00.000Z',
      view: 'region_manager',
      capabilities: { canMaintainWeeklyVisitPlan: true },
      items: items.map((item, index) => ({
        planItemId: `44444444-4444-4444-8444-${String(index).padStart(12, '0')}`,
        storeId: item.storeId,
        storeCode: item.storeId.startsWith('1111') ? 'ST-001' : 'ST-002',
        storeName: item.storeId.startsWith('1111') ? 'Marmara Park' : 'Mall of İstanbul',
        plannedDate: item.plannedDate,
        displayOrder: item.displayOrder,
        status: item.status ?? 'waiting',
        checklistInstanceId: item.checklistInstanceId !== undefined ? item.checklistInstanceId : item.status === 'completed' ? '55555555-5555-4555-8555-555555555555' : null,
        visitCompletedAt: item.visitCompletedAt !== undefined ? item.visitCompletedAt : item.status === 'completed' ? '2026-07-14T09:00:00.000Z' : null,
        completedAt: item.status === 'completed' ? '2026-07-14T09:00:00.000Z' : null,
      })),
    },
  }
}
