import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from './test-fixtures'
import { installStoreContractSession } from './store-page-contract-fixtures'

const checklistCommandEvidenceDir = fileURLToPath(
  new URL('../../docs/evidence/checklist-command-canvas-visits-parity-v1-2026-07-14/', import.meta.url),
)
const checklistPlanEvidenceDir = fileURLToPath(
  new URL('../../docs/evidence/checklist-command-canvas-plan-parity-v1-2026-07-14/', import.meta.url),
)

test('region manager command canvas reads bounded real rows and applies server controls', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installStoreContractSession(page, 'regionManager')
  const requests: URL[] = []
  await routeChecklistCommand(page, requests)

  await page.goto('/store/checklists')

  await expect(page.getByRole('heading', { name: 'Saha Kontrolleri' })).toBeVisible()
  const parityGeometry = await page.locator('.checklist-command-parity').evaluate((root) => {
    const surface = root.querySelector<HTMLElement>('[data-testid="checklist-command-surface"]')
    const metricRail = root.querySelector<HTMLElement>('[data-testid="checklist-command-metrics"]')
    const row = root.querySelector<HTMLElement>('[data-testid="checklist-command-row"]')
    if (!surface || !metricRail || !row) throw new Error('missing parity surface')
    return {
      rootRect: root.getBoundingClientRect().toJSON(),
      metricRect: metricRail.getBoundingClientRect().toJSON(),
      surfaceRect: surface.getBoundingClientRect().toJSON(),
      fontFamily: getComputedStyle(root).fontFamily,
      maxWidth: getComputedStyle(root).maxWidth,
      surfaceRadius: getComputedStyle(surface).borderRadius,
      metricRadius: getComputedStyle(metricRail).borderRadius,
      rowMinHeight: getComputedStyle(row).minHeight,
    }
  })
  expect(parityGeometry).toMatchObject({
    fontFamily: expect.stringContaining('DM Sans'),
    maxWidth: '1065px',
    surfaceRadius: '15px',
    metricRadius: '15px',
    rowMinHeight: '64px',
  })
  expect(parityGeometry.rootRect.width).toBeCloseTo(1065, 0)
  expect(parityGeometry.metricRect.y - parityGeometry.rootRect.y).toBeCloseTo(96, 0)
  await expect(page.getByText('Marmara Park').first()).toBeVisible()
  await expect(page.getByText('92').first()).toBeVisible()
  await expect(page.getByText('Yapılmadı').first()).toBeVisible()
  await expect(page.getByText('4 gün').first()).toBeVisible()

  await page.getByRole('button', { name: /Bu ay eksik/ }).click()
  await expect.poll(() => requests.some((url) => url.searchParams.get('status') === 'needs_visit')).toBe(true)

  await page.getByRole('button', { name: 'Durum', exact: true }).click()
  await expect.poll(() => requests.some((url) => url.searchParams.get('sort') === 'status_asc')).toBe(true)

  await page.getByRole('button', { name: /Kolonlar/ }).click()
  await expect(page.getByRole('menu', { name: /Kolon/ })).toBeVisible()
  await page.getByRole('menuitemradio', { name: /Skorlar/ }).click()
  await expect(page.getByRole('button', { name: /Kolonlar Skorlar/ })).toBeVisible()
  await expect(page.getByText('ZİYARET', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: /Kolonlar/ }).click()
  await page.getByRole('heading', { name: 'Saha Kontrolleri' }).click()
  await expect(page.getByRole('menu', { name: /Kolon/ })).toHaveCount(0)

  await page.getByRole('button', { name: /Temmuz 2026/ }).click()
  await expect(page.getByRole('dialog', { name: /Raporlama dönemi/ })).toBeVisible()
  await page.getByRole('button', { name: 'Ağustos' }).click()
  await page.getByRole('button', { name: /Uygula/ }).click()
  await expect.poll(() => requests.some((url) => url.searchParams.get('period') === '2026-08')).toBe(true)
  await page.getByRole('button', { name: /Ağustos 2026/ }).click()
  await page.getByRole('heading', { name: 'Saha Kontrolleri' }).click()
  await expect(page.getByRole('dialog', { name: /Raporlama dönemi/ })).toHaveCount(0)

  mkdirSync(checklistCommandEvidenceDir, { recursive: true })
  await page.screenshot({
    path: join(checklistCommandEvidenceDir, 'region-manager-command-canvas-desktop.png'),
    fullPage: true,
  })

  await page.getByRole('button', { name: /Checklist/ }).first().click()
  await expect(page).toHaveURL(
    /\/store\/checklists\?view=workflow&storeId=11111111-1111-4111-8111-111111111111/,
  )
})

test('region manager command canvas stays bounded as mobile cards with 30-row pages', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installStoreContractSession(page, 'regionManager')
  await routeChecklistCommand(page, [])

  await page.goto('/store/checklists')

  await expect(page.getByRole('heading', { name: 'Saha Kontrolleri' })).toBeVisible()
  await expect(page.getByRole('article')).toHaveCount(2)
  await expect(page.getByText('1-2 / 2 mağaza')).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)

  mkdirSync(checklistCommandEvidenceDir, { recursive: true })
  await page.screenshot({
    path: join(checklistCommandEvidenceDir, 'region-manager-command-canvas-mobile-390.png'),
    fullPage: true,
  })
})

test('region manager plans a full Monday-Saturday week and saves one real API snapshot', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installStoreContractSession(page, 'regionManager')
  const requests: URL[] = []
  const savedBodies: unknown[] = []
  await routeChecklistCommand(page, requests, savedBodies)

  await page.goto('/store/checklists')
  await page.getByRole('button', { name: /Ziyaret Planı/ }).click()

  await expect(page.getByRole('heading', { name: 'Saha Kontrolleri' })).toBeVisible()
  await expect(page.getByText('Ziyaret Tamamlandı')).toBeVisible()
  await expect(page.getByText('Ziyaret Bekleniyor').first()).toBeVisible()
  await expect(page.getByText('Checklist yapılmadı').first()).toBeVisible()
  await expect(page.getByText('Pazar plan dışı')).toBeVisible()

  await page.getByRole('button', { name: 'Haftayı Planla' }).click()
  const dialog = page.getByRole('dialog', { name: 'Ziyaret planını oluşturun' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Plan kapsamı')).toBeVisible()
  await expect(dialog.getByText('Sorumlu')).toHaveCount(0)

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

test('weekly planner pages 35 scoped stores and keeps the save action reachable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installStoreContractSession(page, 'regionManager')
  await routeChecklistCommand(page, [])

  await page.goto('/store/checklists')
  await page.getByRole('button', { name: /Ziyaret Planı/ }).click()
  await page.getByRole('button', { name: 'Haftayı Planla' }).click()

  const dialog = page.getByRole('dialog', { name: 'Ziyaret planını oluşturun' })
  await expect(dialog.locator('.week-plan-result-row')).toHaveCount(20)
  await expect(dialog.getByText('1 / 2')).toBeVisible()
  await dialog.getByRole('button', { name: 'Sonraki' }).click()
  await expect(dialog.locator('.week-plan-result-row')).toHaveCount(15)
  await expect(dialog.getByRole('button', { name: 'Ziyaret Planını Kaydet' })).toBeVisible()
  const geometry = await dialog.evaluate((element) => ({
    bottom: element.getBoundingClientRect().bottom,
    width: element.getBoundingClientRect().width,
    viewportWidth: document.documentElement.clientWidth,
    pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }))
  expect(geometry.width).toBeCloseTo(390, 0)
  expect(geometry.bottom).toBeCloseTo(844, 0)
  expect(geometry.pageOverflow).toBeLessThanOrEqual(1)
})

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

  await page.locator('.checklist-command-toolbar input').fill('bulunmaz')
  await expect(page.getByText('Bu filtrelerde mağaza yok')).toBeVisible()
  await expect(page.getByRole('button', { name: /Ziyaret Planı/ })).toBeVisible()
  await page.getByRole('button', { name: /Ziyaret Planı/ }).click()
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
  await page.getByRole('button', { name: /Bu ay eksik/ }).click()
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
  await page.getByRole('button', { name: /Bu ay eksik/ }).click()
  await expect(page.getByText('Marmara Park').first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Veriler yenilenemedi.*Tekrar dene/ })).toBeVisible()
  await expect(page.getByText('Marmara Park').first()).toBeVisible()
})

test('failed Plan filters retain the current scoped rows and expose an inline retry', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installStoreContractSession(page, 'regionManager')
  await routeChecklistCommand(page, [], [], undefined, 0, { periodFilterStatus: 400 })

  await page.goto('/store/checklists')
  await page.getByRole('button', { name: /Ziyaret Planı/ }).click()
  await expect(page.locator('.canvas-plan-row').filter({ hasText: 'Marmara Park' })).toBeVisible()
  await page.locator('.decision-rail--plan').getByRole('button', { name: /Yüksek risk/ }).click()
  await expect(page.locator('.canvas-plan-row').filter({ hasText: 'Marmara Park' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'period filter unavailable' })).toBeVisible()
  await expect(page.locator('.canvas-plan-row').filter({ hasText: 'Marmara Park' })).toBeVisible()
})

test('command and plan popovers close on Escape and restore focus to their trigger', async ({ page }) => {
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

  const statusTrigger = page.locator('.checklist-command-toolbar').getByRole('button', { name: /^Durum/ })
  await statusTrigger.click()
  await expect(page.getByRole('menu', { name: 'Durum filtresi' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu', { name: 'Durum filtresi' })).toHaveCount(0)
  await expect(statusTrigger).toBeFocused()

  await page.getByRole('button', { name: /Ziyaret Planı/ }).click()
  const priorityTrigger = page.locator('.canvas-plan-command').getByRole('button', { name: /^Öncelik/ })
  await priorityTrigger.click()
  await expect(page.locator('.canvas-plan-command').getByRole('menu')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.canvas-plan-command').getByRole('menu')).toHaveCount(0)
  await expect(priorityTrigger).toBeFocused()
})

test('weekly planner reuses the idempotency key when an uncertain save is retried unchanged', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installStoreContractSession(page, 'regionManager')
  const savedBodies: unknown[] = []
  await routeChecklistCommand(page, [], savedBodies, undefined, 0, { saveResponses: ['error', 'success'] })

  await page.goto('/store/checklists')
  await page.getByRole('button', { name: /Ziyaret Planı/ }).click()
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
  await page.getByRole('button', { name: /Ziyaret Planı/ }).click()
  await page.getByRole('button', { name: 'Haftayı Planla' }).click()
  const dialog = page.getByRole('dialog', { name: 'Ziyaret planını oluşturun' })
  await dialog.getByRole('button', { name: 'Pazartesi, 13 Tem' }).click()
  await dialog.getByRole('button', { name: /Marmara Park mağazasını/ }).click()
  await expect(dialog.getByText('4 ziyaret', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Ziyaret Planını Kaydet' }).click()

  await expect(dialog.getByRole('alert')).toContainText('Planın daha yeni bir sürümü var')
  await dialog.getByRole('button', { name: 'Güncel planı al ve taslağı yeniden uygula' }).click()
  await expect(dialog.getByText('5 ziyaret', { exact: true })).toBeVisible()
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
  await page.getByRole('button', { name: /Ziyaret Planı/ }).click()
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

test('completed checklist evidence with no score is not labelled as not done', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installStoreContractSession(page, 'regionManager')
  await routeChecklistCommand(page, [], [], undefined, 0, { completedNullScore: true })

  await page.goto('/store/checklists')
  const desktopRow = page.getByTestId('checklist-command-row').filter({ hasText: 'Marmara Park' })
  await expect(desktopRow.locator('.score-vm')).toHaveText('Skor yok')
  await expect(desktopRow.locator('.score-vm')).not.toHaveText('Yapılmadı')
  await expect(page.locator('.checklist-command-partial-notice')).toHaveText('Bazı tamamlanmış checklist skorları henüz sağlanmadı.')
  await expect(page.locator('.checklist-command-partial-notice')).toHaveAttribute('role', 'status')

  await page.setViewportSize({ width: 390, height: 844 })
  const mobileCard = page.locator('.checklist-command-mobile-card').filter({ hasText: 'Marmara Park' })
  await expect(mobileCard.locator('.score-vm')).toHaveText('Skor yok')
  await expect(page.locator('.checklist-command-partial-notice')).toBeVisible()
})

test('multiple completed visits open an occurrence chooser instead of an arbitrary result', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installStoreContractSession(page, 'regionManager')
  await routeChecklistCommand(page, [], [], undefined, 0, { multipleCompletedOccurrences: true })

  await page.goto('/store/checklists')
  await page.getByRole('button', { name: /Ziyaret Planı/ }).click()
  const row = page.locator('.canvas-plan-row').filter({ hasText: 'Mall of İstanbul' })
  await row.getByRole('button', { name: 'Sonuçları gör' }).click()

  const drawer = page.getByRole('dialog', { name: 'Mall of İstanbul' })
  await expect(drawer).toBeVisible()
  await expect(drawer.getByRole('button', { name: 'Sonucu gör' })).toHaveCount(2)
  await expect(drawer.getByText('14 Tem', { exact: true })).toBeVisible()
  await expect(drawer.getByText('16 Tem', { exact: true })).toBeVisible()
})

test('weekly planner keeps 200 scoped candidates bounded to server pages', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await installStoreContractSession(page, 'regionManager')
  await routeChecklistCommand(page, [], [], undefined, 0, { candidateTotal: 200 })

  await page.goto('/store/checklists')
  await page.getByRole('button', { name: /Ziyaret Planı/ }).click()
  await page.getByRole('button', { name: 'Haftayı Planla' }).click()
  const dialog = page.getByRole('dialog', { name: 'Ziyaret planını oluşturun' })
  await expect(dialog.locator('.week-plan-result-row')).toHaveCount(20)
  await expect(dialog.getByText('1 / 10')).toBeVisible()
  for (let pageNumber = 2; pageNumber <= 10; pageNumber += 1) {
    await dialog.getByRole('button', { name: 'Sonraki' }).click()
    await expect(dialog.getByText(`${pageNumber} / 10`)).toBeVisible()
  }
  await expect(dialog.locator('.week-plan-result-row')).toHaveCount(20)
  await expect(dialog.getByText('Mağaza 200')).toBeVisible()
})

test('weekly planner renders forbidden plan and candidate failures without leaking stale data', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installStoreContractSession(page, 'regionManager')
  await routeChecklistCommand(page, [], [], undefined, 0, { periodStatus: 403 })

  await page.goto('/store/checklists')
  await page.getByRole('button', { name: /Ziyaret Planı/ }).click()
  await expect(page.getByRole('alert')).toContainText('Bu bölgenin ziyaret planına erişiminiz yok')

  await page.unrouteAll({ behavior: 'wait' })
  await installStoreContractSession(page, 'regionManager')
  await routeChecklistCommand(page, [], [], undefined, 0, { candidateStatus: 403 })
  await page.reload()
  await page.getByRole('button', { name: /Ziyaret Planı/ }).click()
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
  await page.getByRole('button', { name: /Ziyaret Planı/ }).click()
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
  await expect(dialog).toContainText('4 ziyaret')
  await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true)

  await page.keyboard.press('Escape')
  await expect(confirm).toBeVisible()
  await confirm.getByRole('button', { name: 'Taslağı sil' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(planWeek).toBeFocused()
})

for (const viewport of [
  { width: 1440, height: 900, contentWidth: 1065, titleY: 42, titleHeight: 66, metricsY: 138, metricHeight: 66, weekY: 218, weekHeight: 232, surfaceY: 464 },
  { width: 1024, height: 768, contentWidth: 878, titleY: 18, titleHeight: 66, metricsY: 114, metricHeight: 66, weekY: 194, weekHeight: 392, surfaceY: 600 },
  { width: 390, height: 844, contentWidth: 362, titleY: 24, titleHeight: 88.5, metricsY: 142.5, metricHeight: 53, weekY: 209.5, weekHeight: 657, surfaceY: 880.5 },
  { width: 320, height: 844, contentWidth: 292, titleY: 24, titleHeight: 88.5, metricsY: 142.5, metricHeight: 53, weekY: 209.5, weekHeight: 657, surfaceY: 880.5 },
] as const) {
  test(`plan view preserves the accepted prototype frame at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.clock.setFixedTime(new Date('2026-07-14T09:00:00+03:00'))
    await installStoreContractSession(page, 'regionManager')
    await routeChecklistCommand(page, [])

    await page.goto('/store/checklists')
    await page.getByRole('button', { name: /Ziyaret Planı/ }).click()
    await expect(page.getByRole('region', { name: 'Saha ziyaretlerini günlere yerleştirin' })).toBeVisible()
    await expect(page.getByText('ZİYARET PLANI', { exact: true }).last()).toBeVisible()
    const geometry = await page.locator('.checklist-command-parity').evaluate((root) => {
      const title = root.querySelector<HTMLElement>('.checklist-command-title')
      const metrics = root.querySelector<HTMLElement>('.decision-rail--plan')
      const week = root.querySelector<HTMLElement>('.week-planner')
      const surface = root.querySelector<HTMLElement>('.canvas-plan-surface')
      if (!title || !metrics || !week || !surface) throw new Error('missing plan parity landmark')
      const rect = (element: HTMLElement) => {
        const value = element.getBoundingClientRect()
        return { x: value.x, y: value.y, width: value.width, height: value.height }
      }
      return {
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        root: rect(root as HTMLElement),
        title: rect(title),
        metrics: rect(metrics),
        week: rect(week),
        surface: rect(surface),
      }
    })
    const expectParityDelta = (actual: number, accepted: number) => {
      expect.soft(Math.abs(actual - accepted)).toBeLessThanOrEqual(1)
    }
    expectParityDelta(geometry.root.width, viewport.contentWidth)
    expectParityDelta(geometry.title.y, viewport.titleY)
    expectParityDelta(geometry.title.height, viewport.titleHeight)
    expectParityDelta(geometry.metrics.width, viewport.contentWidth)
    expectParityDelta(geometry.metrics.y, viewport.metricsY)
    expectParityDelta(geometry.metrics.height, viewport.metricHeight)
    expectParityDelta(geometry.week.width, viewport.contentWidth)
    expectParityDelta(geometry.week.y, viewport.weekY)
    expectParityDelta(geometry.week.height, viewport.weekHeight)
    expectParityDelta(geometry.surface.width, viewport.contentWidth)
    expectParityDelta(geometry.surface.y, viewport.surfaceY)
    expect(geometry.documentOverflow).toBeLessThanOrEqual(1)

    await expect(page).toHaveScreenshot(`checklist-plan-${viewport.width}x${viewport.height}.png`, {
      animations: 'disabled',
      fullPage: true,
      maxDiffPixelRatio: 0.005,
    })

    mkdirSync(checklistPlanEvidenceDir, { recursive: true })
    await page.screenshot({
      path: join(checklistPlanEvidenceDir, `production-plan-${viewport.width}x${viewport.height}.png`),
      fullPage: true,
    })
  })
}

for (const viewport of [
  { width: 1024, height: 768, evidence: 'region-manager-command-canvas-tablet-1024.png' },
  { width: 320, height: 720, evidence: 'region-manager-command-canvas-mobile-320.png' },
] as const) {
  test(`region manager command canvas has no horizontal overflow at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await installStoreContractSession(page, 'regionManager')
    await routeChecklistCommand(page, [])

    await page.goto('/store/checklists')

    await expect(page.getByRole('heading', { name: 'Saha Kontrolleri' })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
    const firstActionBox = await page.getByRole('button', { name: /Checklist yap/ }).first().boundingBox()
    expect(firstActionBox).not.toBeNull()
    expect((firstActionBox?.x ?? viewport.width) + (firstActionBox?.width ?? 0)).toBeLessThanOrEqual(viewport.width)
    mkdirSync(checklistCommandEvidenceDir, { recursive: true })
    await page.screenshot({
      path: join(checklistCommandEvidenceDir, viewport.evidence),
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
    candidateStatus?: number
    candidateTotal?: number
    commandFilterStatus?: number
    commandRegionDelays?: Record<string, number>
    commandRegionStatuses?: Record<string, number>
    completedNullScore?: boolean
    multipleCompletedOccurrences?: boolean
    periodStatus?: number
    periodFilterStatus?: number
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
      await route.fulfill({ json: buildVisitPlanPeriodResponse(behavior.multipleCompletedOccurrences) })
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
    if (request.method() === 'GET' && url.pathname.endsWith('/visit-plans')) {
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
    if (commandDelayMs > 0 && url.searchParams.has('status')) {
      await new Promise((resolve) => setTimeout(resolve, commandDelayMs))
    }
    if (behavior.commandFilterStatus && url.searchParams.get('status') === 'needs_visit') {
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
            needsVisit: 1,
            active: 0,
            pending: 0,
            completed: 1,
          },
          items: [
            {
              storeId: '11111111-1111-4111-8111-111111111111',
              storeCode: 'ST-001',
              storeName: 'Marmara Park',
              regionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              regionName: 'Marmara',
              regionManagers: [{ displayName: 'Pilot Bölge Müdürü' }],
              bmScore: 92,
              vmScore: null,
              bmCompletedAt: '2026-07-10T09:00:00.000Z',
              vmCompletedAt: behavior.completedNullScore ? '2026-07-10T10:00:00.000Z' : null,
              lastCompletedVisitAt: '2026-07-10T09:00:00.000Z',
              elapsedDaysSinceLastVisit: 4,
              activeChecklistCount: 0,
              pendingAcknowledgementCount: 0,
              openActionCount: 0,
              blockedActionCount: 0,
              status: 'needs_visit',
              reasonCodes: ['missing_vm_visit'],
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
              pendingAcknowledgementCount: 0,
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

function buildVisitPlanPeriodResponse(multipleCompletedOccurrences = false) {
  const periodItems = multipleCompletedOccurrences
    ? [
        defaultPlanItems()[0]!,
        defaultPlanItems()[1]!,
        { ...defaultPlanItems()[2]!, status: 'completed' as const },
      ]
    : defaultPlanItems()
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
      bmScore: 88, vmScore: 84, risk: 'medium', reasonCodes: ['watch_checklist_result'], planStatus: multipleCompletedOccurrences ? 'completed' : 'mixed',
      lastCompletedVisitAt: '2026-07-11T10:00:00.000Z', elapsedDaysSinceLastVisit: 3,
    },
  ].map((row) => ({
    ...row,
    regionId: weekly.regionId,
    regionName: weekly.regionName,
    planItems: (byStore.get(row.storeId) ?? []).map((item) => ({ ...item, planId: weekly.planId, revision: weekly.revision, weekStart: weekly.weekStart })),
  }))
  return {
    data: {
      period: '2026-07', regionId: weekly.regionId, regionName: weekly.regionName, view: 'region_manager',
      capabilities: { canMaintainWeeklyVisitPlan: true },
      metrics: { totalStores: 2, high: 1, medium: 1, low: 0, planned: 2, unplanned: 0, waiting: 1, missed: 1, completed: 1 },
      items: rows,
      page: { total: 2, limit: 30, offset: 0, hasMore: false },
    },
  }
}

function defaultPlanItems() {
  return [
    { storeId: '22222222-2222-4222-8222-222222222222', plannedDate: '2026-07-14', displayOrder: 0, status: 'completed' as const },
    { storeId: '11111111-1111-4111-8111-111111111111', plannedDate: '2026-07-15', displayOrder: 1, status: 'waiting' as const },
    { storeId: '22222222-2222-4222-8222-222222222222', plannedDate: '2026-07-16', displayOrder: 2, status: 'missed' as const },
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
    pendingAcknowledgementCount: 0,
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
  items: Array<{ storeId: string; plannedDate: string; displayOrder: number; status?: 'waiting' | 'missed' | 'completed' }>,
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
        checklistInstanceId: item.status === 'completed' ? '55555555-5555-4555-8555-555555555555' : null,
        completedAt: item.status === 'completed' ? '2026-07-14T09:00:00.000Z' : null,
      })),
    },
  }
}
