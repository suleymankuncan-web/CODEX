import { expect, test } from './test-fixtures'
import { companyCycleFixture, installCompanyCycleSession, sealHash } from './incentive-company-cycle-fixture'

test('company decision stays unavailable until the sealed revision has been read', async ({ page }) => {
  await installCompanyCycleSession(page)
  let releaseResponse!: () => void
  const responseGate = new Promise<void>(resolve => { releaseResponse = resolve })
  await page.route('**/api/store/incentives/company-cycle**', async route => {
    await responseGate
    await route.fulfill({ json: { items: [companyCycleFixture()] } })
  })
  await page.goto('/store/incentives')
  try {
    await expect(page.getByRole('status').filter({ hasText: 'Onay bilgileri yükleniyor' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Aşamayı onayla', exact: true })).toHaveCount(0)
  } finally {
    releaseResponse()
  }
  await expect(page.getByRole('button', { name: 'Aşamayı onayla', exact: true })).toBeEnabled()
})

test('a replaced seal explains the blocked confirmation and can be reviewed again', async ({ page }) => {
  await installCompanyCycleSession(page)
  const detail = companyCycleFixture()
  const requests: Record<string, unknown>[] = []
  let replaced = false
  await page.route('**/api/store/incentives/company-cycle**', route => {
    if (route.request().method() === 'POST') {
      requests.push(route.request().postDataJSON())
      replaced = true
      return route.fulfill({ status: 409, json: { message: 'Seal changed' } })
    }
    return route.fulfill({ json: { items: [{ ...detail,
      cycle: { ...detail.cycle, current_revision: replaced ? 2 : 1 },
      revisions: [{ ...detail.revisions[0], revision_no: replaced ? 2 : 1, seal_hash: replaced ? 'b'.repeat(64) : sealHash }],
    }] } })
  })
  await page.goto('/store/incentives')
  await page.getByRole('button', { name: 'Aşamayı onayla', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Şirket aşamasını onayla', exact: true })
  await dialog.getByRole('button', { name: 'Onayla', exact: true }).click()
  await expect(page.getByText(/Karar doğrulanamadı/)).toBeVisible()
  expect(requests).toHaveLength(1)
  expect(requests[0]).toMatchObject({ revision: 1, sealHash })
  await page.getByRole('button', { name: 'Aşamayı onayla', exact: true }).click()
  await expect(dialog).toContainText('Revizyon 2')
  await expect(dialog.getByRole('button', { name: 'Onayla', exact: true })).toBeEnabled()
  expect(requests).toHaveLength(1)
})

test('company return confirmation contains a maximum-length note on a narrow phone', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await installCompanyCycleSession(page)
  await page.route('**/api/store/incentives/company-cycle**', route => route.fulfill({ json: { items: [companyCycleFixture()] } }))
  await page.goto('/store/incentives')
  const note = 'A'.repeat(1000)
  await page.getByRole('button', { name: 'İade et', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Şirket listesini iade et', exact: true })
  await dialog.getByRole('textbox', { name: 'İade gerekçesi' }).fill(note)
  expect(await dialog.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
  const confirm = dialog.getByRole('button', { name: 'Onayla', exact: true })
  await confirm.scrollIntoViewIfNeeded()
  await expect(confirm).toBeInViewport()
  await expect(dialog.getByRole('textbox', { name: 'İade gerekçesi' })).toHaveValue(note)
  await page.screenshot({ path: testInfo.outputPath('confirmation-320.png') })
})
