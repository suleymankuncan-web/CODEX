import { expect, test, type Page } from './test-fixtures'
import { companyId, createStoreContractSession, installGenericStoreApiFallbacks, installStoreContractSession } from './store-page-contract-fixtures'
import { createIncentiveWorkspace, routeIncentiveManagerDirectory, routeIncentiveWorkspace } from './store-incentives-command-fixtures'

test('package decision stays unavailable until the submitted package has been read', async ({ page }) => {
  const item = await prepareAuthorizedViewer(page)
  let releaseResponse!: () => void
  const responseGate = new Promise<void>(resolve => { releaseResponse = resolve })
  await page.route('**/api/store/incentives/final-approval**', async route => {
    await responseGate
    await route.fulfill({ json: { items: [item] } })
  })
  await page.goto('/store/incentives')
  try {
    await expect(page.getByRole('button', { name: 'Paketi onayla', exact: true })).toHaveCount(0)
  } finally {
    releaseResponse()
  }
  await expect(page.getByRole('button', { name: 'Paketi onayla', exact: true })).toBeEnabled()
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
  await page.goto('/store/incentives')
  await page.getByRole('button', { name: 'Paketi onayla', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Prim final onayı', exact: true })
  await dialog.getByRole('button', { name: 'Final onayı ver', exact: true }).click()
  await expect(page.getByText(/Karar doğrulanamadı/)).toBeVisible()
  expect(requests).toHaveLength(1)
  await page.getByRole('button', { name: 'Paketi onayla', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Final onayı ver', exact: true })).toBeEnabled()
})

test('package confirmation contains a maximum-length note on a narrow phone', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 })
  const item = await prepareAuthorizedViewer(page)
  await page.route('**/api/store/incentives/final-approval**', route => route.fulfill({ json: { items: [item] } }))
  await page.goto('/store/incentives')
  const note = 'A'.repeat(1000)
  await page.getByRole('button', { name: 'Reddet', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Bölge paketini reddet', exact: true })
  await dialog.getByRole('textbox', { name: 'Ret gerekçesi' }).fill(note)
  await expect(dialog).toBeVisible()
  expect(await dialog.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
  const confirm = dialog.getByRole('button', { name: 'Paketi reddet', exact: true })
  await confirm.scrollIntoViewIfNeeded()
  await expect(confirm).toBeInViewport()
  await expect(dialog.getByRole('textbox', { name: 'Ret gerekçesi' })).toHaveValue(note)
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
  const region = workspace.data.managerGroups[0]!
  return {
    companyId: region.companyId, managerUserId: region.managerUserId, managerName: region.managerName,
    submittedByName: region.managerName, submittedByUserId: 'region-manager',
    regionPackageId: 'package-ui-audit', submittedAt: '2026-07-01T10:00:00.000Z',
    status: 'submitted', storeCount: region.stores.length, submittedStoreCount: region.stores.length,
  }
}
