import { expect, test, type Page } from './test-fixtures'
import { installGenericStoreApiFallbacks, installStoreContractSession } from './store-page-contract-fixtures'
import {
  createIncentiveWorkspace,
  incentiveRegionA,
  incentiveRegionB,
  incentiveStoreA,
  incentiveStoreB,
  incentiveStoreC,
  routeIncentiveCommands,
  routeIncentiveWorkspace,
} from './store-incentives-command-fixtures'

test('region manager receives the Command Canvas surface without legacy export or prototype bypass', async ({ page }) => {
  await prepare(page, 'region_manager')
  await page.goto('/store/incentives?prototype=command-v2')

  await expect(page.getByRole('heading', { name: 'Bölge Primleri' })).toBeVisible()
  await expect(page.getByText('Mall of İstanbul').first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Excel dışa aktar/i })).toHaveCount(0)
  await expect(page.locator('[data-command-canvas-page]')).toHaveCount(1)
  await expect(page.locator('.prototype-state, .role-switcher')).toHaveCount(0)
})

test('store review is optimistic and sends the exact existing write contract', async ({ page }) => {
  const requests: Array<{ path: string; body: unknown }> = []
  await prepare(page, 'region_manager', { allReviewed: false, requests, delayMs: 500 })
  await page.goto('/store/incentives')

  const review = page.getByRole('checkbox', { name: 'Marmara Forum: Mağaza kontrol onayı', exact: true }).filter({ visible: true })
  await review.click()
  await expect(review).toBeChecked({ timeout: 300 })
  await expect(review).toBeDisabled({ timeout: 300 })
  await expect.poll(() => requests).toContainEqual({
    path: '/api/store/incentives/store-reviews',
    body: { period: '2026-06', storeId: incentiveStoreB, reviewStatus: 'reviewed' },
  })
})

test('rate shortcut uses persisted rate metadata and correction payload stays exact', async ({ page }) => {
  const requests: Array<{ path: string; body: unknown }> = []
  await prepare(page, 'region_manager', { requests })
  await page.goto('/store/incentives')
  await expandStore(page)

  await page.getByRole('button', { name: 'Derya Uslu' }).click()
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByRole('button', { name: 'Kaydet', exact: true })).toBeDisabled()
  await drawer.getByRole('radio', { name: /^%1,50/ }).click()
  await expect(drawer.getByLabel('Final prim tutarı')).toHaveValue('23901,60')
  await drawer.getByRole('radio', { name: /^%0,65/ }).click()
  await expect(drawer.getByLabel('Final prim tutarı')).toHaveValue('10357,36')
  await expect(drawer.getByRole('radio', { checked: true })).toHaveCount(1)
  await drawer.getByRole('radio', { name: /^%1,50/ }).click()
  await drawer.getByLabel('Düzeltme notu').fill('ab')
  await expect(drawer.getByRole('button', { name: 'Kaydet', exact: true })).toBeDisabled()
  await drawer.getByLabel('Düzeltme notu').fill('Dönem desteği doğrulandı')
  await expect(drawer.getByRole('button', { name: 'Kaydet', exact: true })).toBeDisabled()
  await drawer.getByRole('radio', { name: /^%0,65/ }).click()
  await drawer.getByRole('button', { name: 'Kaydet', exact: true }).click()

  await expect.poll(() => requests).toContainEqual({
    path: '/api/store/incentives/corrections',
    body: {
      period: '2026-06',
      storeId: incentiveStoreA,
      employeeId: '30000000-0000-4000-8000-000000000002',
      participantType: 'personnel',
      finalAmount: '10357.36',
      reasonNote: 'Dönem desteği doğrulandı',
    },
  })
})

test('successful correction refetch keeps the saved final amount from authoritative workspace truth', async ({ page }) => {
  const requests: Array<{ path: string; body: unknown }> = []
  const initial = createIncentiveWorkspace('region_manager')
  const refreshed = createIncentiveWorkspace('region_manager')
  const refreshedRow = refreshed.data.regions[0]!.stores[0]!.rows.find(
    (row) => row.displayName === 'Derya Uslu',
  )!
  refreshedRow.finalAmount = '25000.00'
  refreshedRow.signedDifferenceAmount = '1098.40'
  refreshedRow.status = 'corrected'
  let workspaceReads = 0

  await installStoreContractSession(page, 'regionManager', {
    actionStoreIds: [incentiveStoreA, incentiveStoreB],
  })
  await installGenericStoreApiFallbacks(page)
  await page.route('**/api/store/incentives/workspace**', async (route) => {
    workspaceReads += 1
    await route.fulfill({ json: workspaceReads === 1 ? initial : refreshed })
  })
  await routeIncentiveCommands(page, requests)
  await page.goto('/store/incentives')
  await expandStore(page)

  await page.getByRole('button', { name: 'Derya Uslu' }).click()
  const drawer = page.getByRole('dialog')
  await drawer.getByLabel('Final prim tutarı').fill('25000,00')
  await drawer.getByLabel('Düzeltme notu').fill('Dönem desteği doğrulandı')
  await drawer.getByRole('button', { name: 'Kaydet', exact: true }).click()

  await expect.poll(() => requests.map((item) => item.path)).toContain('/api/store/incentives/corrections')
  await expect.poll(() => workspaceReads).toBeGreaterThanOrEqual(2)
  const row = page.locator('.incentive-personnel-entry-row, .incentive-personnel-entry').filter({ hasText: 'Derya Uslu', visible: true })
  const finalAmount = row.locator('.incentive-final-amount > strong')

  // Traceability: INC-FR-002/004, AC-INC-001, EC-015.
  await expect(finalAmount).toHaveText('₺25.000,00')
  await expect(finalAmount).not.toHaveText('₺23.901,60')
})

test('failed correction restores the authoritative row instead of preserving optimistic money', async ({ page }) => {
  const requests: Array<{ path: string; body: unknown }> = []
  await prepare(page, 'region_manager', { requests, commandFailurePaths: ['/api/store/incentives/corrections'] })
  await page.goto('/store/incentives')
  await expandStore(page)

  await page.getByRole('button', { name: 'Derya Uslu' }).click()
  const drawer = page.getByRole('dialog')
  await drawer.getByLabel('Final prim tutarı').fill('25000,00')
  await drawer.getByLabel('Düzeltme notu').fill('Geçersiz düzeltme denemesi')
  await drawer.getByRole('button', { name: 'Kaydet', exact: true }).click()
  await expect.poll(() => requests.map((item) => item.path)).toContain('/api/store/incentives/corrections')
  await drawer.getByRole('button', { name: 'İptal', exact: true }).click()

  const row = page.locator('.incentive-personnel-entry-row, .incentive-personnel-entry').filter({ hasText: 'Derya Uslu', visible: true })
  await expect(row).toContainText('₺23.901,60')
  await expect(row).not.toContainText('₺25.000,00')
})

test('failed correction void leaves the persisted correction truth unchanged', async ({ page }) => {
  const requests: Array<{ path: string; body: unknown }> = []
  await prepare(page, 'region_manager', {
    requests,
    draftCorrection: true,
    commandFailurePaths: ['/api/store/incentives/corrections/void'],
  })
  await page.goto('/store/incentives')
  await expandStore(page)

  await page.getByRole('button', { name: 'Süleyman Öztürk', exact: true }).click()
  const drawer = page.getByRole('dialog')
  await drawer.getByRole('button', { name: 'Eski değere dön', exact: true }).click()
  await expect.poll(() => requests.map((item) => item.path)).toContain('/api/store/incentives/corrections/void')
  await expect(drawer).toBeVisible()
  await expect(drawer.getByText('Dönem içi mağaza desteği doğrulandı.')).toBeVisible()
})

test('multiple actionable regions require an explicit region selection before submission', async ({ page }) => {
  const requests: Array<{ path: string; body: unknown }> = []
  await prepare(page, 'region_manager', { allReviewed: true, multipleRegions: true, requests })
  await page.goto('/store/incentives')

  await page.getByRole('button', { name: 'Onaya gönder', exact: true }).first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: 'Onaya gönder', exact: true })).toBeDisabled()
  await expect(dialog.getByText('Kontrol tamamlanmadı', { exact: true })).toBeVisible()
  await dialog.getByLabel('Gönderilecek bölge').click()
  await page.getByRole('option', { name: 'İstanbul Anadolu' }).click()
  const summary = dialog.locator('.incentive-confirm-grid .incentive-drawer-stat')
  await expect(summary.nth(0)).toContainText('1/1')
  await expect(summary.nth(1)).toContainText('0')
  await expect(summary.nth(2)).toContainText('Gönderime hazır')
  await expect(dialog.locator('.incentive-confirm-total')).toContainText('—')
  await dialog.getByLabel('Gönderim notu').fill('Bölge paketi kontrol edildi')
  await dialog.getByRole('button', { name: 'Onaya gönder', exact: true }).click()

  await expect.poll(() => requests).toContainEqual({
    path: '/api/store/incentives/submissions',
    body: { period: '2026-06', regionId: incentiveRegionB, submissionNote: 'Bölge paketi kontrol edildi' },
  })
})

test('mixed closed and projection-only stores keep the submission disabled', async ({ page }) => {
  const requests: Array<{ path: string; body: unknown }> = []
  await prepare(page, 'region_manager', { allReviewed: true, mixedClosure: true, multipleRegions: true, requests })
  await page.goto('/store/incentives')

  await page.getByRole('button', { name: 'Onaya gönder', exact: true }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Gönderilecek bölge').click()
  await page.getByRole('option', { name: 'İstanbul Avrupa' }).click()

  const summary = dialog.locator('.incentive-confirm-grid .incentive-drawer-stat')
  await expect(summary.nth(0)).toContainText('2/2')
  await expect(summary.nth(2)).toContainText('Kontrol tamamlanmadı')
  await expect(dialog.getByRole('button', { name: 'Onaya gönder', exact: true })).toBeDisabled()
  await expect.poll(() => requests).toEqual([])
})

test('workspace tabs implement the ARIA arrow, Home, and End keyboard contract', async ({ page }) => {
  await prepare(page, 'region_manager')
  await page.goto('/store/incentives')
  const stores = page.getByRole('tab', { name: /Mağaza kontrolü/ })
  const corrections = page.getByRole('tab', { name: /Düzeltme/ })
  const rates = page.getByRole('tab', { name: /Prim oranları/ })
  await stores.focus()
  await stores.press('ArrowRight')
  await expect(corrections).toBeFocused()
  await expect(corrections).toHaveAttribute('aria-selected', 'true')
  await corrections.press('End')
  await expect(rates).toBeFocused()
  await rates.press('Home')
  await expect(stores).toBeFocused()
})

test('report viewer hierarchy and audit drawer are structurally read only and emit zero mutations', async ({ page }) => {
  const mutations: string[] = []
  await installStoreContractSession(page, 'reportViewer')
  await installGenericStoreApiFallbacks(page)
  await routeIncentiveWorkspace(page, createIncentiveWorkspace('report_viewer', { multipleRegions: true }))
  page.on('request', (request) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method()) && request.url().includes('/api/store/incentives')) mutations.push(request.url())
  })

  await page.goto('/store/incentives')
  await expect(page.getByRole('heading', { name: 'LUFIAN Mağaza Primleri' })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Mall of İstanbul: Mağaza kontrol onayı', exact: true }).filter({ visible: true })).toBeDisabled()
  await expandStore(page)
  await expect(page.getByText('Süleyman Öztürk').first()).toBeVisible()
  await page.getByRole('button', { name: 'Süleyman Öztürk', exact: true }).click()
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByText('Dönem içi mağaza desteği doğrulandı.')).toBeVisible()
  await expect(drawer.getByText('Onaylandı', { exact: true }).first()).toBeVisible()
  await expect(drawer.getByText('Bölge Müdürü', { exact: true })).toBeVisible()
  await expect(drawer.getByText('%0,70', { exact: true }).first()).toBeVisible()
  await expect(drawer.getByText('REGION_MANAGER', { exact: true })).toHaveCount(0)
  await expect(drawer.locator('input, textarea')).toHaveCount(0)
  await expect(drawer.getByRole('button', { name: /Kaydet|Onaya gönder|Eski değere dön/ })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await page.getByLabel('Durum').click()
  await page.getByRole('option', { name: 'Kontrol edildi' }).click()
  await expect(mutations).toEqual([])
})

test('mixed Report Viewer and Region Manager session resolves to the read-only server view', async ({ page }) => {
  const mutations: string[] = []
  await installStoreContractSession(page, 'reportViewer', { roleCodes: ['REPORT_VIEWER', 'REGION_MANAGER'] })
  await installGenericStoreApiFallbacks(page)
  await routeIncentiveWorkspace(page, createIncentiveWorkspace('report_viewer'))
  page.on('request', (request) => { if (request.method() !== 'GET' && request.url().includes('/api/store/incentives')) mutations.push(request.url()) })

  await page.goto('/store/incentives')
  await expect(page.getByRole('heading', { name: 'LUFIAN Mağaza Primleri' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Onaya gönder', exact: true })).toHaveCount(0)
  await expect(mutations).toEqual([])
})

test('store manager remains unavailable and never requests the protected workspace', async ({ page }) => {
  let workspaceRequests = 0
  await installStoreContractSession(page, 'storeManager')
  await installGenericStoreApiFallbacks(page)
  page.on('request', (request) => { if (request.url().includes('/api/store/incentives/workspace')) workspaceRequests += 1 })

  await page.goto('/store/incentives')
  await expect(page.getByRole('heading', { name: 'Bu rol için rota kullanılamaz' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Primler' })).toHaveCount(0)
  await expect.poll(() => workspaceRequests).toBe(0)
})

test('projection-only store drawer explains the lock and sends no writes', async ({ page }) => {
  const requests: Array<{ path: string; body: unknown }> = []
  await prepare(page, 'region_manager', { mixedClosure: true, requests })
  await page.goto('/store/incentives')
  await expect(page.getByRole('checkbox', { name: 'Marmara Forum: Mağaza kontrol onayı', exact: true }).filter({ visible: true })).toBeDisabled()
  await expandStore(page, 'Marmara Forum')
  const panel = page.getByRole('region', { name: 'Marmara Forum: Personel primleri', exact: true }).filter({ visible: true })
  await expect(panel.getByText(/Dönem henüz kapanmadı/)).toBeVisible()
  await panel.getByRole('button', { name: 'Can Erdem', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Can Erdem', exact: true })
  await expect(drawer).toContainText('Prim oranları')
  await expect(drawer.locator('input, textarea')).toHaveCount(0)
  await expect(drawer.getByRole('button', { name: /Kaydet|Kontrol et/ })).toHaveCount(0)
  expect(requests).toEqual([])
})

for (const adjustment of [
  { final: '63000.00', total: '₺86.901,60', difference: '+₺1.949,22', color: 'is-increase' },
  { final: '50000.00', total: '₺73.901,60', difference: '-₺11.050,78', color: 'is-decrease' },
]) {
  test(`store Final Prim reflects the personnel adjustment ${adjustment.difference}`, async ({ page }) => {
    await prepare(page, 'region_manager')
    const fixture = createIncentiveWorkspace('region_manager')
    fixture.data.regions[0]!.stores[0]!.rows[0]!.finalAmount = adjustment.final
    await routeIncentiveWorkspace(page, fixture)
    await page.goto('/store/incentives')
    const store = page.locator('.incentive-store-summary-row, .incentive-store-mobile > article').filter({ hasText: 'Mall of İstanbul', visible: true })
    await expect(store.locator('.incentive-final-amount > strong')).toHaveText(adjustment.total)
    await expect(store.locator(`.incentive-final-amount > .${adjustment.color}`)).toHaveText(adjustment.difference)
    await expect(store).toContainText('₺84.952,38')
  })
}

async function prepare(
  page: Page,
  view: 'region_manager',
  options: {
    allReviewed?: boolean
    multipleRegions?: boolean
    mixedClosure?: boolean
    requests?: Array<{ path: string; body: unknown }>
    delayMs?: number
    draftCorrection?: boolean
    commandFailurePaths?: string[]
  } = {},
) {
  const actionStoreIds = options.multipleRegions
    ? [incentiveStoreA, incentiveStoreB, incentiveStoreC]
    : [incentiveStoreA, incentiveStoreB]
  await installStoreContractSession(page, 'regionManager', { actionStoreIds })
  await installGenericStoreApiFallbacks(page)
  await routeIncentiveWorkspace(page, createIncentiveWorkspace(view, options))
  await routeIncentiveCommands(page, options.requests ?? [], options.delayMs, new Set(options.commandFailurePaths ?? []))
}

async function expandStore(page: Page, storeName = 'Mall of İstanbul') {
  await page.getByRole('button', { name: `${storeName}`, exact: true }).filter({ visible: true }).click()
}
