import { expect, test, type Page } from './test-fixtures'
import { createStoreContractSession, installStoreContractSession, installGenericStoreApiFallbacks, companyId } from './store-page-contract-fixtures'
import { createIncentiveWorkspace, routeIncentiveManagerDirectory, routeIncentiveWorkspace } from './store-incentives-command-fixtures'

async function prepare(page: Page, granted: boolean) {
  await installStoreContractSession(page, 'reportViewer')
  await installGenericStoreApiFallbacks(page)
  const session = createStoreContractSession('reportViewer')
  await page.route('**/api/auth/session', route => route.fulfill({ json: { ...session, user: { ...session.user, authorizationContextVersion: granted ? 'granted' : 'plain', permissionScopes: granted ? { INCENTIVE_FINAL_APPROVAL: { companyIds: [companyId], regionIds: [], storeIds: [] } } : {} } } }))
  const workspace = createIncentiveWorkspace('report_viewer')
  await routeIncentiveWorkspace(page, workspace)
  await routeIncentiveManagerDirectory(page, workspace)
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
    await page.getByRole('tab', { name: 'Final onay', exact: true }).click()
    const approval = page.getByText('Prim Onayı', { exact: true })
    await expect(approval).toBeVisible()
    await expect(page.locator('.incentive-performance-list')).toHaveCount(0)
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
  await routeIncentiveManagerDirectory(page, workspace)
  await page.route('**/api/store/incentives/final-approval**', route => route.fulfill({ json: { items: workspace.data.regions.map(region => ({ ...item, regionId: region.regionId, regionName: region.regionName })) } }))
  await page.goto('/store/incentives')
  await page.getByRole('tab', { name: 'Final onay', exact: true }).click()
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
  await expect(page.getByRole('heading', { name: 'Primler', exact: true })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Final onay', exact: true })).toHaveCount(0)
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
  await page.getByRole('tab', { name: 'Final onay', exact: true }).click()
  await page.getByRole('button', { name: 'Final onay ver', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Final onayı ver', exact: true }).click()
  await expect(page.getByText('Onay paketleri alınamadı veya yetkiniz kaldırıldı.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Final onay ver', exact: true })).toHaveCount(0)
})

test('bulk approval confirms only eligible exact package versions and never self-approves', async ({ page }) => {
  await prepare(page, true)
  const packages = [{ ...item }, { ...item, regionId: 'region-2', regionName: 'Ege', regionPackageId: 'package-2' },
    { ...item, regionId: 'own', regionName: 'Kendi paketi', regionPackageId: 'own', submittedByUserId: createStoreContractSession('reportViewer').user.userId },
    { ...item, regionId: 'approved', regionName: 'Onaylı paket', regionPackageId: 'approved', status: 'admin_approved' }]
  const requests: typeof item[] = []
  await page.route('**/api/store/incentives/final-approval**', route => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON(); requests.push(body)
      packages.find(row => row.regionId === body.regionId)!.status = 'admin_approved'
      return route.fulfill({ json: { data: { status: 'admin_approved' } } })
    }
    return route.fulfill({ json: { items: packages } })
  })
  await page.goto('/store/incentives')
  await page.getByRole('tab', { name: 'Final onay', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: 'Kendi paketi: Paketi seç', exact: true })).toBeDisabled()
  await page.getByRole('checkbox', { name: 'Onaylanabilir paketlerin tümünü seç' }).check()
  await page.getByRole('button', { name: 'Seçilenleri onayla (2)', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Prim final onayı' })
  await expect(dialog).toContainText('Marmara')
  await expect(dialog).toContainText('Ege')
  await expect(dialog).not.toContainText('Kendi paketi')
  expect(requests).toHaveLength(0)
  await dialog.getByRole('button', { name: 'Final onayı ver', exact: true }).click()
  await expect(page.getByText('2 paket onaylandı.', { exact: true })).toBeVisible()
  expect(requests).toEqual(packages.slice(0, 2).map(row => ({ period: '2026-06', regionId: row.regionId, regionPackageId: row.regionPackageId, submittedAt: row.submittedAt })))
  await expect(page.getByRole('button', { name: 'Seçilenleri onayla', exact: true })).toHaveCount(0)
})

for (const status of [403, 409, 500]) {
  test(`bulk approval stops on ${status} and retains successful approvals without retrying`, async ({ page }) => {
    await prepare(page, true)
    const packages = [item, { ...item, regionId: 'region-2', regionName: 'Ege', regionPackageId: 'package-2' }, { ...item, regionId: 'region-3', regionName: 'Akdeniz', regionPackageId: 'package-3' }].map(row => ({ ...row }))
    const requests: string[] = []
    await page.route('**/api/store/incentives/final-approval**', route => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON(); requests.push(body.regionId)
        if (body.regionId === 'region-2') return route.fulfill({ status, json: { message: 'Package approval rejected' } })
        packages.find(row => row.regionId === body.regionId)!.status = 'admin_approved'
        return route.fulfill({ json: { data: { status: 'admin_approved' } } })
      }
      return route.fulfill({ json: { items: packages } })
    })
    await page.goto('/store/incentives')
    await page.getByRole('tab', { name: 'Final onay', exact: true }).click()
    await page.getByRole('checkbox', { name: 'Onaylanabilir paketlerin tümünü seç' }).check()
    await page.getByRole('button', { name: 'Seçilenleri onayla (3)', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Final onayı ver', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: '1 paket onaylandı.' })).toContainText('Ege için onay doğrulanamadı')
    await expect(page.getByRole('alert').filter({ hasText: '1 paket onaylandı.' })).toContainText('1 pakete işlem yapılmadı')
    await expect(page.getByText('Final onaylandı', { exact: true })).toBeVisible()
    expect(requests).toEqual(['region-1', 'region-2'])
    await expect(page.getByRole('checkbox', { name: 'Marmara: Paketi seç', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Seçilenleri onayla', exact: true })).toHaveCount(0)
  })
}

test('manager filter clears bulk selection instead of approving hidden packages', async ({ page }) => {
  await prepare(page, true)
  const workspace = createIncentiveWorkspace('report_viewer', { multipleRegions: true })
  await routeIncentiveWorkspace(page, workspace)
  await routeIncentiveManagerDirectory(page, workspace)
  await page.route('**/api/store/incentives/final-approval**', route => route.fulfill({ json: { items: workspace.data.regions.map(region => ({ ...item, regionId: region.regionId, regionName: region.regionName })) } }))
  await page.goto('/store/incentives')
  await page.getByRole('tab', { name: 'Final onay', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Onaylanabilir paketlerin tümünü seç' }).check()
  await expect(page.getByRole('button', { name: 'Seçilenleri onayla (2)', exact: true })).toBeEnabled()
  await page.getByRole('complementary', { name: 'Bölge müdürleri' }).getByRole('button', { name: /Ayşe Kaya/ }).click()
  await expect(page.getByRole('button', { name: 'Seçilenleri onayla', exact: true })).toHaveCount(0)
  await expect(page.getByRole('checkbox', { name: 'İstanbul Anadolu: Paketi seç', exact: true })).not.toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'İstanbul Avrupa: Paketi seç', exact: true })).toHaveCount(0)
})

for (const decision of ['approve', 'return'] as const) {
  test(`store drawer ${decision} applies to the exact entire regional package with a note`, async ({ page }) => {
    await prepare(page, true)
    const fixture = createIncentiveWorkspace('report_viewer')
    const region = fixture.data.regions[0]!
    const requests: unknown[] = []
    let status = 'submitted'
    await page.route('**/api/store/incentives/final-approval**', route => {
      if (route.request().method() === 'POST') {
        requests.push(route.request().postDataJSON())
        status = decision === 'return' ? 'admin_returned' : 'admin_approved'
        return route.fulfill({ json: { data: { status } } })
      }
      return route.fulfill({ json: { items: [{ ...item, regionId: region.regionId, status, submittedStoreCount: 2 }] } })
    })
    await page.goto('/store/incentives')
    await page.getByRole('button', { name: 'Mall of İstanbul', exact: true }).filter({ visible: true }).click()
    const panel = page.getByRole('region', { name: 'Bölge paketi kararı' })
    await expect(panel).toContainText('bölge paketinin tamamına')
    await expect(panel.getByRole('button', { name: 'Reddet', exact: true })).toBeDisabled()
    await panel.getByLabel('Karar notu').fill('Paket inceleme notu')
    await panel.getByRole('button', { name: decision === 'return' ? 'Reddet' : 'Kabul et', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: decision === 'return' ? 'Bölge paketini reddet' : 'Bölge paketini kabul et', exact: true })
    await expect(dialog).toContainText('2 mağazanın tamamı')
    expect(requests).toHaveLength(0)
    await dialog.getByRole('button', { name: decision === 'return' ? 'Paketi reddet' : 'Paketi kabul et', exact: true }).click()
    await expect.poll(() => requests).toEqual([{ period: '2026-06', regionId: region.regionId, regionPackageId: item.regionPackageId, submittedAt: item.submittedAt, decision, reviewNote: 'Paket inceleme notu' }])
    await expect(panel.getByRole('button', { name: /^(Kabul et|Reddet)$/ })).toHaveCount(0)
  })
}
