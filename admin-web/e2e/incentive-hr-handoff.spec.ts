import { expect, test, type Page } from './test-fixtures'
import { companyId, createStoreContractSession, installGenericStoreApiFallbacks, installStoreContractSession } from './store-page-contract-fixtures'
import { createIncentiveWorkspace, routeIncentiveManagerDirectory, routeIncentiveWorkspace } from './store-incentives-command-fixtures'

async function prepare(page: Page, approved = true) {
  await installStoreContractSession(page, 'reportViewer')
  await installGenericStoreApiFallbacks(page)
  const session = createStoreContractSession('reportViewer')
  await page.route('**/api/auth/session', route => route.fulfill({ json: { ...session, user: { ...session.user, permissionScopes: { INCENTIVE_FINAL_APPROVAL: { companyIds: [companyId], regionIds: [], storeIds: [] } } } } }))
  const workspace = createIncentiveWorkspace('report_viewer', { multipleRegions: true })
  await routeIncentiveWorkspace(page, workspace)
  await routeIncentiveManagerDirectory(page, workspace)
  await page.route('**/api/store/incentives/final-approval**', route => route.fulfill({ json: { items: workspace.data.managerGroups.map((region, index) => ({ companyId: region.companyId, managerUserId: region.managerUserId, managerName: region.managerName, regionPackageId: `package-${index}`, submittedAt: '2026-07-01T10:00:00Z', submittedByUserId: 'manager', status: approved ? 'admin_approved' : 'submitted', submittedStoreCount: region.stores.length })) } }))
  return { period: '2026-06', version: 'a'.repeat(64), allApproved: approved, mailConfigured: true, canSend: approved,
    companies: [{ companyId, companyName: 'Örnek Şirket', recipients: ['ik@example.test'], managerPackageCount: 2, approvedPackageCount: 2, storeCount: 3, personnelCount: 3, totalAmount: '93994.40', status: 'not_sent', sentAt: null }] }
}

test('HR handoff waits for all approved packages, not the currently filtered region', async ({ page }) => {
  await prepare(page, false)
  const calls: string[] = []
  page.on('request', request => { if (request.url().includes('/api/store/incentives/hr-handoff')) calls.push(request.url()) })
  await page.goto('/store/incentives')
  const handoff = page.getByRole('button', { name: 'İK’ya gönder', exact: true })
  await expect(handoff).toHaveClass(/incentive-primary-action/)
  await expect(handoff).toBeDisabled()
  expect(calls).toEqual([])
})

for (const width of [1440, 390]) {
  test(`HR summary covers all companies and sends only after confirmation at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    const preview = await prepare(page)
    const bodies: unknown[] = []
    await page.route('**/api/store/incentives/hr-handoff**', async route => {
      if (route.request().method() === 'POST') { bodies.push(route.request().postDataJSON()); preview.canSend = false; preview.companies[0]!.status = 'sent' }
      await route.fulfill({ status: route.request().method() === 'POST' ? 201 : 200, json: preview })
    })
    await page.goto('/store/incentives')
    await page.getByRole('button', { name: 'İK’ya gönder', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'İK’ya gönderim özeti' })
    await expect(dialog).toContainText('ik@example.test')
    await expect(dialog.locator('dl')).toContainText('Mağaza3')
    await expect(dialog.locator('dl')).toContainText('Müdür paketi2')
    await expect(dialog).toContainText('₺93.994,40')
    expect(bodies).toEqual([])
    await page.screenshot({ path: testInfo.outputPath(`hr-confirm-${width}.png`) })
    await dialog.getByRole('button', { name: 'Onayla', exact: true }).click()
    await expect(dialog).toContainText('E-posta sunucusuna teslim edildi.')
    expect(bodies).toEqual([{ period: '2026-06', version: preview.version }])
    await expect(dialog.getByRole('button', { name: 'Onayla', exact: true })).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

test('missing SMTP configuration is honest and disables confirmation', async ({ page }) => {
  const preview = await prepare(page)
  preview.mailConfigured = false; preview.canSend = false; preview.companies[0]!.recipients = []
  await page.route('**/api/store/incentives/hr-handoff**', route => route.fulfill({ json: preview }))
  await page.goto('/store/incentives')
  await page.getByRole('button', { name: 'İK’ya gönder', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'İK’ya gönderim özeti' })
  await expect(dialog).toContainText('İK alıcı adresleri henüz tanımlanmadı.')
  await expect(dialog.getByRole('button', { name: 'Onayla', exact: true })).toBeDisabled()
})

test('an uncertain email response is not retried or presented as delivered', async ({ page }) => {
  const preview = await prepare(page)
  let posts = 0
  await page.route('**/api/store/incentives/hr-handoff**', route => {
    if (route.request().method() === 'POST') {
      posts++; preview.canSend = false; preview.companies[0]!.status = 'uncertain'
      return route.fulfill({ status: 503, json: { message: 'Gönderim doğrulanamadı.' } })
    }
    return route.fulfill({ json: preview })
  })
  await page.goto('/store/incentives')
  await page.getByRole('button', { name: 'İK’ya gönder', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'İK’ya gönderim özeti' })
  await dialog.getByRole('button', { name: 'Onayla', exact: true }).click()
  await expect(dialog).toContainText('posta sunucusu kayıtları kontrol edilmeli')
  await expect(dialog.getByRole('button', { name: 'Onayla', exact: true })).toBeDisabled()
  expect(posts).toBe(1)
  await expect(page.getByRole('button', { name: 'İK’ya gönderildi', exact: true })).toHaveCount(0)
})
