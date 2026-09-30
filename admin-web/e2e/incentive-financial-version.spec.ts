import { expect, test } from './test-fixtures'
import { createStoreContractSession, installGenericStoreApiFallbacks, installStoreContractSession, companyId } from './store-page-contract-fixtures'
import { createIncentiveWorkspace, routeIncentiveWorkspace, routeIncentiveManagerDirectory, incentiveManagerA } from './store-incentives-command-fixtures'

for (const moment of ['before-dialog', 'after-dialog']) {
  test(`approval refreshes and binds money when an authorized second client changes it ${moment}`, async ({ page }) => {
    await installStoreContractSession(page, 'reportViewer')
    await installGenericStoreApiFallbacks(page)
    const session = createStoreContractSession('reportViewer')
    await page.route('**/api/auth/session', route => route.fulfill({ json: { ...session, user: { ...session.user,
      permissionScopes: { INCENTIVE_FINAL_APPROVAL: { companyIds: [companyId], regionIds: [], storeIds: [] } },
    } } }))
    const workspace = createIncentiveWorkspace('report_viewer')
    await routeIncentiveWorkspace(page, workspace)
    await routeIncentiveManagerDirectory(page, workspace)
    await page.route('**/api/store/incentives/hr-handoff**', route => route.fulfill({ json: { period: '2026-06', version: 'c'.repeat(64), allApproved: false, mailConfigured: false, canSend: false, companies: [] } }))
    let moneyChanged = false
    let approved = false
    const requests: Record<string, unknown>[] = []
    const originalVersion = 'a'.repeat(64)
    const revisedVersion = 'b'.repeat(64)
    await page.route('**/api/store/incentives/final-approval**', async route => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON(); requests.push(body)
        if (body.expectedFinancialVersion !== (moneyChanged ? revisedVersion : originalVersion)) return route.fulfill({ status: 409, json: { message: 'Financial version changed' } })
        approved = true
        return route.fulfill({ status: 201, json: { data: { status: 'admin_approved' } } })
      }
      await route.fulfill({ json: { items: [{ companyId, managerUserId: incentiveManagerA, managerName: 'Süleyman Öztürk', submittedByUserId: 'region-manager',
        regionPackageId: 'package-1', submittedAt: '2026-07-01T10:00:00.000Z', status: approved ? 'admin_approved' : 'submitted', submittedStoreCount: 2,
        frozenTotalAmount: moneyChanged ? '150.00' : '100.00', financialVersion: moneyChanged ? revisedVersion : originalVersion,
        storeSnapshots: workspace.data.managerGroups[0]!.stores.map(store => ({ storeId: store.storeId, finalSnapshotId: `snapshot-${store.storeId}`, participationRevisionNo: 0, exclusions: [] })),
      }] } })
    })
    await page.goto('/store/incentives')
    const open = page.getByRole('button', { name: 'Paketi onayla', exact: true })
    await expect(open).toBeEnabled()
    if (moment === 'before-dialog') moneyChanged = true
    await open.click()
    const dialog = page.getByRole('dialog', { name: 'Prim final onayı' })
    await expect(dialog.locator('.incentive-confirm-copy').first()).toContainText(moment === 'before-dialog' ? '₺150,00' : '₺100,00')
    if (moment === 'after-dialog') moneyChanged = true
    await dialog.getByRole('button', { name: 'Final onayı ver', exact: true }).click()
    await expect.poll(() => requests.length).toBe(1)
    expect(requests[0]?.expectedFinancialVersion).toBe(moment === 'before-dialog' ? revisedVersion : originalVersion)
    if (moment === 'after-dialog') {
      await expect(page.locator('.incentive-approval-notice')).toContainText('karar doğrulanamadı')
      expect(approved).toBe(false)
    } else await expect(page.locator('.incentive-region-package-status.is-admin_approved')).toBeVisible()
  })
}
