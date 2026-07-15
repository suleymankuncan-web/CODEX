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

  await expect(page.getByRole('heading', { name: 'Prim Kontrol Merkezi' })).toBeVisible()
  await expect(page.getByText('Mall of İstanbul').first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Excel dışa aktar/i })).toHaveCount(0)
  await expect(page.locator('[data-command-canvas-page]')).toHaveCount(1)
  await expect(page.locator('.prototype-state, .role-switcher')).toHaveCount(0)
})

test('store review is optimistic and sends the exact existing write contract', async ({ page }) => {
  const requests: Array<{ path: string; body: unknown }> = []
  await prepare(page, 'region_manager', { allReviewed: false, requests, delayMs: 500 })
  await page.goto('/store/incentives')

  await page.getByText('Marmara Forum').click()
  const review = page.getByRole('button', { name: 'Kontrol et' })
  await review.click()
  await expect(page.getByText('Kontrol edildi').last()).toBeVisible({ timeout: 300 })
  await expect.poll(() => requests).toContainEqual({
    path: '/api/store/incentives/store-reviews',
    body: { period: '2026-06', storeId: incentiveStoreB, reviewStatus: 'reviewed' },
  })
})

test('rate shortcut uses persisted rate metadata and correction payload stays exact', async ({ page }) => {
  const requests: Array<{ path: string; body: unknown }> = []
  await prepare(page, 'region_manager', { requests })
  await page.goto('/store/incentives')

  await page.getByRole('button', { name: 'Derya Uslu: Düzelt' }).click()
  const drawer = page.getByRole('dialog')
  await drawer.getByRole('button', { name: /^%1,50/ }).click()
  await expect(drawer.getByLabel('Final prim tutarı')).toHaveValue('23901,60')
  await drawer.getByLabel('Düzeltme notu').fill('Dönem desteği doğrulandı')
  await drawer.getByRole('button', { name: 'Kaydet', exact: true }).click()

  await expect.poll(() => requests).toContainEqual({
    path: '/api/store/incentives/corrections',
    body: {
      period: '2026-06',
      storeId: incentiveStoreA,
      employeeId: '30000000-0000-4000-8000-000000000002',
      participantType: 'personnel',
      finalAmount: '23901.60',
      reasonNote: 'Dönem desteği doğrulandı',
    },
  })
})

test('failed correction restores the authoritative row instead of preserving optimistic money', async ({ page }) => {
  const requests: Array<{ path: string; body: unknown }> = []
  await prepare(page, 'region_manager', { requests, commandFailurePaths: ['/api/store/incentives/corrections'] })
  await page.goto('/store/incentives')

  await page.getByRole('button', { name: 'Derya Uslu: Düzelt' }).click()
  const drawer = page.getByRole('dialog')
  await drawer.getByLabel('Final prim tutarı').fill('25000,00')
  await drawer.getByLabel('Düzeltme notu').fill('Geçersiz düzeltme denemesi')
  await drawer.getByRole('button', { name: 'Kaydet', exact: true }).click()
  await expect.poll(() => requests.map((item) => item.path)).toContain('/api/store/incentives/corrections')
  await drawer.getByRole('button', { name: 'İptal', exact: true }).click()

  const row = page.locator('.incentive-person-row').filter({ hasText: 'Derya Uslu' })
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

  await page.getByRole('button', { name: 'Süleyman Öztürk: Düzelt' }).click()
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
  await expect(page.getByRole('heading', { name: 'Şirket Prim Görünümü' })).toBeVisible()
  await expect(page.getByText('Süleyman Öztürk').first()).toBeVisible()
  await page.getByRole('button', { name: 'Süleyman Öztürk: Düzeltmeyi görüntüle' }).click()
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByText('Dönem içi mağaza desteği doğrulandı.')).toBeVisible()
  await expect(drawer.getByText('Onaylandı', { exact: true }).first()).toBeVisible()
  await expect(drawer.getByText('Bölge Müdürü', { exact: true })).toBeVisible()
  await expect(drawer.getByText('%0,70', { exact: true })).toBeVisible()
  await expect(drawer.getByText('REGION_MANAGER', { exact: true })).toHaveCount(0)
  await expect(drawer.locator('input, textarea')).toHaveCount(0)
  await expect(drawer.getByRole('button', { name: /Kaydet|Onaya gönder|Eski değere dön/ })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.locator('.command-canvas-metric[data-tone="cyan"]').click()
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
  await expect(page.getByRole('heading', { name: 'Şirket Prim Görünümü' })).toBeVisible()
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

async function prepare(
  page: Page,
  view: 'region_manager',
  options: {
    allReviewed?: boolean
    multipleRegions?: boolean
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
