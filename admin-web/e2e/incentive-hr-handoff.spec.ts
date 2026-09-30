import { expect, test, type Page } from './test-fixtures'
import { companyId } from './store-page-contract-fixtures'
import { companyCycleFixture, cyclePeriod, installCompanyCycleSession, sealHash } from './incentive-company-cycle-fixture'

async function prepare(page: Page, approved = true) {
  await installCompanyCycleSession(page, 'payroll')
  await page.route('**/api/store/incentives/company-cycle**', route => route.fulfill({ json: { items: [companyCycleFixture(approved ? 'final' : 'general_manager')] } }))
  return { period: cyclePeriod, version: 'c'.repeat(64), allApproved: approved, mailConfigured: true, canSend: approved,
    companies: [{ companyId, companyName: 'Mühürlü Şirket', recipients: ['ik@example.test'], managerPackageCount: 1, approvedPackageCount: approved ? 1 : 0, storeCount: 1, personnelCount: 1, totalAmount: '125.00', status: 'not_sent', sentAt: null,
      approvalOrigin: 'company_cycle', finalProof: { cycleId: 'cycle-1', revision: 1, sealHash } }] }
}

test('HR-only payroll capability cannot deliver before General Manager final approval', async ({ page }) => {
  const preview = await prepare(page, false)
  const posts: unknown[] = []
  await page.route('**/api/store/incentives/hr-handoff**', route => { if (route.request().method() === 'POST') posts.push(route.request().postDataJSON()); return route.fulfill({ json: preview }) })
  await page.goto('/store/incentives')
  const handoff = page.getByRole('button', { name: 'Bordroya teslim et', exact: true })
  await expect(handoff).toHaveClass(/incentive-primary-action/); await expect(handoff).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Aşamayı onayla' })).toHaveCount(0); expect(posts).toEqual([])
})

for (const width of [1440, 390]) {
  test(`HR-only final payroll summary uses a separate transport version at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 }); const preview = await prepare(page)
    const bodies: unknown[] = []
    await page.route('**/api/store/incentives/hr-handoff**', async route => {
      if (route.request().method() === 'POST') { bodies.push(route.request().postDataJSON()); preview.canSend = false; preview.companies[0]!.status = 'sent' }
      await route.fulfill({ status: route.request().method() === 'POST' ? 201 : 200, json: preview })
    })
    await page.goto('/store/incentives'); await page.getByRole('button', { name: 'Bordroya teslim et', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Final bordro teslim özeti' })
    await expect(dialog).toContainText('ik@example.test'); await expect(dialog.locator('dl')).toContainText('Mağaza1')
    await expect(dialog.locator('dl')).toContainText('Müdür paketi1'); await expect(dialog).toContainText('₺125,00')
    await expect(dialog).toContainText('Genel Müdür final onayı · Revizyon 1'); expect(bodies).toEqual([])
    await page.screenshot({ path: testInfo.outputPath(`final-payroll-${width}.png`) })
    await dialog.getByRole('button', { name: 'Onayla', exact: true }).click()
    await expect(dialog).toContainText('E-posta sunucusuna teslim edildi.'); expect(bodies).toEqual([{ period: cyclePeriod, version: preview.version }])
    expect(preview.version).not.toBe(sealHash); await expect(dialog.getByRole('button', { name: 'Onayla', exact: true })).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

test('missing SMTP configuration is honest and disables final payroll confirmation', async ({ page }) => {
  const preview = await prepare(page); preview.mailConfigured = false; preview.canSend = false; preview.companies[0]!.recipients = []
  await page.route('**/api/store/incentives/hr-handoff**', route => route.fulfill({ json: preview }))
  await page.goto('/store/incentives'); await page.getByRole('button', { name: 'Bordroya teslim et', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Final bordro teslim özeti' })
  await expect(dialog).toContainText('İK alıcı adresleri henüz tanımlanmadı.'); await expect(dialog.getByRole('button', { name: 'Onayla', exact: true })).toBeDisabled()
})

test('an uncertain final payroll transport response is not retried or presented as delivered', async ({ page }) => {
  const preview = await prepare(page); let posts = 0
  await page.route('**/api/store/incentives/hr-handoff**', route => {
    if (route.request().method() === 'POST') { posts++; preview.canSend = false; preview.companies[0]!.status = 'uncertain'; return route.fulfill({ status: 503, json: { message: 'Gönderim doğrulanamadı.' } }) }
    return route.fulfill({ json: preview })
  })
  await page.goto('/store/incentives'); await page.getByRole('button', { name: 'Bordroya teslim et', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Final bordro teslim özeti' }); await dialog.getByRole('button', { name: 'Onayla', exact: true }).click()
  await expect(dialog).toContainText('posta sunucusu kayıtları kontrol edilmeli'); await expect(dialog.getByRole('button', { name: 'Onayla', exact: true })).toBeDisabled()
  expect(posts).toBe(1); await expect(page.getByRole('button', { name: 'Bordroya teslim edildi', exact: true })).toHaveCount(0)
})
