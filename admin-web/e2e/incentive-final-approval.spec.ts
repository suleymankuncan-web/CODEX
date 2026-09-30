import { expect, test } from './test-fixtures'
import { companyId, createStoreContractSession, installGenericStoreApiFallbacks, installStoreContractSession } from './store-page-contract-fixtures'
import { createIncentiveWorkspace, routeIncentiveManagerDirectory, routeIncentiveWorkspace } from './store-incentives-command-fixtures'
import { companyCycleFixture, cyclePeriod, installCompanyCycleSession, sealHash } from './incentive-company-cycle-fixture'

for (const width of [1440, 390]) for (const stage of ['sales_director', 'hr', 'general_manager'] as const) {
  test(`exact sealed company ${stage} decision at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 }); await installCompanyCycleSession(page, stage)
    let detail = companyCycleFixture(stage)
    const requests: Record<string, unknown>[] = []
    const borrowed: string[] = []
    page.on('request', request => { if (/\/incentives\/(workspace|final-approval)/.test(request.url())) borrowed.push(request.url()) })
    await page.route('**/api/store/incentives/company-cycle**', route => {
      if (route.request().method() === 'POST') {
        requests.push(route.request().postDataJSON()); detail = { ...detail, cycle: { ...detail.cycle, stage: stage === 'sales_director' ? 'hr' : stage === 'hr' ? 'general_manager' : 'final' } }
        return route.fulfill({ status: 201, json: { cycleId: 'cycle-1', companyId, period: cyclePeriod, revision: 1, stage: detail.cycle.stage, sealHash, total: '125.00' } })
      }
      return route.fulfill({ json: { items: [detail] } })
    })
    await page.goto('/store/incentives')
    await expect(page.getByRole('heading', { name: 'Primler', exact: true })).toBeVisible()
    await expect(page.getByText('Mühürlü Personel')).toBeVisible(); await expect(page.getByText('Norm katılım gerekçesi')).toBeVisible()
    await expect(page.getByText('Mühürlü tutar gerekçesi')).toBeVisible()
    await expect(page.getByText('Hedef / nihai prim satırı yok')).toBeVisible()
    if (width === 390) {
      const storeCell = await page.getByText('Mühürlü Mağaza').first().boundingBox()
      expect(storeCell?.width).toBeGreaterThan(120)
      expect(storeCell?.height).toBeLessThan(100)
    }
    await page.screenshot({ path: testInfo.outputPath(`company-list-${stage}-${width}.png`), fullPage: true })
    await expect(page.getByRole('button', { name: 'Bordroya teslim et' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Aşamayı onayla' }).click()
    const dialog = page.getByRole('dialog', { name: 'Şirket aşamasını onayla' })
    await expect(dialog).toContainText('Revizyon 1'); await expect(dialog).toContainText('₺125,00')
    await expect(dialog).toContainText(stage === 'general_manager' ? 'Final onayında mühürlü tutar düzeltmeleri uygulanır.' : 'Bu aşamada tutar düzeltmeleri uygulanmaz.')
    expect(requests).toHaveLength(0)
    await page.screenshot({ path: testInfo.outputPath(`company-${stage}-${width}.png`), fullPage: true })
    await dialog.getByRole('button', { name: 'Onayla', exact: true }).click()
    await expect.poll(() => requests.length).toBe(1)
    expect(requests[0]).toEqual({ companyId, period: cyclePeriod, cycleId: 'cycle-1', revision: 1, stage, sealHash, decision: 'approve' })
    await expect(dialog).toHaveCount(0); expect(borrowed).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
}

test('HR-only role cannot borrow another persona or union read-scope company for stage navigation', async ({ page }) => {
  await installCompanyCycleSession(page, 'hr', ['ungranted-persona-company'], [companyId])
  const reads: string[] = []; page.on('request', request => { if (/\/incentives\/(workspace|company-cycle)/.test(request.url())) reads.push(request.url()) })
  await page.goto('/store/incentives')
  await expect(page.getByRole('button', { name: 'Aşamayı onayla' })).toHaveCount(0)
  await expect(page.getByText('Mühürlü Personel')).toHaveCount(0)
  expect(reads).toEqual([])
})

test('company return requires a note and retains the old seal while restarting preparation', async ({ page }) => {
  await installCompanyCycleSession(page, 'hr'); let detail = companyCycleFixture('hr'); const bodies: Record<string, unknown>[] = []
  await page.route('**/api/store/incentives/company-cycle**', route => {
    if (route.request().method() === 'POST') { bodies.push(route.request().postDataJSON()); detail = { ...detail, cycle: { ...detail.cycle, stage: 'preparation' }, decisions: [{ decision_id: 'd1', revision_no: 1, stage: 'hr', decision: 'return', reason_note: 'Katılımı kontrol edin' }] }; return route.fulfill({ status: 201, json: {} }) }
    return route.fulfill({ json: { items: [detail] } })
  })
  await page.goto('/store/incentives'); await page.getByRole('button', { name: 'İade et' }).click()
  const dialog = page.getByRole('dialog', { name: 'Şirket listesini iade et' }); await expect(dialog.getByRole('button', { name: 'Onayla', exact: true })).toBeDisabled()
  await dialog.getByLabel('İade gerekçesi').fill('Katılımı kontrol edin'); await dialog.getByRole('button', { name: 'Onayla', exact: true }).click()
  await expect.poll(() => bodies.length).toBe(1); expect(bodies[0]).toMatchObject({ revision: 1, stage: 'hr', sealHash, decision: 'return', reasonNote: 'Katılımı kontrol edin' })
  await expect(page.getByText('Mühürlü Personel')).toBeVisible(); await expect(page.getByText(/Bölge hazırlığı/)).toBeVisible()
  await page.getByText('Onay geçmişi').click(); await expect(page.getByText(/Katılımı kontrol edin/)).toBeVisible()
})

test('revoked stage permission fails visibly without an automatic retry or stale action', async ({ page }) => {
  await installCompanyCycleSession(page); let revoked = false; const posts: unknown[] = []
  await page.route('**/api/store/incentives/company-cycle**', route => {
    if (route.request().method() === 'POST') { posts.push(route.request().postDataJSON()); revoked = true }
    return route.fulfill(revoked ? { status: 403, json: { message: 'Live capability revoked' } } : { json: { items: [companyCycleFixture()] } })
  })
  await page.goto('/store/incentives'); await page.getByRole('button', { name: 'Aşamayı onayla' }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Onayla', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Onay bilgileri alınamadı' })).toBeVisible(); expect(posts).toHaveLength(1)
  await expect(page.getByRole('button', { name: 'Aşamayı onayla' })).toHaveCount(0)
})

test('legacy final grant remains read-only and cannot offer a pending manager approval', async ({ page }) => {
  await installStoreContractSession(page, 'reportViewer'); await installGenericStoreApiFallbacks(page)
  const session = createStoreContractSession('reportViewer')
  await page.route('**/api/auth/session', route => route.fulfill({ json: { ...session, user: { ...session.user, permissionScopes: { INCENTIVE_FINAL_APPROVAL: { companyIds: [companyId], regionIds: [], storeIds: [] } } } } }))
  const workspace = createIncentiveWorkspace('report_viewer'); workspace.data.managerGroups[0]!.package.status = 'submitted'
  await routeIncentiveWorkspace(page, workspace); await routeIncentiveManagerDirectory(page, workspace)
  await page.route('**/api/store/incentives/final-approval**', route => route.fulfill({ json: { items: [] } }))
  await page.route('**/api/store/incentives/hr-handoff**', route => route.fulfill({ json: { allApproved: false, canSend: false, companies: [] } }))
  await page.goto('/store/incentives'); await expect(page.getByRole('heading', { name: 'Primler', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Paketi onayla|Aşamayı onayla/ })).toHaveCount(0)
})
