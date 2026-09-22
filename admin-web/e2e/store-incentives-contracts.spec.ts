import { expect, test, type Page } from './test-fixtures'
import { installGenericStoreApiFallbacks, installStoreContractSession } from './store-page-contract-fixtures'
import { createIncentiveWorkspace, incentiveRegionB, incentiveStoreA, incentiveStoreB, incentiveStoreC, routeIncentiveCommands, routeIncentiveManagerDirectory, routeIncentiveWorkspace } from './store-incentives-command-fixtures'

test('region manager list has status only; completion is inside the store drawer', async ({ page }) => {
  const requests: Array<{ path: string; body: unknown }> = []
  await prepare(page, { requests, delayMs: 500 })
  await page.goto('/store/incentives')
  await expect(page.getByRole('heading', { name: 'Primler', exact: true })).toBeVisible()
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Tamamla', exact: true })).toHaveCount(0)
  await expandStore(page, 'Marmara Forum')
  await page.getByRole('button', { name: 'Tamamla', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Kaydediliyor…', exact: true })).toBeDisabled()
  await expect.poll(() => requests).toContainEqual({ path: '/api/store/incentives/store-reviews', body: { period: '2026-06', storeId: incentiveStoreB, reviewStatus: 'reviewed' } })
})

test('persisted rate options produce an exact amount; one store note is required before completion', async ({ page }) => {
  const requests: Array<{ path: string; body: unknown }> = []
  await prepare(page, { requests })
  await page.goto('/store/incentives'); await expandStore(page)
  const drawer = page.getByRole('dialog', { name: 'Mall of İstanbul', exact: true })
  await drawer.getByRole('combobox', { name: 'Derya Uslu: Prim oranı' }).click()
  await page.getByRole('option', { name: '%0,65', exact: true }).click()
  await expect(drawer.getByLabel('Derya Uslu: Final prim tutarı')).toHaveValue('10357,36')
  await expect(drawer.getByRole('button', { name: 'Tamamla', exact: true })).toBeDisabled()
  await drawer.getByLabel('Mağaza değişiklik notu').fill('ab')
  await expect(drawer.getByRole('button', { name: 'Tamamla', exact: true })).toBeDisabled()
  await drawer.getByLabel('Mağaza değişiklik notu').fill('Mağaza dönem desteği doğrulandı')
  await drawer.getByRole('button', { name: 'Tamamla', exact: true }).click()
  await expect.poll(() => requests.length).toBe(2)
  expect(requests).toEqual([
    { path: '/api/store/incentives/corrections', body: { period: '2026-06', storeId: incentiveStoreA, employeeId: '30000000-0000-4000-8000-000000000002', participantType: 'personnel', finalAmount: '10357.36', reasonNote: 'Mağaza dönem desteği doğrulandı' } },
    { path: '/api/store/incentives/store-reviews', body: { period: '2026-06', storeId: incentiveStoreA, reviewStatus: 'reviewed' } },
  ])
})

test('multiple personnel changes share one note and complete only after all writes', async ({ page }) => {
  const requests: Array<{ path: string; body: unknown }> = []
  await prepare(page, { requests })
  await page.goto('/store/incentives'); await expandStore(page)
  await page.getByLabel('Süleyman Öztürk: Final prim tutarı').fill('65000')
  await page.getByLabel('Derya Uslu: Final prim tutarı').fill('25000')
  await expect(page.getByRole('dialog').locator('textarea')).toHaveCount(1)
  await page.getByLabel('Mağaza değişiklik notu').fill('Ortak mağaza notu')
  await page.getByRole('button', { name: 'Tamamla', exact: true }).click()
  await expect.poll(() => requests.length).toBe(3)
  expect(requests.slice(0, 2).map(item => (item.body as { reasonNote: string }).reasonNote)).toEqual(['Ortak mağaza notu', 'Ortak mağaza notu'])
  expect(requests[2]!.path).toBe('/api/store/incentives/store-reviews')
})

test('a failed correction stops remaining writes and never marks the store complete', async ({ page }) => {
  const requests: Array<{ path: string; body: unknown }> = []
  await prepare(page, { requests, commandFailurePaths: ['/api/store/incentives/corrections'] })
  await page.goto('/store/incentives'); await expandStore(page)
  await page.getByLabel('Süleyman Öztürk: Final prim tutarı').fill('65000')
  await page.getByLabel('Derya Uslu: Final prim tutarı').fill('25000')
  await page.getByLabel('Mağaza değişiklik notu').fill('Mağaza düzeltmesi')
  await page.getByRole('button', { name: 'Tamamla', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'İşlem tamamlanamadı' })).toBeVisible()
  expect(requests).toHaveLength(1)
  expect(requests[0]!.path).toBe('/api/store/incentives/corrections')
  await expect(page.getByLabel('Derya Uslu: Final prim tutarı')).toHaveValue('25000')
})

test('saved amounts come from refreshed workspace; a failed completion is retryable without duplicate corrections', async ({ page }) => {
  await prepare(page)
  const fixture = createIncentiveWorkspace('region_manager')
  const requests: string[] = []
  await page.route('**/api/store/incentives/workspace**', route => route.fulfill({ json: fixture }))
  let reviewAttempts = 0
  await page.route('**/api/store/incentives/corrections', route => {
    requests.push('correction')
    const row = fixture.data.regions[0]!.stores[0]!.rows[1]!
    row.finalAmount = '25000.00'; row.status = 'corrected'
    fixture.data.regions[0]!.stores[0]!.review.status = 'pending_review'
    return route.fulfill({ json: { data: {} } })
  })
  await page.route('**/api/store/incentives/store-reviews', route => {
    reviewAttempts++; requests.push('review')
    if (reviewAttempts === 1) return route.fulfill({ status: 500, json: { message: 'Review unavailable' } })
    return route.fulfill({ json: { data: {} } })
  })
  await page.goto('/store/incentives'); await expandStore(page)
  await page.getByLabel('Derya Uslu: Final prim tutarı').fill('25000')
  await page.getByLabel('Mağaza değişiklik notu').fill('Mağaza düzeltmesi')
  await page.getByRole('button', { name: 'Tamamla', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'İşlem tamamlanamadı' })).toBeVisible()
  await page.getByRole('button', { name: 'Tamamla', exact: true }).click()
  await expect.poll(() => requests).toEqual(['correction', 'review', 'review'])
})

test('restoring a draft correction uses the existing void command; failure never completes', async ({ page }) => {
  const requests: Array<{ path: string; body: unknown }> = []
  await prepare(page, { requests, draftCorrection: true, commandFailurePaths: ['/api/store/incentives/corrections/void'] })
  await page.goto('/store/incentives'); await expandStore(page)
  await page.getByLabel('Süleyman Öztürk: Final prim tutarı').fill('61050,78')
  await page.getByLabel('Mağaza değişiklik notu').fill('Hesaplanan tutara dönüş')
  await page.getByRole('button', { name: 'Tamamla', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'İşlem tamamlanamadı' })).toBeVisible()
  expect(requests.map(item => item.path)).toEqual(['/api/store/incentives/corrections/void'])
})

test('unsaved values survive Escape until explicit discard; closing restores focus', async ({ page }) => {
  await prepare(page)
  await page.goto('/store/incentives'); await expandStore(page)
  await page.getByLabel('Derya Uslu: Final prim tutarı').fill('25000')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Kaydedilmemiş değişiklikler var' })).toBeVisible()
  await page.getByRole('button', { name: 'Düzenlemeye dön' }).click()
  await expect(page.getByLabel('Derya Uslu: Final prim tutarı')).toHaveValue('25000')
  await page.getByRole('button', { name: 'Mağaza detayını kapat' }).click()
  await page.getByRole('button', { name: 'Değişiklikleri bırak' }).click()
  await expect(page.getByRole('button', { name: 'Mall of İstanbul', exact: true }).filter({ visible: true })).toBeFocused()
})

test('multiple regions still require explicit package selection before submission', async ({ page }) => {
  const requests: Array<{ path: string; body: unknown }> = []
  await prepare(page, { allReviewed: true, multipleRegions: true, requests })
  await page.goto('/store/incentives')
  await page.getByRole('button', { name: 'Onaya gönder', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: 'Onaya gönder', exact: true })).toBeDisabled()
  await dialog.getByLabel('Gönderilecek bölge').click()
  await page.getByRole('option', { name: 'İstanbul Anadolu' }).click()
  await dialog.getByLabel('Gönderim notu').fill('Bölge paketi kontrol edildi')
  await dialog.getByRole('button', { name: 'Onaya gönder', exact: true }).click()
  await expect.poll(() => requests).toContainEqual({ path: '/api/store/incentives/submissions', body: { period: '2026-06', regionId: incentiveRegionB, submissionNote: 'Bölge paketi kontrol edildi' } })
})

test('mixed closed and projection-only stores keep submission disabled', async ({ page }) => {
  await prepare(page, { allReviewed: true, mixedClosure: true, multipleRegions: true })
  await page.goto('/store/incentives')
  await page.getByRole('button', { name: 'Onaya gönder', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Gönderilecek bölge').click()
  await page.getByRole('option', { name: 'İstanbul Avrupa' }).click()
  await expect(dialog.getByRole('button', { name: 'Onaya gönder', exact: true })).toBeDisabled()
})

test('ungranted viewer reads changes and deduplicated notes without any mutation or approval read', async ({ page }) => {
  await installStoreContractSession(page, 'reportViewer')
  await installGenericStoreApiFallbacks(page)
  const fixture = createIncentiveWorkspace('report_viewer')
  const row = fixture.data.regions[0]!.stores[0]!.rows[0]!
  fixture.data.regions[0]!.stores[0]!.rows[1]!.correction = structuredClone(row.correction)
  await routeIncentiveWorkspace(page, fixture)
  await routeIncentiveManagerDirectory(page, fixture)
  const forbidden: string[] = []
  page.on('request', request => { if (request.url().includes('/api/store/incentives') && (request.method() !== 'GET' || request.url().includes('final-approval'))) forbidden.push(request.url()) })
  await page.goto('/store/incentives'); await expandStore(page)
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByText('Dönem içi mağaza desteği doğrulandı.', { exact: true })).toHaveCount(1)
  await expect(drawer.getByText('Mağaza Müdürü', { exact: true })).toBeVisible()
  await expect(drawer.locator('input, textarea')).toHaveCount(0)
  await expect(drawer.getByRole('button', { name: /Tamamla|Kabul et|Reddet/ })).toHaveCount(0)
  expect(forbidden).toEqual([])
})

test('store manager never requests the protected workspace', async ({ page }) => {
  let requests = 0
  await installStoreContractSession(page, 'storeManager'); await installGenericStoreApiFallbacks(page)
  page.on('request', request => { if (request.url().includes('/api/store/incentives/workspace')) requests++ })
  await page.goto('/store/incentives')
  await expect(page.getByRole('heading', { name: 'Bu rol için rota kullanılamaz' })).toBeVisible()
  expect(requests).toBe(0)
})

test('projection-only store explains the lock and exposes no inputs or completion', async ({ page }) => {
  await prepare(page, { mixedClosure: true })
  await page.goto('/store/incentives'); await expandStore(page, 'Marmara Forum')
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByText(/Dönem henüz kapanmadı/)).toBeVisible()
  await expect(drawer.locator('input, textarea')).toHaveCount(0)
  await expect(drawer.getByRole('button', { name: 'Tamamla' })).toHaveCount(0)
})

for (const adjustment of [
  { final: '63000.00', total: '₺86.901,60', difference: '+₺1.949,22', color: 'is-increase' },
  { final: '50000.00', total: '₺73.901,60', difference: '-₺11.050,78', color: 'is-decrease' },
]) test(`store total includes adjustment ${adjustment.difference}`, async ({ page }) => {
  await prepare(page)
  const fixture = createIncentiveWorkspace('region_manager')
  fixture.data.regions[0]!.stores[0]!.rows[0]!.finalAmount = adjustment.final
  await routeIncentiveWorkspace(page, fixture); await page.goto('/store/incentives')
  const store = page.locator('.incentive-store-summary-row').filter({ hasText: 'Mall of İstanbul' })
  await expect(store.locator('.incentive-final-amount > strong')).toHaveText(adjustment.total)
  await expect(store.locator(`.incentive-final-amount > .${adjustment.color}`)).toHaveText(adjustment.difference)
})

async function prepare(page: Page, options: { allReviewed?: boolean; multipleRegions?: boolean; mixedClosure?: boolean; requests?: Array<{ path: string; body: unknown }>; delayMs?: number; draftCorrection?: boolean; commandFailurePaths?: string[] } = {}) {
  await installStoreContractSession(page, 'regionManager', { actionStoreIds: options.multipleRegions ? [incentiveStoreA, incentiveStoreB, incentiveStoreC] : [incentiveStoreA, incentiveStoreB] })
  await installGenericStoreApiFallbacks(page)
  await routeIncentiveWorkspace(page, createIncentiveWorkspace('region_manager', options))
  await routeIncentiveCommands(page, options.requests ?? [], options.delayMs, new Set(options.commandFailurePaths ?? []))
}
async function expandStore(page: Page, name = 'Mall of İstanbul') { await page.getByRole('button', { name, exact: true }).filter({ visible: true }).click() }
