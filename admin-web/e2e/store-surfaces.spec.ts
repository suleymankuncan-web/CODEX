import { expect, test, type Locator, type Page } from './test-fixtures'
import { setStoredLocale } from './locale-test-utils'
import { readComputedStyle } from './style-test-utils'

const demoStoreId = '00000000-0000-0000-0000-000000000100'
const demoRegionId = '00000000-0000-0000-0000-000000000010'
const demoEmployeeId = '00000000-0000-0000-0000-000000000202'
const demoPositionId = '44444444-4444-4444-8444-444444444444'
const regionSecondStoreId = '00000000-0000-0000-0000-000000000101'
const outsideStoreId = '00000000-0000-0000-0000-000000000999'

async function selectComboboxOption(page: Page, trigger: Locator, optionName: string | RegExp) {
  const option =
    typeof optionName === 'string'
      ? page.getByRole('option', { name: optionName, exact: true })
      : page.getByRole('option', { name: optionName })
  if ((await option.count()) === 0 || !(await option.first().isVisible())) {
    await trigger.click()
  }
  await option.click()
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'store-me-smoke-user',
        mockRoleCodes: 'STORE_PERSONNEL',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })

  await routeStoreSurfaceApi(page)
})

test('store workforce route is visible for store manager true action scope', async ({ page }) => {
  await routeAuthSession(page, createStoreAuthSession({
    roleCodes: ['STORE_MANAGER'],
    readStoreIds: [demoStoreId],
    scopeStoreIds: [demoStoreId],
    actionStoreIds: [demoStoreId],
    legacyAssignedStoreIds: [],
  }))

  await page.goto('/store/home')

  const workforceLink = page.locator('.store-command-nav').getByRole('link', { name: 'Norm Kadro' })
  await expect(workforceLink).toBeVisible()

  await workforceLink.click()
  await expect(page).toHaveURL(/\/store\/workforce$/)
  await expect(page.getByTestId('store-workforce-page')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Norm Kadro', exact: true })).toBeVisible()
})

test('store workforce route stays hidden for read-scope-only store manager', async ({ page }) => {
  await routeAuthSession(page, createStoreAuthSession({
    roleCodes: ['STORE_MANAGER'],
    readStoreIds: [demoStoreId],
    scopeStoreIds: [demoStoreId],
    actionStoreIds: [],
    legacyAssignedStoreIds: [],
  }))

  await page.goto('/store/home')
  await expect(page.locator('.store-command-nav').getByRole('link', { name: 'Norm Kadro' })).toHaveCount(0)

  await page.goto('/store/workforce')
  await expect(page.getByTestId('store-workforce-page')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: /rota kullan|Route not available/i })).toBeVisible()
})

test('store workforce route stays hidden for reporting users with read scope', async ({ page }) => {
  await routeAuthSession(page, createStoreAuthSession({
    roleCodes: ['REPORT_VIEWER'],
    readStoreIds: [demoStoreId],
    scopeStoreIds: [demoStoreId],
    actionStoreIds: [],
    legacyAssignedStoreIds: [],
  }))

  await page.goto('/store/home')
  await expect(page.locator('.store-command-nav').getByRole('link', { name: 'Norm Kadro' })).toHaveCount(0)

  await page.goto('/store/workforce')
  await expect(page.getByTestId('store-workforce-page')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: /rota kullan|Route not available/i })).toBeVisible()
})

test('store workforce route is visible for region manager read scope', async ({ page }) => {
  await routeAuthSession(page, createStoreAuthSession({
    roleCodes: ['REGION_MANAGER'],
    readStoreIds: [],
    readRegionIds: [demoRegionId],
    scopeStoreIds: [],
    scopeRegionIds: [demoRegionId],
    actionStoreIds: [],
    legacyAssignedStoreIds: [],
  }))

  await page.goto('/store/home')

  const workforceLink = page.locator('.store-command-nav').getByRole('link', { name: 'Norm Kadro' })
  await expect(workforceLink).toBeVisible()

  await workforceLink.click()
  await expect(page).toHaveURL(/\/store\/workforce$/)
  await expect(page.getByTestId('store-workforce-page')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Norm Kadro', exact: true })).toBeVisible()
})

test('store workforce page shows only region manager read-scope rows and opens detail in page', async ({ page }) => {
  const workforceCalls: string[] = []
  await routeAuthSession(page, createStoreAuthSession({
    roleCodes: ['REGION_MANAGER'],
    readStoreIds: [demoStoreId, regionSecondStoreId],
    readRegionIds: [demoRegionId],
    scopeStoreIds: [],
    scopeRegionIds: [demoRegionId],
    actionStoreIds: [],
    legacyAssignedStoreIds: [],
  }))
  await routeRegionWorkforceReadCalls(page, workforceCalls)

  await page.goto('/store/workforce')

  await expect(page.getByTestId('store-workforce-page')).toBeVisible()
  await expect(page.getByText('IstinyePark Demo Store').first()).toBeVisible()
  await expect(page.getByText('Marmara Forum').first()).toBeVisible()
  await expect(page.getByText(outsideStoreId)).toHaveCount(0)
  await expect(page.getByText('Mağaza dosyasını aç')).toHaveCount(0)
  await expect(page.getByText('5 / 1').first()).toBeVisible()
  expect(workforceCalls).toEqual([
    demoStoreId,
    regionSecondStoreId,
  ])

  const firstRow = page.getByTestId('store-workforce-region-row').filter({ hasText: 'IstinyePark Demo Store' })
  await expect(firstRow).not.toHaveAttribute('role', 'button')
  await firstRow.getByRole('button', { name: /Detay|Open detail/i }).click()

  const detail = page.getByTestId('store-workforce-region-detail-dialog')
  await expect(detail).toBeVisible()
  await expect(detail).toContainText('IstinyePark Demo Store')
  await detail.getByRole('button', { name: 'Personel' }).click()
  await expect(detail).toContainText('Store Personnel')
  await expect(page).toHaveURL(/\/store\/workforce$/)
  expect(workforceCalls).toEqual([
    demoStoreId,
    regionSecondStoreId,
  ])
})

test('store workforce region detail stays usable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const workforceCalls: string[] = []
  await routeAuthSession(page, createStoreAuthSession({
    roleCodes: ['REGION_MANAGER'],
    readStoreIds: [demoStoreId],
    readRegionIds: [demoRegionId],
    scopeStoreIds: [],
    scopeRegionIds: [demoRegionId],
    actionStoreIds: [],
    legacyAssignedStoreIds: [],
  }))
  await routeRegionWorkforceReadCalls(page, workforceCalls)

  await page.goto('/store/workforce')
  await page
    .getByTestId('store-workforce-region-row')
    .filter({ hasText: 'IstinyePark Demo Store' })
    .getByRole('button', { name: /Detay|Open detail/i })
    .click()

  await expect(page.getByTestId('store-workforce-region-detail-dialog')).toBeVisible()
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(hasHorizontalOverflow).toBe(false)
  expect(workforceCalls).toEqual([demoStoreId])
})

test('store workforce region command layout stays aligned on compact desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  const workforceCalls: string[] = []
  await routeAuthSession(page, createStoreAuthSession({
    roleCodes: ['REGION_MANAGER'],
    readStoreIds: [demoStoreId, regionSecondStoreId],
    readRegionIds: [demoRegionId],
    scopeStoreIds: [],
    scopeRegionIds: [demoRegionId],
    actionStoreIds: [],
    legacyAssignedStoreIds: [],
  }))
  await routeRegionWorkforceReadCalls(page, workforceCalls)

  await page.goto('/store/workforce')

  await expect(page.getByTestId('store-workforce-region-rows')).toBeVisible()
  const layout = await page.evaluate(() => {
    const ledger = document.querySelector('.swc-ledger')?.getBoundingClientRect()
    const root = document.documentElement.getBoundingClientRect()
    const icon = document.querySelector('.swc-metric-icon')?.getBoundingClientRect()
    const svg = document.querySelector('.swc-metric-icon svg')?.getBoundingClientRect()
    const row = document.querySelector('.swc-store-row')?.getBoundingClientRect()
    const action = document.querySelector('.swc-row-action')?.getBoundingClientRect()

    return {
      hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      ledgerFits: ledger ? ledger.left >= root.left && ledger.right <= root.right : false,
      rowActionFits: row && action ? action.left >= row.left && action.right <= row.right : false,
      rowActionFitsViewport: action ? action.left >= root.left && action.right <= root.right : false,
      metricIconCentered: icon && svg
        ? Math.abs((icon.left + icon.width / 2) - (svg.left + svg.width / 2)) <= 1
          && Math.abs((icon.top + icon.height / 2) - (svg.top + svg.height / 2)) <= 1
        : false,
    }
  })
  expect(layout.hasHorizontalOverflow).toBe(false)
  expect(layout.ledgerFits).toBe(true)
  expect(layout.rowActionFits).toBe(true)
  expect(layout.rowActionFitsViewport).toBe(true)
  expect(layout.metricIconCentered).toBe(true)

  await page
    .getByTestId('store-workforce-region-row')
    .filter({ hasText: 'IstinyePark Demo Store' })
    .getByRole('button', { name: /Detay|Open detail/i })
    .click()

  await expect(page.getByTestId('store-workforce-region-detail-dialog')).toBeVisible()
  const activeTab = await readComputedStyle(page, '.swc-modal-tabs .swc-tab-trigger.active')
  expect(activeTab.backgroundImage).not.toBe('none')
  expect(activeTab.color).not.toBe('rgb(255, 255, 255)')
  expect(workforceCalls).toEqual([
    demoStoreId,
    regionSecondStoreId,
  ])
})

test('store workforce route stays hidden for store personnel', async ({ page }) => {
  await routeAuthSession(page, createStoreAuthSession({
    roleCodes: ['STORE_PERSONNEL'],
    readStoreIds: [demoStoreId],
    scopeStoreIds: [demoStoreId],
    actionStoreIds: [demoStoreId],
    legacyAssignedStoreIds: [demoStoreId],
  }))

  await page.goto('/store/home')
  await expect(page.locator('.store-command-nav').getByRole('link', { name: 'Norm Kadro' })).toHaveCount(0)

  await page.goto('/store/workforce')
  await expect(page.getByTestId('store-workforce-page')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: /rota kullan|Route not available/i })).toBeVisible()
})

test('store workforce page reads store manager personnel and workforce movements', async ({ page }) => {
  await page.route('**/api/workforce/store-employees**', async (route) => {
    await route.fulfill({
      json: {
        ...storeEmployeesFixture,
        items: [...storeEmployeesFixture.items, returnedOffboardingEmployeeFixture],
        meta: { count: 2, total: 2, limit: 50, offset: 0 },
      },
    })
  })
  await page.route('**/api/workforce/seller-code-requests**', async (route) => {
    await route.fulfill({
      json: {
        items: [sellerCodeRequestFixture, rejectedSellerCodeRequestFixture, outsideStoreSellerCodeRequestFixture],
        meta: { count: 2, total: 2, limit: 50, offset: 0 },
      },
    })
  })
  await page.route('**/api/workforce/offboarding-requests**', async (route) => {
    await route.fulfill({
      json: {
        items: [offboardingRequestFixture, returnedOffboardingStatusFixture, outsideStoreOffboardingRequestFixture],
        meta: { count: 2, total: 2, limit: 50, offset: 0 },
      },
    })
  })

  await page.goto('/store/workforce')

  await expect(page.getByTestId('store-workforce-page')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Norm Kadro', exact: true })).toBeVisible()
  const personnelList = page.getByTestId('store-workforce-personnel-list')
  await expect(personnelList.getByText('Store Personnel').first()).toBeVisible()
  await expect(personnelList.getByText('FM8001').first()).toBeVisible()
  await expect(personnelList.getByText('Sales Consultant').first()).toBeVisible()
  await expect(personnelList.getByText(/1.*Nis.*2026/).first()).toBeVisible()
  const returnedOffboardingRow = personnelList.locator('tr').filter({ hasText: 'Returned Offboarding Personnel' })
  const returnedOffboardingStatus = returnedOffboardingRow.getByTestId('store-workforce-personnel-row-status')
  await expect(returnedOffboardingStatus).toHaveText('Aktif')
  await expect(page.getByText('Personel talep hareketleri')).toBeVisible()
  await expect(page.getByText('Outside Store')).toHaveCount(0)
  await expect(page.getByText('Outside Personnel')).toHaveCount(0)
  await expect(page.getByText('TC numarasi tekrar kontrol edilmeli')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Yeni personel' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Çıkış talebi' })).toBeVisible()
  await expect(page.getByTestId('store-workforce-request-workbench')).toHaveCount(0)
})

test('store workforce page keeps the store manager surface usable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })

  await page.goto('/store/workforce')

  await expect(page.getByTestId('store-workforce-page')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Norm Kadro', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Yeni personel' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Çıkış talebi' })).toBeVisible()
  await expect(page.getByTestId('store-workforce-personnel-list')).toBeVisible()

  const hasHorizontalOverflow = await page.evaluate(() => {
    const root = document.documentElement
    return root.scrollWidth > root.clientWidth + 1
  })
  expect(hasHorizontalOverflow).toBe(false)
})

test('store workforce page submits seller code requests with the existing payload shape', async ({ page }) => {
  let capturedPayload: unknown = null

  await page.route('**/api/workforce/seller-code-requests**', async (route) => {
    const request = route.request()

    if (request.method() === 'POST') {
      capturedPayload = request.postDataJSON()
      expect(capturedPayload).toEqual({
        storeId: demoStoreId,
        requestType: 'create_code',
        firstName: 'Ayse',
        lastName: 'Yilmaz',
        nationalId: '12345678901',
        phoneNumber: '05551234567',
        hireDate: '2026-05-01',
        requestedPositionId: demoPositionId,
        employmentType: 'full_time',
        requestReason: 'Yeni personel',
      })

      await route.fulfill({
        json: {
          command: {
            status: 'accepted',
            message: 'Seller code request submitted for HR approval',
          },
          data: {
            request: sellerCodeRequestFixture,
          },
        },
      })
      return
    }

    await route.fulfill({
      json: {
        items: [],
        meta: { count: 0, total: 0, limit: 50, offset: 0 },
      },
    })
  })

  await page.goto('/store/workforce')
  await page.getByRole('button', { name: 'Yeni personel' }).click()

  const sellerCodeForm = page.getByLabel(/Sat.*kodu.*formu/i)
  await expect(sellerCodeForm.getByRole('heading', { name: /Sat.*kodu.*talebi/i })).toBeVisible()
  await sellerCodeForm.getByLabel('Ad', { exact: true }).fill('Ayse')
  await sellerCodeForm.getByLabel('Soyad', { exact: true }).fill('Yilmaz')
  await sellerCodeForm.getByLabel('TC kimlik no').fill('12345678901')
  await sellerCodeForm.getByLabel(/Telefon/i).fill('05551234567')
  await sellerCodeForm.getByLabel(/giri.*tarihi/i).fill('2026-05-01')
  const positionSelect = sellerCodeForm.getByRole('combobox', { name: 'Pozisyon' })
  await selectComboboxOption(page, positionSelect, 'Satış Danışmanı')
  await sellerCodeForm.getByLabel('Talep nedeni').fill('Yeni personel')
  await sellerCodeForm.getByRole('button', { name: /g.*nder/i }).click()

  await expect(page.getByText('Seller code request submitted for HR approval')).toBeVisible()
  expect(capturedPayload).not.toBeNull()
})

test('store workforce page submits offboarding requests with the existing payload shape', async ({ page }) => {
  let capturedPayload: unknown = null

  await page.route('**/api/workforce/offboarding-requests**', async (route) => {
    const request = route.request()

    if (request.method() === 'POST') {
      capturedPayload = request.postDataJSON()
      expect(capturedPayload).toEqual({
        storeId: demoStoreId,
        employeeId: demoEmployeeId,
        terminationDate: '2026-05-10',
        terminationReason: 'Personel istifa etti',
        requestReason: 'Personel istifa etti',
      })

      await route.fulfill({
        json: {
          command: {
            status: 'accepted',
            message: 'Offboarding request submitted for HR approval',
          },
          data: {
            request: offboardingRequestFixture,
          },
        },
      })
      return
    }

    await route.fulfill({
      json: {
        items: [],
        meta: { count: 0, total: 0, limit: 50, offset: 0 },
      },
    })
  })

  await page.goto('/store/workforce')
  await page.getByRole('button', { name: 'Çıkış talebi' }).click()

  const offboardingForm = page.getByLabel(/Personel.*talebi formu/i)
  const employeeSelect = offboardingForm.getByRole('combobox', { name: 'Personel' })
  await selectComboboxOption(page, employeeSelect, /Store Personnel/)
  await offboardingForm.getByLabel(/tarihi/i).fill('2026-05-10')
  await offboardingForm.getByLabel('Talep nedeni').fill('Personel istifa etti')
  await offboardingForm.getByRole('button', { name: /g.*nder/i }).click()

  await expect(page.getByText('Offboarding request submitted for HR approval')).toBeVisible()
  expect(capturedPayload).not.toBeNull()
})

test('store workforce page keeps returned request resubmit identity and payload parity', async ({ page }) => {
  const capturedSellerPayloads: unknown[] = []
  const capturedOffboardingPayloads: unknown[] = []
  const capturedPatchPaths: string[] = []

  await page.route('**/api/workforce/seller-code-requests**', async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname

    if (request.method() === 'PATCH' && pathname.endsWith('/resubmit')) {
      capturedPatchPaths.push(pathname)
      const body = request.postDataJSON()
      capturedSellerPayloads.push(body)
      expect(pathname).toContain(rejectedSellerCodeRequestFixture.requestId)
      expect(body).toEqual({
        firstName: 'Ayse',
        lastName: 'Yilmaz',
        nationalId: '12345678902',
        phoneNumber: '05551234567',
        hireDate: '2026-05-02',
        requestedPositionId: demoPositionId,
        employmentType: 'full_time',
        requestReason: 'TC guncellendi',
      })
      await route.fulfill({
        json: {
          command: {
            status: 'resubmitted',
            message: 'Seller code request resubmitted for HR approval',
          },
          data: {
            request: {
              ...rejectedSellerCodeRequestFixture,
              status: 'pending_hr_approval',
              nationalIdLast4: '8902',
              hireDate: '2026-05-02',
              reviewNote: null,
            },
          },
        },
      })
      return
    }

    await route.fulfill({
      json: {
        items: [rejectedSellerCodeRequestFixture, outsideStoreRejectedSellerCodeRequestFixture],
        meta: { count: 1, total: 1, limit: 50, offset: 0 },
      },
    })
  })

  await page.route('**/api/workforce/offboarding-requests**', async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname

    if (request.method() === 'PATCH' && pathname.endsWith('/resubmit')) {
      capturedPatchPaths.push(pathname)
      const body = request.postDataJSON()
      capturedOffboardingPayloads.push(body)
      expect(pathname).toContain(rejectedOffboardingRequestFixture.requestId)
      expect(body).toEqual({
        employeeId: demoEmployeeId,
        terminationDate: '2026-05-12',
        terminationReason: 'Tarih ve sebep guncellendi',
        requestReason: 'Tarih ve sebep guncellendi',
      })
      await route.fulfill({
        json: {
          command: {
            status: 'resubmitted',
            message: 'Offboarding request resubmitted for HR approval',
          },
          data: {
            request: {
              ...rejectedOffboardingRequestFixture,
              status: 'pending_hr_approval',
              terminationDate: '2026-05-12',
              terminationReason: 'Tarih ve sebep guncellendi',
              requestReason: 'Tarih ve sebep guncellendi',
              reviewNote: null,
            },
          },
        },
      })
      return
    }

    await route.fulfill({
      json: {
        items: [rejectedOffboardingRequestFixture, outsideStoreRejectedOffboardingRequestFixture],
        meta: { count: 1, total: 1, limit: 50, offset: 0 },
      },
    })
  })

  await page.goto('/store/workforce')
  await page.getByRole('button', { name: /ade.*kay/i }).click()
  await expect(page.getByText('TC numarasi tekrar kontrol edilmeli')).toBeVisible()
  await expect(page.getByText('Cikis tarihi tekrar kontrol edilmeli')).toBeVisible()
  await expect(page.getByText('Outside store correction')).toHaveCount(0)
  await expect(page.getByText('Outside offboarding correction')).toHaveCount(0)

  await page.getByRole('button', { name: /Sat.*kodu.*d.*zenle/i }).click()
  const sellerCodeForm = page.getByLabel(/Sat.*kodu.*formu/i)
  await expect(sellerCodeForm.getByLabel('Ad', { exact: true })).toHaveValue('Ayse')
  await sellerCodeForm.getByLabel('TC kimlik no').fill('12345678902')
  await sellerCodeForm.getByLabel(/giri.*tarihi/i).fill('2026-05-02')
  await sellerCodeForm.getByLabel('Talep nedeni').fill('TC guncellendi')
  await sellerCodeForm.getByRole('button', { name: /yeniden.*g.*nder/i }).click()
  await expect(page.getByText('Seller code request resubmitted for HR approval')).toBeVisible()

  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /ade.*kay/i }).click()
  await page.getByRole('button', { name: /Personel.*d.*zenle/i }).click()
  const offboardingForm = page.getByLabel(/Personel.*talebi formu/i)
  await offboardingForm.getByLabel(/tarihi/i).fill('2026-05-12')
  await offboardingForm.getByLabel('Talep nedeni').fill('Tarih ve sebep guncellendi')
  await offboardingForm.getByRole('button', { name: /yeniden.*g.*nder/i }).click()
  await expect(page.getByText('Offboarding request resubmitted for HR approval')).toBeVisible()

  expect(capturedSellerPayloads).toHaveLength(1)
  expect(capturedOffboardingPayloads).toHaveLength(1)
  expect(capturedPatchPaths).toEqual([
    `/api/workforce/seller-code-requests/${rejectedSellerCodeRequestFixture.requestId}/resubmit`,
    `/api/workforce/offboarding-requests/${rejectedOffboardingRequestFixture.requestId}/resubmit`,
  ])
})

test('store self-performance page renders live score, metrics, and ranks', async ({ page }) => {
  await page.goto('/store/me')

  await expect(page.locator('[data-testid="store-me-page"]')).toBeVisible()
  await expect(page.getByRole('heading', { name: /Store Personnel · IstinyePark Demo Store/i })).toBeVisible()
  await expect(page.locator('.store-me-plum-dashboard')).toBeVisible()
  await expect(page.locator('.store-me-kpi-grid')).toBeVisible()
  await expect(page.locator('.store-me-line-chart')).toBeVisible()
  await expect(page.locator('.store-me-score-breakdown')).toBeVisible()
  await expect(page.locator('.store-me-quote-card')).toBeVisible()
  await expect(page.getByText('Mağaza', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Bölge', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Türkiye', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Bugün Yapılacaklar')).toBeVisible()
  await expect(page.locator('#store-me-actions').getByText(/Ritmi koru|HG% çizgisini kapat/)).toBeVisible()
  await expect(page.getByText('Gelişim çizgisi')).toBeVisible()
  await expect(page.getByText('Hedef gerçekleşme barı')).toBeVisible()
  await expect(page.getByText('Skor kırılımı')).toBeVisible()
  await expect(page.getByText('Aynı dönem farkı')).toBeVisible()
  await expect(page.getByRole('button', { name: /Tarih filtresi/i })).toBeVisible()
  await page.getByRole('button', { name: 'KPI detayları' }).click()
  const kpiDetailsDialog = page.getByRole('dialog', { name: /ay ay performansı/i })
  await expect(kpiDetailsDialog).toBeVisible()
  await expect(kpiDetailsDialog).toContainText('Nisan 2026')
  await expect(kpiDetailsDialog).toContainText('Mayıs 2026')
  await expect(kpiDetailsDialog).not.toContainText('CR')
  await expect(page.locator('[data-testid="store-me-metric-card"]')).toHaveCount(3)
  await expect(page.locator('[data-testid="store-me-metric-card"]').filter({ hasText: 'UPT' })).toBeVisible()
  await expect(page.locator('[data-testid="store-me-metric-card"]').filter({ hasText: 'ATV' })).toBeVisible()
  await expect(page.locator('[data-testid="store-me-metric-card"]').filter({ hasText: 'HG%' })).toBeVisible()
  await expect(page.locator('.store-metric-grid')).toHaveCount(0)
  await expect(page.locator('.stacked-row')).toHaveCount(0)
  await expect(page.locator('.store-hero-panel')).toHaveCount(0)
  await expect(page.locator('.store-me-score-card')).toHaveCount(0)
  await expect(page.locator('.store-me-action-panel')).toHaveCount(0)
  await expect(page.getByText('Skor yorumu')).toHaveCount(0)
  await expect(page.getByText('Veri kaynağı')).toHaveCount(0)
  await expect(page.getByText('Hedef bazlı skor')).toHaveCount(0)
  await expect(page.getByText('TARGET_ACHIEVEMENT')).toHaveCount(0)
  await expect(page.getByText('Weighted score')).toHaveCount(0)
  await expect(page.getByText('Turkey ranking')).toHaveCount(0)
  await expect(page.getByText('Store ranking')).toHaveCount(0)
  await expect(page.getByText('Resolved Session')).toHaveCount(0)
  await expect(page.getByText('Source mode')).toHaveCount(0)
  await expect(page.getByText('Snapshot run')).toHaveCount(0)
  await expect(page.getByText('Grade')).toHaveCount(0)
  await expect(page.getByText('Excellent')).toHaveCount(0)
  await expect(page.getByText('Pending')).toHaveCount(0)
  await expect(page.getByText('Missing')).toHaveCount(0)
  await expect(page.getByText('Route')).toHaveCount(0)
  await expect(page.getByText('Persona')).toHaveCount(0)
  await expect(page.getByText('Benim performansim')).toHaveCount(0)
  await expect(page.getByText('Performans ozeti')).toHaveCount(0)
  await expect(page.getByText('Donem performansi')).toHaveCount(0)
  await expect(page.getByText('Turkiye siram')).toHaveCount(0)
  await expect(page.getByText('Magaza ici siram')).toHaveCount(0)
  await expect(page.getByText('Hedef girisi')).toHaveCount(0)
  await expect(page.getByText('Mukemmel')).toHaveCount(0)
  await expect(page.getByText('Veri guveni')).toHaveCount(0)
  await expect(page.getByText('Veri kaynagi')).toHaveCount(0)
  await expect(page.getByText('Gerceklesen')).toHaveCount(0)
  await expect(page.getByText('Basari')).toHaveCount(0)
  await expect(page.getByText('Performans yüzeyi açılamadı')).toHaveCount(0)
})

test('store self-performance does not treat raw net sales as HG percent when target is missing', async ({ page }) => {
  const missingTargetFixture = {
    ...myPerformanceFixture,
    score: {
      value: 58.2,
      matchedMetrics: 2,
      totalMetrics: 3,
    },
    partial: {
      isPartial: true,
      missingMetricCodes: [],
      missingMetricLabels: [],
      pendingNormalizationCodes: ['TARGET_ACHIEVEMENT'],
      pendingNormalizationLabels: ['Target Achievement'],
    },
    supporting: {
      ...myPerformanceFixture.supporting,
      netSalesValue: 92002.02,
    },
    metrics: myPerformanceFixture.metrics.map((metric) =>
      metric.code === 'TARGET_ACHIEVEMENT'
        ? {
            ...metric,
            actualValue: 92002.02,
            targetValue: null,
            achievementRate: null,
            actualRatio: null,
            scoredRatio: null,
            contributionValue: 0,
            dataStatus: 'reported',
            scoreStatus: 'missing_reference',
            missingReason: 'personnel_target_missing',
          }
        : metric,
    ),
  }

  await page.unroute('**/api/reports/my-performance**')
  await page.route('**/api/reports/my-performance**', async (route) => {
    await route.fulfill({ json: missingTargetFixture })
  })

  await page.goto('/store/me')

  await expect(page.getByText(/Hedefin %0/)).toBeVisible()
  await expect(page.locator('[data-testid="store-me-target-progress-card"]')).toContainText('Hedef bekleniyor')
  await expect(page.locator('[data-testid="store-me-target-progress-card"]')).toContainText('Veri yok')
  await expect(page.locator('[data-testid="store-me-metric-card"]').filter({ hasText: 'HG%' })).toContainText('Eksik referans')
  await expect(page.getByText(/9\.200\.202%/)).toHaveCount(0)

  await page.getByRole('button', { name: /KPI detay/i }).click()
  await expect(page.locator('[data-testid="store-me-kpi-dialog"]')).not.toContainText(/9\.200\.202%/)
})

test('store self-performance displays target achievement above one hundred percent', async ({ page }) => {
  const aboveTargetFixture = {
    ...myPerformanceFixture,
    supporting: {
      ...myPerformanceFixture.supporting,
      netSalesValue: 136000,
    },
    metrics: myPerformanceFixture.metrics.map((metric) =>
      metric.code === 'TARGET_ACHIEVEMENT'
        ? {
            ...metric,
            actualValue: 1.36,
            achievementRate: 1.36,
            contributionValue: 40,
          }
        : metric,
    ),
  }

  await page.unroute('**/api/reports/my-performance**')
  await page.route('**/api/reports/my-performance**', async (route) => {
    await route.fulfill({ json: aboveTargetFixture })
  })

  await page.goto('/store/me')

  const targetProgressCard = page.locator('[data-testid="store-me-target-progress-card"]')
  await expect(targetProgressCard).toContainText('%136')
  await expect(targetProgressCard).toContainText('136%')
  await expect(targetProgressCard).not.toContainText('%100')
})

test('store self-performance tolerates ISO period timestamps from live API', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error.message)
  })
  const availablePeriods = [
    {
      periodType: 'monthly',
      periodStart: '2026-04-01T00:00:00.000Z',
      periodEnd: '2026-04-30T00:00:00.000Z',
    },
    {
      periodType: 'monthly',
      periodStart: '2026-05-01T00:00:00.000Z',
      periodEnd: '2026-05-31T00:00:00.000Z',
    },
  ]
  const isoAprilFixture = {
    ...myPerformanceFixture,
    period: {
      periodStart: '2026-04-01T00:00:00.000Z',
      periodEnd: '2026-04-30T00:00:00.000Z',
    },
    availablePeriods,
  }
  const isoMayFixture = {
    ...myPerformanceMayFixture,
    period: {
      periodStart: '2026-05-01T00:00:00.000Z',
      periodEnd: '2026-05-31T00:00:00.000Z',
    },
    availablePeriods,
  }

  await page.unroute('**/api/reports/my-performance**')
  await page.route('**/api/reports/my-performance**', async (route) => {
    const requestUrl = new URL(route.request().url())
    await route.fulfill({
      json: requestUrl.searchParams.get('periodStart')?.startsWith('2026-05-01')
        ? isoMayFixture
        : isoAprilFixture,
    })
  })

  await page.goto('/store/me')

  await expect(page.locator('[data-testid="store-me-page"]')).toBeVisible()
  await page.getByRole('button', { name: /KPI detayları/i }).click()
  const kpiDetailsDialog = page.getByRole('dialog', { name: /ay ay performansı/i })
  await expect(kpiDetailsDialog).toBeVisible()
  await expect(kpiDetailsDialog).toContainText('Nisan 2026')
  await expect(kpiDetailsDialog).toContainText('Mayıs 2026')
  expect(pageErrors).toEqual([])
})

test('store self-performance requests exact loaded day without inventing unloaded days', async ({ page }) => {
  const myPerformanceRequests: URL[] = []
  const loadedPeriods = [
    {
      periodType: 'monthly',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
    },
    {
      periodType: 'monthly',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
    },
    {
      periodType: 'daily',
      periodStart: '2026-04-24',
      periodEnd: '2026-04-24',
    },
    {
      periodType: 'daily',
      periodStart: '2026-04-25',
      periodEnd: '2026-04-25',
    },
  ]

  await page.unroute('**/api/reports/my-performance**')
  await page.route('**/api/reports/my-performance**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const requestedPeriodStart = requestUrl.searchParams.get('periodStart')
    myPerformanceRequests.push(requestUrl)

    if (requestUrl.searchParams.get('periodType') === 'daily') {
      const periodStart = requestedPeriodStart || '2026-04-25'
      await route.fulfill({
        json: {
          ...myPerformanceFixture,
          period: {
            periodStart,
            periodEnd: periodStart,
          },
          score: {
            value: periodStart === '2026-04-24' ? 88.4 : 89.1,
            matchedMetrics: 3,
            totalMetrics: 3,
          },
          availablePeriods: loadedPeriods,
        },
      })
      return
    }

    await route.fulfill({
      json: {
        ...myPerformanceFixture,
        availablePeriods: loadedPeriods,
      },
    })
  })

  await page.goto('/store/me')
  await page.locator('button[aria-expanded]').first().click()
  await page.getByRole('radio', { name: /^G.*n$/ }).click()

  const calendar = page.locator('[data-slot="calendar"]')
  await expect(calendar).toBeVisible()
  await expect(calendar.locator('button[data-day="4/24/2026"]')).toBeEnabled()
  await expect(calendar.locator('button[data-day="4/25/2026"]')).toBeEnabled()
  await expect(calendar.locator('button[data-day="4/26/2026"]')).toBeDisabled()
  await calendar.locator('button[data-day="4/24/2026"]').click()

  await expect.poll(() =>
    myPerformanceRequests.some(
      (requestUrl) =>
        requestUrl.searchParams.get('periodType') === 'daily' &&
        requestUrl.searchParams.get('periodStart') === '2026-04-24',
    ),
  ).toBe(true)
  await expect(page.locator('[data-testid="store-me-period-pill"]')).toHaveText('24 Nis 2026 - 24 Nis 2026')

  await page.getByRole('button', { name: /KPI detay/i }).click()
  await expect(page.getByRole('dialog', { name: /ay ay performans/i })).toContainText('24 Nis 2026')
})

test('store self-performance switches to English copy and persists locale', async ({ page }) => {
  await page.goto('/store/me')

  await setStoredLocale(page, 'en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('[data-testid="store-me-page"]')).toBeVisible()
  await expect(page.getByRole('heading', { name: /Store Personnel · IstinyePark Demo Store/i })).toBeVisible()
  await expect(page.locator('.store-me-plum-dashboard')).toBeVisible()
  await expect(page.locator('.store-me-kpi-grid')).toBeVisible()
  await expect(page.locator('.store-me-line-chart')).toBeVisible()
  await expect(page.locator('.store-me-score-breakdown')).toBeVisible()
  await expect(page.getByText("Today's Actions")).toBeVisible()
  await expect(page.locator('#store-me-actions').getByText(/Maintain the rhythm|Close the HG% gap/)).toBeVisible()
  await expect(page.getByText('Progress line')).toBeVisible()
  await expect(page.getByText('Target achievement bar')).toBeVisible()
  await expect(page.getByText('Score breakdown')).toBeVisible()
  await expect(page.getByText('Same-period difference')).toBeVisible()
  await expect(page.getByText('Score meaning')).toHaveCount(0)
  await expect(page.getByText('Data source')).toHaveCount(0)
  await expect(page.getByText('Target-based score')).toHaveCount(0)
  await expect(page.getByText('Actual')).toBeVisible()
  await expect(page.getByText('Achievement', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Benim performansım')).toHaveCount(0)
  await expect(page.getByText('Performans özeti')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ã')
  await expect(page.locator('body')).not.toContainText('Ä')
  await expect(page.locator('body')).not.toContainText('Å')

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('[data-testid="store-me-page"]')).toBeVisible()
})

test('store self-performance handles live no-data responses without supporting metadata', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error.message)
  })

  const myPerformanceWithoutSupporting: Record<string, unknown> = {
    ...myPerformanceFixture,
    employee: {
      employeeId: demoEmployeeId,
      displayName: 'Unknown employee',
      storeId: null,
      storeName: null,
    },
    period: null,
    score: {
      value: 0,
      matchedMetrics: 0,
      totalMetrics: 3,
    },
    rankings: {
      turkeyRank: null,
      turkeyPopulation: 0,
      storeRank: null,
      storePopulation: 0,
    },
    availablePeriods: [],
    partial: {
      isPartial: true,
      missingMetricCodes: ['TARGET_ACHIEVEMENT', 'ATV', 'UPT'],
      missingMetricLabels: ['Target Achievement', 'Average Ticket Value', 'Units Per Ticket'],
      pendingNormalizationCodes: [],
      pendingNormalizationLabels: [],
    },
    metrics: [
      {
        code: 'TARGET_ACHIEVEMENT',
        label: 'Target Achievement',
        weightPercent: 40,
        actualValue: null,
        contributionValue: 0,
        dataStatus: 'missing',
        scoreStatus: 'missing',
        status: 'missing',
      },
      {
        code: 'ATV',
        label: 'Average Ticket Value',
        weightPercent: 30,
        actualValue: null,
        contributionValue: 0,
        dataStatus: 'missing',
        scoreStatus: 'missing',
        status: 'missing',
      },
      {
        code: 'UPT',
        label: 'Units Per Ticket',
        weightPercent: 30,
        actualValue: null,
        contributionValue: 0,
        dataStatus: 'missing',
        scoreStatus: 'missing',
        status: 'missing',
      },
    ],
  }
  delete myPerformanceWithoutSupporting.supporting

  await page.unroute('**/api/reports/my-performance**')
  await page.route('**/api/reports/my-performance**', async (route) => {
    await route.fulfill({ json: myPerformanceWithoutSupporting })
  })

  await page.goto('/store/me')

  await expect(page.locator('[data-testid="store-me-page"]')).toBeVisible()
  await expect(page.getByText('Eksik veri var')).toBeVisible()
  await expect(page.getByText('Bu skor şu an kısmi veriyle hesaplanıyor')).toBeVisible()
  await expect(page.getByText('Performans yüzeyi açılamadı')).toHaveCount(0)
  expect(pageErrors).toEqual([])
})

test('store self-performance closed mode uses readable snapshot labels', async ({ page }) => {
  await page.goto('/store/me')
  await page.getByRole('button', { name: /Tarih filtresi/i }).click()
  await page.getByRole('radio', { name: 'Kapanmış gün' }).click()
  await page.getByRole('combobox').click()

  await expect(
    page.getByRole('option', {
      name: /24 Nis 2026 kapanışı/,
    }),
  ).toBeVisible()
})

test('store KPI highlights page explains metric source semantics', async ({ page }) => {
  await page.unroute('**/api/reports/rankings**')
  await page.unroute('**/api/reports/store-kpi-highlights**')
  await page.route('**/api/reports/store-kpi-highlights**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const isMay = requestUrl.searchParams.get('periodStart') === '2026-05-01'

    await route.fulfill({
      json: {
        ...storeKpiHighlightsFixture,
        period: isMay
          ? {
              periodStart: '2026-05-01',
              periodEnd: '2026-05-31',
            }
          : storeKpiHighlightsFixture.period,
        availablePeriods: [
          {
            periodType: 'monthly',
            periodStart: '2026-04-01',
            periodEnd: '2026-04-30',
          },
          {
            periodType: 'monthly',
            periodStart: '2026-05-01',
            periodEnd: '2026-05-31',
          },
        ],
        metrics: isMay
          ? storeKpiHighlightsFixture.metrics.map((metric) =>
              metric.code === 'TARGET_ACHIEVEMENT'
                ? {
                    ...metric,
                    actualValue: 0.8,
                    achievementRate: 0.8,
                    scoreContribution: 56,
                    statusBand: 'at_risk',
                  }
                : {
                    ...metric,
                    actualValue: 0.9,
                    achievementRate: 0.9,
                    scoreContribution: 27,
                    statusBand: 'at_risk',
                  },
            )
          : storeKpiHighlightsFixture.metrics,
      },
    })
  })
  await page.route('**/api/reports/rankings**', async (route) => {
    await route.fulfill({
      json: {
        ...rankingsFixture,
        personnelLeaderboard: {
          ...rankingsFixture.personnelLeaderboard,
          items: [
            {
              ...personnelRankingSummaryRow,
              employeeId: 'global-personnel-001',
              displayName: 'Global Top Personnel',
              storeId: 'outside-store',
              storeName: 'Outside Store',
              canOpenProfile: false,
              metrics: undefined,
            },
          ],
          managedStorePersonnel: [
            {
              ...personnelRankingRawTargetRow,
              metrics: personnelRankingRawTargetRow.metrics.map((metric) =>
                metric.code === 'TARGET_ACHIEVEMENT'
                  ? {
                      ...metric,
                      targetValue: null,
                      benchmarkValue: null,
                    }
                  : metric,
              ),
            },
          ],
        },
      },
    })
  })

  await page.goto('/store/kpis')

  await expect(page.getByRole('heading', { name: 'IstinyePark Demo Store' })).toBeVisible()
  await expect(page.getByText('Store KPI', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /KPI/ }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Personel KPI' })).toBeVisible()
  await expect(page.getByText('104,6').first()).toBeVisible()
  await expect(page.getByText(/KPI config/)).toBeVisible()
  await expect(page.getByText('Takip gerekli')).toBeVisible()
  await expect(page.getByText('GSM Onayı').first()).toBeVisible()
  await expect(page.getByText(/Problem/)).toBeVisible()
  await expect(page.getByText(/Hedef/).first()).toBeVisible()
  await expect(page.getByText('BM checklist').first()).toBeVisible()
  await expect(page.getByText('VM checklist').first()).toBeVisible()
  await expect(page.getByText(/Yap/).first()).toBeVisible()
  await expect(page.getByText(/skor trendi/i)).toBeVisible()
  await expect(page.getByText('Nis', { exact: true })).toBeVisible()
  await expect(page.getByText('May', { exact: true })).toBeVisible()
  await expect(page.getByText('83')).toBeVisible()

  await page.getByRole('button', { name: 'Personel KPI' }).click()

  await expect(page.getByRole('heading', { name: 'Personel KPI' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Katkı' })).toBeVisible()
  await expect(page.getByRole('row', { name: /Store Personnel - 1/ })).toContainText('Hedef bekleniyor')
  await expect(page.getByRole('row', { name: /Store Personnel - 1/ }).getByRole('link', { name: /Profil/ })).toHaveAttribute(
    'href',
    new RegExp(`/store/personnel/${demoEmployeeId}\\?mode=live&periodType=monthly&periodStart=2026-04-01`),
  )
  await expect(page.getByText('Global Top Personnel')).toHaveCount(0)
  await expect(page.getByText(/Skor kayna/)).toBeVisible()
  await expect(page.getByText('Personel KPI etkisi')).toBeVisible()
  await expect(page.getByText('Store KPI Highlights')).toHaveCount(0)
  await expect(page.getByText('Store skor yorumu')).toHaveCount(0)
  await expect(page.getByText('Weighted Score Summary')).toHaveCount(0)
  await expect(page.getByText('Current Context')).toHaveCount(0)
  await expect(page.getByText('Top Signal')).toHaveCount(0)
  await expect(page.getByText('Ownership Matrix')).toHaveCount(0)
  await expect(page.getByText('Priority Follow-Up')).toHaveCount(0)
  await expect(page.getByText('Needs attention')).toHaveCount(0)
  await expect(page.getByText('Configured blend')).toHaveCount(0)
  await expect(page.getByText('Effective blend')).toHaveCount(0)
  await expect(page.getByText('KPI rows unavailable')).toHaveCount(0)

  await page.getByRole('button', { name: /Kapan/ }).click()
  await expect(page.getByText('Store Personnel - 1')).toHaveCount(0)
  await expect(page.getByText('Global Top Personnel')).toHaveCount(0)
})

test('store KPI live checklist impact uses completed BM and VM visits from highlights', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
  })

  await page.unroute('**/api/reports/kpi-config')
  await page.unroute('**/api/reports/store-kpi-highlights**')

  await page.route('**/api/reports/kpi-config', async (route) => {
    await route.fulfill({
      json: {
        ...kpiConfigFixture,
        storeProfile: {
          ...kpiConfigFixture.storeProfile,
          metrics: [
            {
              code: 'TARGET_ACHIEVEMENT',
              label: 'Target Achievement',
              weightPercent: 90,
              ownerRole: 'STORE_MANAGER',
              scoreBehavior: 'score_only',
            },
            {
              code: 'BM_CHECKLIST',
              label: 'BM Checklist',
              weightPercent: 5,
              ownerRole: 'REGION_MANAGER',
              scoreBehavior: 'score_only',
            },
            {
              code: 'VM_CHECKLIST',
              label: 'VM Checklist',
              weightPercent: 5,
              ownerRole: 'VISUAL_TEAM',
              scoreBehavior: 'score_only',
            },
          ],
        },
      },
    })
  })

  await page.route('**/api/reports/store-kpi-highlights**', async (route) => {
    await route.fulfill({
      json: {
        ...storeKpiHighlightsFixture,
        score: {
          value: 99,
          matchedMetrics: 3,
          totalMetrics: 3,
        },
        metrics: [
          {
            code: 'TARGET_ACHIEVEMENT',
            label: 'Target Achievement',
            weightPercent: 90,
            actualValue: 1,
            targetValue: 1,
            achievementRate: 1,
            actualRatio: 1,
            scoredRatio: 1,
            capRatio: 1.2,
            isCapped: false,
            scoreContribution: 90,
            statusBand: 'exceeded',
            dataStatus: 'reported',
            scoreStatus: 'scored',
          },
          {
            code: 'BM_CHECKLIST',
            label: 'BM Checklist',
            weightPercent: 5,
            actualValue: 80,
            targetValue: 100,
            achievementRate: 0.8,
            actualRatio: 0.8,
            scoredRatio: 0.8,
            capRatio: 1,
            isCapped: false,
            scoreContribution: 4,
            statusBand: 'on_track',
            dataStatus: 'reported',
            scoreStatus: 'scored',
          },
          {
            code: 'VM_CHECKLIST',
            label: 'VM Checklist',
            weightPercent: 5,
            actualValue: 100,
            targetValue: 100,
            achievementRate: 1,
            actualRatio: 1,
            scoredRatio: 1,
            capRatio: 1,
            isCapped: false,
            scoreContribution: 5,
            statusBand: 'exceeded',
            dataStatus: 'reported',
            scoreStatus: 'scored',
          },
        ],
      },
    })
  })

  await page.goto('/store/kpis')

  await expect(page.getByRole('heading', { name: 'IstinyePark Demo Store' })).toBeVisible()
  await expect(page.getByRole('button', { name: /BM checklist - 4/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /VM checklist - 5/ })).toBeVisible()
  await expect(page.getByText('BM checklist').first()).toBeVisible()
  await expect(page.getByText('VM checklist').first()).toBeVisible()
  await expect(page.getByText('Passive')).toHaveCount(0)
})

test('region manager store KPI overview waits for selected store before loading detail highlights', async ({ page }) => {
  const rankingRequests: URL[] = []
  const highlightRequests: URL[] = []
  const regionStoreRows = Array.from({ length: 9 }, (_, index) => {
    const storeNumber = index + 1
    return {
      ...rankingsPrivilegedDetailStoreRow,
      storeId: index === 0 ? 'store-high-hg' : `store-region-${storeNumber}`,
      storeName: index === 0 ? 'High HG Store' : `Region Store ${storeNumber}`,
      rank: storeNumber,
      population: 9,
      scoreValue: 91.4 - index,
      metrics:
        index === 2
          ? rankingsPrivilegedDetailStoreRow.metrics.filter((metric) => metric.code !== 'VM_CHECKLIST')
          : rankingsPrivilegedDetailStoreRow.metrics,
    }
  })
  let storeLeaderboardTotal = regionStoreRows.length
  const regionKpiAvailablePeriods = [
    ...rankingsAvailablePeriods,
    {
      periodType: 'monthly',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
    },
  ]

  await page.unroute('**/api/auth/session')
  await page.unroute('**/api/reports/rankings**')
  await page.unroute('**/api/reports/store-kpi-highlights**')

  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          userId: 'region-kpi-user',
          employeeId: null,
          roleCodes: ['REGION_MANAGER', 'STORE_MANAGER'],
          scope: {
            ...authSessionFixture.user.scope,
            storeIds: [regionStoreRows[0].storeId],
          },
          readScope: {
            ...authSessionFixture.user.readScope,
            storeIds: regionStoreRows.map((row) => row.storeId),
          },
          actionScope: {
            assignedStoreIds: [regionStoreRows[0].storeId],
          },
          assignedStoreIds: [regionStoreRows[0].storeId],
        },
        scopeSummary: {
          ...authSessionFixture.scopeSummary,
          assignedStoreCount: 1,
        },
      },
    })
  })

  await page.route('**/api/reports/rankings**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const periodStart = requestUrl.searchParams.get('periodStart') ?? '2026-04-01'
    rankingRequests.push(requestUrl)
    await route.fulfill({
      json: {
        ...rankingsPrivilegedDetailFixture,
        source: {
          ...rankingsPrivilegedDetailFixture.source,
          periodStart,
          periodEnd: periodStart === '2026-05-01' ? '2026-05-31' : '2026-04-30',
        },
        availablePeriods: regionKpiAvailablePeriods,
        filters: {
          ...rankingsPrivilegedDetailFixture.filters,
          stores: regionStoreRows.map((row) => ({ id: row.storeId, label: row.storeName })),
        },
        storeLeaderboard: {
          ...rankingsPrivilegedDetailFixture.storeLeaderboard,
          items: regionStoreRows,
          currentStore: regionStoreRows[0],
          meta: {
            ...rankingsPrivilegedDetailFixture.storeLeaderboard.meta,
            total: storeLeaderboardTotal,
          },
        },
      },
    })
  })

  await page.route('**/api/reports/store-kpi-highlights**', async (route) => {
    const url = new URL(route.request().url())
    const selectedStoreId = url.searchParams.get('storeId') ?? 'store-high-hg'
    const selectedStore = regionStoreRows.find((row) => row.storeId === selectedStoreId)
    highlightRequests.push(url)
    await route.fulfill({
      json: {
        ...storeKpiHighlightsFixture,
        store: {
          storeId: selectedStoreId,
          storeName: selectedStore?.storeName ?? 'Selected Store',
        },
      },
    })
  })

  await page.goto('/store/kpis')

  await expect(page.getByTestId('store-kpis-region-overview')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Bölge Performansı' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Bölge mağazaları' })).toBeVisible()
  await expect(page.getByText('Bölge KPI değerleri')).toBeVisible()
  await expect(page.getByTestId('store-kpis-region-overview').getByRole('button', { name: /BM Checklist/ })).toBeVisible()
  await expect(page.getByTestId('store-kpis-region-overview').getByRole('button', { name: /VM Checklist/ })).toBeVisible()
  await expect(page.getByTestId('store-kpis-region-overview').getByRole('button', { name: /GSM Onayı/ })).toBeVisible()
  await expect(
    page.getByTestId('store-kpis-region-overview').getByText('Region Store 9').first(),
  ).toBeVisible()
  await expect(page.getByText('VM Pasif').first()).toBeVisible()
  await expect(page.getByRole('link', { name: /KPI sayfasına git/ })).toHaveCount(regionStoreRows.length)
  await expect(page.getByRole('link', { name: 'Region Store 9 KPI sayfasına git' })).toHaveCSS('color', 'rgb(76, 42, 165)')
  await page.setViewportSize({ width: 390, height: 900 })
  await expect(page.getByTestId('store-kpis-region-overview')).toBeInViewport()
  await page.setViewportSize({ width: 1440, height: 900 })
  storeLeaderboardTotal = 120
  await page.reload()
  await expect(page.getByText('Tüm mağazalar dönmediği için ortalama gösterilmez.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Bölge mağazaları' })).toBeVisible()
  storeLeaderboardTotal = regionStoreRows.length
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Bölge mağazaları' })).toBeVisible()
  expect(rankingRequests.length).toBeGreaterThan(0)
  expect(rankingRequests.at(-1)?.searchParams.get('regionManagerUserId')).toBe('region-kpi-user')
  await expect.poll(() => rankingRequests.at(-1)?.searchParams.get('periodStart')).toBe('2026-05-01')
  expect(rankingRequests.at(-1)?.searchParams.get('sortKey')).toBe('score')
  expect(rankingRequests.at(-1)?.searchParams.get('sortDirection')).toBe('desc')
  expect(highlightRequests).toHaveLength(0)

  await page.getByRole('button', { name: 'Bölge KPI dönemi' }).click()
  await page.getByRole('button', { name: 'Nis', exact: true }).click()
  await expect.poll(() => rankingRequests.at(-1)?.searchParams.get('periodStart')).toBe('2026-04-01')

  await page.getByRole('button', { name: 'UPT sütununa göre sırala' }).click()
  await expect.poll(() => rankingRequests.at(-1)?.searchParams.get('sortKey')).toBe('UPT')
  expect(rankingRequests.at(-1)?.searchParams.get('sortDirection')).toBe('desc')

  await page.getByRole('button', { name: 'UPT sütununa göre sırala' }).click()
  await expect.poll(() => rankingRequests.at(-1)?.searchParams.get('sortDirection')).toBe('asc')
  expect(rankingRequests.at(-1)?.searchParams.get('sortKey')).toBe('UPT')
  expect(highlightRequests).toHaveLength(0)

  await page.getByRole('button', { name: 'GSM Onayı sütununa göre sırala' }).click()
  await expect.poll(() => rankingRequests.at(-1)?.searchParams.get('sortKey')).toBe('gsm_approval')

  await page.getByRole('link', { name: 'Region Store 9 KPI sayfasına git' }).click()

  await expect(page).toHaveURL(/\/store\/kpis\?storeId=store-region-9&periodStart=2026-04-01/)
  await expect.poll(() => highlightRequests.length).toBeGreaterThan(0)
  expect(highlightRequests.at(-1)?.searchParams.get('storeId')).toBe('store-region-9')
  expect(highlightRequests.at(-1)?.searchParams.get('periodStart')).toBe('2026-04-01')
  await expect(page.getByRole('button', { name: 'Kapanmış gün' })).toHaveCount(0)
})

test('store KPI highlights switches to English copy and persists locale', async ({ page }) => {
  await page.goto('/store/kpis')

  await setStoredLocale(page, 'en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'IstinyePark Demo Store' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Store KPI' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Personnel KPI' })).toBeVisible()
  await expect(page.getByText('Store score', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Store KPI contribution breakdown' })).toBeVisible()
  await expect(page.getByText('Store KPIs are read together with KPI config weight and reference.')).toBeVisible()
  await expect(page.getByText('Good / above target')).toBeVisible()
  await expect(page.getByText('Problem / not done')).toBeVisible()
  await page.getByRole('button', { name: 'Personnel KPI' }).click()
  await expect(page.getByRole('heading', { name: 'Score source' })).toBeVisible()
  await expect(page.getByText('Personnel KPI impact')).toBeVisible()
  await expect(page.getByText("Mağaza KPI'ları")).toHaveCount(0)
  await expect(page.getByText('Mağaza skor özeti')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ãƒ')
  await expect(page.locator('body')).not.toContainText('Ã„')
  await expect(page.locator('body')).not.toContainText('Ã…')

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('button', { name: 'Store KPI' })).toBeVisible()
})

test('store shell exposes Turkish-first chrome and hides technical auth roles', async ({ page }) => {
  await page.goto('/store')

  const storeNav = page.locator('.store-command-nav')
  const storeSidebar = page.locator('.store-command-sidebar')
  await expect(storeNav.locator('a[href="/store/checklists"]')).toBeVisible()
  await expect(storeNav.locator('a[href="/store/targets"]')).toBeVisible()
  await expect(storeNav.locator('a[href="/store/reports"]')).toHaveCount(0)
  await expect(page.getByRole('main', { name: 'Mağaza çalışma alanı' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Günlük Operasyon' })).toBeVisible()
  await expect(storeNav.getByRole('link', { name: 'Mağaza KPI', exact: true })).toBeVisible()
  await expect(storeNav.getByRole('link', { name: 'Talep Merkezi', exact: true })).toBeVisible()
  await expect(storeSidebar.locator('a[href="/store/settings"]')).toBeVisible()
  const checklistCard = page.getByTestId('store-home-checklist-card')
  await expect(checklistCard).toBeVisible()
  await expect(checklistCard).toContainText('1')
  await checklistCard.click()
  await expect(page.locator('.sh-detail-action')).toHaveAttribute('href', '/store/checklists')
  await expect(page.getByText('Ön izleme', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Prototip rol seçimi')).toHaveCount(0)
  await expect(page.getByTestId('store-home-visit-priority-card')).toHaveCount(0)
  await expect(page.locator('a[href="/store/checklists?tab=plan"]')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('STORE_PERSONNEL')
  await expect(page.locator('body')).not.toContainText('STORE_MANAGER')
  await expect(page.getByText('offline_access')).toHaveCount(0)
  await expect(page.getByText('uma_authorization')).toHaveCount(0)
  await expect(page.getByText('default-roles-store-ops')).toHaveCount(0)
  await expect(page.getByText('Task-first preview for store-scoped work.')).toHaveCount(0)
})

test('store home uses locked Plum Glacier prototype palette tokens', async ({ page }) => {
  await page.goto('/store/home')

  await expect(page.getByTestId('store-home-dashboard')).toBeVisible()

  const app = await readComputedStyle(page, '.store-shell.store-command-app')
  expect(app.backgroundColor).toBe('rgb(248, 245, 251)')
  expect(app.backgroundImage).toContain('rgba(248, 245, 251, 0.98)')
  expect(app.backgroundImage).toContain('rgba(237, 247, 246, 0.94)')
  expect(app.color).toBe('rgb(23, 20, 33)')

  const activeNav = await readComputedStyle(page, '.store-command-nav-link-active')
  expect(activeNav.backgroundImage).toContain('rgba(124, 58, 237, 0.12)')
  expect(activeNav.backgroundImage).toContain('rgba(19, 167, 179, 0.12)')
  expect(activeNav.color).toBe('rgb(76, 42, 165)')

  const hero = await readComputedStyle(page, '.store-command-home .sh-hero')
  expect(hero.backgroundImage).toContain('rgba(255, 255, 255, 0.97)')
  expect(hero.backgroundImage).toContain('rgba(239, 247, 246, 0.92)')
  expect(hero.borderColor).toBe('rgba(36, 28, 50, 0.1)')
  expect(hero.boxShadow).toContain('rgba(32, 24, 48, 0.08)')

  const card = await readComputedStyle(page, '.store-command-home .sh-metric')
  expect(card.backgroundColor).toBe('rgba(255, 255, 255, 0.86)')
  expect(card.borderColor).toBe('rgba(36, 28, 50, 0.1)')
  expect(card.boxShadow).toContain('rgba(32, 24, 48, 0.08)')

  const primaryPill = await readComputedStyle(page, '.store-command-home .sh-pill-primary')
  expect(primaryPill.backgroundImage).toContain('rgb(124, 58, 237)')
  expect(primaryPill.backgroundImage).toContain('rgb(19, 167, 179)')
  expect(primaryPill.color).toBe('rgb(255, 255, 255)')

  const cyanIcon = await readComputedStyle(page, '.store-command-home .sh-tone-cyan .sh-icon')
  expect(cyanIcon.backgroundColor).toBe('rgba(19, 167, 179, 0.12)')
  expect(cyanIcon.color).toBe('rgb(8, 123, 134)')

  const softButton = await readComputedStyle(page, '.store-command-home .sh-button-soft')
  expect(softButton.backgroundColor).toBe('rgba(255, 255, 255, 0.82)')
  expect(softButton.borderColor).toBe('rgba(36, 28, 50, 0.1)')
  expect(softButton.color).toBe('rgb(76, 42, 165)')
  expect(softButton.minHeight).toBe('40px')

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(hasHorizontalOverflow).toBe(false)
})

test('store home prefetches the task queue for manager navigation', async ({ page }) => {
  let workflowInboxRequests = 0
  await page.unroute('**/api/workflow/inbox')
  await page.route('**/api/workflow/inbox', async (route) => {
    workflowInboxRequests += 1
    await route.fulfill({ json: workflowInboxFixture })
  })

  await page.goto('/store/home')

  await expect(page.getByRole('heading', { name: 'Günlük Operasyon' })).toBeVisible()
  await expect(page.getByTestId('store-home-dashboard')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Öncelik akışı' })).toBeVisible()
  await expect(page.getByText('Mağaza özeti', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Dönem', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Ayarlar içinde', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Açık görevler takipte')).toBeVisible()
  const taskPriority = page.getByRole('button', { name: /Görevler Açık görevler takipte/ })
  await expect(taskPriority.locator('.sh-status')).toHaveText('Takipte')
  await expect.poll(() => workflowInboxRequests).toBeGreaterThanOrEqual(1)

  await page
    .locator('.store-command-nav')
    .getByRole('link', { name: 'Görevler', exact: true })
    .click()

  await expect(page.getByRole('heading', { name: 'Görevler' })).toBeVisible()
  expect(workflowInboxRequests).toBe(1)
})

test('store home keeps the command surface pending when workflow inbox fails', async ({ page }) => {
  await page.unroute('**/api/workflow/inbox')
  await page.route('**/api/workflow/inbox', async (route) => {
    await route.fulfill({
      status: 503,
      json: { message: 'Workflow unavailable' },
    })
  })

  await page.goto('/store/home')

  await expect(page.getByRole('heading', { name: 'Günlük Operasyon' })).toBeVisible()
  await expect(page.getByText('Görev verisi bekleniyor')).toBeVisible()
  await expect(page.getByText('Bekliyor').first()).toBeVisible()
  await expect(page.getByText('Görev verisi bekleniyor')).not.toHaveText('0')
})

test('region manager home surfaces checklist field queue summary', async ({ page }) => {
  let acknowledgementRequests = 0
  let mobileTodayRequests = 0

  await page.unroute('**/api/auth/session')
  await page.unroute('**/api/checklists/acknowledgements/list')
  await page.unroute('**/api/mobile/checklists/today')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          roleCodes: ['REGION_MANAGER'],
          actionScope: {
            assignedStoreIds: [demoStoreId, '00000000-0000-0000-0000-000000000101'],
          },
          assignedStoreIds: [demoStoreId, '00000000-0000-0000-0000-000000000101'],
        },
        scopeSummary: {
          ...authSessionFixture.scopeSummary,
          assignedStoreCount: 2,
          storeCount: 2,
        },
      },
    })
  })
  await page.route('**/api/checklists/acknowledgements/list', async (route) => {
    acknowledgementRequests += 1
    await route.fulfill({ json: checklistAcknowledgementsFixture })
  })
  await page.route('**/api/mobile/checklists/today', async (route) => {
    mobileTodayRequests += 1
    await route.fulfill({ json: mobileChecklistTodayFixture })
  })

  await page.goto('/store/home')

  const storeNav = page.locator('.store-command-nav')
  await expect(storeNav.locator('a[href="/store/reports"]')).toBeVisible()
  const checklistCard = page.getByTestId('store-home-checklist-card')
  await expect(checklistCard).toBeVisible()
  await expect(checklistCard).toContainText('1')
  await checklistCard.click()
  await expect(page.locator('.sh-detail-action')).toHaveAttribute('href', '/store/checklists')
  const visitPriorityCard = page.getByTestId('store-home-visit-priority-card')
  await expect(visitPriorityCard).toBeVisible()
  await expect(visitPriorityCard).toContainText('Bu hafta ziyaret')
  await expect(visitPriorityCard).toContainText('2')
  await visitPriorityCard.click()
  const visitPriorityDetail = page.locator('.sh-detail-panel')
  await expect(visitPriorityDetail).toContainText('2 yüksek riskli mağaza')
  await expect(visitPriorityDetail).toContainText('ziyaret planında görünüyor')
  await expect(page.locator('.sh-detail-action')).toHaveAttribute('href', '/store/checklists?tab=plan')
  await expect(page.getByRole('heading', { name: 'Hızlı geçiş' })).toBeVisible()
  await expect(page.locator('a[href="/store/kpis"]').first()).toBeVisible()
  await expect.poll(() => acknowledgementRequests).toBeGreaterThanOrEqual(1)
  await expect.poll(() => mobileTodayRequests).toBeGreaterThanOrEqual(1)
  const prefetchedAcknowledgementRequests = acknowledgementRequests
  const prefetchedMobileTodayRequests = mobileTodayRequests

  await checklistCard.click()
  await page.locator('.sh-detail-action').click()

  await expect(page).toHaveURL(/\/store\/checklists$/)
  await expect(page.getByRole('heading', { name: 'Checklist Akış Sayfası' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Atanmış mağaza checklist ziyaretleri' })).toBeVisible()
  await expect.poll(() => acknowledgementRequests, { timeout: 1000 }).toBe(prefetchedAcknowledgementRequests)
  await expect.poll(() => mobileTodayRequests, { timeout: 1000 }).toBe(prefetchedMobileTodayRequests)
})

test('region manager visit priority card stays pending when checklist data fails', async ({ page }) => {
  let mobileTodayErrorRequests = 0
  await page.unroute('**/api/auth/session')
  await page.unroute('**/api/checklists/acknowledgements/list')
  await page.unroute('**/api/mobile/checklists/today')
  await page.context().unroute('**/api/mobile/checklists/today')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: createStoreAuthSession({
        roleCodes: ['REGION_MANAGER'],
        readStoreIds: [demoStoreId, regionSecondStoreId],
        scopeStoreIds: [demoStoreId, regionSecondStoreId],
        actionStoreIds: [demoStoreId, regionSecondStoreId],
        legacyAssignedStoreIds: [demoStoreId, regionSecondStoreId],
      }),
    })
  })
  await page.route('**/api/checklists/acknowledgements/list', async (route) => {
    await route.fulfill({ json: checklistAcknowledgementsFixture })
  })
  await page.context().route('**/api/mobile/checklists/today**', async (route) => {
    mobileTodayErrorRequests += 1
    await route.fulfill({
      status: 503,
      json: { message: 'Checklist data unavailable' },
    })
  })

  await page.goto('/store/home')

  const visitPriorityCard = page.getByTestId('store-home-visit-priority-card')
  await expect(visitPriorityCard).toBeVisible()
  await expect.poll(() => mobileTodayErrorRequests).toBeGreaterThanOrEqual(1)
  await expect(visitPriorityCard).toContainText('Bekliyor')
  await visitPriorityCard.click()
  const visitPriorityDetail = page.locator('.sh-detail-panel')
  await expect(visitPriorityDetail).toContainText('Checklist verisi okunamadı')
  await expect(visitPriorityDetail).not.toContainText('Yüksek riskli mağaza yok')
})

test('report viewer store home does not advertise the visit plan link', async ({ page }) => {
  await routeAuthSession(page, createStoreAuthSession({
    roleCodes: ['REPORT_VIEWER'],
    readStoreIds: [demoStoreId],
    scopeStoreIds: [demoStoreId],
    actionStoreIds: [],
    legacyAssignedStoreIds: [],
  }))

  await page.goto('/store/home')

  await expect(page.locator('.store-command-nav').locator('a[href="/store/checklists"]')).toBeVisible()
  await expect(page.getByTestId('store-home-visit-priority-card')).toHaveCount(0)
  await expect(page.locator('a[href="/store/checklists?tab=plan"]')).toHaveCount(0)
})

test('region manager home translates visit priority reasons in English', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
  })
  await routeAuthSession(page, createStoreAuthSession({
    roleCodes: ['REGION_MANAGER'],
    readStoreIds: [demoStoreId, regionSecondStoreId],
    scopeStoreIds: [demoStoreId, regionSecondStoreId],
    actionStoreIds: [demoStoreId, regionSecondStoreId],
    legacyAssignedStoreIds: [demoStoreId, regionSecondStoreId],
  }))

  await page.goto('/store/home')

  const visitPriorityCard = page.getByTestId('store-home-visit-priority-card')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(visitPriorityCard).toBeVisible()
  await expect(visitPriorityCard).toContainText('This week visit priority')
  await visitPriorityCard.click()
  const selectedDetail = page.locator('.sh-detail-panel')
  await expect(selectedDetail).toContainText('2 high-risk stores')
  await expect(selectedDetail).toContainText('visit plan')
  await expect(selectedDetail).not.toContainText('Bu ay ziyaret yok')
})

test('store home dashboard actions follow role-aware navigation for admin landing roles', async ({ page }) => {
  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          roleCodes: ['HR_ADMIN'],
          actionScope: {
            assignedStoreIds: [],
          },
          assignedStoreIds: [],
        },
        scopeSummary: {
          ...authSessionFixture.scopeSummary,
          assignedStoreCount: 0,
        },
      },
    })
  })

  await page.goto('/store/home')

  await expect(page.getByTestId('store-home-dashboard')).toBeVisible()
  await expect(page.locator('.store-command-persona-chip')).toContainText('Admin görünümü')
  await expect(page.locator('.store-command-identity')).toContainText('Admin görünümü / Şirket geneli')
  await expect(page.getByRole('heading', { name: 'Günlük Operasyon' })).toBeVisible()
  await expect(page.getByTestId('store-home-dashboard').getByText('Admin görünümü', { exact: true })).toBeVisible()
  await expect(page.getByText('Bölge özet dashboard')).toHaveCount(0)
  await expect(page.locator('a[href="/store/feed"]').first()).toBeVisible()
  await expect(page.locator('a[href="/store/reports"]')).toHaveCount(0)
  await expect(page.locator('a[href="/store/kpis"]')).toHaveCount(0)
  await expect(page.locator('a[href="/store/targets"]')).toHaveCount(0)
  await expect(page.locator('a[href="/store/approvals"]')).toHaveCount(0)
  await expect(page.locator('a[href="/store/checklists"]')).toHaveCount(0)
  await expect(page.locator('a[href="/store/tasks"]')).toHaveCount(0)
})

test('store personnel sidebar only exposes personnel surfaces', async ({ page }) => {
  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          roleCodes: ['STORE_PERSONNEL'],
          actionScope: {
            assignedStoreIds: [demoStoreId],
          },
          assignedStoreIds: [demoStoreId],
        },
      },
    })
  })

  await page.goto('/store/me')

  const storeNav = page.locator('.store-command-nav')
  await expect(storeNav.locator('a[href="/store/me"]')).toBeVisible()
  await expect(storeNav.locator('a[href="/store/rankings"]')).toBeVisible()
  await expect(storeNav.locator('a[href="/store/settings"]')).toBeVisible()
  await expect(storeNav.locator('a[href="/store/checklists"]')).toHaveCount(0)
  await expect(storeNav.locator('a[href="/store/kpis"]')).toHaveCount(0)
  await expect(storeNav.locator('a[href="/store/approvals"]')).toHaveCount(0)
  await expect(storeNav.locator('a[href="/store/tasks"]')).toHaveCount(0)
  await expect(page.locator('a[href="/store/checklists"]')).toHaveCount(0)
  await expect(page.locator('a[href="/store/approvals"]')).toHaveCount(0)
})

test('store personnel command surface stays personal and read-only', async ({ page }) => {
  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          roleCodes: ['STORE_PERSONNEL'],
          actionScope: {
            assignedStoreIds: [demoStoreId],
          },
          assignedStoreIds: [demoStoreId],
        },
      },
    })
  })

  await page.goto('/store/home')

  await expect(page.getByTestId('store-home-command')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Günlük Operasyon' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Hızlı geçiş' })).toBeVisible()
  await expect(page.locator('a[href="/store/me"]').first()).toBeVisible()
  await expect(page.locator('a[href="/store/rankings"]').first()).toBeVisible()
  await expect(page.locator('a[href="/store/feed"]').first()).toBeVisible()
  await expect(page.locator('a[href="/store/tasks"]')).toHaveCount(0)
  await expect(page.locator('a[href="/store/checklists"]')).toHaveCount(0)
  await expect(page.locator('a[href="/store/kpis"]')).toHaveCount(0)
})

test('store personnel cannot open tasks by direct route', async ({ page }) => {
  let workflowInboxRequests = 0
  let storeActionPlanRequests = 0

  await page.unroute('**/api/auth/session')
  await page.unroute('**/api/workflow/inbox**')
  await page.unroute('**/api/store-actions/plans**')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          roleCodes: ['STORE_PERSONNEL'],
          actionScope: {
            assignedStoreIds: [demoStoreId],
          },
          assignedStoreIds: [demoStoreId],
        },
      },
    })
  })
  await page.route('**/api/workflow/inbox**', async (route) => {
    workflowInboxRequests += 1
    await route.fulfill({ json: workflowInboxFixture })
  })
  await page.route('**/api/store-actions/plans**', async (route) => {
    storeActionPlanRequests += 1
    await route.fulfill({
      json: {
        items: [],
        meta: {
          total: 0,
          limit: 20,
          offset: 0,
        },
      },
    })
  })

  await page.goto('/store/tasks')

  await expect(page.getByRole('heading', { name: /rota kullan/i })).toBeVisible()
  await expect(page.getByText('/store/me')).toBeVisible()
  expect(workflowInboxRequests).toBe(0)
  expect(storeActionPlanRequests).toBe(0)
})

test('store personnel cannot open checklists by direct route', async ({ page }) => {
  let acknowledgementRequests = 0
  let mobileTodayRequests = 0

  await page.unroute('**/api/auth/session')
  await page.unroute('**/api/checklists/acknowledgements/list')
  await page.unroute('**/api/mobile/checklists/today')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          roleCodes: ['STORE_PERSONNEL'],
          actionScope: {
            assignedStoreIds: [demoStoreId],
          },
          assignedStoreIds: [demoStoreId],
        },
      },
    })
  })
  await page.route('**/api/checklists/acknowledgements/list', async (route) => {
    acknowledgementRequests += 1
    await route.fulfill({ json: checklistAcknowledgementsFixture })
  })
  await page.route('**/api/mobile/checklists/today', async (route) => {
    mobileTodayRequests += 1
    await route.fulfill({ json: mobileChecklistTodayFixture })
  })

  await page.goto('/store/checklists')

  await expect(page.getByRole('heading', { name: /rota kullan/i })).toBeVisible()
  await expect(page.getByText('/store/me')).toBeVisible()
  await expect(page.locator('.store-checklists-command-page')).toHaveCount(0)
  expect(acknowledgementRequests).toBe(0)
  expect(mobileTodayRequests).toBe(0)
})

test('store personnel cannot open approvals by direct route', async ({ page }) => {
  let targetDistributionRequests = 0

  await page.unroute('**/api/auth/session')
  await page.unroute('**/api/target-distributions/requests**')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          roleCodes: ['STORE_PERSONNEL'],
          actionScope: {
            assignedStoreIds: [demoStoreId],
          },
          assignedStoreIds: [demoStoreId],
        },
      },
    })
  })
  await page.route('**/api/target-distributions/requests**', async (route) => {
    targetDistributionRequests += 1
    await route.fulfill({ json: targetDistributionRequestsFixture })
  })

  await page.goto('/store/approvals')

  await expect(page.getByRole('heading', { name: /rota kullan/i })).toBeVisible()
  await expect(page.getByText('/store/me')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Talep Merkezi' })).toHaveCount(0)
  expect(targetDistributionRequests).toBe(0)
})

test('store personnel cannot open targets by direct route', async ({ page }) => {
  let targetDistributionRequests = 0
  let targetCoverageRequests = 0
  let targetPersonnelRequests = 0

  await page.unroute('**/api/auth/session')
  await page.unroute('**/api/target-distributions/requests**')
  await page.unroute('**/api/target-distributions/coverage**')
  await page.unroute('**/api/target-distributions/store-personnel**')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          roleCodes: ['STORE_PERSONNEL'],
          actionScope: {
            assignedStoreIds: [demoStoreId],
          },
          assignedStoreIds: [demoStoreId],
        },
      },
    })
  })
  await page.route('**/api/target-distributions/requests**', async (route) => {
    targetDistributionRequests += 1
    await route.fulfill({ json: targetDistributionRequestsFixture })
  })
  await page.route('**/api/target-distributions/coverage**', async (route) => {
    targetCoverageRequests += 1
    await route.fulfill({ json: targetCoverageFixture })
  })
  await page.route('**/api/target-distributions/store-personnel**', async (route) => {
    targetPersonnelRequests += 1
    await route.fulfill({ json: storeTargetingPersonnelFixture })
  })

  await page.goto('/store/targets')

  await expect(page.getByRole('heading', { name: /rota kullan/i })).toBeVisible()
  await expect(page.getByText('/store/me')).toBeVisible()
  await expect(page.locator('[data-testid="store-targets-contract-surface"]')).toHaveCount(0)
  expect(targetDistributionRequests).toBe(0)
  expect(targetCoverageRequests).toBe(0)
  expect(targetPersonnelRequests).toBe(0)
})

test('visual merchandiser lands on checklist-only shell from store root', async ({ page }) => {
  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          roleCodes: ['VISUAL_MERCHANDISER'],
          actionScope: {
            assignedStoreIds: [demoStoreId],
          },
          assignedStoreIds: [demoStoreId],
        },
      },
    })
  })

  await page.goto('/store')

  await expect(page).toHaveURL(/\/store\/checklists$/)
  await expect(page.locator('.store-checklists-command-page')).toBeVisible()
  const storeNav = page.locator('.store-command-nav')
  await expect(storeNav).toHaveCount(0)
  await expect(storeNav.locator('a[href="/store/home"]')).toHaveCount(0)
  await expect(storeNav.locator('a[href="/store/kpis"]')).toHaveCount(0)
  await expect(storeNav.locator('a[href="/store/rankings"]')).toHaveCount(0)
  await expect(storeNav.locator('a[href="/store/approvals"]')).toHaveCount(0)
  await expect(page.getByText('VM görünümü').first()).toBeVisible()
  await expect(page.getByLabel(/VM Checklist ziyaret yok/)).toHaveCount(2)
  await expect(page.getByText('BM Checklist')).toHaveCount(0)
  await expect(page.getByText('BM skor')).toHaveCount(0)
  await expect(page.getByText('BM görünümü')).toHaveCount(0)
  await expect(page.getByText('BM + VM')).toHaveCount(0)
  await expectHealthyStoreTransition(page)
})

test('store home keeps the command surface stable when English locale persists', async ({ page }) => {
  await page.goto('/store')

  await setStoredLocale(page, 'en')

  const storeNav = page.locator('.store-command-nav')
  const storeSidebar = page.locator('.store-command-sidebar')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Günlük Operasyon' })).toBeVisible()
  await expect(page.getByTestId('store-home-dashboard')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Öncelik akışı' })).toBeVisible()
  await expect(page.getByText('Store operations run from one command surface.')).toHaveCount(0)
  await expect(page.getByText('Store performance and requests share one entry.')).toHaveCount(0)
  await expect(storeNav.getByRole('link', { name: 'Store KPIs', exact: true })).toBeVisible()
  await expect(storeNav.getByRole('link', { name: 'Rankings', exact: true })).toBeVisible()
  await expect(storeNav.getByRole('link', { name: 'Request Center', exact: true })).toBeVisible()
  await expect(storeSidebar.locator('a[href="/store/settings"]')).toBeVisible()
  await expect(page.getByText('Mağaza alanı')).toHaveCount(0)
  await expect(page.getByText('Mağaza ana sayfa Faz 1')).toHaveCount(0)
  await expect(page.getByText('Benim performansim')).toHaveCount(0)
  await expect(page.getByText('Siralamalar')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ãƒ')
  await expect(page.locator('body')).not.toContainText('Ã„')
  await expect(page.locator('body')).not.toContainText('Ã…')

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Günlük Operasyon' })).toBeVisible()
})

test('store sidebar recovers when a lazy route module fails during SPA navigation', async ({ page }) => {
  let failedFeedRouteModuleOnce = false
  await page.route(/StoreFeedPage.*\.(js|tsx)(\?.*)?$/, async (route) => {
    if (!failedFeedRouteModuleOnce) {
      failedFeedRouteModuleOnce = true
      await route.abort('failed')
      return
    }

    await route.continue()
  })

  await page.goto('/store/home')

  await page
    .locator('.store-command-nav')
    .getByRole('link', { name: 'Duyurular', exact: true })
    .click()

  await expect(page).toHaveURL(/\/store\/feed$/)
  await expect(page.getByRole('heading', { name: 'Duyurular' })).toBeVisible()
  expect(failedFeedRouteModuleOnce).toBe(true)
})

test('store sidebar retries a transient announcements API failure without leaving the user stuck', async ({ page }) => {
  const pageErrors: string[] = []
  let feedAttempts = 0

  page.on('pageerror', (error) => {
    pageErrors.push(error.message)
  })

  await page.unroute('**/api/feed?**')
  await page.route('**/api/feed?**', async (route) => {
    feedAttempts += 1

    if (feedAttempts === 1) {
      await route.fulfill({
        status: 503,
        json: { message: 'Temporary feed outage' },
      })
      return
    }

    await route.fulfill({ json: storeFeedFixture })
  })

  await page.goto('/store/home')

  await page
    .locator('.store-command-nav')
    .getByRole('link', { name: 'Duyurular', exact: true })
    .click()

  await expect(page).toHaveURL(/\/store\/feed$/)
  await expect.poll(() => feedAttempts).toBeGreaterThanOrEqual(2)
  await expect(page.getByText('Pilot store shell announcement.')).toBeVisible()
  await expect(page.getByText(/Duyurular a..lamad./i)).toHaveCount(0)
  expect(pageErrors).toEqual([])
})

test('store sidebar prefetches announcement data before opening feed', async ({ page }) => {
  let feedRequests = 0

  await page.unroute('**/api/feed?**')
  await page.route('**/api/feed?**', async (route) => {
    feedRequests += 1
    await route.fulfill({ json: storeFeedFixture })
  })

  await page.goto('/store/home')

  const feedLink = page
    .locator('.store-command-nav')
    .getByRole('link', { name: 'Duyurular', exact: true })
  await expect(feedLink).toBeVisible()
  expect(feedRequests).toBe(0)

  await feedLink.hover()

  await expect.poll(() => feedRequests).toBeGreaterThanOrEqual(1)
  const prefetchedFeedRequests = feedRequests

  await feedLink.click()

  await expect(page).toHaveURL(/\/store\/feed$/)
  await expect(page.getByText('Pilot store shell announcement.')).toBeVisible()
  await expect.poll(() => feedRequests, { timeout: 1000 }).toBe(prefetchedFeedRequests)
})

test('store sidebar transitions across visible manager pages without requiring manual refresh', async ({ page }) => {
  const storeNav = page.locator('.store-command-nav')
  await page.goto('/store/home')

  await verifyStoreNavTransition(page, storeNav, {
    linkName: 'Mağaza KPI',
    path: '/store/kpis',
    ready: page.getByRole('heading', { name: /KPI çalışma alanı/ }),
  })
  await verifyStoreNavTransition(page, storeNav, {
    linkName: 'Rankings',
    path: '/store/rankings',
    ready: page.getByRole('heading', { name: 'Sıralamalar' }),
  })
  await verifyStoreNavTransition(page, storeNav, {
    linkName: 'Talep Merkezi',
    path: '/store/approvals',
    ready: page.getByRole('heading', { name: 'Talep Merkezi' }),
  })
  await verifyStoreNavTransition(page, storeNav, {
    linkName: 'Görevler',
    path: '/store/tasks',
    ready: page.getByRole('heading', { name: 'Görevler' }),
  })
  await verifyStoreNavTransition(page, storeNav, {
    linkName: 'Duyurular',
    path: '/store/feed',
    ready: page.getByRole('heading', { name: 'Duyurular' }),
  })
  await verifyStoreNavTransition(page, storeNav, {
    linkName: 'Ana Sayfa',
    path: '/store/home',
    ready: page.getByRole('heading', { name: 'Günlük Operasyon' }),
  })

  await expectHealthyStoreTransition(page)
})

test('store settings utility pages show honest preferences and stay mobile-safe', async ({ page }) => {
  await page.goto('/store/settings')

  await expect(page.getByRole('heading', { name: 'Profil ve dil tercihleri' })).toBeVisible()
  await expect(page.getByLabel('Dil tercihi kontrolü')).toContainText('Tercih')
  await expect(page.getByLabel('Ayarlar çalışma sınırı')).toContainText('Profil bilgileri hazırlanıyor')
  await expect(page.getByLabel('Ayarlar çalışma sınırı')).toContainText('Bildirim tercihleri')
  await expect(page.getByLabel('Dil tercihi kontrolü').getByText('Dil ve görünüm')).toBeVisible()
  await expect(page.getByLabel('Dil tercihi kontrolü').getByText('Bu cihazdaki mağaza ekranları')).toBeVisible()
  await expect(page.getByText('Tercih modeli')).toHaveCount(0)
  await expect(page.getByText('Kayıt yeri')).toHaveCount(0)
  await expect(page.getByText('Etkilediği alan')).toHaveCount(0)
  await expect(page.getByText('gerçek tercih modeli')).toHaveCount(0)
  await expect(page.getByText('Bu tarayıcı')).toHaveCount(0)
  await expect(page.getByText('Uygulama metinleri')).toHaveCount(0)
  await expect(page.getByText('/store/settings')).toHaveCount(0)
  await expect(page.getByText('Sonraki güvenli adım')).toHaveCount(0)

  await page.goto('/store/targets')

  await expect(page.locator('[data-testid="store-targets-contract-surface"]')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Hedefler' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Personel hedef dağıtımı' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Hedef ak/i })).toHaveCount(0)
  await expect(page.getByText('/admin/targets')).toHaveCount(0)

  await page.goto('/store/reports')

  await expect(page.getByRole('heading', { name: /rota kullan|Route not available/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Raporlar' })).toHaveCount(0)

  await page.setViewportSize({ width: 390, height: 900 })
  await page.reload()

  await expect(page.getByRole('heading', { name: /rota kullan|Route not available/i })).toBeVisible()
  await expect.poll(
    () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  ).toBe(true)
})

test('store reports package is visible for region managers and stays mobile-safe', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-06-29T12:00:00.000Z'))
  await routeAuthSession(page, createStoreAuthSession({
    roleCodes: ['REGION_MANAGER'],
    readStoreIds: [demoStoreId, regionSecondStoreId],
    readRegionIds: [demoRegionId],
    scopeStoreIds: [],
    scopeRegionIds: [demoRegionId],
    actionStoreIds: [],
    legacyAssignedStoreIds: [],
  }))

  await page.goto('/store/reports')

  await expect(page.getByRole('heading', { name: 'Raporlar' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Mağaza İzleyiş Exceli/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Excel indir/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Haziran 2026/i })).toBeVisible()
  await expect(page.getByText('Raporları aç')).toHaveCount(0)
  await expect(page.getByText('/admin/reports')).toHaveCount(0)

  await page.setViewportSize({ width: 390, height: 900 })
  await page.reload()

  await expect(page.getByRole('heading', { name: 'Raporlar' })).toBeVisible()
  await expect.poll(
    () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  ).toBe(true)
  await expect.poll(() =>
    page.evaluate(() => {
      const nav = document.querySelector<HTMLElement>('.store-command-sidebar')
      if (!nav) {
        return false
      }

      const navBox = nav.getBoundingClientRect()
      return navBox.top >= 0 && navBox.bottom <= window.innerHeight
    }),
  ).toBe(true)
  await expect.poll(() =>
    page.evaluate(() => {
      const nav = document.querySelector<HTMLElement>('.store-command-sidebar')
      if (!nav) {
        return false
      }

      return window.getComputedStyle(nav).position !== 'fixed'
    }),
  ).toBe(true)
  await expect(page.getByText('KPI kolonları')).toBeVisible()
})

test('store route navigation does not blank the shell with a global transition layer', async ({ page }) => {
  const storeNav = page.locator('.store-command-nav')
  await page.goto('/store/home')

  await expect(page.locator('.store-command-home')).toBeVisible()

  await page.evaluate(() => {
    const marker = '__storeRouteTransitionSeen'
    ;(window as Window & Record<typeof marker, boolean>)[marker] = Boolean(
      document.querySelector('[data-testid="route-transition"]'),
    )
    const observer = new MutationObserver(() => {
      if (document.querySelector('[data-testid="route-transition"]')) {
        ;(window as Window & Record<typeof marker, boolean>)[marker] = true
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
  })

  await storeNav.getByRole('link', { name: 'Duyurular', exact: true }).click()

  await expect(page).toHaveURL(/\/store\/feed$/)
  await expect(page.getByText('Pilot store shell announcement.')).toBeVisible()
  await expect.poll(() =>
    page.evaluate(() => (window as Window & { __storeRouteTransitionSeen?: boolean }).__storeRouteTransitionSeen ?? false),
  ).toBe(false)
  await expectHealthyStoreTransition(page)
})

test('store rankings page renders Plum ranking table without signal chrome', async ({ page }) => {
  await page.goto('/store/rankings')

  await expect(page.getByRole('heading', { name: 'Sıralamalar' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Yıl filtresi' })).toContainText('2026')
  const monthFilter = page.getByRole('button', { name: 'Ay filtresi' })
  await expect(monthFilter).toContainText('Nis')
  await monthFilter.click()
  await expect(page.getByRole('checkbox', { name: 'Nis' })).toBeChecked()
  await page.getByRole('button', { name: 'Gün filtresi' }).click()
  await expect(page.getByRole('checkbox', { name: 'Nis' })).toHaveCount(0)
  await expect(page.getByRole('checkbox', { name: 'Tüm ay' })).toBeChecked()
  await expect(page.getByTestId('store-rankings-page')).toBeVisible()
  await expect(page.getByText('Top 100 görünüm', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Seçili görünüm referansı')).toContainText('Türkiye Referansı')
  await expect(page.getByLabel('Sıralama güven özeti')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Türkiye mağaza sıralaması' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Skor/ })).toBeVisible()
  await expect(page.locator('.store-rankings-scorebar').first()).toBeVisible()
  await expect(page.getByText('Sinyal')).toHaveCount(0)
  await page.getByRole('tab', { name: 'Personel listesi' }).click()
  await expect(page.getByRole('heading', { name: 'Türkiye personel sıralaması' })).toBeVisible()
  await expect(page.getByText('Store Personnel - 1').first()).toBeVisible()
  await expect(page.locator('.store-rankings-scorebar').first()).toBeVisible()
  await expect(page.getByText('Sinyal')).toHaveCount(0)
  await expect(page.getByText('Magaza ve personel rankingleri')).toHaveCount(0)
  await expect(page.getByText('Top 100 gorunumu')).toHaveCount(0)
  await expect(page.getByText('Turkiye magaza siralamasi')).toHaveCount(0)
  await expect(page.getByText('Turkiye personel siralamasi')).toHaveCount(0)
  await expect(page.getByText('Kendi magaza sirasi')).toHaveCount(0)
  await expect(page.getByText('Kendi personel sirasi')).toHaveCount(0)
  await expect(page.getByText('Siralama yuzeyi acilamadi')).toHaveCount(0)
})

test('store rankings retries a transient API failure without leaving the user stuck', async ({ page }) => {
  let rankingAttempts = 0

  await page.unroute('**/api/reports/rankings**')
  await page.route('**/api/reports/rankings**', async (route) => {
    rankingAttempts += 1

    if (rankingAttempts === 1) {
      await route.fulfill({ status: 503, json: { message: 'Temporary rankings outage' } })
      return
    }

    await route.fulfill({ json: rankingsFixture })
  })

  await page.goto('/store/rankings')

  await expect.poll(() => rankingAttempts).toBeGreaterThanOrEqual(2)
  await expect(page.getByTestId('store-rankings-page')).toBeVisible()
  await expect(page.getByText('IstinyePark Demo Store')).toBeVisible()
  await expect(page.getByText('Siralama yuzeyi acilamadi')).toHaveCount(0)
})

test('store rankings keeps non-privileged rows summary-only and backend-gated', async ({ page }) => {
  let personnelPerformanceRequests = 0

  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          roleCodes: ['STORE_PERSONNEL'],
        },
      },
    })
  })

  await page.unroute('**/api/reports/rankings**')
  await page.route('**/api/reports/rankings**', async (route) => {
    await route.fulfill({
      json: {
        ...rankingsFixture,
        storeLeaderboard: {
          ...rankingsFixture.storeLeaderboard,
          items: [
            {
              ...storeRankingSummaryRow,
              metrics: rankingsPrivilegedDetailStoreRow.metrics,
            },
          ],
        },
        personnelLeaderboard: {
          items: [
            {
              ...personnelRankingDetailRow,
              employeeId: '99999999-9999-4999-8999-999999999998',
              displayName: 'Other Top Personnel',
              canOpenProfile: false,
            },
          ],
          currentEmployee: null,
          managedStorePersonnel: [],
          meta: {
            total: 420,
            limit: 100,
            offset: 0,
          },
        },
      },
    })
  })

  await page.unroute('**/api/reports/personnel-performance/**')
  await page.route('**/api/reports/personnel-performance/**', async (route) => {
    personnelPerformanceRequests += 1
    await route.fulfill({ status: 403, json: { message: 'Forbidden' } })
  })

  await page.goto('/store/rankings')

  const rankingTable = page.locator('.store-rankings-table')
  await expect(page.getByText('Top 100 görünüm', { exact: true })).toBeVisible()
  await expect(rankingTable.getByRole('columnheader', { name: /UPT/ })).toHaveCount(0)
  await expect(rankingTable.getByRole('columnheader', { name: /BM/ })).toHaveCount(0)
  await expect(rankingTable.getByRole('button', { name: 'Detay aç' })).toHaveCount(0)

  await page.getByRole('tab', { name: 'Personel listesi' }).click()
  await expect(page.getByRole('row', { name: /Other Top Personnel/ })).toBeVisible()
  await expect(rankingTable.getByRole('columnheader', { name: /ATV/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Profile Git' })).toHaveCount(0)
  await expect.poll(() => personnelPerformanceRequests).toBe(0)
})

test('store personnel profile hides backend denial details on direct access', async ({ page }) => {
  const deniedEmployeeId = '99999999-9999-4999-8999-999999999998'

  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          userId: 'region-ranking-user',
          roleCodes: ['REGION_MANAGER'],
        },
      },
    })
  })

  await page.unroute('**/api/reports/personnel-performance/**')
  await page.route('**/api/reports/personnel-performance/**', async (route) => {
    await route.fulfill({
      status: 403,
      json: { message: `Forbidden employee ${deniedEmployeeId}` },
    })
  })

  await page.goto(`/store/personnel/${deniedEmployeeId}`)

  await expect(page.getByRole('heading', { name: 'Personel profili açılamıyor' })).toBeVisible()
  await expect(page.getByText('Bu personel profiline erişiminiz yok.')).toBeVisible()
  await expect(page.locator('body')).not.toContainText('Forbidden employee')
  await expect(page.locator('body')).not.toContainText(deniedEmployeeId)
})

test('store rankings personnel detail opens the selected personnel performance profile', async ({ page }) => {
  const personnelPerformanceRequests: URL[] = []
  const rankingRequests: URL[] = []

  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          userId: 'region-ranking-user',
          roleCodes: ['REGION_MANAGER'],
        },
      },
    })
  })

  await page.unroute('**/api/reports/rankings**')
  await page.route('**/api/reports/rankings**', async (route) => {
    rankingRequests.push(new URL(route.request().url()))
    await route.fulfill({
      json: {
        ...rankingsPrivilegedDetailFixture,
        personnelLeaderboard: {
          items: [personnelRankingDetailRow],
          currentEmployee: null,
          managedStorePersonnel: [],
          meta: {
            total: 1,
            limit: 100,
            offset: 0,
          },
        },
      },
    })
  })
  await page.unroute('**/api/reports/personnel-performance/**')
  await page.route('**/api/reports/personnel-performance/**', async (route) => {
    const requestUrl = new URL(route.request().url())
    personnelPerformanceRequests.push(requestUrl)
    await route.fulfill({
      json: {
        ...myPerformanceFixture,
        employee: {
          ...myPerformanceFixture.employee,
          employeeId: demoEmployeeId,
          displayName: 'Store Personnel - 1',
          storeName: 'IstinyePark Demo Store',
        },
      },
    })
  })

  await page.goto('/store/rankings?list=personnel&period=2026-04-01&q=Store&sort=ATV&dir=asc&page=2')
  await expect(page.getByRole('tab', { name: 'Personel listesi' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('searchbox', { name: 'Personel arama' })).toHaveValue('Store')
  await expect.poll(() =>
    rankingRequests.some((requestUrl) =>
      requestUrl.searchParams.get('periodStart') === '2026-04-01' &&
      requestUrl.searchParams.get('search') === 'Store' &&
      requestUrl.searchParams.get('sortKey') === 'ATV' &&
      requestUrl.searchParams.get('sortDirection') === 'asc' &&
      requestUrl.searchParams.get('offset') === '100',
    ),
  ).toBe(true)
  const personnelRow = page.getByRole('row', { name: /Store Personnel - 1/ })
  await personnelRow.getByRole('button', { name: 'Profile Git' }).click()
  await expect(page.locator('.store-rankings-drawer')).toHaveCount(0)

  await expect(page).toHaveURL(new RegExp(`/store/personnel/${demoEmployeeId}\\?`))
  await expect.poll(() => new URL(page.url()).searchParams.get('mode')).toBe('live')
  await expect.poll(() => new URL(page.url()).searchParams.get('periodType')).toBe('monthly')
  await expect.poll(() => new URL(page.url()).searchParams.get('periodStart')).toBe('2026-04-01')
  await expect(page.locator('[data-testid="store-me-page"]')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: /Store Personnel - 1 . IstinyePark Demo Store/i }),
  ).toBeVisible()
  await expect(page.locator('[data-testid="store-me-metric-card"]')).toHaveCount(3)
  await expect(page.locator('[data-testid="store-me-metric-card"]').filter({ hasText: 'CR' })).toHaveCount(0)
  await expect
    .poll(() =>
      personnelPerformanceRequests.some((requestUrl) => requestUrl.searchParams.get('periodStart') === '2026-04-01'),
    )
    .toBe(true)

  await page.getByRole('button', { name: 'Sıralamaya dön' }).click()
  await expect(page).toHaveURL(/\/store\/rankings\?/)
  const returnedParams = new URL(page.url()).searchParams
  expect(returnedParams.get('list')).toBe('personnel')
  expect(returnedParams.get('period')).toBe('2026-04-01')
  expect(returnedParams.get('q')).toBe('Store')
  expect(returnedParams.get('sort')).toBe('ATV')
  expect(returnedParams.get('dir')).toBe('asc')
  expect(returnedParams.get('page')).toBe('2')
  await expect(page.getByRole('tab', { name: 'Personel listesi' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('searchbox', { name: 'Personel arama' })).toHaveValue('Store')
  await expect(page.getByRole('row', { name: /Store Personnel - 1/ })).toBeVisible()
})

test('region manager rankings opens only in-region personnel profile actions', async ({ page }) => {
  const personnelPerformanceRequests: URL[] = []

  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          userId: 'region-ranking-user',
          employeeId: '00000000-0000-0000-0000-000000000301',
          roleCodes: ['REGION_MANAGER'],
          scope: {
            companyIds: ['company-1'],
            regionIds: ['region-1'],
            storeIds: [],
          },
          readScope: {
            companyIds: ['company-1'],
            regionIds: ['region-1'],
            storeIds: [],
          },
          actionScope: {
            assignedStoreIds: ['store-in-region'],
          },
          assignedStoreIds: ['store-in-region'],
        },
      },
    })
  })

  await page.unroute('**/api/reports/rankings**')
  await page.route('**/api/reports/rankings**', async (route) => {
    await route.fulfill({
      json: {
        ...rankingsPrivilegedDetailFixture,
        personnelLeaderboard: {
          items: [regionManagerInScopePersonnelRow, regionManagerOutOfScopePersonnelRow],
          currentEmployee: null,
          managedStorePersonnel: [],
          meta: {
            total: 2,
            limit: 100,
            offset: 0,
          },
        },
      },
    })
  })

  await page.unroute('**/api/reports/personnel-performance/**')
  await page.route('**/api/reports/personnel-performance/**', async (route) => {
    const requestUrl = new URL(route.request().url())
    personnelPerformanceRequests.push(requestUrl)
    await route.fulfill({
      json: {
        ...myPerformanceFixture,
        employee: {
          ...myPerformanceFixture.employee,
          employeeId: demoEmployeeId,
          displayName: 'BM Region Personnel',
          storeName: 'BM Region Store',
        },
      },
    })
  })

  await page.goto('/store/rankings')
  await page.getByRole('tab', { name: 'Personel listesi' }).click()

  const inScopeRow = page.getByRole('row', { name: /BM Region Personnel/ })
  await inScopeRow.getByRole('button', { name: 'Profile Git' }).click()
  await expect(page.locator('.store-rankings-drawer')).toHaveCount(0)
  await expect(page).toHaveURL(new RegExp(`/store/personnel/${demoEmployeeId}\\?`))
  await expect(page.locator('[data-testid="store-me-page"]')).toBeVisible()
  const inScopeRequestCount = personnelPerformanceRequests.length
  expect(inScopeRequestCount).toBeGreaterThan(0)

  await page.goto('/store/rankings')
  await page.getByRole('tab', { name: 'Personel listesi' }).click()
  const outOfScopeRow = page.getByRole('row', { name: /Other Region Personnel/ })
  await expect(outOfScopeRow).toBeVisible()
  await expect(outOfScopeRow.getByRole('button', { name: 'Profile Git' })).toHaveCount(0)
  await expect(page.locator('.store-rankings-drawer')).toHaveCount(0)
  await expect.poll(() => personnelPerformanceRequests.length).toBe(inScopeRequestCount)
})

test('store personnel profile falls back when ranking period has no personnel data', async ({ page }) => {
  const personnelPerformanceRequests: URL[] = []
  const aprilOnlyPeriods = [
    {
      periodType: 'monthly',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
    },
  ]
  const noMayPersonnelDataFixture = {
    ...myPerformanceFixture,
    employee: {
      employeeId: demoEmployeeId,
      displayName: 'Unknown employee',
      storeId: null,
      storeName: null,
    },
    period: null,
    score: {
      value: 0,
      matchedMetrics: 0,
      totalMetrics: 3,
    },
    availablePeriods: aprilOnlyPeriods,
    partial: {
      isPartial: true,
      missingMetricCodes: ['TARGET_ACHIEVEMENT', 'ATV', 'UPT'],
      missingMetricLabels: ['Target Achievement', 'Average Ticket Value', 'Units Per Ticket'],
      pendingNormalizationCodes: [],
      pendingNormalizationLabels: [],
    },
    metrics: myPerformanceFixture.metrics.map((metric) => ({
      ...metric,
      actualValue: null,
      contributionValue: 0,
      dataStatus: 'missing',
      scoreStatus: 'missing',
      status: 'missing',
    })),
  }

  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          userId: 'region-ranking-user',
          roleCodes: ['REGION_MANAGER'],
        },
      },
    })
  })

  await page.unroute('**/api/reports/rankings**')
  await page.route('**/api/reports/rankings**', async (route) => {
    await route.fulfill({
      json: {
        ...rankingsPrivilegedDetailFixture,
        source: {
          ...rankingsPrivilegedDetailFixture.source,
          periodStart: '2026-05-01',
          periodEnd: '2026-05-31',
        },
        availablePeriods: [
          ...rankingsPrivilegedDetailFixture.availablePeriods,
          {
            periodType: 'monthly',
            periodStart: '2026-05-01',
            periodEnd: '2026-05-31',
          },
        ],
        personnelLeaderboard: {
          items: [personnelRankingDetailRow],
          currentEmployee: null,
          managedStorePersonnel: [],
          meta: {
            total: 1,
            limit: 100,
            offset: 0,
          },
        },
      },
    })
  })
  await page.unroute('**/api/reports/personnel-performance/**')
  await page.route('**/api/reports/personnel-performance/**', async (route) => {
    const requestUrl = new URL(route.request().url())
    personnelPerformanceRequests.push(requestUrl)

    if (requestUrl.searchParams.get('periodStart') === '2026-05-01') {
      await route.fulfill({ json: noMayPersonnelDataFixture })
      return
    }

    await route.fulfill({
      json: {
        ...myPerformanceFixture,
        availablePeriods: aprilOnlyPeriods,
        employee: {
          ...myPerformanceFixture.employee,
          employeeId: demoEmployeeId,
          displayName: 'Store Personnel - 1',
          storeName: 'IstinyePark Demo Store',
        },
      },
    })
  })

  await page.goto('/store/rankings')
  await page.getByRole('tab', { name: 'Personel listesi' }).click()
  await page
    .getByRole('row', { name: /Store Personnel - 1/ })
    .getByRole('button', { name: 'Profile Git' })
    .click()

  await expect.poll(() =>
    personnelPerformanceRequests.some((requestUrl) => requestUrl.searchParams.get('periodStart') === '2026-05-01'),
  ).toBe(true)
  await expect.poll(() =>
    personnelPerformanceRequests.some((requestUrl) => requestUrl.searchParams.get('periodStart') === '2026-04-01'),
  ).toBe(true)
  await expect(
    page.getByRole('heading', { name: /Store Personnel - 1 . IstinyePark Demo Store/i }),
  ).toBeVisible()
  await expect(page.getByText('Unknown employee')).toHaveCount(0)
})

test('store personnel profile date filter exposes loaded months and days', async ({ page }) => {
  const personnelPerformanceRequests: URL[] = []
  const loadedPeriods = [
    {
      periodType: 'monthly',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
    },
    {
      periodType: 'monthly',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
    },
    {
      periodType: 'daily',
      periodStart: '2026-04-24',
      periodEnd: '2026-04-24',
    },
    {
      periodType: 'daily',
      periodStart: '2026-04-25',
      periodEnd: '2026-04-25',
    },
  ]
  const dailyPerformanceFixture = {
    ...myPerformanceFixture,
    period: {
      periodStart: '2026-04-24',
      periodEnd: '2026-04-24',
    },
    score: {
      value: 88.4,
      matchedMetrics: 3,
      totalMetrics: 3,
    },
    availablePeriods: loadedPeriods,
    employee: {
      ...myPerformanceFixture.employee,
      employeeId: demoEmployeeId,
      displayName: 'Store Personnel - 1',
      storeName: 'IstinyePark Demo Store',
    },
  }

  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          userId: 'region-ranking-user',
          roleCodes: ['REGION_MANAGER'],
        },
      },
    })
  })

  await page.unroute('**/api/reports/personnel-performance/**')
  await page.route('**/api/reports/personnel-performance/**', async (route) => {
    const requestUrl = new URL(route.request().url())
    personnelPerformanceRequests.push(requestUrl)

    await route.fulfill({
      json:
        requestUrl.searchParams.get('periodType') === 'daily'
          ? dailyPerformanceFixture
          : {
              ...myPerformanceFixture,
              availablePeriods: loadedPeriods,
              employee: {
                ...myPerformanceFixture.employee,
                employeeId: demoEmployeeId,
                displayName: 'Store Personnel - 1',
                storeName: 'IstinyePark Demo Store',
              },
            },
    })
  })

  await page.goto(`/store/personnel/${demoEmployeeId}?mode=live&periodType=monthly&periodStart=2026-04-01`)
  await page.getByRole('button', { name: /Tarih filtresi/i }).click()

  await expect(page.getByRole('radio', { name: 'Ay', exact: true })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Gün', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Yüklü ay seçimi' })).toContainText('Nisan 2026')

  await page.getByRole('radio', { name: 'Gün', exact: true }).click()
  const calendar = page.locator('[data-slot="calendar"]')
  await expect(calendar).toBeVisible()
  await expect(calendar.locator('button[data-day="4/24/2026"]')).toBeEnabled()
  await expect(calendar.locator('button[data-day="4/25/2026"]')).toBeEnabled()
  await calendar.locator('button[data-day="4/24/2026"]').click()

  await expect.poll(() =>
    personnelPerformanceRequests.some(
      (requestUrl) =>
        requestUrl.searchParams.get('periodType') === 'daily' &&
        requestUrl.searchParams.get('periodStart') === '2026-04-24',
    ),
  ).toBe(true)
  await expect(page.locator('[data-testid="store-me-period-pill"]')).toHaveText('24 Nis 2026 - 24 Nis 2026')
})

test('store personnel profile derives date filters from the active period when the period list is empty', async ({ page }) => {
  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          userId: 'region-ranking-user',
          roleCodes: ['REGION_MANAGER'],
        },
      },
    })
  })

  await page.unroute('**/api/reports/personnel-performance/**')
  await page.route('**/api/reports/personnel-performance/**', async (route) => {
    await route.fulfill({
      json: {
        ...myPerformanceFixture,
        period: {
          periodStart: '2026-03-01',
          periodEnd: '2026-03-31',
        },
        availablePeriods: [],
        employee: {
          ...myPerformanceFixture.employee,
          employeeId: demoEmployeeId,
          displayName: 'Store Personnel - 1',
          storeName: 'IstinyePark Demo Store',
        },
      },
    })
  })

  await page.goto(`/store/personnel/${demoEmployeeId}?mode=live&periodType=monthly&periodStart=2026-03-01`)
  await page.getByRole('button', { name: /Tarih filtresi/i }).click()

  await expect(page.getByText('Yüklü dönem yok')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Yüklü ay seçimi' })).toContainText('Mart 2026')
})

test('store personnel profile opens daily data when requested month has no rows', async ({ page }) => {
  const personnelPerformanceRequests: URL[] = []
  const loadedPeriods = [
    {
      periodType: 'daily',
      periodStart: '2026-04-24',
      periodEnd: '2026-04-24',
    },
  ]
  const noMonthlyDataFixture = {
    ...myPerformanceFixture,
    employee: {
      employeeId: demoEmployeeId,
      displayName: 'Unknown employee',
      storeId: null,
      storeName: null,
    },
    period: null,
    score: {
      value: 0,
      matchedMetrics: 0,
      totalMetrics: 3,
    },
    availablePeriods: loadedPeriods,
    partial: {
      isPartial: true,
      missingMetricCodes: ['TARGET_ACHIEVEMENT', 'ATV', 'UPT'],
      missingMetricLabels: ['Target Achievement', 'Average Ticket Value', 'Units Per Ticket'],
      pendingNormalizationCodes: [],
      pendingNormalizationLabels: [],
    },
    metrics: myPerformanceFixture.metrics.map((metric) => ({
      ...metric,
      actualValue: null,
      contributionValue: 0,
      dataStatus: 'missing',
      scoreStatus: 'missing',
      status: 'missing',
    })),
  }
  const dailyPerformanceFixture = {
    ...myPerformanceFixture,
    period: {
      periodStart: '2026-04-24',
      periodEnd: '2026-04-24',
    },
    availablePeriods: loadedPeriods,
    employee: {
      ...myPerformanceFixture.employee,
      employeeId: demoEmployeeId,
      displayName: 'Store Personnel - 1',
      storeName: 'IstinyePark Demo Store',
    },
  }

  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          userId: 'region-ranking-user',
          roleCodes: ['REGION_MANAGER'],
        },
      },
    })
  })

  await page.unroute('**/api/reports/personnel-performance/**')
  await page.route('**/api/reports/personnel-performance/**', async (route) => {
    const requestUrl = new URL(route.request().url())
    personnelPerformanceRequests.push(requestUrl)

    await route.fulfill({
      json:
        requestUrl.searchParams.get('periodType') === 'daily'
          ? dailyPerformanceFixture
          : noMonthlyDataFixture,
    })
  })

  await page.goto(`/store/personnel/${demoEmployeeId}?mode=live&periodType=monthly&periodStart=2026-05-01`)

  await expect.poll(() =>
    personnelPerformanceRequests.some(
      (requestUrl) =>
        requestUrl.searchParams.get('periodType') === 'daily' &&
        requestUrl.searchParams.get('periodStart') === '2026-04-24',
    ),
  ).toBe(true)
  await expect(
    page.getByRole('heading', { name: /Store Personnel - 1 . IstinyePark Demo Store/i }),
  ).toBeVisible()
  await expect(page.getByText('Unknown employee')).toHaveCount(0)
})

test('store personnel profile uses employee periods instead of global closed snapshots', async ({ page }) => {
  const personnelPerformanceRequests: URL[] = []
  const snapshotRunRequests: URL[] = []
  const loadedPeriods = [
    {
      periodType: 'monthly',
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
    },
    {
      periodType: 'daily',
      periodStart: '2026-03-01',
      periodEnd: '2026-03-01',
    },
    {
      periodType: 'daily',
      periodStart: '2026-03-02',
      periodEnd: '2026-03-02',
    },
  ]
  const monthlyPerformanceFixture = {
    ...myPerformanceFixture,
    period: {
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
    },
    availablePeriods: loadedPeriods,
    employee: {
      ...myPerformanceFixture.employee,
      employeeId: demoEmployeeId,
      displayName: 'Store Personnel - 1',
      storeName: 'IstinyePark Demo Store',
    },
  }
  const dailyPerformanceFixture = {
    ...myPerformanceFixture,
    period: {
      periodStart: '2026-03-01',
      periodEnd: '2026-03-01',
    },
    availablePeriods: loadedPeriods,
    employee: {
      ...myPerformanceFixture.employee,
      employeeId: demoEmployeeId,
      displayName: 'Store Personnel - 1',
      storeName: 'IstinyePark Demo Store',
    },
  }

  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          userId: 'region-ranking-user',
          roleCodes: ['REGION_MANAGER'],
        },
      },
    })
  })

  await page.unroute('**/api/reports/snapshot-runs**')
  await page.route('**/api/reports/snapshot-runs**', async (route) => {
    snapshotRunRequests.push(new URL(route.request().url()))
    await route.fulfill({
      json: {
        items: [
          {
            snapshotRunId: '00000000-0000-0000-0000-000000000501',
            snapshotType: 'daily',
            snapshotDate: '2026-04-24',
            runStatus: 'completed',
            generatedAt: '2026-04-24T21:00:00.000Z',
            generatedBy: null,
          },
        ],
        total: 1,
        limit: 30,
        offset: 0,
      },
    })
  })

  await page.unroute('**/api/reports/personnel-performance/**')
  await page.route('**/api/reports/personnel-performance/**', async (route) => {
    const requestUrl = new URL(route.request().url())
    personnelPerformanceRequests.push(requestUrl)

    await route.fulfill({
      json:
        requestUrl.searchParams.get('periodType') === 'daily'
          ? dailyPerformanceFixture
          : monthlyPerformanceFixture,
    })
  })

  await page.goto(`/store/personnel/${demoEmployeeId}`)
  await page.getByRole('button', { name: /Tarih filtresi/i }).click()

  await expect(page.getByText('Kapanmış performans kaydı seçimi')).toHaveCount(0)
  await expect(page.getByText('Kapanmış gün')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Yüklü ay seçimi' })).toContainText('Mart 2026')
  await expect(page.getByText('Nisan 2026')).toHaveCount(0)

  await page.getByRole('radio', { name: 'Gün', exact: true }).click()
  const personnelCalendar = page.locator('[data-slot="calendar"]')
  await expect(personnelCalendar).toBeVisible()
  await expect(personnelCalendar.locator('button[data-day="3/1/2026"]')).toBeEnabled()
  await expect(personnelCalendar.locator('button[data-day="3/2/2026"]')).toBeEnabled()
  await personnelCalendar.locator('button[data-day="3/1/2026"]').click()

  await expect.poll(() =>
    personnelPerformanceRequests.some(
      (requestUrl) =>
        requestUrl.searchParams.get('periodType') === 'daily' &&
        requestUrl.searchParams.get('periodStart') === '2026-03-01',
    ),
  ).toBe(true)
  await expect(page.locator('[data-testid="store-me-period-pill"]')).toHaveText('1 Mar 2026 - 1 Mar 2026')
  expect(snapshotRunRequests).toEqual([])
})

test('store personnel profile resets requested live period when switching employees', async ({ page }) => {
  const firstEmployeeId = demoEmployeeId
  const secondEmployeeId = '00000000-0000-0000-0000-000000000203'
  const personnelPerformanceRequests: URL[] = []
  const firstDailyFixture = {
    ...myPerformanceFixture,
    period: {
      periodStart: '2026-03-02',
      periodEnd: '2026-03-02',
    },
    availablePeriods: [
      {
        periodType: 'daily',
        periodStart: '2026-03-02',
        periodEnd: '2026-03-02',
      },
    ],
    employee: {
      ...myPerformanceFixture.employee,
      employeeId: firstEmployeeId,
      displayName: 'First Person',
      storeName: 'First Store',
    },
  }
  const secondMonthlyFixture = {
    ...myPerformanceFixture,
    period: {
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
    },
    availablePeriods: [
      {
        periodType: 'monthly',
        periodStart: '2026-04-01',
        periodEnd: '2026-04-30',
      },
    ],
    employee: {
      ...myPerformanceFixture.employee,
      employeeId: secondEmployeeId,
      displayName: 'Second Person',
      storeName: 'Second Store',
    },
  }
  const secondWrongPeriodFixture = {
    ...secondMonthlyFixture,
    period: null,
    score: {
      value: 0,
      matchedMetrics: 0,
      totalMetrics: 3,
    },
    metrics: secondMonthlyFixture.metrics.map((metric) => ({
      ...metric,
      actualValue: null,
      achievementRate: null,
      actualRatio: null,
      scoredRatio: null,
      contributionValue: 0,
      dataStatus: 'missing',
      scoreStatus: 'missing',
      status: 'missing',
    })),
  }

  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          userId: 'region-ranking-user',
          roleCodes: ['REGION_MANAGER'],
        },
      },
    })
  })

  await page.unroute('**/api/reports/personnel-performance/**')
  await page.route('**/api/reports/personnel-performance/**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const requestedEmployeeId = decodeURIComponent(requestUrl.pathname.split('/').at(-1) ?? '')
    personnelPerformanceRequests.push(requestUrl)

    if (requestedEmployeeId === firstEmployeeId) {
      await route.fulfill({ json: firstDailyFixture })
      return
    }

    const isSecondMonthlyRequest =
      requestedEmployeeId === secondEmployeeId &&
      requestUrl.searchParams.get('periodType') === 'monthly' &&
      requestUrl.searchParams.get('periodStart') === '2026-04-01'

    await route.fulfill({
      json: isSecondMonthlyRequest ? secondMonthlyFixture : secondWrongPeriodFixture,
    })
  })

  await page.goto(
    `/store/personnel/${firstEmployeeId}?mode=live&periodType=daily&periodStart=2026-03-02`,
  )
  await expect(page.getByRole('heading', { name: /First Person/i })).toBeVisible()

  personnelPerformanceRequests.length = 0
  await page.evaluate((url) => {
    window.history.pushState({}, '', url)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, `/store/personnel/${secondEmployeeId}?mode=live&periodType=monthly&periodStart=2026-04-01`)

  await expect
    .poll(
      () =>
        personnelPerformanceRequests.find((requestUrl) =>
          requestUrl.pathname.endsWith(secondEmployeeId),
        ) !== undefined,
    )
    .toBe(true)

  const firstSecondRequest = personnelPerformanceRequests.find((requestUrl) =>
    requestUrl.pathname.endsWith(secondEmployeeId),
  )
  expect(firstSecondRequest?.searchParams.get('periodType')).toBe('monthly')
  expect(firstSecondRequest?.searchParams.get('periodStart')).toBe('2026-04-01')
  await expect(page.getByRole('heading', { name: /Second Person/i })).toBeVisible()
})

test('store rankings page switches to English copy and persists locale', async ({ page }) => {
  await page.goto('/store/rankings')

  await setStoredLocale(page, 'en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Rankings' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Year filter' })).toContainText('2026')
  const monthFilter = page.getByRole('button', { name: 'Month filter' })
  await expect(monthFilter).toContainText('Apr')
  await monthFilter.click()
  await expect(page.getByRole('checkbox', { name: 'Apr' })).toBeChecked()
  await monthFilter.click()
  await expect(page.getByTestId('store-rankings-page')).toBeVisible()
  await expect(page.locator('header').getByText('Top 100 view', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Turkey store ranking' })).toBeVisible()
  await expect(page.getByRole('table', { name: /Showing store results/i })).toBeVisible()
  await page.getByRole('tab', { name: 'Personnel list' }).click()
  await expect(page.getByRole('heading', { name: 'Turkey personnel ranking' })).toBeVisible()
  await expect(page.getByRole('table', { name: /Showing personnel results/i })).toBeVisible()
  await expect.poll(() => new URL(page.url()).searchParams.get('list')).toBe('personnel')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByText('Mağaza ve personel sıralamaları')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ã')
  await expect(page.locator('body')).not.toContainText('Ä')
  await expect(page.locator('body')).not.toContainText('Å')

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Rankings' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Personnel list' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('table', { name: /Showing personnel results/i })).toBeVisible()
  await expect
    .poll(
      () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
      { message: 'store rankings should not create page-level horizontal overflow on mobile' },
    )
    .toBe(true)
})

test('store rankings personnel mobile cards keep text separated', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/store/rankings')
  await page.getByRole('tab', { name: 'Personel listesi' }).click()

  const firstPersonnelCard = page.locator('.store-rankings-table tbody tr').first()
  await expect(firstPersonnelCard.locator('.store-rankings-cell-entity')).toBeVisible()
  await expect(firstPersonnelCard.locator('.store-rankings-entity-detail')).toBeVisible()
  await expect(firstPersonnelCard.locator('.store-rankings-cell-store')).toBeHidden()
  await expect(firstPersonnelCard.locator('.store-rankings-cell-score')).toBeVisible()
  await expect(firstPersonnelCard.locator('.store-rankings-cell-action')).toBeVisible()

  const overlappingCells = await firstPersonnelCard.evaluate((row) => {
    const cells = Array.from(row.querySelectorAll('td'))
      .map((cell) => {
        const rect = cell.getBoundingClientRect()

        return {
          label: cell.getAttribute('data-label') ?? '',
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          visible: rect.width > 0 && rect.height > 0,
        }
      })
      .filter((cell) => cell.visible)
    const overlaps: string[] = []

    for (let firstIndex = 0; firstIndex < cells.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < cells.length; secondIndex += 1) {
        const first = cells[firstIndex]
        const second = cells[secondIndex]
        const separated =
          first.right <= second.left + 1 ||
          second.right <= first.left + 1 ||
          first.bottom <= second.top + 1 ||
          second.bottom <= first.top + 1

        if (!separated) {
          overlaps.push(`${first.label}/${second.label}`)
        }
      }
    }

    return overlaps
  })

  expect(overlappingCells).toEqual([])
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    .toBe(true)
})

test('store rankings requests exact loaded day and returns to monthly view', async ({ page }) => {
  const rankingRequests: URL[] = []

  await page.unroute('**/api/reports/rankings**')
  await page.route('**/api/reports/rankings**', async (route) => {
    const url = new URL(route.request().url())
    rankingRequests.push(url)

    await route.fulfill({
      json: url.searchParams.get('periodType') === 'daily' ? rankingsDailyFixture : rankingsFixture,
    })
  })

  await page.goto('/store/rankings')
  await expect(page.getByRole('button', { name: 'Yıl filtresi' })).toContainText('2026')
  await expect(page.getByRole('button', { name: 'Ay filtresi' })).toContainText('Nis')
  await expect(page.getByRole('button', { name: 'Gün filtresi' })).toContainText('Tüm ay')
  await expect(page.getByText('Top 100 görünüm', { exact: true })).toBeVisible()
  await expect(
    page.getByText('Top 100 görünümünü, kendi mağaza ve personel konumunla birlikte takip et.'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Gün filtresi' }).click()
  await expect(page.getByRole('checkbox', { name: '15', exact: true })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: '16', exact: true })).toHaveCount(0)
  await page.getByRole('checkbox', { name: '15', exact: true }).click()
  await expect
    .poll(() =>
      rankingRequests.some(
        (url) =>
          url.searchParams.get('periodType') === 'daily' &&
          url.searchParams.get('periodStart') === '2026-04-15',
      ),
    )
    .toBe(true)
  await expect(page.getByRole('button', { name: 'Gün filtresi' })).toContainText('15')
  await expect(page.getByText('Seçili gün görünümü')).toBeVisible()
  await page.getByRole('button', { name: 'Gün filtresi' }).click()
  await page.getByRole('checkbox', { name: 'Tüm ay' }).click()
  await expect
    .poll(() => {
      const lastRequest = rankingRequests.at(-1)

      return lastRequest
        ? `${lastRequest.searchParams.get('periodType')}:${lastRequest.searchParams.get('periodStart')}`
        : ''
    })
    .toBe('monthly:2026-04-01')
  await expect(page.getByText('Global liste Top 100 ozet; kendi konumun ayrica gorunur.')).toHaveCount(0)
  await expect(page.getByText('Siralama yuzeyi acilamadi')).toHaveCount(0)
})

test('store rankings uses Turkey reference, checklist metrics, normalized HG, and backend sort params', async ({ page }) => {
  const rankingRequests: URL[] = []

  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          userId: 'region-ranking-user',
          roleCodes: ['REGION_MANAGER'],
        },
      },
    })
  })

  await page.unroute('**/api/reports/rankings**')
  await page.route('**/api/reports/rankings**', async (route) => {
    const url = new URL(route.request().url())
    rankingRequests.push(url)
    const ascendingTargetSort =
      url.searchParams.get('sortKey') === 'TARGET_ACHIEVEMENT' &&
      url.searchParams.get('sortDirection') === 'asc'

    if (ascendingTargetSort) {
      await new Promise((resolve) => setTimeout(resolve, 250))
    }

    await route.fulfill({
      json: {
        ...rankingsPrivilegedDetailFixture,
        storeLeaderboard: {
          ...rankingsPrivilegedDetailFixture.storeLeaderboard,
          items: ascendingTargetSort
            ? [rankingsPrivilegedLowHgStoreRow]
            : [rankingsPrivilegedMissingChecklistStoreRow],
        },
      },
    })
  })

  await page.goto('/store/rankings')

  await expect(page.getByRole('heading', { name: 'Türkiye Referansı' })).toBeVisible()
  await expect(page.getByLabel('Seçili görünüm referansı')).toContainText('Türkiye Referansı')
  const rankingTable = page.locator('.store-rankings-table')
  await expect(rankingTable.locator('thead')).not.toContainText('KPI')
  await expect(page.locator('td[data-label="KPI özeti"]')).toHaveCount(0)
  await expect(page.locator('td[data-label="KPI summary"]')).toHaveCount(0)
  await expect(rankingTable.locator('thead')).toContainText('BM')
  await expect(rankingTable.locator('thead')).toContainText('VM')
  await expect(rankingTable.locator('thead')).toContainText('GSM')
  await expect(rankingTable.locator('thead')).toContainText('CR')
  await expect(rankingTable.getByRole('columnheader', { name: 'Aksiyon' })).toHaveCount(0)
  await expect(rankingTable.getByRole('button', { name: 'Detay aç' })).toHaveCount(0)
  await expect(rankingTable.locator('tbody')).toContainText('19,70%')
  await expect(rankingTable.locator('tbody')).toContainText('371,09%')
  await expect(rankingTable.locator('tbody')).not.toContainText('371.088.457%')
  await expect(rankingTable.locator('tbody')).toContainText('Yapılmadı')

  await page.locator('.store-rankings-sort-button', { hasText: 'HG%' }).click()
  await page.locator('.store-rankings-sort-button', { hasText: 'HG%' }).click()

  await expect(page.getByText('High HG Store')).toBeVisible()
  await expect(page.getByText('Sıralama hazırlanıyor')).toHaveCount(0)
  await expect(page.getByText('Sıralama yüzeyi açılamadı')).toHaveCount(0)
  await expect.poll(() => rankingRequests.at(-1)?.searchParams.get('sortKey')).toBe('TARGET_ACHIEVEMENT')
  await expect.poll(() => rankingRequests.at(-1)?.searchParams.get('sortDirection')).toBe('asc')
  await expect(page.getByText('Low HG Store')).toBeVisible()
  await expect(rankingTable.locator('tbody')).toContainText('%91,21')
})

test('store rankings removes signal chrome while preserving weighted score rows', async ({ page }) => {
  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          userId: 'region-ranking-user',
          roleCodes: ['REGION_MANAGER'],
        },
      },
    })
  })

  await page.unroute('**/api/reports/rankings**')
  await page.route('**/api/reports/rankings**', async (route) => {
    await route.fulfill({
      json: {
        ...rankingsPrivilegedDetailFixture,
        storeLeaderboard: {
          ...rankingsPrivilegedDetailFixture.storeLeaderboard,
          items: [scoreDisplayLeaderStoreRow, scoreDisplayFollowerStoreRow],
          meta: {
            total: 2,
            limit: 100,
            offset: 0,
          },
        },
      },
    })
  })

  await page.goto('/store/rankings')

  const rows = page.locator('.store-rankings-table tbody tr')
  await expect(rows.nth(0)).toContainText('Weighted Score Leader With Long Store Name')
  await expect(rows.nth(0).locator('.store-rankings-scorebar')).toContainText('112,30')
  await expect(rows.nth(1)).toContainText('Raw Delta Trap')
  await expect(rows.nth(1).locator('.store-rankings-scorebar')).toContainText('104,20')
  await expect(page.getByText('Sinyal')).toHaveCount(0)

  await expect(page.getByRole('columnheader', { name: 'Aksiyon' })).toHaveCount(0)
  await expect(rows.nth(0).getByRole('button', { name: 'Detay aç' })).toHaveCount(0)
  await expect(page.locator('.store-rankings-drawer')).toHaveCount(0)
})

test('store rankings store rows keep long names on one line without covering scores', async ({ page }) => {
  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          userId: 'region-ranking-user',
          roleCodes: ['REGION_MANAGER'],
        },
      },
    })
  })

  await page.unroute('**/api/reports/rankings**')
  await page.route('**/api/reports/rankings**', async (route) => {
    await route.fulfill({
      json: {
        ...rankingsPrivilegedDetailFixture,
        storeLeaderboard: {
          ...rankingsPrivilegedDetailFixture.storeLeaderboard,
          items: [
            {
              ...scoreDisplayLeaderStoreRow,
              storeName: 'Istanbul Beylikduzu Cadde Avm Metropol Outlet Uzun Magaza Adi',
            },
            scoreDisplayFollowerStoreRow,
          ],
          meta: {
            total: 2,
            limit: 100,
            offset: 0,
          },
        },
      },
    })
  })

  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/store/rankings')

  const firstRow = page.locator('.store-rankings-table tbody tr').first()
  const storeName = firstRow.locator('.store-rankings-entity-copy-store strong')
  await expect(storeName).toBeVisible()

  const storeTextLayout = await storeName.evaluate((node) => {
    const rect = node.getBoundingClientRect()
    const style = window.getComputedStyle(node)

    return {
      height: rect.height,
      lineHeight: Number.parseFloat(style.lineHeight),
      overflow: style.overflow,
      textOverflow: style.textOverflow,
      whiteSpace: style.whiteSpace,
    }
  })

  expect(storeTextLayout.whiteSpace).toBe('nowrap')
  expect(storeTextLayout.overflow).toBe('hidden')
  expect(storeTextLayout.textOverflow).toBe('ellipsis')
  expect(storeTextLayout.height).toBeLessThanOrEqual(storeTextLayout.lineHeight * 1.35)

  const tableWidthState = await page.locator('.store-rankings-table-wrap').evaluate((wrap) => {
    const table = wrap.querySelector('.store-rankings-table')
    const finalHeader = table?.querySelector('thead th:last-child')
    const wrapRect = wrap.getBoundingClientRect()
    const finalHeaderRect = finalHeader?.getBoundingClientRect()

    return {
      clientWidth: wrap.clientWidth,
      scrollWidth: wrap.scrollWidth,
      finalHeaderRight: finalHeaderRect?.right ?? Number.POSITIVE_INFINITY,
      wrapRight: wrapRect.right,
    }
  })

  expect(tableWidthState.scrollWidth).toBeLessThanOrEqual(tableWidthState.clientWidth + 1)
  expect(tableWidthState.finalHeaderRight).toBeLessThanOrEqual(tableWidthState.wrapRight + 1)

  const cellGap = await firstRow.evaluate((row) => {
    const storeCell = row.querySelector('.store-rankings-cell-entity')
    const scoreCell = row.querySelector('.store-rankings-cell-score')

    if (!storeCell || !scoreCell) {
      return Number.NEGATIVE_INFINITY
    }

    return scoreCell.getBoundingClientRect().left - storeCell.getBoundingClientRect().right
  })

  expect(cellGap).toBeGreaterThanOrEqual(-1)
})

test('store tasks page renders readable Turkish queue labels', async ({ page }) => {
  await page.goto('/store/tasks')

  await expect(page.getByRole('heading', { name: 'Görevler' })).toBeVisible()
  await expect(page.getByText('Mağaza aksiyonları, checklist takipleri ve projeksiyon işleri.')).toBeVisible()
  await expect(page.getByText('Detay ozeti')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'İş kuyruğu' })).toBeVisible()
  await expect(page.getByText('Açık iş').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Projeksiyon', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Checklist', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Hedef' })).toHaveCount(0)
  await expect(page.getByText('Store Action İş Akışı')).toHaveCount(0)
  await expect(page.getByText('Mağaza aksiyon listesi')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ã')
  await expect(page.locator('body')).not.toContainText('Ä')
  await expect(page.locator('body')).not.toContainText('Å')
})

test('store tasks lets managers retry after the queue load fails', async ({ page }) => {
  let inboxAttempts = 0
  let allowInbox = false

  await page.unroute('**/api/workflow/inbox')
  await page.route('**/api/workflow/inbox', async (route) => {
    inboxAttempts += 1

    if (!allowInbox) {
      await route.fulfill({
        status: 503,
        json: { message: 'Temporary workflow inbox outage' },
      })
      return
    }

    await route.fulfill({ json: workflowInboxFixture })
  })

  await page.goto('/store/tasks')

  await expect(page.getByRole('heading', { name: 'Görevler açılamadı' })).toBeVisible()
  const retryButton = page.getByRole('button', { name: 'Tekrar dene' })
  await expect(retryButton).toBeVisible()

  allowInbox = true
  await retryButton.click()

  await expect(page.getByRole('heading', { name: 'Görevler' })).toBeVisible()
  await expect.poll(() => inboxAttempts).toBeGreaterThan(1)
  await expect(page.getByRole('heading', { name: 'Görevler açılamadı' })).toHaveCount(0)
})

test('store tasks command-center copy stays stable when locale changes', async ({ page }) => {
  await page.goto('/store/tasks')

  await setStoredLocale(page, 'en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Görevler' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'İş kuyruğu' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Projeksiyon', exact: true })).toBeVisible()
  await expect(page.getByText('Store Action workflow')).toHaveCount(0)
  await expect(page.getByText('Store action list')).toHaveCount(0)
  await expect(page.getByText('Aksiyon gerektiren işler')).toHaveCount(0)
  await expect(page.getByText('Detay özeti')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ãƒ')
  await expect(page.locator('body')).not.toContainText('Ã„')
  await expect(page.locator('body')).not.toContainText('Ã…')

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Görevler' })).toBeVisible()
})

test('store tasks checklist acknowledgement opens the exact checklist receipt', async ({ page }) => {
  let acknowledgementRequests = 0

  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
  })
  await page.unroute('**/api/auth/session')
  await page.unroute('**/api/workflow/inbox')
  await page.unroute('**/api/checklists/acknowledgements/list')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          roleCodes: ['SUPER_ADMIN', 'STORE_MANAGER'],
        },
      },
    })
  })
  await page.route('**/api/workflow/inbox', async (route) => {
    await route.fulfill({
      json: {
        items: [
          {
            itemType: 'acknowledgement',
            sourceType: 'checklist_receipt',
            sourceId: 'checklist-instance-bm-1',
            title: 'BM Result',
            summary: 'IstinyePark Demo Store completed checklist result',
            storeId: demoStoreId,
            storeName: 'IstinyePark Demo Store',
            workflowStatus: 'completed',
            inboxStatus: 'needs_attention',
            urgency: 'medium',
            createdAt: '2026-05-12T09:00:00.000Z',
            needsAttentionAt: '2026-05-12T09:00:00.000Z',
            actorRole: 'STORE_MANAGER',
            primaryActionLabel: 'I acknowledge',
            secondaryActionLabel: 'Open checklist result',
            deepLink: '/store/checklists?tab=inbox&result=checklist-instance-bm-1',
          },
        ],
        meta: {
          count: 1,
          total: 1,
          limit: 30,
          offset: 0,
        },
      },
    })
  })
  await page.route('**/api/checklists/acknowledgements/list', async (route) => {
    acknowledgementRequests += 1
    await route.fulfill({ json: checklistAcknowledgementsFixture })
  })

  await page.goto('/store/tasks')
  await expect.poll(() => acknowledgementRequests).toBeGreaterThanOrEqual(1)
  await page.getByTestId('store-task-queue-row').filter({ hasText: 'BM Result' }).click()
  await page.getByRole('dialog', { name: 'Görev detayı' }).getByRole('link', { name: 'Kaynağı aç' }).click()

  await expect(page).toHaveURL(/\/store\/checklists\?tab=inbox&result=checklist-instance-bm-1$/)
  await expect(page.locator('#store-checklist-tab-inbox')).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog')).toContainText('Checklist result')
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'BM Result' })).toBeVisible()

  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click()

  await expect(page).toHaveURL(/\/store\/checklists\?tab=inbox$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    page.getByRole('heading', { name: 'Completed checklist receipts waiting on store acknowledgement' }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'View details' }).click()

  await expect(page).toHaveURL(/\/store\/checklists\?tab=inbox&result=checklist-instance-bm-1$/)
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'BM Result' })).toBeVisible()
})

test('store tasks keeps target approvals out of the command center', async ({ page }) => {
  let targetDistributionRequests = 0

  await page.unroute('**/api/workflow/inbox')
  await page.unroute('**/api/target-distributions/requests**')
  await page.route('**/api/workflow/inbox', async (route) => {
    await route.fulfill({
      json: {
        items: [
          {
            itemType: 'approval',
            sourceType: 'target_distribution_request',
            sourceId: 'target-request-prefetch-1',
            title: 'Mayis hedef dagitimi',
            summary: 'IstinyePark Demo Store icin hedef onayi bekliyor',
            storeId: demoStoreId,
            storeName: 'IstinyePark Demo Store',
            workflowStatus: 'pending_region_approval',
            inboxStatus: 'needs_attention',
            urgency: 'medium',
            createdAt: '2026-05-12T09:00:00.000Z',
            needsAttentionAt: '2026-05-12T09:00:00.000Z',
            actorRole: 'STORE_MANAGER',
            primaryActionLabel: 'Talebi ac',
            secondaryActionLabel: 'Onay yuzeyine git',
            deepLink: '/store/approvals',
          },
        ],
        meta: {
          count: 1,
          total: 1,
          limit: 30,
          offset: 0,
        },
      },
    })
  })
  await page.route('**/api/target-distributions/requests**', async (route) => {
    if (route.request().method() === 'GET') {
      targetDistributionRequests += 1
      await route.fulfill({ json: targetDistributionRequestsFixture })
      return
    }

    await route.fulfill({
      status: 403,
      json: { message: 'Target distribution write route is not mocked in this surface test.' },
    })
  })

  await page.goto('/store/tasks')

  await expect(page.getByText('Mayis hedef dagitimi')).toHaveCount(0)
  await expect(page.getByTestId('store-action-plans-panel').locator('a[href="/store/approvals"]')).toHaveCount(0)
  await expect.poll(() => targetDistributionRequests, { timeout: 1000 }).toBe(0)
})

test('store checklist acknowledgement refreshes the store task queue', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
  })
  await page.unroute('**/api/auth/session')
  await page.unroute('**/api/workflow/inbox')
  await page.unroute('**/api/checklists/acknowledgements/list')
  let acknowledged = false
  let workflowInboxRequests = 0

  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          roleCodes: ['STORE_MANAGER'],
        },
      },
    })
  })
  await page.route('**/api/workflow/inbox', async (route) => {
    workflowInboxRequests += 1
    await route.fulfill({
      json: {
        items: acknowledged
          ? []
          : [
              {
                itemType: 'acknowledgement',
                sourceType: 'checklist_receipt',
                sourceId: 'checklist-instance-bm-1',
                title: 'BM Result',
                summary: 'IstinyePark Demo Store completed checklist result',
                storeId: demoStoreId,
                storeName: 'IstinyePark Demo Store',
                workflowStatus: 'completed',
                inboxStatus: 'needs_attention',
                urgency: 'medium',
                createdAt: '2026-05-12T09:00:00.000Z',
                needsAttentionAt: '2026-05-12T09:00:00.000Z',
                actorRole: 'STORE_MANAGER',
                primaryActionLabel: 'I acknowledge',
                secondaryActionLabel: 'Open checklist result',
                deepLink: '/store/checklists?tab=inbox&result=checklist-instance-bm-1',
              },
            ],
        meta: {
          count: acknowledged ? 0 : 1,
          total: acknowledged ? 0 : 1,
          limit: 30,
          offset: 0,
        },
      },
    })
  })
  await page.route('**/api/checklists/acknowledgements/list', async (route) => {
    await route.fulfill({
      json: {
        ...checklistAcknowledgementsFixture,
        items: checklistAcknowledgementsFixture.items.map((item) =>
          item.checklistInstanceId === 'checklist-instance-bm-1'
            ? {
                ...item,
                acknowledgement: acknowledged
                  ? {
                      checklistAcknowledgementId: 'checklist-ack-bm-1',
                      acknowledgedByUserId: 'store-manager-1',
                      acknowledgementNote: 'Store saw the completed visit',
                      acknowledgedAt: '2026-05-12T11:00:00.000Z',
                    }
                  : null,
              }
            : item,
        ),
      },
    })
  })
  await page.route('**/api/checklists/instances/*/acknowledge', async (route) => {
    expect(route.request().method()).toBe('POST')
    acknowledged = true
    await route.fulfill({
      json: {
        command: { status: 'acknowledged', message: 'Checklist instance acknowledged' },
        data: {
          acknowledgement: {
            checklistAcknowledgementId: 'checklist-ack-bm-1',
            acknowledgedByUserId: 'store-manager-1',
            acknowledgementNote: 'Store saw the completed visit',
            acknowledgedAt: '2026-05-12T11:00:00.000Z',
          },
        },
      },
    })
  })

  await page.goto('/store/tasks')
  await expect(page.getByTestId('store-task-queue-row').filter({ hasText: 'BM Result' })).toBeVisible()
  expect(workflowInboxRequests).toBe(1)

  await page.getByTestId('store-task-queue-row').filter({ hasText: 'BM Result' }).click()
  await page.getByRole('dialog', { name: 'Görev detayı' }).getByRole('link', { name: 'Kaynağı aç' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'I acknowledge' }).click()
  await expect(page).toHaveURL(/\/store\/checklists\?tab=history$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.goto('/store/tasks')

  await expect.poll(() => workflowInboxRequests).toBeGreaterThanOrEqual(2)
  await expect(page.getByTestId('store-task-queue-row').filter({ hasText: 'BM Result' })).toHaveCount(0)
})

test('store incentives page switches to English copy and persists locale', async ({ page }) => {
  await page.goto('/store/incentives')
  const incentiveSurface = page.getByTestId('store-incentives-page')

  await expect(page.getByRole('heading', { name: /primleri$/i })).toBeVisible()
  await expect(incentiveSurface.getByText('Primler', { exact: true })).toBeVisible()
  await expect(incentiveSurface.getByText('Toplam hakediş')).toBeVisible()
  await expect(page.getByText('Store Incentives')).toHaveCount(0)

  await setStoredLocale(page, 'en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: /Store incentives/i })).toBeVisible()
  await expect(incentiveSurface.getByText('Incentives', { exact: true })).toBeVisible()
  await expect(incentiveSurface.getByText('Total entitlement')).toBeVisible()
  await expect(page.getByText('Mağaza primleri')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ãƒ')
  await expect(page.locator('body')).not.toContainText('Ã„')
  await expect(page.locator('body')).not.toContainText('Ã…')

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: /Store incentives/i })).toBeVisible()
})

test('store competitions page renders visible contribution details', async ({ page }) => {
  await page.goto('/store/competitions')

  await expect(page.getByRole('heading', { name: /Mağaza yarışmaları/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'April Region Challenge' }).first()).toBeVisible()
  const readSummary = page.getByLabel('Mağaza yarışma okuma özeti')
  const contributionRows = page.getByLabel('Yetkili mağaza yarışma katkıları')
  await expect(readSummary.getByText('Okuma özeti')).toBeVisible()
  await expect(readSummary.getByText('95% katkı kapsamı')).toBeVisible()
  await expect(contributionRows.getByText('Katkı sağlığı')).toBeVisible()
  await expect(contributionRows.getByText('Kısmi katkı').first()).toBeVisible()
  await expect(contributionRows.getByText('BM checklist', { exact: true })).toBeVisible()
  await expect(page.getByText('Mağaza katkıları')).toBeVisible()
  await expect(page.getByText('IstinyePark Demo Store')).toBeVisible()
  await expect(page.getByText('93.50')).toBeVisible()
  await expect(page.getByText('Outside Region Store')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Recalculate/ })).toHaveCount(0)
})

test('store competitions lets store users retry after the detail load fails', async ({ page }) => {
  let detailAttempts = 0
  let allowCompetitionDetail = false

  await page.unroute('**/api/competitions**')
  await page.route('**/api/competitions**', async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname

    if (request.method() === 'GET' && pathname.endsWith('/api/competitions')) {
      await route.fulfill({
        json: {
          items: [competitionFixture],
          meta: { count: 1, total: 1, limit: 50, offset: 0 },
        },
      })
      return
    }

    if (
      request.method() === 'GET' &&
      pathname.endsWith(`/api/competitions/${competitionFixture.competitionId}`)
    ) {
      detailAttempts += 1

      if (!allowCompetitionDetail) {
        await route.fulfill({
          status: 503,
          json: { message: 'Temporary competition detail outage' },
        })
        return
      }

      await route.fulfill({ json: competitionDetailFixture })
      return
    }

    await route.fulfill({
      status: 403,
      json: { message: 'Store competition surface is read-only' },
    })
  })

  await page.goto('/store/competitions')

  await expect(page.getByRole('heading', { name: 'Sıralama açılamadı' })).toBeVisible()
  const retryButton = page.getByRole('button', { name: 'Tekrar dene' })
  await expect(retryButton).toBeVisible()

  allowCompetitionDetail = true
  await retryButton.click()

  await expect(page.getByLabel('Mağaza yarışma okuma özeti').getByText('Okuma özeti')).toBeVisible()
  await expect.poll(() => detailAttempts).toBeGreaterThan(1)
  await expect(page.getByRole('heading', { name: 'Sıralama açılamadı' })).toHaveCount(0)
})

test('store competitions page localizes lifecycle states and competition types', async ({ page }) => {
  const competitionSummaries = [
    competitionFixture,
    {
      ...competitionFixture,
      competitionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02',
      competitionCode: 'MAY_REGION_LEAGUE',
      competitionName: 'May Region League',
      competitionType: 'region_league',
      lifecycleState: 'published',
    },
    {
      ...competitionFixture,
      competitionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03',
      competitionCode: 'SUMMER_CAMPAIGN',
      competitionName: 'Summer Campaign',
      competitionType: 'campaign',
      lifecycleState: 'completed',
    },
  ]

  await page.unroute('**/api/competitions**')
  await page.route('**/api/competitions**', async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname

    if (request.method() === 'GET' && pathname.endsWith('/api/competitions')) {
      await route.fulfill({
        json: {
          items: competitionSummaries,
          meta: {
            count: competitionSummaries.length,
            total: competitionSummaries.length,
            limit: 50,
            offset: 0,
          },
        },
      })
      return
    }

    if (
      request.method() === 'GET' &&
      pathname.endsWith(`/api/competitions/${competitionFixture.competitionId}`)
    ) {
      await route.fulfill({ json: competitionDetailFixture })
      return
    }

    await route.fulfill({
      status: 403,
      json: { message: 'Store competition surface is read-only' },
    })
  })

  await page.goto('/store/competitions')

  const leagueRow = page.locator('article').filter({ hasText: 'May Region League' })
  const campaignRow = page.locator('article').filter({ hasText: 'Summer Campaign' })
  await expect(leagueRow.getByText('yayında', { exact: true })).toBeVisible()
  await expect(leagueRow.getByText('bölge ligi', { exact: true })).toBeVisible()
  await expect(campaignRow.getByText('tamamlandı', { exact: true })).toBeVisible()
  await expect(campaignRow.getByText('kampanya', { exact: true })).toBeVisible()
  await expect(page.locator('body')).not.toContainText('published')
  await expect(page.locator('body')).not.toContainText('completed')
  await expect(page.locator('body')).not.toContainText('region_league')
})

test('store competitions page switches chrome to English copy and persists locale', async ({
  page,
}) => {
  await page.goto('/store/competitions')

  await expect(page.getByRole('heading', { name: /Mağaza yarışmaları/i })).toBeVisible()
  await expect(page.getByText('Görünür yarışmalar')).toBeVisible()
  await expect(page.getByText('Sadece okuma')).toBeVisible()
  await expect(page.getByRole('button', { name: 'İncele' }).first()).toBeVisible()
  await expect(page.getByText('Store competitions')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ã')
  await expect(page.locator('body')).not.toContainText('Ä')
  await expect(page.locator('body')).not.toContainText('Å')

  await setStoredLocale(page, 'en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: /Store competitions/i })).toBeVisible()
  await expect(page.getByText('Visible challenges')).toBeVisible()
  await expect(page.getByText('Read only')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Review' }).first()).toBeVisible()
  await expect(page.getByText('Team standing', { exact: true })).toBeVisible()
  await expect(page.getByText('Contribution rows').first()).toBeVisible()
  await expect(page.getByText('Mağaza yarışmaları')).toHaveCount(0)

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: /Store competitions/i })).toBeVisible()
})

test('store approvals page renders request center without creation forms', async ({ page }) => {
  await page.goto('/store/approvals')

  await expect(page.getByRole('heading', { name: 'Talep Merkezi' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Açık / Bekleyen' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Tamamlanan' })).toBeVisible()
  await expect(page.getByLabel('Hedef dağıtım talebi formu')).toHaveCount(0)
  await expect(page.getByLabel('Satıcı kodu talebi formu')).toHaveCount(0)
  await expect(page.getByLabel('Personel çıkış talebi formu')).toHaveCount(0)
  await expect(page.locator('.store-approvals-ledger-grid')).toHaveCount(0)
  await expect(page.locator('.store-approvals-ledger-table')).toHaveCount(0)
  await expect(page.locator('.store-approvals-action-workbench')).toHaveCount(0)
  await expect(page.locator('a[href="/store/targets"]').first()).toBeVisible()
})

test('store approvals page keeps region manager request center free of workforce queues', async ({ page }) => {
  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          roleCodes: ['REGION_MANAGER'],
          actionScope: {
            assignedStoreIds: [demoStoreId],
          },
          assignedStoreIds: [demoStoreId],
        },
      },
    })
  })

  const workforceCalls: string[] = []
  await page.unroute('**/api/workforce/seller-code-requests**')
  await page.route('**/api/workforce/seller-code-requests**', async (route) => {
    workforceCalls.push(route.request().url())
    await route.fulfill({
      status: 403,
      json: { message: 'Region manager must not request seller-code queues here.' },
    })
  })
  await page.unroute('**/api/workforce/offboarding-requests**')
  await page.route('**/api/workforce/offboarding-requests**', async (route) => {
    workforceCalls.push(route.request().url())
    await route.fulfill({
      status: 403,
      json: { message: 'Region manager must not request offboarding queues here.' },
    })
  })

  await page.goto('/store/approvals')

  await expect(page.getByRole('heading', { name: 'Talep Merkezi' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'SM' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'BM' })).toHaveCount(0)
  await expect(page.getByLabel('Satıcı kodu talebi formu')).toHaveCount(0)
  await expect(page.getByLabel('Personel çıkış talebi formu')).toHaveCount(0)
  await expect(page.getByLabel('İade edilen personel talepleri')).toHaveCount(0)
  expect(workforceCalls).toEqual([])
})

test('store approvals page presents workforce request load failures as alerts', async ({ page }) => {
  await page.unroute('**/api/workforce/seller-code-requests**')
  await page.route('**/api/workforce/seller-code-requests**', async (route) => {
    await route.fulfill({
      status: 500,
      body: 'Returned seller queue unavailable',
    })
  })
  await page.unroute('**/api/workforce/offboarding-requests**')
  await page.route('**/api/workforce/offboarding-requests**', async (route) => {
    await route.fulfill({
      status: 500,
      body: 'Returned offboarding queue unavailable',
    })
  })

  await page.goto('/store/approvals')

  const alerts = page.getByRole('alert')
  await expect(alerts).toHaveCount(2)
  await expect(alerts.filter({ hasText: 'Returned seller queue unavailable' })).toBeVisible()
  await expect(alerts.filter({ hasText: 'Returned offboarding queue unavailable' })).toBeVisible()
})

test('store approvals page hands returned workforce corrections to workforce with identity', async ({ page }) => {
  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          actionScope: {
            assignedStoreIds: [outsideStoreId, demoStoreId],
          },
          assignedStoreIds: [outsideStoreId, demoStoreId],
        },
      },
    })
  })

  await page.route('**/api/workforce/seller-code-requests**', async (route) => {
    await route.fulfill({
      json: {
        items: [rejectedSellerCodeRequestFixture],
        meta: { count: 1, total: 1, limit: 50, offset: 0 },
      },
    })
  })
  await page.route('**/api/workforce/offboarding-requests**', async (route) => {
    await route.fulfill({
      json: {
        items: [rejectedOffboardingRequestFixture],
        meta: { count: 1, total: 1, limit: 50, offset: 0 },
      },
    })
  })

  await page.goto('/store/approvals')

  const sellerRow = page
    .locator('[data-testid="store-approvals-request-row"]:visible')
    .filter({ hasText: 'Ayse Yilmaz' })
  await sellerRow.getByRole('link', { name: 'Düzelt' }).click()
  await expect(page).toHaveURL(
    new RegExp(
      `/store/workforce\\?storeId=${demoStoreId}&requestType=sellerCode&requestId=${rejectedSellerCodeRequestFixture.requestId}`,
    ),
  )
  const sellerCodeForm = page.getByLabel('Satıcı kodu talebi formu')
  await expect(sellerCodeForm.getByLabel('Ad', { exact: true })).toHaveValue('Ayse')
  await expect(sellerCodeForm.getByLabel('Soyad', { exact: true })).toHaveValue('Yilmaz')

  await page.goto('/store/approvals')
  const offboardingRow = page
    .locator('[data-testid="store-approvals-request-row"]:visible')
    .filter({ hasText: 'Store Personnel' })
  await offboardingRow.getByRole('link', { name: 'Düzelt' }).click()
  await expect(page).toHaveURL(
    new RegExp(
      `/store/workforce\\?storeId=${demoStoreId}&requestType=offboarding&requestId=${rejectedOffboardingRequestFixture.requestId}`,
    ),
  )
  const offboardingForm = page.getByLabel('Personel çıkış talebi formu')
  await expect(offboardingForm.getByRole('combobox', { name: 'Personel' })).toContainText('Store Personnel')
  await expect(offboardingForm.getByLabel('Çıkış tarihi')).toHaveValue('2026-05-10')
})

test('store approvals page keeps pending workforce read actions generic', async ({ page }) => {
  await page.route('**/api/workforce/seller-code-requests**', async (route) => {
    await route.fulfill({
      json: {
        items: [sellerCodeRequestFixture],
        meta: { count: 1, total: 1, limit: 50, offset: 0 },
      },
    })
  })
  await page.route('**/api/workforce/offboarding-requests**', async (route) => {
    await route.fulfill({
      json: {
        items: [offboardingRequestFixture],
        meta: { count: 1, total: 1, limit: 50, offset: 0 },
      },
    })
  })

  await page.goto('/store/approvals')

  const sellerRow = page
    .locator('[data-testid="store-approvals-request-row"]:visible')
    .filter({ hasText: 'Ayse Yilmaz' })
  await expect(sellerRow.getByRole('link', { name: 'Durumu oku' })).toHaveAttribute(
    'href',
    `/store/workforce?storeId=${demoStoreId}`,
  )

  const offboardingRow = page
    .locator('[data-testid="store-approvals-request-row"]:visible')
    .filter({ hasText: 'Store Personnel' })
  await expect(offboardingRow.getByRole('link', { name: 'Durumu oku' })).toHaveAttribute(
    'href',
    `/store/workforce?storeId=${demoStoreId}`,
  )
})

test('store approvals page paginates request center rows after fifteen records', async ({ page }) => {
  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          roleCodes: ['REGION_MANAGER'],
          actionScope: {
            assignedStoreIds: [demoStoreId],
          },
          assignedStoreIds: [demoStoreId],
        },
      },
    })
  })

  const baseRequest = pendingTargetDistributionRequestsFixture.items[0]
  const items = Array.from({ length: 20 }, (_, index) => ({
    ...baseRequest,
    requestId: `00000000-0000-0000-0000-0000000008${String(index).padStart(2, '0')}`,
    storeId: demoStoreId,
    storeName: `Pagination Store ${index + 1}`,
    status: index < 18 ? 'pending_region_approval' : 'approved',
    updatedAt: `2026-05-${String(20 - index).padStart(2, '0')}T10:00:00.000Z`,
  }))

  await page.route('**/api/target-distributions/requests**', async (route) => {
    await route.fulfill({
      json: {
        items,
        meta: { count: items.length, total: items.length, limit: 200, offset: 0 },
      },
    })
  })

  await page.goto('/store/approvals')

  const visibleRows = page.locator('[data-testid="store-approvals-request-row"]:visible')
  const targetAction = visibleRows.getByRole('link', { name: 'Hedefe git' }).first()
  await expect(targetAction).toBeVisible()
  await expect(targetAction).toHaveAttribute('href', /requestMonth=2026-05/)
  await expect(targetAction).toHaveAttribute('href', new RegExp(`storeId=${demoStoreId}`))
  await expect(targetAction).toHaveAttribute('href', /status=pending/)
  await expect(targetAction).toHaveAttribute('href', /tab=approval/)
  await expect(targetAction).toHaveCSS('color', 'rgb(76, 42, 165)')
  await expect(visibleRows).toHaveCount(15)
  await page.getByRole('button', { name: 'Sayfa 2' }).click()
  await expect(visibleRows).toHaveCount(3)
  await page.getByRole('radio', { name: 'Tamamlanan' }).click()
  await expect(visibleRows).toHaveCount(2)
})

test('store approvals page sends store manager target handoff to distribution status', async ({ page }) => {
  await routeAuthSession(page, createStoreAuthSession({
    roleCodes: ['STORE_MANAGER'],
    readStoreIds: [demoStoreId],
    scopeStoreIds: [demoStoreId],
    actionStoreIds: [demoStoreId],
    legacyAssignedStoreIds: [demoStoreId],
    assignedStoreTypes: ['company'],
  }))

  await page.unroute('**/api/target-distributions/requests**')
  await page.route('**/api/target-distributions/requests**', async (route) => {
    await route.fulfill({ json: pendingTargetDistributionRequestsFixture })
  })

  await page.goto('/store/approvals')

  const targetAction = page
    .locator('[data-testid="store-approvals-request-row"]:visible')
    .getByRole('link', { name: 'Hedefe git' })
    .first()
  await expect(targetAction).toBeVisible()
  await expect(targetAction).toHaveAttribute('href', /requestMonth=2026-05/)
  await expect(targetAction).toHaveAttribute('href', new RegExp(`storeId=${demoStoreId}`))
  await expect(targetAction).toHaveAttribute('href', /status=pending/)
  await expect(targetAction).toHaveAttribute('href', /tab=distribution/)
  await expect(targetAction).not.toHaveAttribute('href', /tab=approval/)
})

test('store approvals page switches to English request center copy and persists locale', async ({ page }) => {
  await page.goto('/store/approvals')

  await setStoredLocale(page, 'en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: /Request Center/i })).toBeVisible()
  await expect(page.getByText('Returned corrections')).toBeVisible()
  await expect(page.getByLabel('Seller code request form')).toHaveCount(0)
  await expect(page.getByLabel('Offboarding request form')).toHaveCount(0)
  await expect(page.getByRole('radio', { name: 'Open / Pending' })).toBeVisible()
  await expect(page.locator('a[href="/store/targets"]').first()).toBeVisible()
  await expect(page.getByText('Mağaza onayları')).toHaveCount(0)
  await expect(page.getByText('Satıcı kodu talebi')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('ÃƒÆ’')
  await expect(page.locator('body')).not.toContainText('Ãƒâ€')
  await expect(page.locator('body')).not.toContainText('Ãƒâ€¦')

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: /Request Center/i })).toBeVisible()
})
test('language toggle localizes competition read labels and persists preference', async ({ page }) => {
  await page.goto('/store/competitions')

  const readSummary = page.getByLabel('Mağaza yarışma okuma özeti')
  const contributionRows = page.getByLabel('Yetkili mağaza yarışma katkıları')

  await expect(readSummary.getByRole('heading', { name: 'Okuma özeti' })).toBeVisible()
  await expect(readSummary.getByText('95% katkı kapsamı')).toBeVisible()
  await expect(contributionRows.getByText('Katkı sağlığı')).toBeVisible()
  await expect(contributionRows.getByText('Kısmi katkı').first()).toBeVisible()

  await setStoredLocale(page, 'en')

  const readSummaryEn = page.getByLabel('Store competition read summary')
  const contributionRowsEn = page.getByLabel('Authorized store competition contributions')

  await expect(readSummaryEn.getByRole('heading', { name: 'Read summary' })).toBeVisible()
  await expect(readSummaryEn.getByText('95% contribution coverage')).toBeVisible()
  await expect(contributionRowsEn.getByText('Contribution health')).toBeVisible()
  await expect(contributionRowsEn.getByText('Partial contribution').first()).toBeVisible()

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(readSummaryEn.getByRole('heading', { name: 'Read summary' })).toBeVisible()
  await expect(contributionRowsEn.getByText('Contribution health')).toBeVisible()
  await expect(page.locator('.language-toggle-button')).toHaveCount(0)
})

async function verifyStoreNavTransition(
  page: Page,
  storeNav: Locator,
  input: {
    linkName: string
    path: string
    ready: Locator
  },
) {
  await storeNav.getByRole('link', { name: input.linkName, exact: true }).click()

  await expect(page).toHaveURL(new RegExp(`${escapeRegex(input.path)}$`))
  await expect(input.ready).toBeVisible()
  await expectHealthyStoreTransition(page)
}

async function expectHealthyStoreTransition(page: Page) {
  await expect(page.locator('body')).not.toContainText(
    /Rota yükleniyor|Sayfa geçişi tamamlanamadı|Bu rol için rota kullanılamaz|açılamadı|could not finish|could not be opened|unavailable/i,
  )
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function createStoreAuthSession(input: {
  roleCodes: string[]
  readStoreIds: string[]
  readRegionIds?: string[]
  scopeStoreIds: string[]
  scopeRegionIds?: string[]
  actionStoreIds: string[]
  legacyAssignedStoreIds: string[]
  assignedStoreTypes?: Array<'company' | 'franchise' | 'operator'>
}) {
  return {
    ...authSessionFixture,
    user: {
      ...authSessionFixture.user,
      roleCodes: input.roleCodes,
      scope: {
        ...authSessionFixture.user.scope,
        regionIds: input.scopeRegionIds ?? [],
        storeIds: input.scopeStoreIds,
      },
      readScope: {
        ...authSessionFixture.user.readScope,
        regionIds: input.readRegionIds ?? [],
        storeIds: input.readStoreIds,
      },
      actionScope: {
        assignedStoreIds: input.actionStoreIds,
        assignedStoreTypes: input.assignedStoreTypes ?? [],
      },
      assignedStoreIds: input.legacyAssignedStoreIds,
    },
    scopeSummary: {
      ...authSessionFixture.scopeSummary,
      regionCount: (input.readRegionIds ?? []).length,
      storeCount: input.readStoreIds.length,
      assignedStoreCount: input.actionStoreIds.length,
    },
  }
}

async function routeAuthSession(page: Page, authSession: ReturnType<typeof createStoreAuthSession>) {
  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSession })
  })
}

async function routeRegionWorkforceReadCalls(page: Page, calls: string[]) {
  await page.route('**/api/org/stores', async (route) => {
    await route.fulfill({
      json: {
        items: [
          {
            store_id: demoStoreId,
            store_code: 'IST-DEMO',
            store_name: 'IstinyePark Demo Store',
            region_id: demoRegionId,
            company_id: '00000000-0000-0000-0000-000000000001',
            status: 'active',
          },
          {
            store_id: regionSecondStoreId,
            store_code: 'MAR-FORUM',
            store_name: 'Marmara Forum',
            region_id: demoRegionId,
            company_id: '00000000-0000-0000-0000-000000000001',
            status: 'active',
          },
        ],
        meta: { count: 2, total: 2, limit: 2, offset: 0 },
      },
    })
  })

  await page.route('**/api/workforce/store-employees**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const storeId = requestUrl.searchParams.get('storeId') ?? ''
    calls.push(storeId)

    if (storeId === regionSecondStoreId) {
      await route.fulfill({
        json: {
          items: [
            {
              ...storeEmployeesFixture.items[0],
              employeeId: '00000000-0000-0000-0000-000000000203',
              displayName: 'Region Second Personnel',
              externalEmployeeRef: 'FM8101',
              storeId: regionSecondStoreId,
              assignmentStartDate: '2025-12-01',
            },
          ],
          meta: { count: 1, total: 1, limit: 1, offset: 0 },
        },
      })
      return
    }

    await route.fulfill({ json: storeEmployeesFixture })
  })

  await page.route('**/api/workforce/headcount-gap**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const storeId = requestUrl.searchParams.get('storeId') ?? ''
    await route.fulfill({
      json: {
        store_id: storeId,
        planned_headcount: storeId === regionSecondStoreId ? '2.00' : '5.00',
        active_headcount: storeId === regionSecondStoreId ? '1.00' : '1.00',
        headcount_gap: storeId === regionSecondStoreId ? '1.00' : '4.00',
        planned_fte: storeId === regionSecondStoreId ? '2.00' : '5.00',
        active_fte: storeId === regionSecondStoreId ? '1.00' : '1.00',
        fte_gap: storeId === regionSecondStoreId ? '1.00' : '4.00',
      },
    })
  })

  await page.route('**/api/workforce/position-options**', async (route) => {
    await route.fulfill({ status: 403, json: { message: 'Position options are not used by region workforce read view.' } })
  })
  await page.route('**/api/workforce/seller-code-requests**', async (route) => {
    await route.fulfill({ status: 403, json: { message: 'Workforce requests are not used by region workforce read view.' } })
  })
  await page.route('**/api/workforce/offboarding-requests**', async (route) => {
    await route.fulfill({ status: 403, json: { message: 'Offboarding requests are not used by region workforce read view.' } })
  })
}

async function routeStoreSurfaceApi(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSessionFixture })
  })

  await page.route('**/api/feed?**', async (route) => {
    await route.fulfill({ json: storeFeedFixture })
  })

  await page.route('**/api/org/stores', async (route) => {
    await route.fulfill({
      json: {
        items: [
          {
            store_id: demoStoreId,
            store_code: 'IST-DEMO',
            store_name: 'IstinyePark Demo Store',
            region_id: demoRegionId,
            company_id: '00000000-0000-0000-0000-000000000001',
            status: 'active',
          },
        ],
        meta: { count: 1, total: 1, limit: 1, offset: 0 },
      },
    })
  })

  await page.route('**/api/reports/kpi-config', async (route) => {
    await route.fulfill({ json: kpiConfigFixture })
  })

  await page.route('**/api/reports/my-performance**', async (route) => {
    const requestUrl = new URL(route.request().url())
    await route.fulfill({
      json:
        requestUrl.searchParams.get('periodStart') === '2026-05-01'
          ? myPerformanceMayFixture
          : myPerformanceFixture,
    })
  })

  await page.route('**/api/store/me/incentives**', async (route) => {
    await route.fulfill({ json: ownIncentivesFixture })
  })

  await page.route('**/api/store/incentives**', async (route) => {
    await route.fulfill({ json: storeIncentivesFixture })
  })

  await page.route('**/api/reports/personnel-performance/**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const baseFixture =
      requestUrl.searchParams.get('periodStart') === '2026-05-01'
        ? myPerformanceMayFixture
        : myPerformanceFixture

    await route.fulfill({
      json: {
        ...baseFixture,
        employee: {
          ...baseFixture.employee,
          employeeId: demoEmployeeId,
          displayName: 'Store Personnel - 1',
          storeName: 'IstinyePark Demo Store',
        },
      },
    })
  })

  await page.route('**/api/reports/store-kpi-highlights**', async (route) => {
    await route.fulfill({ json: storeKpiHighlightsFixture })
  })

  await page.route('**/api/reports/kpis**', async (route) => {
    await route.fulfill({
      json: {
        items: storeKpiHighlightsFixture.metrics.map((metric) => ({
          snapshotRunId: 'snapshot-2026-04-24',
          storeId: demoStoreId,
          kpiId: `closed-${metric.code}`,
          kpiCode: metric.code,
          kpiName: metric.label,
          periodStart: '2026-04-24',
          periodEnd: '2026-04-24',
          targetValue: metric.targetValue === null ? null : String(metric.targetValue),
          actualValue: metric.actualValue === null ? null : String(metric.actualValue),
          achievementRate: metric.achievementRate === null ? null : String(metric.achievementRate),
          statusBand: metric.statusBand,
        })),
        meta: {
          count: storeKpiHighlightsFixture.metrics.length,
          total: storeKpiHighlightsFixture.metrics.length,
          limit: 50,
          offset: 0,
        },
      },
    })
  })

  await page.route('**/api/reports/store-score-breakdown**', async (route) => {
    await route.fulfill({
      json: {
        snapshotRunId: 'snapshot-2026-04-24',
        storeId: demoStoreId,
        scoreStatus: 'final',
        totalScore: 87,
        missingWeightPolicy: 'return_missing_weight_to_kpi',
        configuredWeights: {
          kpiPerformanceWeight: 90,
          bmChecklistWeight: 5,
          vmChecklistWeight: 5,
        },
        effectiveWeights: {
          kpiPerformanceWeight: 100,
          bmChecklistWeight: 0,
          vmChecklistWeight: 0,
        },
        components: {
          kpi: {
            included: true,
            score: 87,
            weight: 100,
            contribution: 87,
            status: 'included',
          },
          bmChecklist: {
            included: false,
            score: null,
            weight: 0,
            contribution: null,
            status: 'not_included',
            visitCount: 0,
          },
          vmChecklist: {
            included: false,
            score: null,
            weight: 0,
            contribution: null,
            status: 'not_included',
            visitCount: 0,
          },
        },
      },
    })
  })

  await page.route('**/api/reports/leaderboards/closed**', async (route) => {
    const requestUrl = new URL(route.request().url())
    await route.fulfill({
      json:
        requestUrl.searchParams.get('periodType') === 'monthly'
          ? closedLeaderboardMonthlyPreviewFixture
          : closedLeaderboardFixture,
    })
  })

  await page.route('**/api/reports/rankings**', async (route) => {
    await route.fulfill({ json: rankingsFixture })
  })

  await page.route('**/api/reports/snapshot-runs**', async (route) => {
    await route.fulfill({
      json: {
        items: [
          {
            snapshotRunId: 'snapshot-2026-04-24',
            snapshotDate: '2026-04-24',
            snapshotType: 'daily',
            periodStart: '2026-04-24',
            periodEnd: '2026-04-24',
            runStatus: 'completed',
            generatedAt: '2026-04-24T08:00:00.000Z',
            generatedBy: 'release-smoke',
          },
        ],
        meta: {
          count: 1,
          total: 1,
          limit: 30,
          offset: 0,
        },
      },
    })
  })

  await page.route('**/api/reports/store-monthly-package?**', async (route) => {
    await route.fulfill({
      json: {
        period: '2026-06',
        periodLabel: 'Haziran 2026',
        coverageLabel: '1-14 Haziran',
        isCurrentPeriod: true,
        storeCount: 30,
        sections: [
          { code: 'kpis', label: 'KPI kolonları', value: 'Skor, UPT, ATV, CR, HG%', status: 'ready' },
          { code: 'approval_scores', label: 'Onay skorları', value: 'GSM, BM Checklist, VM Checklist', status: 'ready' },
          { code: 'actions', label: 'Aksiyon durumu', value: 'Bitirildi, devam ediyor, bekliyor', status: 'ready' },
          { code: 'targets', label: 'Hedefler', value: 'Mağaza ve personel hedef durumu', status: 'ready' },
          { code: 'incentives', label: 'Primler', value: 'Hakediş ve kontrol durumu', status: 'ready' },
          { code: 'workforce', label: 'Norm Kadro', value: 'Aktif, norm, eksik gün, turnover', status: 'ready' },
          { code: 'visits', label: 'Ziyaret', value: 'Son ziyaret ve geçen gün', status: 'ready' },
        ],
        items: [
          {
            regionManager: 'Onur Kaytan',
            storeName: 'IstinyePark Demo Store',
            city: 'İstanbul',
            period: 'Haziran 2026',
            reportRange: '1-14 Haziran',
            score: '87,20',
            upt: '4,12',
            atv: '4.850,00',
            cr: '%22,4',
            hg: '%104,5',
            gsm: '%96',
            bmChecklist: '91',
            vmChecklist: '88',
            actionStatus: 'Devam ediyor',
            targetStatus: 'Onaylandı',
            incentiveStatus: 'Kontrol edildi',
            normFiili: '6 / 6',
            missingDays: 'Yok',
            turnover: 'Veri yok',
            lastVisit: '14 Haziran',
            daysSinceVisit: '7 gün',
            dataNote: '',
          },
        ],
      },
    })
  })

  await page.route('**/api/reports/store-monthly-package.xlsx?**', async (route) => {
    await route.fulfill({
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body: 'store-report-package',
    })
  })

  await page.route('**/api/workflow/inbox', async (route) => {
    await route.fulfill({ json: workflowInboxFixture })
  })

  await page.route('**/api/store-actions/plans**', async (route) => {
    await route.fulfill({
      json: {
        items: [],
        meta: { count: 0, total: 0, limit: 20, offset: 0 },
      },
    })
  })

  await page.route('**/api/checklists/acknowledgements/list', async (route) => {
    await route.fulfill({ json: checklistAcknowledgementsFixture })
  })

  await page.route('**/api/mobile/checklists/today', async (route) => {
    await route.fulfill({ json: mobileChecklistTodayFixture })
  })

  await page.route('**/api/target-distributions/requests**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: targetDistributionRequestsFixture })
      return
    }

    await route.fulfill({
      status: 403,
      json: { message: 'Target distribution write route is not mocked in this surface test.' },
    })
  })

  await page.route('**/api/target-distributions/store-personnel**', async (route) => {
    await route.fulfill({ json: storeTargetingPersonnelFixture })
  })

  await page.route('**/api/workforce/position-options**', async (route) => {
    await route.fulfill({ json: positionOptionsFixture })
  })

  await page.route('**/api/workforce/store-employees**', async (route) => {
    await route.fulfill({ json: storeEmployeesFixture })
  })

  await page.route('**/api/workforce/headcount-gap**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const storeId = requestUrl.searchParams.get('storeId') ?? demoStoreId
    await route.fulfill({
      json: {
        store_id: storeId,
        planned_headcount: '5.00',
        active_headcount: '1.00',
        headcount_gap: '4.00',
        planned_fte: '5.00',
        active_fte: '1.00',
        fte_gap: '4.00',
      },
    })
  })

  await page.route('**/api/workforce/seller-code-requests**', async (route) => {
    await route.fulfill({
      json: {
        items: [],
        meta: { count: 0, total: 0, limit: 50, offset: 0 },
      },
    })
  })

  await page.route('**/api/workforce/offboarding-requests**', async (route) => {
    await route.fulfill({
      json: {
        items: [],
        meta: { count: 0, total: 0, limit: 50, offset: 0 },
      },
    })
  })

  await page.route('**/api/competitions**', async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname

    if (request.method() === 'GET' && pathname.endsWith('/api/competitions')) {
      await route.fulfill({
        json: {
          items: [competitionFixture],
          meta: { count: 1, total: 1, limit: 50, offset: 0 },
        },
      })
      return
    }

    if (
      request.method() === 'GET' &&
      pathname.endsWith(`/api/competitions/${competitionFixture.competitionId}`)
    ) {
      await route.fulfill({ json: competitionDetailFixture })
      return
    }

    await route.fulfill({
      status: 403,
      json: { message: 'Store competition surface is read-only' },
    })
  })
}

const authSessionFixture = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'store-me-smoke-user',
    employeeId: demoEmployeeId,
    roleCodes: ['STORE_PERSONNEL', 'STORE_MANAGER', 'offline_access', 'uma_authorization', 'default-roles-store-ops'],
    scope: {
      companyIds: ['00000000-0000-0000-0000-000000000001'],
      regionIds: ['00000000-0000-0000-0000-000000000010'],
      storeIds: [demoStoreId],
    },
    readScope: {
      companyIds: ['00000000-0000-0000-0000-000000000001'],
      regionIds: ['00000000-0000-0000-0000-000000000010'],
      storeIds: [demoStoreId],
    },
    actionScope: {
      assignedStoreIds: [demoStoreId],
      assignedStoreTypes: ['company'],
    },
    assignedStoreIds: [demoStoreId],
  },
  scopeSummary: {
    companyCount: 1,
    regionCount: 1,
    storeCount: 1,
    assignedStoreCount: 1,
  },
}

const workflowInboxFixture = {
  items: [
    {
      itemType: 'task',
      sourceType: 'kpi_exception',
      sourceId: 'snapshot-2026-04-24:store:kpi',
      title: 'UPT at risk',
      summary: 'IstinyePark Demo Store icin KPI exception takibi gerekiyor',
      storeId: demoStoreId,
      storeName: 'IstinyePark Demo Store',
      workflowStatus: 'at_risk',
      inboxStatus: 'needs_attention',
      urgency: 'high',
      createdAt: '2026-04-24T08:00:00.000Z',
      needsAttentionAt: '2026-04-24T08:00:00.000Z',
      actorRole: 'STORE_MANAGER',
      primaryActionLabel: 'Open KPI detail',
      secondaryActionLabel: 'Detay aç',
      deepLink: '/store/kpis',
      historyPreview: 'Achievement 84%',
    },
  ],
  meta: {
    count: 1,
    total: 1,
    limit: 30,
    offset: 0,
  },
}

const checklistAcknowledgementsFixture = {
  items: [
    {
      checklistInstanceId: 'checklist-instance-bm-1',
      checklistTemplateId: 'checklist-template-bm-1',
      templateName: 'BM Result',
      templateType: 'BM_STORE_VISIT',
      category: 'BM',
      storeId: demoStoreId,
      storeName: 'IstinyePark Demo Store',
      completedByUserId: 'region-user-1',
      completedAt: '2026-05-12T09:00:00.000Z',
      status: 'completed',
      totalScore: 82,
      complianceRate: 0.82,
      responses: [],
      acknowledgement: null,
    },
    {
      checklistInstanceId: 'checklist-instance-vm-1',
      checklistTemplateId: 'checklist-template-vm-1',
      templateName: 'VM Result',
      templateType: 'VM_STORE_VISIT',
      category: 'VM',
      storeId: demoStoreId,
      storeName: 'IstinyePark Demo Store',
      completedByUserId: 'vm-user-1',
      completedAt: '2026-05-11T09:00:00.000Z',
      status: 'completed',
      totalScore: 94,
      complianceRate: 0.94,
      responses: [],
      acknowledgement: {
        checklistAcknowledgementId: 'checklist-ack-vm-1',
        acknowledgedByUserId: 'store-manager-1',
        acknowledgementNote: 'Goruldu',
        acknowledgedAt: '2026-05-11T11:00:00.000Z',
      },
    },
  ],
  meta: {
    count: 2,
    total: 2,
    limit: 50,
    offset: 0,
  },
}

const mobileChecklistTodayFixture = {
  data: {
    stores: [
      { storeId: demoStoreId, storeName: 'IstinyePark Demo Store' },
      { storeId: '00000000-0000-0000-0000-000000000101', storeName: 'Marmara Park Demo Store' },
    ],
    templates: [
      {
        checklistTemplateId: 'checklist-template-bm-1',
        templateCode: 'BM_STORE_VISIT_2026',
        templateType: 'BM_STORE_VISIT',
        templateName: 'BM Visit',
        versionNo: 1,
        items: [],
      },
      {
        checklistTemplateId: 'checklist-template-vm-1',
        templateCode: 'VM_STORE_VISIT_2026',
        templateType: 'VM_STORE_VISIT',
        templateName: 'VM Visit',
        versionNo: 1,
        items: [],
      },
    ],
    activeInstances: [
      {
        checklistInstanceId: 'checklist-active-bm-1',
        checklistTemplateId: 'checklist-template-bm-1',
        storeId: demoStoreId,
        status: 'in_progress',
        startedAt: '2026-05-12T10:00:00.000Z',
        updatedAt: '2026-05-12T10:10:00.000Z',
        responses: [],
      },
    ],
    completedThisMonth: [
      {
        checklistInstanceId: 'checklist-instance-bm-1',
        checklistTemplateId: 'checklist-template-bm-1',
        storeId: demoStoreId,
        completedAt: '2026-05-12T09:00:00.000Z',
        totalScore: 82,
        acknowledgedAt: null,
      },
    ],
    pendingAcknowledgements: [],
    monthlySummaries: [
      {
        storeId: demoStoreId,
        checklistTemplateId: 'checklist-template-bm-1',
        monthStart: '2026-05-01',
        completedCount: 1,
        averageScore: 82,
      },
    ],
  },
}

const storeFeedFixture = {
  items: [
    {
      feedPostId: 'store-home-feed-1',
      postType: 'announcement',
      title: 'Pilot announcement',
      body: 'Pilot store shell announcement.',
      linkLabel: null,
      linkUrl: null,
      visibilityScopeType: 'store',
      visibilityScopeIds: [demoStoreId],
      isPinned: true,
      publishStatus: 'published',
      publishedAt: '2026-05-01T08:00:00.000Z',
      startsAt: null,
      endsAt: null,
      metricCode: null,
      metricLabel: null,
      challengeStartsOn: null,
      challengeEndsOn: null,
      targetRoute: null,
      createdByUserId: 'store-me-smoke-user',
      updatedByUserId: 'store-me-smoke-user',
      createdAt: '2026-05-01T08:00:00.000Z',
      updatedAt: '2026-05-01T08:00:00.000Z',
    },
  ],
  meta: {
    count: 1,
    total: 1,
    limit: 50,
    offset: 0,
  },
}

const kpiConfigFixture = {
  storeProfile: {
    profileCode: 'store',
    title: 'Store Score',
    summary: 'Store score profile',
    futureMetricRule: 'Manual review',
    metrics: [
      {
        code: 'TARGET_ACHIEVEMENT',
        label: 'Target Achievement',
        weightPercent: 70,
        ownerRole: 'STORE_MANAGER',
        scoreBehavior: 'score_only',
      },
      {
        code: 'UPT',
        label: 'Units Per Ticket',
        weightPercent: 30,
        ownerRole: 'STORE_MANAGER',
        scoreBehavior: 'score_only',
      },
    ],
  },
  personnelProfile: {
    profileCode: 'personnel',
    title: 'Personnel Score',
    summary: 'Personnel score profile',
    futureMetricRule: 'Manual review',
    metrics: [
      {
        code: 'TARGET_ACHIEVEMENT',
        label: 'Target Achievement',
        weightPercent: 40,
        ownerRole: 'STORE_PERSONNEL',
        scoreBehavior: 'score_only',
      },
      {
        code: 'ATV',
        label: 'Average Ticket Value',
        weightPercent: 30,
        ownerRole: 'STORE_PERSONNEL',
        scoreBehavior: 'score_only',
      },
      {
        code: 'UPT',
        label: 'Units Per Ticket',
        weightPercent: 30,
        ownerRole: 'STORE_PERSONNEL',
        scoreBehavior: 'score_only',
      },
    ],
  },
  ownershipMatrix: [],
  gradingBands: [
    {
      code: 'A',
      label: 'Excellent',
      emoji: 'A',
      tone: 'calm',
      minScore: 1,
    },
    {
      code: 'B',
      label: 'Healthy',
      emoji: 'B',
      tone: 'accent',
      minScore: 0.85,
    },
  ],
}

const myPerformanceFixture = {
  source: {
    mode: 'live',
    snapshotRunId: null,
    snapshotDate: null,
  },
  employee: {
    employeeId: demoEmployeeId,
    displayName: 'Store Personnel',
    storeId: demoStoreId,
    storeName: 'IstinyePark Demo Store',
  },
  period: {
    periodStart: '2026-04-01',
    periodEnd: '2026-04-30',
  },
  score: {
    value: 91.5,
    matchedMetrics: 3,
    totalMetrics: 3,
  },
  rankings: {
    turkeyRank: 1,
    turkeyPopulation: 4,
    storeRank: 1,
    storePopulation: 3,
  },
  availablePeriods: [
    {
      periodType: 'monthly',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
    },
    {
      periodType: 'monthly',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
    },
  ],
  partial: {
    isPartial: false,
    missingMetricCodes: [],
    missingMetricLabels: [],
    pendingNormalizationCodes: [],
    pendingNormalizationLabels: [],
  },
  supporting: {
    netSalesValue: 145000,
    targetEntryMode: 'manager_assignment',
    targetEditableByCurrentUser: false,
  },
  metrics: [
    {
      code: 'TARGET_ACHIEVEMENT',
      label: 'Target Achievement',
      weightPercent: 40,
      actualValue: 0.98,
      targetValue: null,
      achievementRate: 0.98,
      contributionValue: 39.2,
      dataStatus: 'reported',
      scoreStatus: 'scored',
      status: 'reported',
    },
    {
      code: 'ATV',
      label: 'Average Ticket Value',
      weightPercent: 30,
      actualValue: 96,
      targetValue: null,
      achievementRate: 96,
      contributionValue: 28.8,
      dataStatus: 'reported',
      scoreStatus: 'scored',
      status: 'reported',
    },
    {
      code: 'UPT',
      label: 'Units Per Ticket',
      weightPercent: 30,
      actualValue: 95,
      targetValue: null,
      achievementRate: 95,
      contributionValue: 28.5,
      dataStatus: 'reported',
      scoreStatus: 'scored',
      status: 'reported',
    },
  ],
}

const ownIncentivesFixture = {
  data: {
    period: '2026-06',
    periodStart: '2026-06-01',
    periodEnd: '2026-06-30',
    periodTimezone: 'Europe/Istanbul',
    roleScope: 'own',
    projections: [
      {
        period: '2026-06',
        periodTimezone: 'Europe/Istanbul',
        closeCutoffAt: null,
        ruleVersionId: 'sales-target-incentive-v1.0.0',
        storeId: demoStoreId,
        storeName: 'IstinyePark Demo Store',
        storeOwnershipType: 'company',
        roleScope: 'own',
        storeTarget: '1000000.00',
        storeActualNetSales: '1000000.00',
        storeAchievementPct: '100.0000',
        storeGatePassed: true,
        calculationState: 'projected',
        blockedReason: null,
        lastImportAt: '2026-06-18T08:00:00.000Z',
        rows: [
          {
            employeeId: demoEmployeeId,
            displayName: 'Store Personnel',
            participantType: 'personnel',
            positionCode: 'SALES_ASSOCIATE',
            normalizedFromPositionCode: null,
            target: '1000000.00',
            actualPositiveSales: '820000.00',
            achievementPct: '82.0000',
            storeAchievementPct: '100.0000',
            storeGatePassed: true,
            rate: '0.0150',
            rawEarnedAmount: '12300.000000',
            payableAmount: '12300.00',
            correctionAmount: null,
            adjustmentAmount: null,
            finalAmount: null,
            status: 'projected',
            blockedReason: null,
            rateTableVersion: 'personnel-sales-target-v1.0.0',
            explanation: 'Fixture projection.',
          },
        ],
      },
    ],
  },
}

const storeIncentivesFixture = {
  data: {
    ...ownIncentivesFixture.data,
    roleScope: 'store',
    projections: [
      {
        ...ownIncentivesFixture.data.projections[0],
        roleScope: 'store',
        rows: [
          {
            employeeId: 'manager-1',
            displayName: 'Store Manager',
            participantType: 'store_manager',
            positionCode: 'STORE_MANAGER',
            normalizedFromPositionCode: null,
            target: '1000000.00',
            actualPositiveSales: '1500000.00',
            achievementPct: '150.0000',
            storeAchievementPct: '150.0000',
            storeGatePassed: null,
            rate: '0.0100',
            rawEarnedAmount: '15000.000000',
            payableAmount: '15000.00',
            correctionAmount: null,
            adjustmentAmount: null,
            finalAmount: null,
            status: 'projected',
            blockedReason: null,
            rateTableVersion: 'manager-sales-target-v1.0.0',
            explanation: 'Fixture projection.',
          },
          {
            ...ownIncentivesFixture.data.projections[0].rows[0],
            actualPositiveSales: '1000000.00',
            achievementPct: '100.0000',
            rawEarnedAmount: '16500.000000',
            payableAmount: '16500.00',
            rate: '0.0165',
          },
        ],
      },
    ],
  },
}

const myPerformanceMayFixture = {
  ...myPerformanceFixture,
  period: {
    periodStart: '2026-05-01',
    periodEnd: '2026-05-31',
  },
  score: {
    value: 93.2,
    matchedMetrics: 3,
    totalMetrics: 3,
  },
  rankings: {
    turkeyRank: 1,
    turkeyPopulation: 4,
    storeRank: 1,
    storePopulation: 3,
  },
  supporting: {
    netSalesValue: 172000,
    targetEntryMode: 'manager_assignment',
    targetEditableByCurrentUser: false,
  },
  metrics: [
    {
      code: 'TARGET_ACHIEVEMENT',
      label: 'Target Achievement',
      weightPercent: 40,
      actualValue: 1.04,
      targetValue: null,
      achievementRate: 1.04,
      contributionValue: 41.6,
      dataStatus: 'reported',
      scoreStatus: 'scored',
      status: 'reported',
    },
    {
      code: 'ATV',
      label: 'Average Ticket Value',
      weightPercent: 30,
      actualValue: 112,
      targetValue: null,
      achievementRate: 112,
      contributionValue: 33.6,
      dataStatus: 'reported',
      scoreStatus: 'scored',
      status: 'reported',
    },
    {
      code: 'UPT',
      label: 'Units Per Ticket',
      weightPercent: 30,
      actualValue: 101,
      targetValue: null,
      achievementRate: 101,
      contributionValue: 30.3,
      dataStatus: 'reported',
      scoreStatus: 'scored',
      status: 'reported',
    },
  ],
}

const storeKpiHighlightsFixture = {
  source: {
    mode: 'live',
    snapshotRunId: null,
    snapshotDate: null,
    periodType: 'monthly',
  },
  store: {
    storeId: demoStoreId,
    storeName: 'IstinyePark Demo Store',
  },
  period: {
    periodStart: '2026-04-01',
    periodEnd: '2026-04-30',
  },
  score: {
    value: 91.5,
    matchedMetrics: 2,
    totalMetrics: 2,
  },
  availablePeriods: [
    {
      periodType: 'monthly',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
    },
  ],
  partial: {
    isPartial: false,
    missingMetricCodes: [],
    missingMetricLabels: [],
    pendingNormalizationCodes: [],
    pendingNormalizationLabels: [],
  },
  metrics: [
    {
      code: 'TARGET_ACHIEVEMENT',
      label: 'Target Achievement',
      weightPercent: 35,
      actualValue: 0.98,
      targetValue: null,
      achievementRate: 0.98,
      statusBand: 'exceeded',
      dataStatus: 'reported',
      scoreStatus: 'scored',
    },
    {
      code: 'UPT',
      label: 'Units Per Ticket',
      weightPercent: 25,
      actualValue: 95,
      targetValue: null,
      achievementRate: 95,
      statusBand: 'on_track',
      dataStatus: 'reported',
      scoreStatus: 'scored',
    },
    {
      code: 'gsm_approval',
      label: 'GSM Onayı',
      weightPercent: 5,
      actualValue: 91.2052,
      targetValue: null,
      achievementRate: 0.912052,
      statusBand: 'on_track',
      dataStatus: 'reported',
      scoreStatus: 'scored',
    },
  ],
}

const closedLeaderboardFixture = {
  source: {
    mode: 'closed',
    periodType: 'daily',
    state: 'closed',
    snapshotRunId: 'snapshot-2026-04-24',
    snapshotDate: '2026-04-24',
    periodStart: '2026-04-24',
    periodEnd: '2026-04-24',
  },
  includedSnapshotRuns: [
    {
      snapshotRunId: 'snapshot-2026-04-24',
      snapshotDate: '2026-04-24',
      snapshotType: 'daily',
      periodStart: '2026-04-24',
      periodEnd: '2026-04-24',
      runStatus: 'completed',
      generatedAt: '2026-04-24T08:00:00.000Z',
      generatedBy: 'release-smoke',
    },
  ],
  currentEmployee: {
    employeeId: demoEmployeeId,
    displayName: 'Store Personnel',
    storeId: demoStoreId,
    storeName: 'IstinyePark Demo Store',
    scoreValue: 91.5,
    rankings: {
      turkeyRank: 1,
      turkeyPopulation: 4,
      storeRank: 1,
      storePopulation: 3,
    },
    coverage: {
      closedDaysInPeriod: 1,
      daysWithPerformance: 1,
      minimumRequiredDays: 1,
      isEligibleForRanking: true,
    },
    rankingStatus: 'official',
    eligibilityReason: 'eligible',
    neededPerformanceDays: 0,
    metricRanks: [
      {
        code: 'TARGET_ACHIEVEMENT',
        label: 'Target Achievement',
        actualValue: 0.98,
        storeRank: 1,
        storePopulation: 3,
        turkeyRank: 1,
        turkeyPopulation: 4,
      },
      {
        code: 'ATV',
        label: 'Average Ticket Value',
        actualValue: 96,
        storeRank: 1,
        storePopulation: 3,
        turkeyRank: 2,
        turkeyPopulation: 4,
      },
      {
        code: 'UPT',
        label: 'Units Per Ticket',
        actualValue: 95,
        storeRank: 1,
        storePopulation: 3,
        turkeyRank: 1,
        turkeyPopulation: 4,
      },
    ],
  },
  personnelTop: [
    {
      employeeId: demoEmployeeId,
      displayName: 'Store Personnel',
      storeId: demoStoreId,
      storeName: 'IstinyePark Demo Store',
      scoreValue: 91.5,
      rankings: {
        turkeyRank: 1,
        turkeyPopulation: 4,
        storeRank: 1,
        storePopulation: 3,
      },
      coverage: {
        closedDaysInPeriod: 1,
        daysWithPerformance: 1,
        minimumRequiredDays: 1,
        isEligibleForRanking: true,
      },
      rankingStatus: 'official',
      eligibilityReason: 'eligible',
      neededPerformanceDays: 0,
      metricRanks: [],
    },
  ],
}

const closedLeaderboardMonthlyPreviewFixture = {
  ...closedLeaderboardFixture,
  source: {
    ...closedLeaderboardFixture.source,
    periodType: 'monthly',
    snapshotRunId: null,
    snapshotDate: '2026-04-02',
    periodStart: '2026-04-01',
    periodEnd: '2026-04-30',
  },
  includedSnapshotRuns: [
    {
      snapshotRunId: 'snapshot-2026-04-23',
      snapshotDate: '2026-04-23',
      snapshotType: 'daily',
      periodStart: '2026-04-23',
      periodEnd: '2026-04-23',
      runStatus: 'completed',
      generatedAt: '2026-04-23T08:00:00.000Z',
      generatedBy: 'ranking-closure-job',
    },
    {
      snapshotRunId: 'snapshot-2026-04-24',
      snapshotDate: '2026-04-24',
      snapshotType: 'daily',
      periodStart: '2026-04-24',
      periodEnd: '2026-04-24',
      runStatus: 'completed',
      generatedAt: '2026-04-24T08:00:00.000Z',
      generatedBy: 'ranking-closure-job',
    },
  ],
  currentEmployee: {
    ...closedLeaderboardFixture.currentEmployee,
    rankings: {
      turkeyRank: null,
      turkeyPopulation: 4,
      storeRank: null,
      storePopulation: 3,
    },
    coverage: {
      closedDaysInPeriod: 2,
      daysWithPerformance: 2,
      minimumRequiredDays: 3,
      isEligibleForRanking: false,
    },
    rankingStatus: 'preview_only',
    eligibilityReason: 'needs_more_closed_days',
    neededPerformanceDays: 1,
  },
  personnelTop: [
    {
      ...closedLeaderboardFixture.personnelTop[0],
      rankings: {
        turkeyRank: null,
        turkeyPopulation: 4,
        storeRank: null,
        storePopulation: 3,
      },
      coverage: {
        closedDaysInPeriod: 2,
        daysWithPerformance: 2,
        minimumRequiredDays: 3,
        isEligibleForRanking: false,
      },
      rankingStatus: 'preview_only',
      eligibilityReason: 'needs_more_closed_days',
      neededPerformanceDays: 1,
    },
  ],
}

const storeRankingSummaryRow = {
  subject: 'store',
  storeId: demoStoreId,
  storeName: 'IstinyePark Demo Store',
  regionId: '00000000-0000-0000-0000-000000000010',
  regionName: 'Marmara',
  regionManagerUserId: 'region-manager-1',
  regionManagerName: 'Region Manager',
  rank: 12,
  population: 240,
  scoreValue: 104.6,
  visibility: 'summary',
}

const personnelRankingSummaryRow = {
  subject: 'personnel',
  employeeId: demoEmployeeId,
  displayName: 'Store Personnel - 1',
  storeId: demoStoreId,
  storeName: 'IstinyePark Demo Store',
  regionId: '00000000-0000-0000-0000-000000000010',
  regionName: 'Marmara',
  regionManagerUserId: 'region-manager-1',
  regionManagerName: 'Region Manager',
  rank: 7,
  population: 420,
  storeRank: 1,
  storePopulation: 4,
  scoreValue: 96.4,
  canOpenProfile: true,
  visibility: 'summary',
}

const personnelRankingDetailRow = {
  ...personnelRankingSummaryRow,
  visibility: 'detail',
  metrics: [
    {
      code: 'UPT',
      label: 'UPT',
      actualValue: 4.8,
      benchmarkValue: 4.2,
      contributionValue: 29,
    },
    {
      code: 'ATV',
      label: 'ATV',
      actualValue: 1245,
      benchmarkValue: 1180,
      contributionValue: 28,
    },
    {
      code: 'TARGET_ACHIEVEMENT',
      label: 'Target Achievement',
      actualValue: 0.98,
      targetValue: 1,
      contributionValue: 39.2,
    },
  ],
}

const personnelRankingRawTargetRow = {
  ...personnelRankingDetailRow,
  metrics: personnelRankingDetailRow.metrics.map((metric) =>
    metric.code === 'TARGET_ACHIEVEMENT'
      ? {
          ...metric,
          actualValue: 3710884.57,
          targetValue: 1000000,
          benchmarkValue: 1000000,
        }
      : metric,
  ),
}

const regionManagerInScopePersonnelRow = {
  ...personnelRankingDetailRow,
  employeeId: demoEmployeeId,
  displayName: 'BM Region Personnel',
  storeId: 'store-in-region',
  storeName: 'BM Region Store',
  regionId: 'region-1',
  regionName: 'BM Region',
  regionManagerUserId: 'region-ranking-user',
  regionManagerName: 'Region Manager',
  canOpenProfile: true,
}

const regionManagerOutOfScopePersonnelRow = {
  ...personnelRankingDetailRow,
  employeeId: '99999999-9999-4999-8999-999999999999',
  displayName: 'Other Region Personnel',
  storeId: 'store-out-region',
  storeName: 'Other Region Store',
  regionId: 'region-2',
  regionName: 'Other Region',
  regionManagerUserId: 'other-region-manager',
  regionManagerName: 'Other Region Manager',
  canOpenProfile: false,
}

const rankingsPrivilegedDetailStoreRow = {
  subject: 'store',
  storeId: 'store-high-hg',
  storeName: 'High HG Store',
  regionId: '00000000-0000-0000-0000-000000000010',
  regionName: 'Marmara',
  regionManagerUserId: 'region-manager-1',
  regionManagerName: 'Region Manager',
  rank: 1,
  population: 2,
  scoreValue: 91.4,
  visibility: 'detail',
  metrics: [
    {
      code: 'UPT',
      label: 'UPT',
      actualValue: 4.75,
      benchmarkValue: 4.2,
      contributionValue: 15,
    },
    {
      code: 'ATV',
      label: 'ATV',
      actualValue: 1580,
      benchmarkValue: 1320,
      contributionValue: 15,
    },
    {
      code: 'CR',
      label: 'CR',
      actualValue: 0.197,
      benchmarkValue: 0.185,
      contributionValue: 20,
    },
    {
      code: 'TARGET_ACHIEVEMENT',
      label: 'Target Achievement',
      actualValue: 3710884.57,
      targetValue: 1000000,
      contributionValue: 40,
    },
    {
      code: 'gsm_approval',
      label: 'GSM Onayı',
      actualValue: 91.2052,
      contributionValue: 4.56,
    },
    {
      code: 'BM_CHECKLIST',
      label: 'BM Checklist',
      actualValue: 86,
      contributionValue: 4.3,
    },
    {
      code: 'VM_CHECKLIST',
      label: 'VM Checklist',
      actualValue: 92,
      contributionValue: 4.6,
    },
  ],
}

const rankingsPrivilegedLowHgStoreRow = {
  ...rankingsPrivilegedDetailStoreRow,
  storeId: 'store-low-hg',
  storeName: 'Low HG Store',
  rank: 2,
  scoreValue: 64.2,
  metrics: rankingsPrivilegedDetailStoreRow.metrics.map((metric) =>
    metric.code === 'TARGET_ACHIEVEMENT'
      ? {
          ...metric,
          actualValue: 640000,
          targetValue: 1000000,
          contributionValue: 25.6,
        }
      : metric,
  ),
}

const rankingsPrivilegedMissingChecklistStoreRow = {
  ...rankingsPrivilegedDetailStoreRow,
  metrics: rankingsPrivilegedDetailStoreRow.metrics.filter(
    (metric) => metric.code !== 'BM_CHECKLIST' && metric.code !== 'gsm_approval',
  ),
}

const scoreDisplayLeaderStoreRow = {
  ...rankingsPrivilegedDetailStoreRow,
  storeId: 'store-score-display-leader',
  storeName: 'Weighted Score Leader With Long Store Name',
  rank: 1,
  scoreValue: 112.3,
  metrics: [
    {
      code: 'UPT',
      label: 'UPT',
      actualValue: 4,
      benchmarkValue: 4,
      contributionValue: 15,
    },
    {
      code: 'ATV',
      label: 'ATV',
      actualValue: 1500,
      benchmarkValue: 1500,
      contributionValue: 15,
    },
    {
      code: 'CR',
      label: 'CR',
      actualValue: 0.2,
      benchmarkValue: 0.2,
      contributionValue: 20,
    },
    {
      code: 'TARGET_ACHIEVEMENT',
      label: 'Target Achievement',
      actualValue: 1000000,
      targetValue: 1000000,
      contributionValue: 40,
    },
    {
      code: 'gsm_approval',
      label: 'GSM Onayı',
      actualValue: 96.4,
      contributionValue: 4.8,
    },
    {
      code: 'BM_CHECKLIST',
      label: 'BM Checklist',
      actualValue: 95,
      contributionValue: 11.15,
    },
    {
      code: 'VM_CHECKLIST',
      label: 'VM Checklist',
      actualValue: 95,
      contributionValue: 11.15,
    },
  ],
}

const scoreDisplayFollowerStoreRow = {
  ...rankingsPrivilegedDetailStoreRow,
  storeId: 'store-score-display-follower',
  storeName: 'Raw Delta Trap',
  rank: 2,
  scoreValue: 104.2,
  metrics: [
    {
      code: 'UPT',
      label: 'UPT',
      actualValue: 7,
      benchmarkValue: 4,
      contributionValue: 18,
    },
    {
      code: 'ATV',
      label: 'ATV',
      actualValue: 1500,
      benchmarkValue: 1500,
      contributionValue: 15,
    },
    {
      code: 'CR',
      label: 'CR',
      actualValue: 0.2,
      benchmarkValue: 0.2,
      contributionValue: 20,
    },
    {
      code: 'TARGET_ACHIEVEMENT',
      label: 'Target Achievement',
      actualValue: 1000000,
      targetValue: 1000000,
      contributionValue: 40,
    },
    {
      code: 'gsm_approval',
      label: 'GSM Onayı',
      actualValue: 88.3,
      contributionValue: 4.4,
    },
    {
      code: 'BM_CHECKLIST',
      label: 'BM Checklist',
      actualValue: 56,
      contributionValue: 5.6,
    },
    {
      code: 'VM_CHECKLIST',
      label: 'VM Checklist',
      actualValue: 56,
      contributionValue: 5.6,
    },
  ],
}

const rankingsAvailablePeriods = [
  {
    periodType: 'monthly',
    periodStart: '2026-04-01',
    periodEnd: '2026-04-30',
  },
  {
    periodType: 'daily',
    periodStart: '2026-04-15',
    periodEnd: '2026-04-15',
  },
] as const

const rankingsPrivilegedDetailFixture = {
  source: {
    mode: 'live',
    periodType: 'monthly',
    periodStart: '2026-04-01',
    periodEnd: '2026-04-30',
  },
  access: {
    globalMode: 'full',
    canSeeGlobalDetails: true,
    canSeeManagedStorePersonnelDetails: true,
  },
  filters: {
    regionManagers: [{ id: 'region-manager-1', label: 'Region Manager' }],
    regions: [{ id: '00000000-0000-0000-0000-000000000010', label: 'Marmara' }],
    stores: [{ id: 'store-high-hg', label: 'High HG Store' }],
  },
  reference: {
    store: {
      averageScore: 83.6,
      metrics: [
        { code: 'UPT', label: 'UPT', value: 4.22 },
        { code: 'ATV', label: 'ATV', value: 1320 },
        { code: 'CR', label: 'CR', value: 0.185 },
        { code: 'TARGET_ACHIEVEMENT', label: 'Target Achievement', value: 0.94 },
        { code: 'gsm_approval', label: 'GSM Onayı', value: 91.2 },
        { code: 'BM_CHECKLIST', label: 'BM Checklist', value: 81 },
        { code: 'VM_CHECKLIST', label: 'VM Checklist', value: 84 },
      ],
    },
    personnel: {
      averageScore: 79.2,
      metrics: [
        { code: 'UPT', label: 'UPT', value: 4.1 },
        { code: 'ATV', label: 'ATV', value: 1180 },
        { code: 'TARGET_ACHIEVEMENT', label: 'Target Achievement', value: 0.88 },
      ],
    },
  },
  storeLeaderboard: {
    items: [rankingsPrivilegedDetailStoreRow],
    currentStore: rankingsPrivilegedDetailStoreRow,
    meta: {
      total: 2,
      limit: 100,
      offset: 0,
    },
  },
  personnelLeaderboard: {
    items: [],
    currentEmployee: null,
    managedStorePersonnel: [],
    meta: {
      total: 0,
      limit: 100,
      offset: 0,
    },
  },
  availablePeriods: rankingsAvailablePeriods,
}

const rankingsFixture = {
  source: {
    mode: 'live',
    periodType: 'monthly',
    periodStart: '2026-04-01',
    periodEnd: '2026-04-30',
  },
  access: {
    globalMode: 'top100',
    canSeeGlobalDetails: false,
    canSeeManagedStorePersonnelDetails: true,
  },
  filters: {
    regionManagers: [],
    regions: [],
    stores: [],
  },
  storeLeaderboard: {
    items: [storeRankingSummaryRow],
    currentStore: {
      ...storeRankingSummaryRow,
      visibility: 'detail',
      metrics: [
        {
          code: 'TARGET_ACHIEVEMENT',
          label: 'Target Achievement',
          actualValue: 1.12,
          targetValue: 1,
          contributionValue: 70,
        },
      ],
    },
    meta: {
      total: 240,
      limit: 100,
      offset: 0,
    },
  },
  personnelLeaderboard: {
    items: [personnelRankingSummaryRow],
    currentEmployee: {
      ...personnelRankingSummaryRow,
      visibility: 'detail',
      metrics: [
        {
          code: 'ATV',
          label: 'ATV',
          actualValue: 1245,
          benchmarkValue: 1180,
          contributionValue: 28,
        },
      ],
    },
    managedStorePersonnel: [],
    meta: {
      total: 420,
      limit: 100,
      offset: 0,
    },
  },
  availablePeriods: rankingsAvailablePeriods,
}

const rankingsDailyFixture = {
  ...rankingsFixture,
  source: {
    mode: 'live',
    periodType: 'daily',
    periodStart: '2026-04-15',
    periodEnd: '2026-04-15',
  },
}

const competitionFixture = {
  competitionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  competitionCode: 'APRIL_REGION_CHALLENGE',
  competitionName: 'April Region Challenge',
  description: null,
  competitionType: 'region_challenge',
  lifecycleState: 'active',
  startsOn: '2026-04-22',
  endsOn: '2026-04-24',
}

const targetDistributionRequestsFixture = {
  items: [],
  meta: {
    count: 0,
    total: 0,
    limit: 30,
    offset: 0,
  },
}

const pendingTargetRequestId = '00000000-0000-4000-8000-000000000777'

const pendingTargetDistributionRequestsFixture = {
  items: [
    {
      requestId: pendingTargetRequestId,
      companyId: '00000000-0000-0000-0000-000000000001',
      regionId: '00000000-0000-0000-0000-000000000010',
      storeId: demoStoreId,
      storeName: 'IstinyePark Demo Store',
      requestMonth: '2026-05-01',
      targetLabel: 'Mayis hedef dagitimi',
      totalTargetValue: 145000,
      allocationCount: 1,
      status: 'pending_region_approval',
      requestReason: 'Magaza hedef dagitimi',
      allocations: [
        {
          employeeId: demoEmployeeId,
          assigneeLabel: 'Store Personnel',
          targetValue: 145000,
          note: null,
        },
      ],
      submittedByUserId: 'store-manager-1',
      approvedByUserId: null,
      approvedAt: null,
      approvalNote: null,
      createdAt: '2026-05-10T08:00:00.000Z',
      updatedAt: '2026-05-10T08:00:00.000Z',
    },
  ],
  meta: {
    count: 1,
    total: 1,
    limit: 30,
    offset: 0,
  },
}

const approvedTargetDistributionRequestsFixture = {
  items: [
    {
      requestId: '00000000-0000-4000-8000-000000000778',
      companyId: '00000000-0000-0000-0000-000000000001',
      regionId: '00000000-0000-0000-0000-000000000010',
      storeId: demoStoreId,
      storeName: 'IstinyePark Demo Store',
      requestMonth: '2026-05-01',
      targetLabel: 'Mayis hedef dagitimi',
      totalTargetValue: 145000,
      allocationCount: 2,
      status: 'approved',
      requestReason: 'Magaza hedef dagitimi',
      allocations: [
        {
          employeeId: demoEmployeeId,
          assigneeLabel: 'Store Personnel',
          targetValue: 45000,
          note: null,
        },
        {
          employeeId: '00000000-0000-0000-0000-000000000203',
          assigneeLabel: 'Store Personnel Covered',
          targetValue: 100000,
          note: null,
        },
      ],
      submittedByUserId: 'store-manager-1',
      approvedByUserId: 'region-user-1',
      approvedAt: '2026-05-20T08:00:00.000Z',
      approvalNote: 'Bolge onayi',
      createdAt: '2026-05-10T08:00:00.000Z',
      updatedAt: '2026-05-20T08:00:00.000Z',
    },
  ],
  meta: {
    count: 1,
    total: 1,
    limit: 30,
    offset: 0,
  },
}

const targetCoverageFixture = {
  items: [
    {
      storeId: demoStoreId,
      storeName: 'IstinyePark Demo Store',
      employeeId: demoEmployeeId,
      displayName: 'Store Personnel',
      externalEmployeeRef: 'FM8001',
      targetReferenceId: null,
      targetValue: null,
      pendingRequestId: pendingTargetRequestId,
      pendingTargetValue: 145000,
      staleTargetReferenceId: null,
      targetStatus: 'pending_region_approval',
    },
    {
      storeId: demoStoreId,
      storeName: 'IstinyePark Demo Store',
      employeeId: '00000000-0000-0000-0000-000000000203',
      displayName: 'Store Personnel Covered',
      externalEmployeeRef: 'FM8002',
      targetReferenceId: '00000000-0000-4000-8000-000000000601',
      targetValue: 155000,
      pendingRequestId: null,
      pendingTargetValue: null,
      staleTargetReferenceId: null,
      targetStatus: 'approved',
    },
    {
      storeId: demoStoreId,
      storeName: 'IstinyePark Demo Store',
      employeeId: '00000000-0000-0000-0000-000000000204',
      displayName: 'Store Personnel Missing',
      externalEmployeeRef: 'FM8003',
      targetReferenceId: null,
      targetValue: null,
      pendingRequestId: null,
      pendingTargetValue: null,
      staleTargetReferenceId: null,
      targetStatus: 'missing',
    },
  ],
  meta: {
    count: 3,
    total: 3,
    limit: 50,
    offset: 0,
  },
  summary: {
    requestMonth: '2026-05-01',
    totalEmployees: 3,
    coveredEmployees: 1,
    missingEmployees: 1,
    pendingEmployees: 1,
    conflictEmployees: 0,
    staleEmployees: 0,
    uncoveredEmployees: 2,
    coverageRate: 1 / 3,
  },
}

const approvedTargetCoverageFixture = {
  items: [
    {
      storeId: demoStoreId,
      storeName: 'IstinyePark Demo Store',
      employeeId: demoEmployeeId,
      displayName: 'Store Personnel',
      externalEmployeeRef: 'FM8001',
      targetReferenceId: '00000000-0000-4000-8000-000000000601',
      targetValue: 45000,
      pendingRequestId: null,
      pendingTargetValue: null,
      staleTargetReferenceId: null,
      targetStatus: 'approved',
    },
    {
      storeId: demoStoreId,
      storeName: 'IstinyePark Demo Store',
      employeeId: '00000000-0000-0000-0000-000000000203',
      displayName: 'Store Personnel Covered',
      externalEmployeeRef: 'FM8002',
      targetReferenceId: '00000000-0000-4000-8000-000000000602',
      targetValue: 100000,
      pendingRequestId: null,
      pendingTargetValue: null,
      staleTargetReferenceId: null,
      targetStatus: 'approved',
    },
  ],
  meta: {
    count: 2,
    total: 2,
    limit: 50,
    offset: 0,
  },
  summary: {
    requestMonth: '2026-05-01',
    totalEmployees: 2,
    coveredEmployees: 2,
    missingEmployees: 0,
    pendingEmployees: 0,
    conflictEmployees: 0,
    staleEmployees: 0,
    uncoveredEmployees: 0,
    coverageRate: 1,
  },
}

const storeTargetingPersonnelFixture = {
  items: [
    {
      employeeId: demoEmployeeId,
      displayName: 'Store Personnel',
      externalEmployeeRef: 'FM8001',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
      netSalesValue: 145000,
    },
  ],
  meta: {
    count: 1,
    total: 1,
    limit: 30,
    offset: 0,
  },
}

const sellerCodeRequestFixture = {
  requestId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  companyId: '00000000-0000-0000-0000-000000000001',
  regionId: '00000000-0000-0000-0000-000000000010',
  storeId: demoStoreId,
  storeCode: 'DEMO-100',
  storeName: 'IstinyePark Demo Store',
  storeType: 'franchise',
  requestType: 'create_code',
  status: 'pending_hr_approval',
  firstName: 'Ayse',
  lastName: 'Yilmaz',
  nationalIdLast4: '8901',
  phoneNumber: '05551234567',
  hireDate: '2026-05-01',
  requestedPositionId: demoPositionId,
  positionCode: 'SALES_CONSULTANT',
  positionName: 'Sales Consultant',
  employmentType: 'full_time',
  requestedSellerCode: null,
  approvedSellerCode: null,
  lastReferenceSellerCode: null,
  submittedByUserId: 'store-me-smoke-user',
  reviewedByUserId: null,
  reviewedAt: null,
  reviewNote: null,
  employeeId: null,
  createdAt: '2026-04-27T09:00:00.000Z',
  updatedAt: '2026-04-27T09:00:00.000Z',
}

const offboardingRequestFixture = {
  requestId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  companyId: '00000000-0000-0000-0000-000000000001',
  regionId: '00000000-0000-0000-0000-000000000010',
  storeId: demoStoreId,
  storeCode: 'DEMO-100',
  storeName: 'IstinyePark Demo Store',
  employeeId: demoEmployeeId,
  displayName: 'Store Personnel',
  externalEmployeeRef: 'FM8001',
  positionCode: 'SALES_CONSULTANT',
  positionName: 'Sales Consultant',
  status: 'pending_hr_approval',
  terminationDate: '2026-05-10',
  terminationReason: 'resignation',
  requestReason: 'Personel istifa etti',
  submittedByUserId: 'store-me-smoke-user',
  reviewedByUserId: null,
  reviewedAt: null,
  reviewNote: null,
  createdAt: '2026-04-27T09:00:00.000Z',
  updatedAt: '2026-04-27T09:00:00.000Z',
}

const rejectedSellerCodeRequestFixture = {
  ...sellerCodeRequestFixture,
  status: 'rejected',
  reviewedByUserId: 'hr-admin-user',
  reviewedAt: '2026-04-27T10:00:00.000Z',
  reviewNote: 'TC numarasi tekrar kontrol edilmeli',
  updatedAt: '2026-04-27T10:00:00.000Z',
}

const outsideStoreSellerCodeRequestFixture = {
  ...sellerCodeRequestFixture,
  requestId: 'dddddddd-dddd-4ddd-8ddd-dddddddddd90',
  storeId: outsideStoreId,
  storeCode: 'DEMO-999',
  storeName: 'Outside Store',
  firstName: 'Outside',
  lastName: 'Store',
  updatedAt: '2026-04-27T11:00:00.000Z',
}

const outsideStoreRejectedSellerCodeRequestFixture = {
  ...outsideStoreSellerCodeRequestFixture,
  status: 'rejected',
  reviewedByUserId: 'hr-admin-user',
  reviewedAt: '2026-04-27T11:30:00.000Z',
  reviewNote: 'Outside store correction',
  updatedAt: '2026-04-27T11:30:00.000Z',
}

const rejectedOffboardingRequestFixture = {
  ...offboardingRequestFixture,
  status: 'rejected',
  reviewedByUserId: 'hr-admin-user',
  reviewedAt: '2026-04-27T10:00:00.000Z',
  reviewNote: 'Cikis tarihi tekrar kontrol edilmeli',
  updatedAt: '2026-04-27T10:00:00.000Z',
}

const returnedOffboardingStatusFixture = {
  ...rejectedOffboardingRequestFixture,
  requestId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee80',
  employeeId: '00000000-0000-0000-0000-000000000208',
  displayName: 'Returned Offboarding Personnel',
  externalEmployeeRef: 'FM8008',
}

const outsideStoreOffboardingRequestFixture = {
  ...offboardingRequestFixture,
  requestId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee90',
  storeId: outsideStoreId,
  storeCode: 'DEMO-999',
  storeName: 'Outside Store',
  employeeId: '00000000-0000-0000-0000-000000000909',
  displayName: 'Outside Personnel',
  externalEmployeeRef: 'FM9901',
  updatedAt: '2026-04-27T11:00:00.000Z',
}

const outsideStoreRejectedOffboardingRequestFixture = {
  ...outsideStoreOffboardingRequestFixture,
  status: 'rejected',
  reviewedByUserId: 'hr-admin-user',
  reviewedAt: '2026-04-27T11:30:00.000Z',
  reviewNote: 'Outside offboarding correction',
  updatedAt: '2026-04-27T11:30:00.000Z',
}

const storeEmployeesFixture = {
  items: [
    {
      employeeId: demoEmployeeId,
      displayName: 'Store Personnel',
      externalEmployeeRef: 'FM8001',
      storeId: demoStoreId,
      positionId: demoPositionId,
      positionCode: 'SALES_CONSULTANT',
      positionName: 'Sales Consultant',
      assignmentStartDate: '2026-04-01',
      employmentStatus: 'active',
    },
  ],
  meta: {
    count: 1,
    total: 1,
    limit: 1,
    offset: 0,
  },
}

const returnedOffboardingEmployeeFixture = {
  employeeId: '00000000-0000-0000-0000-000000000208',
  displayName: 'Returned Offboarding Personnel',
  externalEmployeeRef: 'FM8008',
  storeId: demoStoreId,
  positionId: demoPositionId,
  positionCode: 'SALES_CONSULTANT',
  positionName: 'Sales Consultant',
  assignmentStartDate: '2026-03-15',
  employmentStatus: 'active',
}

const positionOptionsFixture = {
  items: [
    {
      positionId: demoPositionId,
      positionCode: 'SALES_ASSOCIATE',
      positionName: 'Sales Associate',
      jobFamily: 'store',
      isManagerial: false,
    },
    {
      positionId: '44444444-4444-4444-9444-444444444443',
      positionCode: 'SALES',
      positionName: 'Sales',
      jobFamily: 'store',
      isManagerial: false,
    },
    {
      positionId: '44444444-4444-4444-9444-444444444444',
      positionCode: 'ASSISTANT_MANAGER',
      positionName: 'Assistant Store Manager',
      jobFamily: 'store',
      isManagerial: true,
    },
    {
      positionId: '44444444-4444-4444-9444-444444444445',
      positionCode: 'SENIOR_SALES_CONSULTANT',
      positionName: 'Senior Sales Consultant',
      jobFamily: 'store',
      isManagerial: false,
    },
    {
      positionId: '44444444-4444-4444-9444-444444444446',
      positionCode: 'CASHIER',
      positionName: 'Cashier',
      jobFamily: 'store',
      isManagerial: false,
    },
    {
      positionId: '44444444-4444-4444-9444-444444444447',
      positionCode: 'STORE_MANAGER',
      positionName: 'Store Manager',
      jobFamily: 'store',
      isManagerial: true,
    },
  ],
  meta: {
    count: 6,
    total: 6,
    limit: 6,
    offset: 0,
  },
}

const competitionDetailFixture = {
  competition: competitionFixture,
  stages: [
    {
      competitionStageId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      competitionId: competitionFixture.competitionId,
      stageCode: 'QUALIFIER',
      stageName: 'Qualifier',
      stageOrder: 1,
      stageType: 'qualifier',
      startsOn: '2026-04-22',
      endsOn: '2026-04-24',
      lifecycleState: 'active',
      finalizationState: null,
    },
  ],
  teams: [
    {
      competitionTeamId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      teamCode: 'MARMARA_DEMO',
      teamName: 'Marmara Demo',
      teamOrder: 1,
      stores: [
        {
          storeId: demoStoreId,
          storeCode: 'DEMO-100',
          storeName: 'IstinyePark Demo Store',
          regionId: '00000000-0000-0000-0000-000000000010',
        },
      ],
    },
  ],
  latestScores: [
    {
      stageId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      teamId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      teamCode: 'MARMARA_DEMO',
      teamName: 'Marmara Demo',
      snapshotDate: '2026-04-22',
      scoreValue: 92.45,
      validStoreCount: 1,
      totalStoreCount: 1,
      coverageRate: 1,
      rankPosition: 1,
      rankingPopulation: 2,
    },
  ],
  warnings: [],
  storeContributions: [
    {
      stageId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      teamId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      teamCode: 'MARMARA_DEMO',
      teamName: 'Marmara Demo',
      storeId: demoStoreId,
      storeCode: 'DEMO-100',
      storeName: 'IstinyePark Demo Store',
      regionId: '00000000-0000-0000-0000-000000000010',
      snapshotDate: '2026-04-22',
      scoreValue: 93.5,
      reportedWeightPercent: 95,
      expectedWeightPercent: 100,
      hasDailyData: true,
      missingKpiCodes: ['BM_CHECKLIST'],
    },
  ],
}
