import { expect, test, type Page } from './test-fixtures'
import { createStoreContractSession, installStoreContractSession, installGenericStoreApiFallbacks, companyId } from './store-page-contract-fixtures'
import { createIncentiveWorkspace, routeIncentiveManagerDirectory, routeIncentiveWorkspace, incentiveManagerA } from './store-incentives-command-fixtures'

async function prepare(page: Page, granted: boolean) {
  await installStoreContractSession(page, 'reportViewer')
  await installGenericStoreApiFallbacks(page)
  const session = createStoreContractSession('reportViewer')
  await page.route('**/api/auth/session', route => route.fulfill({ json: { ...session, user: { ...session.user, authorizationContextVersion: granted ? 'granted' : 'plain', permissionScopes: granted ? { INCENTIVE_FINAL_APPROVAL: { companyIds: [companyId], regionIds: [], storeIds: [] } } : {} } } }))
  const workspace = createIncentiveWorkspace('report_viewer')
  await routeIncentiveWorkspace(page, workspace)
  await routeIncentiveManagerDirectory(page, workspace)
  await page.route('**/api/store/incentives/hr-handoff**', route => route.fulfill({ json: { period: '2026-06', version: 'a'.repeat(64), allApproved: true, mailConfigured: false, canSend: false, companies: [] } }))
}
const item = {
  companyId, managerUserId: incentiveManagerA, managerName: 'Süleyman Öztürk', submittedByName: 'Süleyman Öztürk', submittedByUserId: 'region-manager',
  regionPackageId: 'package-1', submittedAt: '2026-07-01T10:00:00.000Z', status: 'submitted', storeCount: 2, submittedStoreCount: 2,
}

for (const width of [1440, 390]) {
  test(`authorized viewer confirms exact package at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 })
    await prepare(page, true)
    let approved = false
    const bodies: unknown[] = []
    await page.route('**/api/store/incentives/final-approval**', async route => {
      if (route.request().method() === 'POST') {
        bodies.push(route.request().postDataJSON()); approved = true
        return route.fulfill({ status: 201, json: { data: { status: 'admin_approved' } } })
      }
      await route.fulfill({ json: { items: [{ ...item, status: approved ? 'admin_approved' : 'submitted' }] } })
    })
    await page.goto('/store/incentives')
    const approval = page.getByRole('heading', { name: 'Primler', exact: true })
    await expect(approval).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Final onay', exact: true })).toHaveCount(0)
    await expect(page.locator('.incentive-performance-list')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Paketi onayla' })).toBeVisible()
    await page.locator('.incentive-region-package-toggle').first().click()
    await expect(page.getByLabel('Mall of İstanbul: Prim ayrıntılarını aç').filter({ visible: true })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath(`prim-main-list-${width}.png`), fullPage: true })
    await page.getByLabel('Mall of İstanbul: Prim ayrıntılarını aç').filter({ visible: true }).click()
    const drawer = page.getByRole('dialog', { name: 'Mall of İstanbul', exact: true })
    await expect(drawer.getByRole('region', { name: 'Bölge paketi kararı' })).toHaveCount(0)
    await expect(drawer.getByRole('button', { name: /^(Tamamla|Kabul et|Reddet)$/ })).toHaveCount(0)
    await expect(drawer.locator('[data-slot="sheet-footer"]')).toHaveCount(0)
    await drawer.getByRole('button', { name: 'Mağaza detayını kapat' }).click()
    await page.getByRole('button', { name: 'Paketi onayla', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Prim final onayı' })
    await expect(dialog).toContainText('2 mağaza')
    expect(bodies).toHaveLength(0)
    await page.screenshot({ path: testInfo.outputPath(`prim-final-${width}.png`) })
    await dialog.getByRole('button', { name: 'Final onayı ver', exact: true }).click()
    await expect(page.locator('.incentive-region-package-status.is-admin_approved')).toHaveText('Onaylandı')
    await expect(page.locator('.incentive-region-package-actions')).toHaveCount(0)
    expect(bodies).toEqual([{ period: '2026-06', regionPackageId: item.regionPackageId, submittedAt: item.submittedAt, decision: 'approve' }])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
}
test('viewer groups stores by manager package without an extra manager column', async ({ page }) => {
  await prepare(page, true)
  const workspace = createIncentiveWorkspace('report_viewer', { multipleRegions: true })
  await routeIncentiveWorkspace(page, workspace)
  await routeIncentiveManagerDirectory(page, workspace)
  await page.route('**/api/store/incentives/final-approval**', route => route.fulfill({ json: { items: workspace.data.managerGroups.map(region => ({ ...item, companyId, managerUserId: region.managerUserId, managerName: region.managerName })) } }))
  await page.goto('/store/incentives')
  await expect(page.getByRole('complementary', { name: 'Bölge müdürleri' })).toHaveCount(0)
  await expect(page.getByRole('columnheader', { name: /Bölge Müdürü/ })).toHaveCount(0)
  await expect(page.locator('.incentive-region-package-toggle')).toHaveCount(2)
  await page.locator('.incentive-region-package-toggle').first().click()
  await expect(page.getByLabel('Mall of İstanbul: Prim ayrıntılarını aç').filter({ visible: true })).toBeVisible()
  await page.locator('.incentive-region-package-toggle').last().click()
  await expect(page.getByLabel('Akasya AVM: Prim ayrıntılarını aç').filter({ visible: true })).toBeVisible()
  await expect(page.locator('.incentive-region-manager-cell, .incentive-store-manager-name')).toHaveCount(0)
})

test('authorized viewer can approve the visible submitted packages in one confirmed batch', async ({ page }) => {
  await prepare(page, true)
  const workspace = createIncentiveWorkspace('report_viewer', { multipleRegions: true })
  await routeIncentiveWorkspace(page, workspace)
  await routeIncentiveManagerDirectory(page, workspace)
  const items = workspace.data.managerGroups.map((region, index) => ({
    ...item, companyId, managerUserId: region.managerUserId, managerName: region.managerName,
    regionPackageId: `package-${index + 1}`,
    submittedStoreCount: region.stores.length,
  }))
  const requests: Array<{ regionPackageId: string }> = []
  await page.route('**/api/store/incentives/final-approval**', route => {
    if (route.request().method() === 'POST') {
      requests.push(route.request().postDataJSON())
      return route.fulfill({ status: 201, json: { data: { status: 'admin_approved' } } })
    }
    return route.fulfill({ json: { items: items.map(packageItem => ({
      ...packageItem,
      status: requests.some(request => request.regionPackageId === packageItem.regionPackageId) ? 'admin_approved' : 'submitted',
    })) } })
  })
  await page.goto('/store/incentives')
  await page.getByRole('button', { name: '2 paketi toplu onayla' }).click()
  const dialog = page.getByRole('dialog', { name: 'Prim final onayı' })
  await expect(dialog).toContainText('2 bölge paketi')
  expect(requests).toHaveLength(0)
  await dialog.getByRole('button', { name: 'Final onayı ver' }).click()
  await expect.poll(() => requests.map(request => request.regionPackageId)).toEqual(items.map(packageItem => packageItem.regionPackageId))
  await expect(page.locator('.incentive-region-package-status.is-admin_approved')).toHaveCount(2)
})

test('plain viewer has no approval control and never calls its endpoints', async ({ page }) => {
  await prepare(page, false)
  const workspace = createIncentiveWorkspace('report_viewer')
  workspace.data.managerGroups[0]!.package.status = 'submitted'
  await routeIncentiveWorkspace(page, workspace)
  const calls: string[] = []
  page.on('request', r => { if (r.url().includes('/final-approval')) calls.push(r.url()) })
  await page.goto('/store/incentives')
  await expect(page.getByRole('heading', { name: 'Primler', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Prim Onayı' })).toHaveCount(0)
  await expect(page.locator('.incentive-region-package-actions')).toHaveCount(0)
  await page.locator('.incentive-region-package-toggle').first().click()
  await page.getByLabel('Mall of İstanbul: Prim ayrıntılarını aç').filter({ visible: true }).click()
  await expect(page.getByRole('region', { name: 'Bölge paketi kararı' })).toHaveCount(0)
  expect(calls).toEqual([])
})
test('revoked permission fails visibly and offers no stale approval action', async ({ page }) => {
  await prepare(page, true)
  let revoked = false
  await page.route('**/api/store/incentives/final-approval**', async route => {
    if (route.request().method() === 'POST') revoked = true
    await route.fulfill(revoked ? { status: 403, json: { message: 'Permission revoked' } } : { json: { items: [item] } })
  })
  await page.goto('/store/incentives')
  await page.getByRole('button', { name: 'Paketi onayla', exact: true }).click()
  await page.getByRole('dialog', { name: 'Prim final onayı' }).getByRole('button', { name: 'Final onayı ver' }).click()
  await expect(page.locator('.incentive-approval-notice')).toContainText('Onay paketleri alınamadı veya yetkiniz kaldırıldı.')
  await expect(page.locator('.incentive-region-package-actions')).toHaveCount(0)
})

test('package header approves only its submitted region after confirmation', async ({ page }) => {
  await prepare(page, true)
  const requests: unknown[] = []
  let status = 'submitted'
  await page.route('**/api/store/incentives/final-approval**', route => {
    if (route.request().method() === 'POST') {
      requests.push(route.request().postDataJSON())
      status = 'admin_approved'
      return route.fulfill({ status: 201, json: { data: { status } } })
    }
    return route.fulfill({ json: { items: [{ ...item, status }] } })
  })
  await page.goto('/store/incentives')
  await page.getByRole('button', { name: 'Paketi onayla', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Prim final onayı' })
  await expect(dialog).toContainText('2 mağaza')
  expect(requests).toHaveLength(0)
  await dialog.getByRole('button', { name: 'Final onayı ver' }).click()
  await expect.poll(() => requests).toEqual([{ period: '2026-06', regionPackageId: item.regionPackageId, submittedAt: item.submittedAt, decision: 'approve' }])
})

for (const width of [1440, 390]) {
  test(`package header requires a rejection reason and returns the exact package at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await prepare(page, true)
    const requests: unknown[] = []
    let status = 'submitted'
    await page.route('**/api/store/incentives/final-approval**', route => {
      if (route.request().method() === 'POST') {
        requests.push(route.request().postDataJSON())
        status = 'admin_returned'
        return route.fulfill({ status: 201, json: { data: { status } } })
      }
      return route.fulfill({ json: { items: [{ ...item, status }] } })
    })
    await page.goto('/store/incentives')
    await page.getByRole('button', { name: 'Reddet', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Bölge paketini reddet', exact: true })
    const submit = dialog.getByRole('button', { name: 'Paketi reddet', exact: true })
    await expect(dialog).toContainText('2 mağaza')
    await expect(submit).toBeDisabled()
    await dialog.getByLabel('Ret gerekçesi').fill('   ')
    await expect(submit).toBeDisabled()
    await dialog.getByLabel('Ret gerekçesi').fill('  Mağaza prim oranlarını yeniden kontrol edin.  ')
    await expect(submit).toBeEnabled()
    expect(requests).toHaveLength(0)
    await page.screenshot({ path: testInfo.outputPath(`package-rejection-${width}.png`) })
    await submit.click()
    await expect(dialog).toHaveCount(0)
    await expect(page.locator('.incentive-region-package-status.is-admin_returned')).toHaveText('Reddedildi')
    await expect(page.locator('.incentive-region-package-actions')).toHaveCount(0)
    expect(requests).toEqual([{ period: '2026-06', regionPackageId: item.regionPackageId, submittedAt: item.submittedAt, decision: 'return', reviewNote: 'Mağaza prim oranlarını yeniden kontrol edin.' }])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
}

test('viewer cannot approve or reject their own submission from the package header', async ({ page }) => {
  await prepare(page, true)
  const userId = createStoreContractSession('reportViewer').user.userId
  await page.route('**/api/store/incentives/final-approval**', route => route.fulfill({ json: { items: [{ ...item, submittedByUserId: userId }] } }))
  await page.goto('/store/incentives')
  await expect(page.getByRole('button', { name: 'Reddet', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Paketi onayla', exact: true })).toBeDisabled()
})

test('failed package rejection reports uncertainty and does not retry the write', async ({ page }) => {
  await prepare(page, true)
  let writes = 0
  await page.route('**/api/store/incentives/final-approval**', route => {
    if (route.request().method() === 'POST') {
      writes += 1
      return route.fulfill({ status: 409, json: { message: 'Package version changed' } })
    }
    return route.fulfill({ json: { items: [{ ...item, status: writes ? 'admin_returned' : 'submitted' }] } })
  })
  await page.goto('/store/incentives')
  await page.getByRole('button', { name: 'Reddet', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Bölge paketini reddet', exact: true })
  await dialog.getByLabel('Ret gerekçesi').fill('Prim tutarları kontrol edilmeli.')
  await dialog.getByRole('button', { name: 'Paketi reddet', exact: true }).click()
  await expect(page.getByText(/Karar doğrulanamadı/)).toBeVisible()
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('.incentive-region-package-actions')).toHaveCount(0)
  expect(writes).toBe(1)
})

for (const status of ['admin_approved', 'admin_returned'] as const) {
  test(`store drawer keeps the ${status} decision note without offering another decision`, async ({ page }) => {
    await prepare(page, true)
    const fixture = createIncentiveWorkspace('report_viewer')
    const region = fixture.data.managerGroups[0]!
    region.package.status = status
    region.package.reviewNote = 'Paket inceleme notu'
    await routeIncentiveWorkspace(page, fixture)
    const requests: unknown[] = []
    await page.route('**/api/store/incentives/final-approval**', route => {
      if (route.request().method() === 'POST') {
        requests.push(route.request().postDataJSON())
        return route.fulfill({ json: { data: { status } } })
      }
      return route.fulfill({ json: { items: [{ ...item, managerUserId: region.managerUserId, status, submittedStoreCount: 2 }] } })
    })
    await page.goto('/store/incentives')
    await page.locator('.incentive-region-package-toggle').first().click()
    await page.getByLabel('Mall of İstanbul: Prim ayrıntılarını aç').filter({ visible: true }).click()
    const drawer = page.getByRole('dialog', { name: 'Mall of İstanbul', exact: true })
    await expect(drawer.getByText('Paket inceleme notu', { exact: true })).toBeVisible()
    await expect(drawer.getByRole('heading', { name: 'Paket karar notu' })).toBeVisible()
    await expect(drawer.getByRole('region', { name: 'Bölge paketi kararı' })).toHaveCount(0)
    await expect(drawer.getByRole('button', { name: /^(Tamamla|Kabul et|Reddet)$/ })).toHaveCount(0)
    await expect(drawer.locator('[data-slot="sheet-footer"]')).toHaveCount(0)
    expect(requests).toHaveLength(0)
  })
}
