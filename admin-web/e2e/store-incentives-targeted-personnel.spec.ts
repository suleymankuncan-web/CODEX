import { expect, test } from './test-fixtures'
import { installGenericStoreApiFallbacks, installStoreContractSession } from './store-page-contract-fixtures'
import { createIncentiveWorkspace, routeIncentiveWorkspace } from './store-incentives-command-fixtures'

for (const width of [1440, 390]) {
  test(`incentive drawer shows selected-month target holders and an honest departure label at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await installStoreContractSession(page, 'regionManager')
    await installGenericStoreApiFallbacks(page)
    const fixture = createIncentiveWorkspace('region_manager')
    const store = fixture.data.managerGroups[0]!.stores[0]!
    Object.assign(store, {
      trackedSaleAmount: '10010.00', trackedReturnAmount: '-12050.00', trackedNetAmount: '-2040.00',
      outOfRosterReturns: [
        { employeeId: 'former-seller', personnelCode: 'OLD-SELLER', displayName: 'Hedefsiz Satıcı', saleAmount: '10.00', returnAmount: '-50.00', netAmount: '-40.00' },
        { employeeId: null, personnelCode: 'OLD-RETURN', displayName: 'Yalnız İade', saleAmount: '0.00', returnAmount: '-20.00', netAmount: '-20.00' },
      ],
    })
    Object.assign(store.rows[0]!, { currentEmploymentStatus: 'inactive', terminationDate: '2026-01-01', trackedSaleAmount: '5000.00', trackedReturnAmount: '0.00', trackedNetAmount: '5000.00' })
    Object.assign(store.rows[1]!, { currentEmploymentStatus: 'terminated', terminationDate: '2026-09-26', trackedSaleAmount: '0.00', trackedReturnAmount: '0.00', trackedNetAmount: '0.00' })
    store.rows.push({
      ...store.rows[1]!, employeeId: 'former-seller', displayName: 'Hedefsiz Satıcı', target: null,
      currentEmploymentStatus: 'terminated', terminationDate: '2026-09-26', trackedSaleAmount: '10.00',
      trackedReturnAmount: '-50.00', trackedNetAmount: '-40.00', calculatedAmount: '777.00', finalAmount: '777.00',
    })
    await routeIncentiveWorkspace(page, fixture)
    const writes: string[] = []
    page.on('request', request => { if (request.url().includes('/api/store/incentives') && request.method() !== 'GET') writes.push(request.url()) })

    await page.goto('/store/incentives')
    await page.getByLabel('Mall of İstanbul: Prim ayrıntılarını aç').filter({ visible: true }).click()
    const drawer = page.getByRole('dialog', { name: 'Mall of İstanbul', exact: true })
    const personnel = drawer.getByRole('table', { name: 'Personel prim dağılımı' })
    await expect(personnel.getByText('Süleyman Öztürk', { exact: true })).toBeVisible()
    await expect(personnel.getByText('Derya Uslu', { exact: true })).toBeVisible()
    await expect(personnel.getByText('Hedefsiz Satıcı', { exact: true })).toHaveCount(0)
    await expect(personnel.getByText('İşten ayrıldı', { exact: true })).toHaveCount(1)
    await expect(personnel.getByRole('row').filter({ hasText: 'Süleyman Öztürk' })).not.toContainText('İşten ayrıldı')
    await expect(drawer).toContainText('1 hedefsiz kayıt')
    await expect(drawer.locator('.incentive-detail-totals')).toContainText('₺87.678,60')

    await drawer.getByRole('button', { name: 'Mağazalar Arası İade: Detay', exact: true }).click()
    const returns = page.getByRole('dialog', { name: 'Mağazalar Arası İade', exact: true })
    await expect(returns.getByText('Yalnız İade', { exact: true })).toBeVisible()
    await expect(returns.getByText('Hedefsiz Satıcı', { exact: true })).toHaveCount(0)
    await expect(returns.locator('.incentive-return-total')).toContainText('-₺20,00')
    expect(writes).toEqual([])
  })
}

test('unavailable movement detail preserves target-bearing personnel and unknown values', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await installGenericStoreApiFallbacks(page)
  const fixture = createIncentiveWorkspace('region_manager')
  fixture.data.sections.movementTracking.status = 'unavailable'
  await routeIncentiveWorkspace(page, fixture)
  await page.goto('/store/incentives')
  await page.getByLabel('Mall of İstanbul: Prim ayrıntılarını aç').filter({ visible: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Mall of İstanbul', exact: true })
  const row = drawer.getByRole('row').filter({ hasText: 'Derya Uslu' })
  await expect(row).toBeVisible()
  await expect(row.locator('[data-label="Net Satış"]')).toHaveText('—')
  await expect(drawer).toContainText('Hedefi olan personel kayıtları korunuyor')
})

for (const width of [1440, 360]) {
  test(`return detail keeps forty personnel compact with a pinned total at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await installStoreContractSession(page, 'regionManager')
    await installGenericStoreApiFallbacks(page)
    const fixture = createIncentiveWorkspace('region_manager')
    Object.assign(fixture.data.managerGroups[0]!.stores[0]!, {
      outOfRosterReturns: Array.from({ length: 40 }, (_, index) => ({
        employeeId: `return-${index}`,
        personnelCode: `OLD-${index}`,
        displayName: `İade Personeli ${index + 1}`,
        saleAmount: '0.00',
        returnAmount: '-10.00',
        netAmount: '-10.00',
      })),
    })
    await routeIncentiveWorkspace(page, fixture)

    await page.goto('/store/incentives')
    await page.getByLabel('Mall of İstanbul: Prim ayrıntılarını aç').filter({ visible: true }).click()
    const trigger = page.getByRole('button', { name: 'Mağazalar Arası İade: Detay', exact: true })
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: 'Mağazalar Arası İade', exact: true })
    const items = dialog.getByRole('listitem')
    await expect(items).toHaveCount(40)
    await expect(dialog.locator('.incentive-return-total')).toContainText('-₺400,00')
    expect(await items.evaluateAll(elements => Math.max(...elements.map(element => element.getBoundingClientRect().height)))).toBeLessThanOrEqual(width > 520 ? 64 : 88)
    await expect.poll(() => dialog.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(2)
    const totalTop = (await dialog.locator('.incentive-return-total').boundingBox())!.y
    await items.last().scrollIntoViewIfNeeded()
    await expect(items.last()).toBeVisible()
    expect((await dialog.locator('.incentive-return-total').boundingBox())!.y).toBeCloseTo(totalTop, 0)
    await expect(dialog.getByRole('button', { name: 'İade detayını kapat' })).toBeInViewport()
    await dialog.getByRole('button', { name: 'İade detayını kapat' }).click()
    await expect(trigger).toBeFocused()
  })
}
