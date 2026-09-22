import { expect, test, type Locator, type Page } from './test-fixtures'
import { installGenericStoreApiFallbacks, installStoreContractSession } from './store-page-contract-fixtures'
import { createIncentiveWorkspace, incentiveStoreA, incentiveStoreB, routeIncentiveCommands, routeIncentiveManagerDirectory, routeIncentiveWorkspace } from './store-incentives-command-fixtures'

// Both roles share the Checklist-style directory, store ledger and personnel drawer.
for (const view of ['region_manager', 'report_viewer'] as const) {
  for (const width of [1440, 1024, 390, 320]) {
    test(`${view} list and drawer remain readable at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      await prepare(page, view)
      await page.goto('/store/incentives')
      await expect(page.getByRole('heading', { name: 'Primler', exact: true })).toBeVisible()
      await expect(page.locator('.incentive-performance-metrics > button')).toHaveCount(4)
      if (view === 'report_viewer') {
        const directory = page.getByRole('complementary', { name: 'Bölge müdürleri' })
        await expect(directory).toBeVisible()
        await expect(directory.getByRole('button', { name: 'Süleyman Öztürk 2 sorumlu mağaza', exact: true })).toBeVisible()
        await expect(directory).not.toContainText('İstanbul Avrupa')
        await expect(directory).not.toContainText('₺')
        await expect(directory.getByRole('button').first()).toContainText('Tüm Mağazalar')
        await expect(directory.getByRole('button').first()).toHaveAttribute('aria-current', 'true')
        if (width >= 1024) {
          const left = await directory.boundingBox()
          const right = await page.locator('.incentive-performance-main').boundingBox()
          expect(left!.x + left!.width).toBeLessThan(right!.x)
        }
      }
      await expect(page.locator('.incentive-store-summary, .incentive-region-trigger')).toHaveCount(0)
      await expectFits(page, page.locator('.incentive-performance'))
      await page.screenshot({ path: testInfo.outputPath(`${view}-${width}.png`), fullPage: true })
      const opener = page.getByRole('button', { name: 'Mall of İstanbul', exact: true }).filter({ visible: true })
      await opener.click()
      const panel = page.getByRole('region', { name: 'Mall of İstanbul: Personel primleri', exact: true }).filter({ visible: true })
      const storeDrawer = page.getByRole('dialog', { name: 'Mall of İstanbul', exact: true })
      await expect(storeDrawer).toBeVisible()
      await expectFits(page, storeDrawer)
      await expect(storeDrawer.getByRole('region', { name: 'Dönemin prim oranları' })).toHaveCount(0)
      await expect(panel).toBeVisible()
      await expectFits(page, panel)
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

test('shared calendar and metric filtering preserve the store list', async ({ page }) => {
  await prepare(page, 'region_manager')
  await page.goto('/store/incentives')
  await page.getByRole('button', { name: 'Prim dönemi', exact: true }).click()
  await expect(page.locator('[data-slot="popover-content"]')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.locator('.incentive-performance-metrics').getByRole('button', { name: /Düzeltme/ }).click()
  await expect(page.getByRole('button', { name: 'Mall of İstanbul' }).filter({ visible: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Marmara Forum' })).toHaveCount(0)
})

test('report viewer directory and search operate together', async ({ page }) => {
  await prepare(page, 'report_viewer', { multipleRegions: true })
  await page.goto('/store/incentives')
  const directory = page.getByRole('complementary', { name: 'Bölge müdürleri' })
  await directory.getByRole('button', { name: /Ayşe Kaya/ }).click()
  await expect(page.getByRole('button', { name: 'Akasya AVM' }).filter({ visible: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mall of İstanbul' })).toHaveCount(0)
  await directory.getByRole('button', { name: /Tüm Mağazalar/ }).click()
  await page.getByPlaceholder('Mağaza veya personel ara').fill('Derya')
  await expect(page.getByRole('button', { name: 'Mall of İstanbul' }).filter({ visible: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Akasya AVM' })).toHaveCount(0)
})

test('regional manager directory only represents the current authorized workspace', async ({ page }) => {
  await prepare(page, 'region_manager')
  await page.goto('/store/incentives')
  const directory = page.getByRole('complementary', { name: 'Bölge müdürleri' })
  await expect(directory.getByRole('button')).toHaveCount(2)
  await expect(directory.getByRole('button').first()).toContainText('Tüm Mağazalar')
  await directory.getByRole('button', { name: 'Onur Kaytan 2 sorumlu mağaza', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Mall of İstanbul', exact: true }).filter({ visible: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Marmara Forum', exact: true }).filter({ visible: true })).toBeVisible()
  await expect(directory).not.toContainText('Ayşe Kaya')
})

test('store drawer remains open across a mobile resize and restores the selected manager list', async ({ page }) => {
  await prepare(page, 'report_viewer', { multipleRegions: true })
  await page.goto('/store/incentives')
  const directory = page.getByRole('complementary', { name: 'Bölge müdürleri' })
  await directory.getByRole('button', { name: /Süleyman Öztürk/ }).click()
  await page.getByRole('button', { name: 'Mall of İstanbul', exact: true }).filter({ visible: true }).click()
  await page.setViewportSize({ width: 375, height: 667 })
  const drawer = page.getByRole('dialog', { name: 'Mall of İstanbul', exact: true })
  await expect(drawer).toBeVisible()
  await expectFits(page, drawer)
  await page.setViewportSize({ width: 844, height: 390 })
  await expect(drawer).toBeVisible()
  await expectFits(page, drawer)
  await drawer.getByRole('button', { name: 'Mağaza detayını kapat' }).click()
  await expect(directory.getByRole('button', { name: /Süleyman Öztürk/ })).toHaveAttribute('aria-current', 'true')
  await expect(page.getByRole('button', { name: 'Akasya AVM', exact: true })).toHaveCount(0)
})

for (const width of [1280, 390, 320]) {
  test(`rate and amount edits keep personnel, notes and completion in place at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await prepare(page, 'region_manager')
    const fixture = createIncentiveWorkspace('region_manager')
    for (const row of fixture.data.regions[0]!.stores[0]!.rows) {
      row.finalAmount = row.calculatedAmount
      row.correction = null
    }
    await routeIncentiveWorkspace(page, fixture)
    await page.goto('/store/incentives')
    await page.getByRole('button', { name: 'Mall of İstanbul', exact: true }).filter({ visible: true }).click()
    const drawer = page.getByRole('dialog', { name: 'Mall of İstanbul', exact: true })
    const note = drawer.getByLabel('Mağaza değişiklik notu')
    const amount = drawer.getByLabel('Derya Uslu: Final prim tutarı')
    const reset = drawer.getByRole('button', { name: 'Vazgeç', exact: true })
    await expect(note).toBeAttached()
    await expect(note).toBeDisabled()
    await expect(reset).toBeVisible()
    await expect(reset).toBeDisabled()
    await page.evaluate(() => document.fonts.ready)
    const initial = await editorGeometry(drawer)

    await drawer.getByRole('combobox', { name: 'Derya Uslu: Prim oranı' }).click()
    const scrollBeforeSelection = await drawer.locator('.incentive-store-sheet-body').evaluate(element => element.scrollTop)
    await page.getByRole('option', { name: '%0,65', exact: true }).click()
    await expect(amount).toHaveValue('10357,36')
    await expect(note).toBeEnabled()
    await expect.poll(() => editorGeometry(drawer)).toEqual(initial)
    await expect.poll(() => drawer.locator('.incentive-store-sheet-body').evaluate(element => element.scrollTop)).toBe(scrollBeforeSelection)

    await amount.fill('25000')
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
    await expect.poll(() => editorGeometry(drawer)).toEqual(initial)
    await expectFits(page, drawer)
  })
}

async function editorGeometry(drawer: Locator) {
  return drawer.evaluate(element => {
    const body = element.querySelector('.incentive-store-sheet-body')!
    const origin = body.getBoundingClientRect()
    // Content coordinates ignore intentional scrolling to reach a field on mobile.
    const content = Array.from(body.querySelectorAll('.incentive-edit-row, .incentive-edit-person, .incentive-edit-row input, .incentive-edit-row [role="combobox"], .incentive-store-editor-total, .incentive-store-note-input, textarea')).map(item => {
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
