import { expect, test, type Page } from './test-fixtures'
import { companyId, createStoreContractSession, installGenericStoreApiFallbacks, installStoreContractSession } from './store-page-contract-fixtures'
import { createIncentiveWorkspace, routeIncentiveManagerDirectory, routeIncentiveWorkspace } from './store-incentives-command-fixtures'

test('store decision shows loading until the submitted package has been read', async ({ page }) => {
  const item = await prepareAuthorizedViewer(page)
  let releaseResponse!: () => void
  const responseGate = new Promise<void>(resolve => { releaseResponse = resolve })
  await page.route('**/api/store/incentives/final-approval**', async route => {
    await responseGate
    await route.fulfill({ json: { items: [item] } })
  })
  await openStore(page)
  const panel = page.getByRole('region', { name: 'Bölge paketi kararı', exact: true })
  try {
    await expect(panel.getByRole('status')).toHaveText('Paket bilgisi yükleniyor…')
    await expect(panel).not.toContainText('Bölge müdürünün paketi göndermesi bekleniyor.')
    await expect(panel.getByRole('button', { name: 'Kabul et', exact: true })).toHaveCount(0)
  } finally {
    releaseResponse()
  }
  await expect(panel.getByRole('button', { name: 'Kabul et', exact: true })).toBeEnabled()
  await expect(panel.getByText('Paket bilgisi yükleniyor…', { exact: true })).toHaveCount(0)
})

test('a replaced package explains the blocked confirmation and can be reviewed again', async ({ page }) => {
  const item = await prepareAuthorizedViewer(page)
  const requests: unknown[] = []
  let replaced = false
  await page.route('**/api/store/incentives/final-approval**', route => {
    if (route.request().method() === 'POST') {
      requests.push(route.request().postDataJSON())
      replaced = true
      return route.fulfill({ status: 409, json: { message: 'Package changed' } })
    }
    return route.fulfill({ json: { items: [{ ...item, submittedAt: replaced ? '2026-07-02T10:00:00.000Z' : item.submittedAt }] } })
  })
  await openStore(page)
  const panel = page.getByRole('region', { name: 'Bölge paketi kararı', exact: true })
  await panel.getByRole('button', { name: 'Kabul et', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Bölge paketini kabul et', exact: true })
  await dialog.getByRole('button', { name: 'Paketi kabul et', exact: true }).click()
  await expect(dialog.getByRole('alert')).toHaveText('Paket bilgileri değişti. Pencereyi kapatıp güncel paketi kontrol edin.')
  await expect(dialog.getByRole('button', { name: 'Paketi kabul et', exact: true })).toBeDisabled()
  expect(requests).toHaveLength(1)
  await dialog.getByRole('button', { name: 'Vazgeç', exact: true }).click()
  await panel.getByRole('button', { name: 'Kabul et', exact: true }).click()
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Paketi kabul et', exact: true })).toBeEnabled()
})

test('package confirmation contains a maximum-length note on a narrow phone', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 })
  const item = await prepareAuthorizedViewer(page)
  await page.route('**/api/store/incentives/final-approval**', route => route.fulfill({ json: { items: [item] } }))
  await openStore(page)
  const panel = page.getByRole('region', { name: 'Bölge paketi kararı', exact: true })
  const note = 'A'.repeat(1000)
  await panel.getByRole('textbox', { name: 'Karar notu' }).fill(note)
  await panel.getByRole('button', { name: 'Reddet', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Bölge paketini reddet', exact: true })
  await expect(dialog).toBeVisible()
  expect(await dialog.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
  const confirm = dialog.getByRole('button', { name: 'Paketi reddet', exact: true })
  await confirm.scrollIntoViewIfNeeded()
  await expect(confirm).toBeInViewport()
  await expect(dialog.getByText(note, { exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('confirmation-320.png') })
})

async function prepareAuthorizedViewer(page: Page) {
  await installStoreContractSession(page, 'reportViewer')
  await installGenericStoreApiFallbacks(page)
  const session = createStoreContractSession('reportViewer')
  await page.route('**/api/auth/session', route => route.fulfill({ json: {
    ...session,
    user: { ...session.user, authorizationContextVersion: 'incentives-ui-audit', permissionScopes: { INCENTIVE_FINAL_APPROVAL: { companyIds: [companyId], regionIds: [], storeIds: [] } } },
  } }))
  const workspace = createIncentiveWorkspace('report_viewer')
  await routeIncentiveWorkspace(page, workspace)
  await routeIncentiveManagerDirectory(page, workspace)
  const region = workspace.data.regions[0]!
  return {
    regionId: region.regionId, regionName: region.regionName, regionManagerName: region.regionManager.displayName,
    submittedByName: region.regionManager.displayName, submittedByUserId: 'region-manager',
    regionPackageId: 'package-ui-audit', submittedAt: '2026-07-01T10:00:00.000Z',
    status: 'submitted', storeCount: region.stores.length, submittedStoreCount: region.stores.length,
  }
}

async function openStore(page: Page) {
  await page.goto('/store/incentives')
  await page.getByRole('button', { name: 'Mall of İstanbul', exact: true }).filter({ visible: true }).click()
}
