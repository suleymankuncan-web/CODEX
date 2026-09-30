import { expect, test } from './test-fixtures'
import { installGenericStoreApiFallbacks, installStoreContractSession } from './store-page-contract-fixtures'
import { createIncentiveWorkspace, routeIncentiveWorkspace } from './store-incentives-command-fixtures'

for (const width of [1440, 390]) {
  test(`targetless personnel exclusion requires a reason and binds the source revision at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await installStoreContractSession(page, 'regionManager')
    await installGenericStoreApiFallbacks(page)
    const fixture = createIncentiveWorkspace('region_manager')
    const store = fixture.data.managerGroups[0]!.stores[0]!
    const snapshotId = '70000000-0000-4000-8000-000000000001'
    Object.assign(store.review, { finalSnapshotId: snapshotId, participationRevision: 0 })
    const employeeId = '30000000-0000-4000-8000-000000000099'
    const person = { ...store.rows[1]!, employeeId, displayName: 'Hedefsiz Personel', target: null,
      calculatedAmount: null, finalAmount: null, signedDifferenceAmount: null, correction: null, correctionRecords: [],
      participation: { included: true, reasonNote: null as string | null } }
    store.rows.push(person as typeof store.rows[number])
    await routeIncentiveWorkspace(page, fixture)
    const requests: Record<string, unknown>[] = []
    await page.route('**/api/store/incentives/workspace/participation', async route => {
      const body = route.request().postDataJSON()
      requests.push(body)
      person.participation = { included: body.included, reasonNote: body.included ? null : body.reasonNote }
      person.finalAmount = body.included ? null : '0.00' as never
      Object.assign(store.review, { participationRevision: Number(body.expectedRevision) + 1, status: 'pending_review' })
      await route.fulfill({ status: 201, json: { data: { revision: Number(body.expectedRevision) + 1, finalSnapshotId: snapshotId, employeeId, included: body.included } } })
    })
    await page.goto('/store/incentives')
    await page.getByLabel('Mall of İstanbul: Prim ayrıntılarını aç').filter({ visible: true }).click()
    const drawer = page.getByRole('dialog', { name: 'Mall of İstanbul', exact: true })
    const row = drawer.getByRole('row').filter({ hasText: 'Hedefsiz Personel' })
    await expect(row).toBeVisible()
    await expect(row.getByText('Hedef yok', { exact: true })).toBeVisible()
    const totals = (await drawer.locator('.incentive-detail-totals').textContent())!
    await row.getByRole('checkbox', { name: 'Hedefsiz Personel: Prime Dahil Değildir' }).check()
    const save = row.getByRole('button', { name: 'Hedefsiz Personel: Prim kararını kaydet' })
    await expect(save).toBeDisabled()
    await expect(drawer.getByRole('button', { name: 'Tamamla', exact: true })).toBeDisabled()
    await row.getByRole('textbox', { name: 'Hedefsiz Personel: Dışlama gerekçesi' }).fill('   ')
    await expect(save).toBeDisabled()
    expect(requests).toEqual([])
    await row.getByRole('textbox', { name: 'Hedefsiz Personel: Dışlama gerekçesi' }).fill('Bu paket için onaylı hedefi yok')
    await save.click()
    await expect.poll(() => requests.length).toBe(1)
    expect(requests[0]).toEqual({ period: fixture.data.period, storeId: store.storeId, employeeId, included: false,
      reasonNote: 'Bu paket için onaylı hedefi yok', expectedRevision: 0, expectedSnapshotId: snapshotId })
    await expect(row.getByRole('checkbox')).toBeChecked()
    await expect(row.getByRole('button', { name: 'Hedefsiz Personel: Prim kararını kaydet' })).toHaveCount(0)
    await expect(drawer.locator('.incentive-detail-totals')).toHaveText(totals)
    await row.getByRole('checkbox').uncheck()
    await row.getByRole('button', { name: 'Hedefsiz Personel: Prim kararını kaydet' }).click()
    await expect.poll(() => requests.length).toBe(2)
    expect(requests[1]).toEqual({ period: fixture.data.period, storeId: store.storeId, employeeId, included: true, expectedRevision: 1, expectedSnapshotId: snapshotId })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
}

test('saving one person and filtering adjustments preserves the other person participation draft', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await installGenericStoreApiFallbacks(page)
  const fixture = createIncentiveWorkspace('region_manager')
  const store = fixture.data.managerGroups[0]!.stores[0]!
  const snapshot = '70000000-0000-4000-8000-000000000001'
  Object.assign(store.review, { finalSnapshotId: snapshot, participationRevision: 0 })
  store.rows.forEach(row => Object.assign(row, { participation: { included: true, reasonNote: null } }))
  await routeIncentiveWorkspace(page, fixture)
  const bodies: Record<string, unknown>[] = []
  await page.route('**/api/store/incentives/workspace/participation', async route => {
    const body = route.request().postDataJSON(); bodies.push(body)
    Object.assign(store.rows.find(row => row.employeeId === body.employeeId)!, { finalAmount: '0.00', participation: { included: false, reasonNote: body.reasonNote } })
    Object.assign(store.review, { participationRevision: Number(body.expectedRevision) + 1, status: 'pending_review' })
    await route.fulfill({ status: 201, json: { data: { revision: Number(body.expectedRevision) + 1, finalSnapshotId: snapshot, employeeId: body.employeeId, included: false } } })
  })
  await page.goto('/store/incentives')
  await page.getByLabel('Mall of İstanbul: Prim ayrıntılarını aç').filter({ visible: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Mall of İstanbul', exact: true })
  for (const [name, reason] of [['Süleyman Öztürk', 'First exclusion reason'], ['Derya Uslu', 'Second draft reason']]) {
    await drawer.getByRole('checkbox', { name: `${name}: Prime Dahil Değildir` }).check()
    await drawer.getByRole('textbox', { name: `${name}: Dışlama gerekçesi` }).fill(reason!)
  }
  await drawer.getByRole('switch', { name: 'Sadece değişiklikleri göster' }).check()
  await expect(drawer.getByRole('textbox', { name: 'Derya Uslu: Dışlama gerekçesi' })).toHaveValue('Second draft reason')
  await drawer.getByRole('button', { name: 'Süleyman Öztürk: Prim kararını kaydet' }).click()
  await expect(drawer.getByRole('button', { name: 'Süleyman Öztürk: Prim kararını kaydet' })).toHaveCount(0)
  await expect(drawer.getByRole('checkbox', { name: 'Derya Uslu: Prime Dahil Değildir' })).toBeChecked()
  await expect(drawer.getByRole('textbox', { name: 'Derya Uslu: Dışlama gerekçesi' })).toHaveValue('Second draft reason')
  await expect(drawer.getByRole('button', { name: 'Tamamla', exact: true })).toBeDisabled()
  expect(bodies).toHaveLength(1)
  await drawer.getByRole('button', { name: 'Derya Uslu: Prim kararını kaydet' }).click()
  await expect.poll(() => bodies.length).toBe(2)
  expect(bodies[1]).toMatchObject({ employeeId: store.rows[1]!.employeeId, reasonNote: 'Second draft reason', expectedRevision: 1, expectedSnapshotId: snapshot })
})

for (const change of ['source', 'same-person']) {
  test(`a preserved participation draft cannot silently overwrite ${change} changes`, async ({ page }) => {
    await installStoreContractSession(page, 'regionManager')
    await installGenericStoreApiFallbacks(page)
    const fixture = createIncentiveWorkspace('region_manager')
    const store = fixture.data.managerGroups[0]!.stores[0]!
    Object.assign(store.review, { finalSnapshotId: '70000000-0000-4000-8000-000000000001', participationRevision: 0 })
    store.rows.forEach(row => Object.assign(row, { participation: { included: true, reasonNote: null } }))
    await routeIncentiveWorkspace(page, fixture)
    const bodies: Record<string, unknown>[] = []
    await page.route('**/api/store/incentives/workspace/participation', async route => {
      bodies.push(route.request().postDataJSON())
      if (change === 'source') Object.assign(store.review, { finalSnapshotId: '70000000-0000-4000-8000-000000000002', participationRevision: 0 })
      else {
        Object.assign(store.review, { participationRevision: 1 })
        Object.assign(store.rows[1]!, { finalAmount: '0.00', participation: { included: false, reasonNote: 'Another recorded decision' } })
      }
      await route.fulfill({ status: 409, json: { message: 'Source or participation changed' } })
    })
    await page.goto('/store/incentives')
    await page.getByLabel('Mall of İstanbul: Prim ayrıntılarını aç').filter({ visible: true }).click()
    const drawer = page.getByRole('dialog', { name: 'Mall of İstanbul', exact: true })
    for (const name of ['Süleyman Öztürk', 'Derya Uslu']) {
      await drawer.getByRole('checkbox', { name: `${name}: Prime Dahil Değildir` }).check()
      await drawer.getByRole('textbox', { name: `${name}: Dışlama gerekçesi` }).fill('My original source decision')
    }
    await drawer.getByRole('button', { name: 'Süleyman Öztürk: Prim kararını kaydet' }).click()
    const affected = drawer.getByRole('row').filter({ hasText: 'Derya Uslu' })
    await expect(affected.getByRole('alert')).toContainText('Eski taslak yeni kaynağa uygulanamaz')
    await expect(affected.getByRole('button', { name: 'Derya Uslu: Prim kararını kaydet' })).toBeDisabled()
    await expect(drawer.getByRole('button', { name: 'Tamamla', exact: true })).toBeDisabled()
    expect(bodies).toHaveLength(1)
    await affected.getByRole('button', { name: 'Güncel kararı incele' }).click()
    if (change === 'same-person') await expect(affected.getByRole('textbox', { name: 'Derya Uslu: Dışlama gerekçesi' })).toHaveValue('Another recorded decision')
    else await expect(affected.getByRole('checkbox')).not.toBeChecked()
    expect(bodies).toHaveLength(1)
  })
}
