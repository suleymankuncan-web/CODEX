import { expect, test } from './test-fixtures'
import { installGenericStoreApiFallbacks, installStoreContractSession } from './store-page-contract-fixtures'
import { routeStoreManagerTargetCommand, storeManagerStoreId } from './store-targets-store-manager-command-fixtures'

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-15T09:00:00+03:00'))
  await installStoreContractSession(page, 'storeManager')
  await installGenericStoreApiFallbacks(page)
})

test('AC-TGT-004/005/006: viewed and submission periods are independent and approval marks are persisted', async ({
  page,
}) => {
  await routeStoreManagerTargetCommand(page)
  await page.goto('/store/targets')
  await expect(page.getByRole('heading', { name: 'Mağaza Hedef Dağılımı' })).toBeVisible()
  await expect(page.locator('button.command-canvas-metric')).toHaveCount(0)
  await page.locator('.command-canvas-period-trigger').click()
  await page.locator('.command-canvas-period-popover').getByRole('button', { name: 'Haz' }).click()
  await expect(page.locator('.command-canvas-period-trigger')).toContainText('Haziran 2026')
  await expect(page.locator('.target-entry-period')).toContainText('Temmuz 2026')
  await page.locator('.target-entry-period').getByRole('button').first().click()
  await expect(page.getByRole('button', { name: /Haziran.*Onaylı/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Temmuz.*Durum kaydı yok/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Ağustos.*Onay bekliyor/ })).toBeVisible()
  await page.getByRole('button', { name: /Ağustos/ }).click()
  await expect(page.locator('.target-entry-period')).toContainText('Ağustos 2026')
  await expect(page.locator('.command-canvas-period-trigger')).toContainText('Haziran 2026')
})

test('AC-TGT-007: new distribution submits only when minor-unit balance is zero', async ({ page }) => {
  const api = await routeStoreManagerTargetCommand(page)
  await page.goto('/store/targets')
  await page.getByLabel('Toplam mağaza hedefi').fill('10000000.10049')
  await expect(page.getByLabel('Toplam mağaza hedefi')).toHaveValue('10000000.1004')
  await page.getByLabel('Derya Uslu Aylık hedef').fill('5000000.0502')
  await page.getByLabel('Can Erdem Aylık hedef').fill('5000000.0502')
  await page.getByLabel('Onay notu').fill('Temmuz dağılımı hazırlandı.')
  await page.getByRole('button', { name: 'Onaya gönder' }).click()
  expect(api.payloads).toEqual([
    {
      storeId: storeManagerStoreId,
      requestMonth: '2026-07-01',
      targetLabel: 'Aylık personel hedef dağıtımı',
      totalTargetValue: 10000000.1004,
      requestReason: 'Temmuz dağılımı hazırlandı.',
      allocations: [
        {
          employeeId: 'employee-1',
          assigneeLabel: 'Derya Uslu',
          targetValue: 5000000.0502,
        },
        {
          employeeId: 'employee-2',
          assigneeLabel: 'Can Erdem',
          targetValue: 5000000.0502,
        },
      ],
    },
  ])
})

test('TGT-FR-009: revision-basis loading and failure remain fail-closed', async ({ page }) => {
  const loadingApi = await routeStoreManagerTargetCommand(page, { holdBasis: true })
  await page.goto('/store/targets')
  await expect(page.getByLabel('Toplam mağaza hedefi')).toBeDisabled()
  await expect(page.getByLabel('Derya Uslu Aylık hedef')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Onaya gönder' })).toBeDisabled()
  loadingApi.releaseBasis()
  await expect(page.getByLabel('Toplam mağaza hedefi')).toBeEnabled()
  await page.getByLabel('Toplam mağaza hedefi').fill('10000000')
  await page.getByLabel('Derya Uslu Aylık hedef').fill('5000000')
  await page.getByLabel('Can Erdem Aylık hedef').fill('5000000')
  await expect(page.getByRole('button', { name: 'Onaya gönder' })).toBeEnabled()

  await page.unroute('**/api/target-distributions/revision-basis**')
  await routeStoreManagerTargetCommand(page, { basisError: true, inheritedJune: true })
  await page.locator('.target-entry-period').getByRole('button').first().click()
  await page.getByRole('button', { name: /Haziran.*Onaylı/ }).click()
  await expect(page.getByText('Bazı hedef bilgileri eksik')).toBeVisible()
  await expect(page.getByLabel('Revizyon notu')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Revizyonu gönder' })).toBeDisabled()
})

test('TGT-FR-009: an ambiguous multi-store manager scope fails closed without mutation controls', async ({ page }) => {
  const api = await routeStoreManagerTargetCommand(page, { multipleStores: true })
  await page.goto('/store/targets')
  await expect(page.getByText('Mağaza kapsamı doğrulanamadı')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Onaya gönder' })).toHaveCount(0)
  expect(api.payloads).toEqual([])
})

test('EC-007/009: unsafe lifecycle truth stays visible and non-actionable', async ({ page }) => {
  await routeStoreManagerTargetCommand(page, { statusOverride: 'revision_conflict' })
  await page.goto('/store/targets')
  await expect(page.getByText('Revizyon çakışması')).toBeVisible()
  await expect(page.getByLabel('Toplam mağaza hedefi')).toBeDisabled()
  await expect(page.getByLabel('Derya Uslu Aylık hedef')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Onaya gönder' })).toBeDisabled()
})

test('AC-TGT-008: approved period revision preserves reference and removed-employee payload', async ({ page }) => {
  const api = await routeStoreManagerTargetCommand(page, {
    approvedRequestReason: 'İlk dağıtım notu',
    divergentLocalRequest: true,
  })
  await page.goto('/store/targets')
  await page.locator('.target-entry-period').getByRole('button').first().click()
  await page.getByRole('button', { name: /Haziran.*Onaylı/ }).click()
  await expect.poll(() => api.basisRequests.join('\n')).toContain('requestMonth=2026-06-01')
  await expect(page.getByLabel('Toplam mağaza hedefi')).toHaveValue('9000000')
  await expect(page.getByLabel('Derya Uslu Aylık hedef')).toHaveValue('4000000')
  await expect(page.getByLabel('Can Erdem Aylık hedef')).toHaveValue('4000000')
  await expect(page.getByLabel('Eski Personel Aylık hedef')).toHaveValue('1000000')
  await page.getByLabel('Derya Uslu Aylık hedef').fill('4500000')
  await page.getByLabel('Can Erdem Aylık hedef').fill('4500000')
  await page.getByLabel('Eski Personel Aylık hedef').fill('0')
  await expect(page.getByText('İlk dağıtım notu')).toBeVisible()
  await expect(page.getByLabel('Revizyon notu')).toHaveValue('')
  await expect(page.getByRole('button', { name: 'Revizyonu gönder' })).toBeDisabled()
  await page.getByLabel('Revizyon notu').fill('Ay içi görev değişikliği.')
  await page.getByRole('button', { name: 'Revizyonu gönder' }).click()
  expect(api.payloads[0]).toMatchObject({
    requestMonth: '2026-06-01',
    targetLabel: 'Aylık personel hedef dağıtımı revize',
    requestReason: 'Ay içi görev değişikliği.',
    revision: {
      baseReferenceIds: ['reference-1', 'reference-2', 'reference-3'],
      removedEmployeeIds: ['employee-former'],
    },
  })
})

test('AC-TGT-008: inherited approved basis remains revisable without a local request row', async ({ page }) => {
  const api = await routeStoreManagerTargetCommand(page, {
    inheritedJune: true,
  })
  await page.goto('/store/targets')
  await page.locator('.target-entry-period').getByRole('button').first().click()
  await page.getByRole('button', { name: /Haziran.*Onaylı/ }).click()
  await expect.poll(() => api.basisRequests.join('\n')).toContain('requestMonth=2026-06-01')
  await expect(page.getByLabel('Revizyon notu')).toBeVisible()
  await page.getByLabel('Derya Uslu Aylık hedef').fill('4500000')
  await page.getByLabel('Can Erdem Aylık hedef').fill('4500000')
  await page.getByLabel('Eski Personel Aylık hedef').fill('0')
  await page.getByLabel('Revizyon notu').fill('Devralınan onaylı baz revize edildi.')
  await page.getByRole('button', { name: 'Revizyonu gönder' }).click()
  expect(api.payloads[0]).toMatchObject({
    requestMonth: '2026-06-01',
    totalTargetValue: 9000000,
    targetLabel: 'Aylık personel hedef dağıtımı revize',
    revision: {
      baseReferenceIds: ['reference-1', 'reference-2', 'reference-3'],
      removedEmployeeIds: ['employee-former'],
    },
  })
})

test('EC-018/019/020: mobile distribution stays reachable and inputs do not trigger browser zoom', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await routeStoreManagerTargetCommand(page)
  await page.goto('/store/targets')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
    true,
  )
  expect(
    await page.getByLabel('Derya Uslu Aylık hedef').evaluate((element) => getComputedStyle(element).fontSize),
  ).toBe('16px')
  await expect(page.getByRole('button', { name: 'Onaya gönder' })).toBeVisible()
})

test('EC-005/015: no-personnel and partial states remain honest and actionable', async ({ page }) => {
  await routeStoreManagerTargetCommand(page, {
    noPersonnel: true,
    partial: true,
  })
  await page.goto('/store/targets')
  await expect(page.getByText('Hedef girilebilecek aktif personel bulunmuyor.')).toBeVisible()
  await expect(page.getByText('Bazı hedef bilgileri eksik')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Onaya gönder' })).toBeDisabled()
})

test('EC-016: failed submission preserves the completed distribution draft', async ({ page }) => {
  const api = await routeStoreManagerTargetCommand(page, { failSubmit: true })
  await page.goto('/store/targets')
  await page.getByLabel('Toplam mağaza hedefi').fill('10000000.10')
  await page.getByLabel('Derya Uslu Aylık hedef').fill('5000000.05')
  await page.getByLabel('Can Erdem Aylık hedef').fill('5000000.05')
  const failedResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/target-distributions/requests') &&
      response.request().method() === 'POST' &&
      response.status() === 500,
  )
  await page.getByRole('button', { name: 'Onaya gönder' }).click()
  await failedResponse
  await expect.poll(() => api.payloads.length).toBe(1)
  await expect(page.getByText('Hedef kaydedilemedi.')).toBeVisible()
  await expect(page.getByLabel('Toplam mağaza hedefi')).toHaveValue('10000000.10')
  await expect(page.getByLabel('Derya Uslu Aylık hedef')).toHaveValue('5000000.05')
  await expect(page.getByRole('button', { name: 'Onaya gönder' })).toBeEnabled()
})

test('TGT-NFR-003/EC-015: a failed background refresh preserves the draft but fails writes closed', async ({ page }) => {
  const api = await routeStoreManagerTargetCommand(page)
  await page.goto('/store/targets')
  await page.getByLabel('Toplam mağaza hedefi').fill('10000000')
  await page.getByLabel('Derya Uslu Aylık hedef').fill('5000000')
  await page.getByLabel('Can Erdem Aylık hedef').fill('5000000')
  api.failWorkspaceRefresh()
  await page.getByRole('button', { name: 'Onaya gönder' }).click()

  await expect(page.getByText('Bazı hedef bilgileri eksik')).toBeVisible()
  await expect(page.getByLabel('Toplam mağaza hedefi')).toHaveValue('10000000')
  await expect(page.getByLabel('Derya Uslu Aylık hedef')).toHaveValue('5000000')
  await expect(page.getByLabel('Toplam mağaza hedefi')).toBeDisabled()
  await expect(page.getByLabel('Derya Uslu Aylık hedef')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Onaya gönder' })).toBeDisabled()

  api.restoreWorkspaceRefresh()
  await page.getByRole('button', { name: 'Tekrar dene' }).click()
  await expect(page.getByText('Bazı hedef bilgileri eksik')).toHaveCount(0)
  await expect(page.getByLabel('Toplam mağaza hedefi')).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Onaya gönder' })).toBeEnabled()
})

test('EC-020: long Turkish store and personnel names stay inside the narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await routeStoreManagerTargetCommand(page, { longNames: true })
  await page.goto('/store/targets')
  await expect(
    page.getByRole('heading', {
      name: 'İstanbul Uluslararası Finans ve Yaşam Merkezi Mağazası',
    }),
  ).toBeVisible()
  await expect(page.getByText('Derya Nur Uslu Karahisarlıoğlu')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
    true,
  )
})
