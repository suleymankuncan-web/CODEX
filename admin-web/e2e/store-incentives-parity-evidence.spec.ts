import { expect, test, type Locator, type Page } from './test-fixtures'
import { installGenericStoreApiFallbacks, installStoreContractSession } from './store-page-contract-fixtures'
import { createIncentiveWorkspace, incentiveStoreA, incentiveStoreB, routeIncentiveCommands, routeIncentiveManagerDirectory, routeIncentiveWorkspace } from './store-incentives-command-fixtures'

// Both roles share the store ledger and personnel drawer; Report Viewer groups stores by package.
for (const view of ['region_manager', 'report_viewer'] as const) {
  for (const width of [1440, 1024, 915, 390, 320]) {
    test(`${view} list and drawer remain readable at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      await prepare(page, view)
      await page.goto('/store/incentives')
      await expect(page.getByRole('heading', { name: 'Primler', exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Prim dönemi', exact: true })).toHaveCount(1)
      await expect(page.getByRole('button', { name: 'Satışların son günü' })).toHaveCount(0)
      await expect(page.locator('.incentive-performance-metrics > button, .operations-metrics > button')).toHaveCount(4)
      if (view === 'region_manager') await expect(page.getByRole('button', { name: 'Onaya gönder', exact: true })).toHaveClass(/incentive-primary-action/)
      if (view === 'report_viewer') {
        await expect(page.getByRole('complementary', { name: 'Bölge müdürleri' })).toHaveCount(0)
        await page.locator('.incentive-region-package-toggle').first().click()
        await expect(page.getByRole('columnheader', { name: /Bölge Müdürü/ })).toHaveCount(0)
        await expect(page.locator('.incentive-store-manager-name, .incentive-region-manager-cell')).toHaveCount(0)
      } else {
        await expect(page.getByRole('complementary', { name: 'Bölge müdürleri' })).toHaveCount(0)
        await expect(page.getByRole('heading', { name: 'Yetkili Mağazalar' })).toBeVisible()
      }
      if (await page.locator('.incentive-store-desktop').isVisible()) {
        await expect(page.getByRole('columnheader', { name: 'Hedef', exact: true })).toBeVisible()
        await expect(page.getByRole('columnheader', { name: 'Gerçekleşen', exact: true })).toBeVisible()
        await expect(page.getByRole('columnheader', { name: 'Personel', exact: true })).toHaveCount(0)
        if (view === 'report_viewer') await expectLedgerColumnsAligned(page)
      } else {
        await expect(page.locator('.incentive-store-mobile dt').filter({ hasText: /^Hedef$/ }).first()).toBeVisible()
        await expect(page.locator('.incentive-store-mobile dt').filter({ hasText: /^Gerçekleşen$/ }).first()).toBeVisible()
      }
      await expect(page.locator('.incentive-store-summary, .incentive-region-trigger')).toHaveCount(0)
      await expectFits(page, page.locator('.incentive-performance'))
      await page.screenshot({ path: testInfo.outputPath(`${view}-${width}.png`), fullPage: true })
      const opener = page.locator('button.incentive-store-name, .incentive-store-mobile-row[role="button"]').filter({ hasText: 'Mall of İstanbul', visible: true })
      await opener.click()
      const panel = page.getByRole('region', { name: 'Mall of İstanbul: Personel primleri', exact: true }).filter({ visible: true })
      const storeDrawer = page.getByRole('dialog', { name: 'Mall of İstanbul', exact: true })
      await expect(storeDrawer).toBeVisible()
      await expectFits(page, storeDrawer)
      if (width === 915) expect((await storeDrawer.boundingBox())!.x + (await storeDrawer.boundingBox())!.width).toBeLessThanOrEqual(width - 12)
      await expect(storeDrawer.getByRole('region', { name: 'Dönemin prim oranları' })).toHaveCount(0)
      await expect(panel).toBeVisible()
      await expectFits(page, panel)
      await expect(panel.getByRole('heading', { name: /Personel primleri/ })).toHaveCount(0)
      await expect(panel).not.toContainText('Hesaplanan tutarlar ve bölge müdürünün düzenlemeleri.')
      await expect(panel).not.toContainText('Oran seçin veya tutarı düzenleyin.')
      if (width >= 1024) {
        await expect(panel.getByRole('columnheader', { name: 'Hedef', exact: true })).toBeVisible()
        await expect(panel.getByRole('columnheader', { name: 'Gerçekleşen', exact: true })).toBeVisible()
      } else {
        await expect(panel.locator('[data-label="Hedef"]').first()).toBeVisible()
        await expect(panel.locator('[data-label="Gerçekleşen"]').first()).toBeVisible()
      }
      await expect(panel.getByText('₺8.200.000,00', { exact: true }).first()).toBeVisible()
      await expect(panel.getByText('₺8.721.540,00', { exact: true }).first()).toBeVisible()
      await page.screenshot({ path: testInfo.outputPath(`store-drawer-${view}-${width}.png`) })
      await expect(page.getByRole('button', { name: /: Detay/ })).toHaveCount(0)
      await expect(panel.getByText('Mağaza Müdürü', { exact: true })).toBeVisible()
      await expect(panel.getByText('Satış Danışmanı', { exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Mağaza detayını kapat', exact: true }).click()
      await expect(opener).toBeFocused()
      await expect(panel).toHaveCount(0)
    })
  }
}

for (const view of ['region_manager', 'report_viewer'] as const) {
  for (const width of [1440, 390]) {
    test(`${view} achievement threshold and earned incentive tones at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await prepare(page, view, { prototypeParity: true })
      await page.goto('/store/incentives')
      if (view === 'report_viewer') await page.locator('.incentive-region-package-toggle').nth(1).click()
      const belowThreshold = page.getByLabel('Aqua Florya: Prim ayrıntılarını aç').filter({ visible: true })
      await expect(belowThreshold.locator('.is-below-threshold').first()).toBeVisible()
      await expect(belowThreshold.locator('.is-earned')).toHaveCount(0)
      await belowThreshold.click()
      const drawer = page.getByRole('dialog', { name: 'Aqua Florya', exact: true })
      await expect(drawer.locator('.incentive-detail-totals .is-below-threshold')).toHaveCount(1)
      await expect(drawer.locator('.incentive-detail-totals .is-earned')).toHaveCount(0)
      const manager = drawer.locator('.incentive-edit-row').filter({ hasText: 'Emre Korkmaz' })
      await expect(manager.locator('.is-below-threshold')).toHaveCount(1)
      await expect(manager.locator('.is-earned')).toHaveCount(0)
      await expectFits(page, drawer)
      await drawer.getByRole('button', { name: 'Mağaza detayını kapat' }).click()
      if (view === 'report_viewer') await page.locator('.incentive-region-package-toggle').first().click()
      const earned = page.getByLabel('Mall of İstanbul: Prim ayrıntılarını aç').filter({ visible: true })
      await expect(earned.locator('.is-below-threshold')).toHaveCount(0)
      await expect(earned.locator('.is-earned').first()).toBeVisible()
      if (view === 'region_manager') await expect(page.getByLabel('Marmara Park: Prim ayrıntılarını aç').filter({ visible: true }).locator('.is-below-threshold')).toHaveCount(0)
    })
  }
}

test('shared calendar and metric filtering preserve the store list', async ({ page }) => {
  await prepare(page, 'region_manager')
  await page.goto('/store/incentives')
  await page.getByRole('button', { name: 'Prim dönemi', exact: true }).click()
  await expect(page.locator('[data-slot="popover-content"]')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.locator('.incentive-performance-metrics').getByRole('button', { name: /Düzeltme/ }).click()
  await expect(page.getByLabel('Mall of İstanbul: Prim ayrıntılarını aç').filter({ visible: true })).toBeVisible()
  await expect(page.getByLabel('Marmara Forum: Prim ayrıntılarını aç')).toHaveCount(0)
})

test('monthly view shows cumulative daily sales without changing closed incentive amounts', async ({ page }) => {
  await prepare(page, 'report_viewer')
  const workspaceRequests: string[] = []
  page.on('request', request => { if (request.url().includes('/api/store/incentives/workspace')) workspaceRequests.push(request.url()) })
  const fixture = createIncentiveWorkspace('report_viewer')
  Object.assign(fixture.data, { salesTracking: { throughDate: '2026-06-08', lastLoadedDate: '2026-06-08', status: 'complete' } })
  Object.assign(fixture.data.managerGroups[0]!.stores[0]!, { dailyActualNetSales: '500000.00', dailyAchievementPct: '6.10' })
  Object.assign(fixture.data.managerGroups[0]!.stores[0]!.rows[0]!, { dailyActualNetSales: '500000.00', dailyAchievementPct: '6.10' })
  Object.assign(fixture.data.managerGroups[0]!.stores[0]!.rows[1]!, { dailyActualNetSales: '90000.00', dailyAchievementPct: '6.21' })
  await routeIncentiveWorkspace(page, fixture)
  await page.goto('/store/incentives')
  await expect(page.getByText(/Günlük net satış ve HG%/)).toBeVisible()
  await page.locator('.incentive-region-package-toggle').first().click()
  const row = page.getByLabel('Mall of İstanbul: Prim ayrıntılarını aç').filter({ visible: true })
  await expect(row).toContainText('₺500.000,00')
  await expect(row).toContainText('%6,10')
  await expect(row).toContainText('₺86.901,60')
  await row.click()
  const drawer = page.getByRole('dialog', { name: 'Mall of İstanbul', exact: true })
  await expect(drawer.locator('.incentive-detail-totals dt').filter({ hasText: 'Ay içi net satış' })).toBeVisible()
  await expect(drawer.getByRole('columnheader', { name: 'Ay içi net satış' })).toBeVisible()
  await expect(drawer.getByText('₺500.000,00').first()).toBeVisible()
  const personnel = drawer.getByRole('row').filter({ hasText: 'Derya Uslu' })
  await expect(personnel.locator('[data-label="Ay içi net satış"]')).toHaveText('₺90.000,00')
  await expect(personnel.locator('[data-label="Ay içi HG%"]')).toHaveText('%6,21')
  await expect(personnel.locator('[data-label="Hesaplanan"]')).toHaveText('₺23.901,60')
  await expect(personnel.locator('[data-label="Final prim"]')).toHaveText('₺23.901,60')
  await expect(drawer.getByText('₺86.901,60')).toBeVisible()
  await expect(drawer.getByText(/Ayın günlük satışları ve HG% takip amaçlıdır/)).toHaveCount(0)
  await drawer.getByRole('button', { name: 'Mağaza detayını kapat' }).click()
  await expect(page.getByRole('button', { name: 'Satışların son günü' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Prim dönemi', exact: true })).toHaveCount(1)
  expect(workspaceRequests.length).toBeGreaterThan(0)
  expect(workspaceRequests.every(url => !url.includes('throughDate='))).toBe(true)
})

test('missing personnel daily sales do not fall back to a closed-period amount', async ({ page }) => {
  await prepare(page, 'report_viewer')
  const fixture = createIncentiveWorkspace('report_viewer')
  Object.assign(fixture.data, { salesTracking: { throughDate: '2026-06-08', lastLoadedDate: '2026-06-08', status: 'complete' } })
  Object.assign(fixture.data.managerGroups[0]!.stores[0]!, { dailyActualNetSales: '500000.00', dailyAchievementPct: '6.10' })
  await routeIncentiveWorkspace(page, fixture)
  await page.goto('/store/incentives')
  await page.locator('.incentive-region-package-toggle').first().click()
  await page.getByLabel('Mall of İstanbul: Prim ayrıntılarını aç').filter({ visible: true }).click()

  const personnel = page.getByRole('dialog', { name: 'Mall of İstanbul', exact: true }).getByRole('row').filter({ hasText: 'Derya Uslu' })
  await expect(personnel.locator('[data-label="Ay içi net satış"]')).toHaveText('—')
  await expect(personnel.locator('[data-label="Ay içi HG%"]')).toHaveText('—')
  await expect(personnel.locator('[data-label="Hesaplanan"]')).toHaveText('₺23.901,60')
})

test('report viewer groups stores by region package without a manager column', async ({ page }) => {
  await prepare(page, 'report_viewer', { multipleRegions: true })
  await page.goto('/store/incentives')
  await expect(page.getByRole('complementary', { name: 'Bölge müdürleri' })).toHaveCount(0)
  await expect(page.getByPlaceholder('Mağaza veya personel ara')).toHaveCount(0)
  await expect(page.locator('.incentive-region-package-toggle')).toHaveCount(2)
  await page.locator('.incentive-region-package-toggle').last().click()
  await expect(page.getByLabel('Akasya AVM: Prim ayrıntılarını aç').filter({ visible: true })).toBeVisible()
  await page.locator('.incentive-region-package-toggle').first().click()
  await expect(page.getByLabel('Mall of İstanbul: Prim ayrıntılarını aç').filter({ visible: true })).toBeVisible()
  await expect(page.locator('.incentive-region-manager-cell, .incentive-store-manager-name')).toHaveCount(0)
})

test('regional manager sees their authorized stores without a redundant directory', async ({ page }) => {
  await prepare(page, 'region_manager')
  await page.goto('/store/incentives')
  await expect(page.getByRole('complementary', { name: 'Bölge müdürleri' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Yetkili Mağazalar' })).toBeVisible()
  await expect(page.getByLabel('Mall of İstanbul: Prim ayrıntılarını aç').filter({ visible: true })).toBeVisible()
  await expect(page.getByLabel('Marmara Forum: Prim ayrıntılarını aç').filter({ visible: true })).toBeVisible()
  await expect(page.locator('.incentive-performance-list')).not.toContainText('Ayşe Kaya')
})

test('store drawer remains open across a mobile resize and restores the selected row', async ({ page }) => {
  await prepare(page, 'report_viewer', { multipleRegions: true })
  await page.goto('/store/incentives')
  await page.locator('.incentive-region-package-toggle').first().click()
  const opener = page.locator('button.incentive-store-name, .incentive-store-mobile-row[role="button"]').filter({ hasText: 'Mall of İstanbul', visible: true })
  await opener.click()
  await page.setViewportSize({ width: 375, height: 667 })
  const drawer = page.getByRole('dialog', { name: 'Mall of İstanbul', exact: true })
  await expect(drawer).toBeVisible()
  await expectFits(page, drawer)
  await page.setViewportSize({ width: 844, height: 390 })
  await expect(drawer).toBeVisible()
  await expectFits(page, drawer)
  await drawer.getByRole('button', { name: 'Mağaza detayını kapat' }).click()
  await expect(opener).toBeFocused()
  await page.locator('.incentive-region-package-toggle').last().click()
  await expect(page.getByLabel('Akasya AVM: Prim ayrıntılarını aç').filter({ visible: true })).toBeVisible()
})

for (const width of [1280, 390, 320]) {
  test(`rate and amount edits keep personnel, notes and completion in place at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await prepare(page, 'region_manager')
    const fixture = createIncentiveWorkspace('region_manager')
    for (const row of fixture.data.managerGroups[0]!.stores[0]!.rows) {
      row.finalAmount = row.calculatedAmount
      row.correction = null
    }
    await routeIncentiveWorkspace(page, fixture)
    await page.goto('/store/incentives')
    await page.getByLabel('Mall of İstanbul: Prim ayrıntılarını aç').filter({ visible: true }).click()
    const drawer = page.getByRole('dialog', { name: 'Mall of İstanbul', exact: true })
    const note = drawer.getByLabel('Mağaza değişiklik notu')
    const amount = drawer.getByLabel('Derya Uslu: Final prim tutarı')
    const summary = drawer.locator('.incentive-detail-totals > div').last()
    const reset = drawer.getByRole('button', { name: 'Vazgeç', exact: true })
    await expect(summary).toContainText('Mağaza toplamı')
    await expect(drawer.locator('.incentive-store-editor-total')).toHaveCount(0)
    await expect(drawer.locator('.incentive-edit-row [data-label="Hesaplanan"] small')).toHaveCount(0)
    await expect(drawer).not.toContainText('Hesaplananla aynı')
    await expect(drawer.getByText('Satış Danışmanı', { exact: true }).first()).toBeVisible()
    await expect(note).toBeAttached()
    await expect(note).toBeDisabled()
    await expect(reset).toBeVisible()
    await expect(reset).toBeDisabled()
    await page.evaluate(() => document.fonts.ready)
    const initial = await editorGeometry(drawer)
    const initialTotal = await summary.innerText()

    await drawer.getByRole('combobox', { name: 'Derya Uslu: Prim oranı' }).click()
    const scrollBeforeSelection = await drawer.locator('.incentive-store-sheet-body').evaluate(element => element.scrollTop)
    await page.getByRole('option', { name: '%0,65', exact: true }).click()
    await expect(amount).toHaveValue('10357,36')
    await expect(note).toBeEnabled()
    await expect.poll(() => editorGeometry(drawer)).toEqual(initial)
    await expect.poll(() => drawer.locator('.incentive-store-sheet-body').evaluate(element => element.scrollTop)).toBe(scrollBeforeSelection)

    await amount.fill('25000')
    await expect.poll(() => summary.innerText()).not.toBe(initialTotal)
    await expect.poll(() => editorGeometry(drawer)).toEqual(initial)
    await note.fill('Mağaza düzeltmesi. '.repeat(35))
    await expect.poll(() => editorGeometry(drawer)).toEqual(initial)
    await expect(drawer.getByRole('button', { name: 'Tamamla', exact: true })).toBeEnabled()
    await page.screenshot({ path: testInfo.outputPath(`store-edit-stable-${width}.png`) })

    await amount.fill('')
    await expect(amount).toHaveAttribute('aria-invalid', 'true')
    await expect(drawer.getByRole('button', { name: 'Tamamla', exact: true })).toBeDisabled()
    await expect.poll(() => editorGeometry(drawer)).toEqual(initial)
    await reset.click()
    await expect(amount).toHaveValue('23901,60')
    await expect(note).toBeDisabled()
    await expect(note).toHaveValue('')
    await expect.poll(() => summary.innerText()).toBe(initialTotal)
    await expect.poll(() => editorGeometry(drawer)).toEqual(initial)
    await expectFits(page, drawer)
  })
}

async function editorGeometry(drawer: Locator) {
  return drawer.evaluate(element => {
    const body = element.querySelector('.incentive-store-sheet-body')!
    const origin = body.getBoundingClientRect()
    // Content coordinates ignore intentional scrolling to reach a field on mobile.
    const content = Array.from(body.querySelectorAll('.incentive-edit-row, .incentive-edit-person, .incentive-edit-row input, .incentive-edit-row [role="combobox"], .incentive-store-note-input, textarea')).map(item => {
      const rect = item.getBoundingClientRect()
      return [rect.x, rect.y - origin.y + body.scrollTop, rect.width, rect.height]
    })
    const fixed = Array.from(element.querySelectorAll('.incentive-store-sheet-footer, .incentive-store-completion button')).map(item => {
      const rect = item.getBoundingClientRect()
      return [rect.x, rect.y, rect.width, rect.height]
    })
    return { content, fixed, scrollHeight: body.scrollHeight }
  })
}

async function prepare(page: Page, view: 'region_manager' | 'report_viewer', options?: Parameters<typeof createIncentiveWorkspace>[1]) {
  await installStoreContractSession(page, view === 'region_manager' ? 'regionManager' : 'reportViewer', view === 'region_manager' ? { actionStoreIds: [incentiveStoreA, incentiveStoreB] } : undefined)
  await installGenericStoreApiFallbacks(page)
  const workspace = createIncentiveWorkspace(view, options)
  await routeIncentiveWorkspace(page, workspace)
  if (view === 'report_viewer') await routeIncentiveManagerDirectory(page, workspace)
  if (view === 'region_manager') await routeIncentiveCommands(page, [])
}

for (const view of ['region_manager', 'report_viewer'] as const) {
  for (const width of [1440, 390]) {
    test(`${view} filters adjusted personnel without changing store totals at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      await prepare(page, view)
      await page.goto('/store/incentives')
      if (view === 'report_viewer') {
        await expect(page.locator('.incentive-region-change-count').first()).toHaveText('1 personelde düzenleme var')
        await page.locator('.incentive-region-package-toggle').first().click()
      }
      await page.getByLabel('Mall of İstanbul: Prim ayrıntılarını aç').filter({ visible: true }).click()
      const drawer = page.getByRole('dialog', { name: 'Mall of İstanbul', exact: true })
      const rows = drawer.locator('.incentive-edit-row')
      const summary = drawer.locator('.incentive-detail-totals > div').last()
      await expect(rows).toHaveCount(2)
      await expect(summary).toContainText('₺86.901,60')
      const filter = drawer.getByRole('switch', { name: 'Sadece değişiklikleri göster' })
      if (view === 'region_manager') {
        await expectSwitchThumbAtEdge(filter, false)
        await filter.check()
        await expectSwitchThumbAtEdge(filter, true)
        await expect(rows).toHaveCount(1)
        await expect(rows.first()).toContainText('Süleyman Öztürk')
        await expect(rows.first()).toContainText('₺61.050,78')
        await expect(summary).toContainText('₺86.901,60')
        await expect(drawer.getByRole('region', { name: 'Mağaza notu', exact: true })).toBeVisible()
        await page.screenshot({ path: testInfo.outputPath(`adjustments-${view}-${width}.png`) })
        await filter.focus()
        await page.keyboard.press('Space')
        await expect(filter).not.toBeChecked()
        await expectSwitchThumbAtEdge(filter, false)
        await expect(rows).toHaveCount(2)
      } else {
        await expect(filter).toHaveCount(0)
        await expect(drawer.getByRole('region', { name: 'Mağaza notu', exact: true })).toBeVisible()
      }
      await drawer.getByRole('button', { name: 'Mağaza detayını kapat' }).click()
      await page.getByLabel('Marmara Forum: Prim ayrıntılarını aç').filter({ visible: true }).click()
      const unchanged = page.getByRole('dialog', { name: 'Marmara Forum', exact: true })
      if (view === 'region_manager') {
        await unchanged.getByRole('switch', { name: 'Sadece değişiklikleri göster' }).check()
        await expect(unchanged.getByText('Bu mağazada gösterilecek tutar değişikliği yok.')).toBeVisible()
        await unchanged.getByRole('button', { name: 'Tüm personeli göster' }).click()
      } else {
        await expect(unchanged.getByRole('switch', { name: 'Sadece değişiklikleri göster' })).toHaveCount(0)
      }
      await expect(unchanged.locator('.incentive-edit-row')).toHaveCount(1)
    })
  }

  test(`${view} monthly picker has only month and year and commits only on apply`, async ({ page }) => {
    await prepare(page, view)
    const requests: string[] = []
    page.on('request', request => { if (request.url().includes('/api/store/incentives/workspace')) requests.push(request.url()) })
    await page.goto('/store/incentives')
    const trigger = page.getByRole('button', { name: 'Prim dönemi', exact: true })
    await trigger.click()
    const picker = page.getByRole('dialog', { name: 'Dönem seç', exact: true })
    await expect(picker.locator('[data-day], .rdp-weekday, [role="grid"]')).toHaveCount(0)
    await expect(picker.getByRole('combobox', { name: 'Ay seç' }).locator('option')).toHaveCount(12)
    const initialRequests = requests.length
    await picker.getByRole('combobox', { name: 'Yıl seç' }).selectOption('2027')
    await picker.getByRole('combobox', { name: 'Ay seç' }).selectOption('1')
    await page.keyboard.press('Escape')
    expect(requests).toHaveLength(initialRequests)
    await expect(trigger).toHaveText('Haziran 2026')
    await trigger.click()
    await expect(picker.getByRole('combobox', { name: 'Yıl seç' })).toHaveValue('2026')
    await expect(picker.getByRole('combobox', { name: 'Ay seç' })).toHaveValue('5')
    await picker.getByRole('combobox', { name: 'Yıl seç' }).selectOption('2027')
    await picker.getByRole('combobox', { name: 'Ay seç' }).selectOption('1')
    await picker.getByRole('button', { name: 'Uygula' }).click()
    await expect.poll(() => requests.some(url => url.includes('period=2027-02'))).toBe(true)
  })
}

async function expectSwitchThumbAtEdge(control: Locator, checked: boolean) {
  await expect.poll(() => control.evaluate((root, isChecked) => {
    const track = root.getBoundingClientRect()
    const thumb = root.querySelector('[data-slot="switch-thumb"]')!.getBoundingClientRect()
    const gap = isChecked ? track.right - thumb.right : thumb.left - track.left
    return gap >= 0 && gap <= 2 && thumb.left >= track.left && thumb.right <= track.right
  }, checked)).toBe(true)
}

test('adjustments filter retains pending resets and invalid drafts', async ({ page }) => {
  await prepare(page, 'region_manager')
  await page.goto('/store/incentives')
  await page.getByLabel('Mall of İstanbul: Prim ayrıntılarını aç').filter({ visible: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Mall of İstanbul', exact: true })
  const filter = drawer.getByRole('switch', { name: 'Sadece değişiklikleri göster' })
  const amount = drawer.getByLabel('Süleyman Öztürk: Final prim tutarı')
  await filter.check()
  await amount.fill('61050,78')
  await expect(amount).toBeVisible()
  await expect(drawer.getByLabel('Mağaza değişiklik notu')).toBeEnabled()
  await amount.fill('')
  await expect(amount).toBeVisible()
  await expect(amount).toHaveAttribute('aria-invalid', 'true')
  await expect(drawer.getByRole('button', { name: 'Tamamla', exact: true })).toBeDisabled()
  await amount.fill('64000')
  await filter.uncheck()
  await filter.check()
  await expect(amount).toHaveValue('64000')
  await drawer.getByRole('button', { name: 'Vazgeç', exact: true }).click()
  await expect(amount).toHaveValue('63000,00')
})

async function expectFits(page: Page, surface: Locator) {
  const box = await surface.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1)
  if (await surface.getAttribute('role') === 'dialog') {
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
}

async function expectLedgerColumnsAligned(page: Page) {
  const aligned = await page.locator('.incentive-store-ledger').evaluate(table => {
    const headers = Array.from(table.querySelectorAll('thead th'))
    const cells = Array.from(table.querySelectorAll('tbody tr:first-child td'))
    return headers.length === 7 && cells.length === 7 && headers.every((header, index) => {
      const head = header.getBoundingClientRect(), cell = cells[index]!.getBoundingClientRect()
      return Math.abs(head.left - cell.left) <= 1 && Math.abs(head.right - cell.right) <= 1
    })
  })
  expect(aligned).toBe(true)
}
