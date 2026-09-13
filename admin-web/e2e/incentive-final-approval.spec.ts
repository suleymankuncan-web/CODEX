import { expect, test, type Page } from './test-fixtures'
import { createStoreContractSession, installStoreContractSession, installGenericStoreApiFallbacks, companyId } from './store-page-contract-fixtures'
import { createIncentiveWorkspace, routeIncentiveWorkspace } from './store-incentives-command-fixtures'

async function prepare(page: Page, granted: boolean) {
  await installStoreContractSession(page, 'reportViewer')
  await installGenericStoreApiFallbacks(page)
  const session = createStoreContractSession('reportViewer')
  await page.route('**/api/auth/session', route => route.fulfill({ json: { ...session, user: { ...session.user, authorizationContextVersion: granted ? 'granted' : 'plain', permissionScopes: granted ? { INCENTIVE_FINAL_APPROVAL: { companyIds: [companyId], regionIds: [], storeIds: [] } } : {} } } }))
  await routeIncentiveWorkspace(page, createIncentiveWorkspace('report_viewer'))
}
const item = {
  regionId: 'region-1', regionName: 'Marmara', regionManagerName: 'Ayşe Demir', submittedByName: 'Ayşe Demir', submittedByUserId: 'region-manager',
  regionPackageId: 'package-1', submittedAt: '2026-07-01T10:00:00.000Z', status: 'submitted', storeCount: 10, submittedStoreCount: 10,
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
    const approval = page.getByText('Prim Onayı', { exact: true })
    await expect(approval).toBeVisible()
    const approvalBox = await approval.boundingBox()
    const listBox = await page.locator('.incentive-performance-list').boundingBox()
    expect(approvalBox!.y + approvalBox!.height).toBeLessThan(listBox!.y)
    await page.getByRole('button', { name: 'Final onay ver', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Prim final onayı' })
    await expect(dialog).toContainText('Marmara')
    expect(bodies).toHaveLength(0)
    await page.screenshot({ path: testInfo.outputPath(`prim-final-${width}.png`) })
    await dialog.getByRole('button', { name: 'Final onayı ver', exact: true }).click()
    await expect(page.getByText('Final onaylandı', { exact: true })).toBeVisible()
    expect(bodies).toEqual([{ period: '2026-06', regionId: item.regionId, regionPackageId: item.regionPackageId, submittedAt: item.submittedAt }])
    await expect(page.getByRole('button', { name: 'Final onay ver', exact: true })).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
}
test('directory selection shows only the selected regions approval package', async ({ page }) => {
  await prepare(page, true)
  const workspace = createIncentiveWorkspace('report_viewer', { multipleRegions: true })
  await routeIncentiveWorkspace(page, workspace)
  await page.route('**/api/store/incentives/final-approval**', route => route.fulfill({ json: { items: workspace.data.regions.map(region => ({ ...item, regionId: region.regionId, regionName: region.regionName })) } }))
  await page.goto('/store/incentives')
  await expect(page.getByRole('button', { name: 'Final onay ver', exact: true })).toHaveCount(2)
  await page.getByRole('complementary', { name: 'Bölge müdürleri' }).getByRole('button', { name: /Ayşe Kaya/ }).click()
  await expect(page.getByRole('button', { name: 'Final onay ver', exact: true })).toHaveCount(1)
  await page.getByRole('button', { name: 'Final onay ver', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Prim final onayı' })
  await expect(dialog).toContainText('İstanbul Anadolu')
  await expect(dialog).not.toContainText('İstanbul Avrupa')
})

test('plain viewer has no approval control and never calls its endpoints', async ({ page }) => {
  await prepare(page, false)
  const calls: string[] = []
  page.on('request', r => { if (r.url().includes('/final-approval')) calls.push(r.url()) })
  await page.goto('/store/incentives')
  await expect(page.getByRole('heading', { name: 'LUFIAN Mağaza Primleri' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Final onay ver', exact: true })).toHaveCount(0)
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
  await page.getByRole('button', { name: 'Final onay ver', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Final onayı ver', exact: true }).click()
  await expect(page.getByText('Onay paketleri alınamadı veya yetkiniz kaldırıldı.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Final onay ver', exact: true })).toHaveCount(0)
})
