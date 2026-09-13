import { expect, test } from './test-fixtures'
import { installGenericStoreApiFallbacks, installStoreContractSession } from './store-page-contract-fixtures'
import { routeTargetWorkspace, targetStoreA } from './store-targets-command-fixtures'

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-15T09:00:00+03:00'))
})

test('AC-TGT-001/002: Region Manager sees every assigned store and approves a balanced allocation', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await installGenericStoreApiFallbacks(page)
  const api = await routeTargetWorkspace(page, 'region_manager')
  await page.goto('/store/targets')

  await expect(page.getByRole('heading', { name: 'Hedef Kontrol Masası' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Toplam hedef/ })).toContainText('₺')
  await expect(page.getByRole('button', { name: /Onaylanan/ })).toContainText('1')
  await page.getByRole('button', { name: 'Daha fazla mağaza göster' }).click()
  await expect(page.getByText('Mall of İstanbul').first()).toBeVisible()
  await expect(page.getByText('Edirne Novada').first()).toBeVisible()
  await expect(page.getByText('İstinyePark').first()).toBeVisible()
  await expect(page.getByText('Hedef bekleniyor', { exact: true }).last()).toBeVisible()
  await expect(page.getByText('Aksiyon', { exact: true })).toHaveCount(0)

  await page.getByRole('button', { name: /Mall of İstanbul/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', {name:'Günleri düzenle',exact:true}).click()
  await page.getByLabel('Derya Uslu dağıtım günü').fill('20')
  await page.getByLabel('Can Erdem dağıtım günü').fill('21')
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Dağılımı onayla' })).toBeDisabled()
  await page.getByLabel('Onay notu', {exact:false}).fill('Dağılım kontrol edildi.')
  await page.getByRole('button', { name: 'Dağılımı onayla' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(api.mutations).toEqual(['PATCH'])
  expect(api.approvedPayload).toEqual({
    approvalNote: 'Dağılım kontrol edildi.',
    approvedTotalTargetValue: 8200000,
    approvedAllocations: [
      { employeeId: 'employee-1', assigneeLabel: 'Derya Uslu', targetValue: 4000000, distributionDays:20 },
      { employeeId: 'employee-2', assigneeLabel: 'Can Erdem', targetValue: 4200000, distributionDays:21 },
    ],
  })
})

test('AC-TGT-002: unchanged approval remains direct and sends no adjusted payload', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await installGenericStoreApiFallbacks(page)
  const api = await routeTargetWorkspace(page, 'region_manager')
  await page.goto('/store/targets')
  await page.getByRole('button', { name: /Mall of İstanbul/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Dağılımı onayla' }).click()
  expect(api.approvedPayload).toEqual({})
})

test('AC-TGT-002: unchanged direct approval defers legacy balance validation to the backend', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await installGenericStoreApiFallbacks(page)
  const api = await routeTargetWorkspace(page, 'region_manager', { directUnbalanced: true })
  await page.goto('/store/targets')
  await page.getByRole('button', { name: /Mall of İstanbul/ }).click()
  const approve = page.getByRole('dialog').getByRole('button', { name: 'Dağılımı onayla' })
  await expect(approve).toBeEnabled()
  await approve.click()
  expect(api.approvedPayload).toEqual({})
})

test('AC-002/003: filters and sorts locally without blanking or extra workspace reads', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await installGenericStoreApiFallbacks(page)
  const api = await routeTargetWorkspace(page, 'region_manager')
  await page.goto('/store/targets')
  await page.getByRole('button', { name: 'Daha fazla mağaza göster' }).click()
  const reads = api.reads
  await page.getByRole('button', { name: /Hedef bekleniyor/ }).first().click()
  await expect(page.getByText('Edirne Novada').first()).toBeVisible()
  await expect(page.getByText('Mall of İstanbul')).toHaveCount(0)
  await page.getByRole('button', { name: /^Mağaza:/ }).click()
  expect(api.reads).toBe(reads)
})

test('AC-TGT-003/009: Report Viewer gets company hierarchy and emits no mutation', async ({ page }) => {
  await installStoreContractSession(page, 'reportViewer')
  await installGenericStoreApiFallbacks(page)
  const api = await routeTargetWorkspace(page, 'report_viewer')
  await page.goto('/store/targets')
  await expect(page.getByRole('heading', { name: 'Şirket hedef görünümü' })).toBeVisible()
  await expect(page.locator('.target-command-row')).toHaveCount(3)
  await expect(page.getByText('Süleyman Öztürk').first()).toBeVisible()
  await expect(page.getByText('Deniz Akar').first()).toBeVisible()
  await page.getByRole('button', { name: /Mall of İstanbul/ }).click()
  const drawer = page.getByRole('dialog')
  await expect(drawer.locator('input, textarea, select')).toHaveCount(0)
  await expect(drawer.getByRole('button', { name: 'Dağılımı onayla' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(drawer).toHaveCount(0)
  expect(api.mutations).toEqual([])
})

test('AC-005: 320px Region Manager list and longest drawer stay reachable without page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await installStoreContractSession(page, 'regionManager')
  await installGenericStoreApiFallbacks(page)
  await routeTargetWorkspace(page, 'region_manager')
  await page.goto('/store/targets')
  await page.getByRole('button', { name: /Mall of İstanbul/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  expect(await page.getByRole('dialog').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: /Mall of İstanbul/ })).toBeFocused()
})

test('AC-006: partial personnel failure preserves valid store rows', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await installGenericStoreApiFallbacks(page)
  await routeTargetWorkspace(page, 'region_manager', { partial: true })
  await page.goto('/store/targets')
  await expect(page.getByText('Bazı hedef bilgileri eksik')).toBeVisible()
  await expect(page.getByText('Mall of İstanbul').first()).toBeVisible()
})

test('EC-015: later-page partial failure remains visible after pagination', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await installGenericStoreApiFallbacks(page)
  await routeTargetWorkspace(page, 'region_manager', { partialPage2: true })
  await page.goto('/store/targets')
  await page.getByRole('button', { name: 'Daha fazla mağaza göster' }).click()
  await expect(page.getByText('Bazı hedef bilgileri eksik')).toBeVisible()
  await expect(page.getByText('İstinyePark').first()).toBeVisible()
})

test('EC-005/006: missing target drawer never fabricates a balanced zero package', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await installGenericStoreApiFallbacks(page)
  await routeTargetWorkspace(page, 'region_manager')
  await page.goto('/store/targets')
  await page.getByRole('button', { name: /Edirne Novada/ }).click()
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByText('Hedef bekleniyor', { exact: true }).first()).toBeVisible()
  await expect(drawer.getByText('₺0', { exact: true })).toHaveCount(0)
  await expect(drawer.getByRole('button', { name: 'Dağılımı onayla' })).toHaveCount(0)
})

test('scope capability is authoritative even when a pending row is visible', async ({ page }) => {
  await installStoreContractSession(page, 'reportViewer')
  await installGenericStoreApiFallbacks(page)
  await routeTargetWorkspace(page, 'report_viewer')
  await page.goto('/store/targets')
  await page.getByRole('button', { name: /Mall of İstanbul/ }).click()
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Dağılımı onayla' })).toHaveCount(0)
  await expect(page.getByText(targetStoreA)).toHaveCount(0)
})
