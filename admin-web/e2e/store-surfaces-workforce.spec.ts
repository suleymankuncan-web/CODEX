import { expect, test } from './test-fixtures'
import type { Locator, Page } from '@playwright/test'
import { setStoredLocale } from './locale-test-utils'
import { expectNoCriticalAxeViolations } from './axe-test-utils'
import { pressTabFromDocumentStart } from './keyboard-test-utils'
import { demoStoreId, demoRegionId, demoEmployeeId, demoPositionId, regionSecondStoreId, outsideStoreId } from './store-surfaces-identities'
import { selectComboboxOption, createStoreAuthSession, routeAuthSession, routeRegionWorkforceReadCalls, routeStoreSurfaceApi } from './store-surfaces-api-fixtures'
import { sellerCodeRequestFixture, offboardingRequestFixture, rejectedSellerCodeRequestFixture, outsideStoreSellerCodeRequestFixture, outsideStoreRejectedSellerCodeRequestFixture, rejectedOffboardingRequestFixture, returnedOffboardingStatusFixture, outsideStoreOffboardingRequestFixture, outsideStoreRejectedOffboardingRequestFixture, storeEmployeesFixture, returnedOffboardingEmployeeFixture } from './store-surfaces-operations-fixtures'

async function selectSingleCalendarDate(page: Page, trigger: Locator, date: string) {
  const [year, month, day] = date.split('-')
  await trigger.click()
  const calendar = page.getByRole('dialog', { name: 'Dönem seç' })
  await calendar.getByRole('combobox', { name: 'Yıl seç' }).selectOption(year)
  await calendar.getByRole('combobox', { name: 'Ay seç' }).selectOption(String(Number(month) - 1))
  await calendar.locator('button[data-day]').filter({ hasText: new RegExp(`^${Number(day)}$`) }).first().click()
  await calendar.getByRole('button', { name: 'Uygula', exact: true }).click()
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

test('store shell skip link moves focus to localized main landmark', async ({ page }) => {
  await page.goto('/store/home')

  const main = page.getByRole('main')
  const turkishSkipLink = page.getByRole('link', { name: 'Ana içeriğe geç' })
  await pressTabFromDocumentStart(page, turkishSkipLink)
  await expect(turkishSkipLink).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(main).toBeFocused()
  await expect(main).toHaveAttribute('id', 'application-main-content')

  await setStoredLocale(page, 'en')
  const englishSkipLink = page.getByRole('link', { name: 'Skip to main content' })
  await pressTabFromDocumentStart(page, englishSkipLink)
  await expect(englishSkipLink).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(main).toBeFocused()
})

test('stable store home shell has no critical WCAG 2 A or AA violations', async ({ page }) => {
  await page.goto('/store/home')
  await expect(page.getByRole('main')).toBeVisible()

  await expectNoCriticalAxeViolations(page)
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

test('store workforce route is visible read-only for reporting users with company scope', async ({ page }) => {
  await routeAuthSession(page, createStoreAuthSession({
    roleCodes: ['REPORT_VIEWER'],
    readStoreIds: [demoStoreId],
    scopeStoreIds: [demoStoreId],
    actionStoreIds: [],
    legacyAssignedStoreIds: [],
  }))
  await routeRegionWorkforceReadCalls(page, [])

  await page.goto('/store/home')
  await expect(page.locator('.store-command-nav').getByRole('link', { name: 'Norm Kadro' })).toBeVisible()

  await page.goto('/store/workforce')
  await expect(page.getByTestId('store-workforce-page')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Norm Kadro', exact: true })).toBeVisible()
})

test('store workforce route is visible for region manager assigned stores', async ({ page }) => {
  await routeAuthSession(page, createStoreAuthSession({
    roleCodes: ['REGION_MANAGER'],
    readStoreIds: [],
    readRegionIds: [demoRegionId],
    scopeStoreIds: [],
    scopeRegionIds: [demoRegionId],
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

test('store workforce page shows only region manager assigned-store rows and opens detail in page', async ({ page }) => {
  const workforceCalls: string[] = []
  await routeAuthSession(page, createStoreAuthSession({
    roleCodes: ['REGION_MANAGER'],
    readStoreIds: [demoStoreId, regionSecondStoreId],
    readRegionIds: [demoRegionId],
    scopeStoreIds: [],
    scopeRegionIds: [demoRegionId],
    actionStoreIds: [demoStoreId, regionSecondStoreId],
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
  expect(workforceCalls).toEqual(['workspace'])

  const firstRow = page.getByTestId('store-workforce-region-row').filter({ hasText: 'IstinyePark Demo Store' })
  await firstRow.click()

  const detail = page.getByTestId('store-workforce-region-detail-dialog')
  await expect(detail).toBeVisible()
  await expect(detail).toContainText('IstinyePark Demo Store')
  await expect(detail).toContainText('Store Personnel')
  await expect(page).toHaveURL(/\/store\/workforce$/)
  expect(workforceCalls).toEqual(['workspace', 'workspace'])
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
    actionStoreIds: [demoStoreId],
    legacyAssignedStoreIds: [],
  }))
  await routeRegionWorkforceReadCalls(page, workforceCalls)

  await page.goto('/store/workforce')
  await page
    .getByTestId('store-workforce-region-row')
    .filter({ hasText: 'IstinyePark Demo Store' })
    .click()

  await expect(page.getByTestId('store-workforce-region-detail-dialog')).toBeVisible()
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(hasHorizontalOverflow).toBe(false)
  expect(workforceCalls).toEqual(['workspace', 'workspace'])
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
    actionStoreIds: [demoStoreId, regionSecondStoreId],
    legacyAssignedStoreIds: [],
  }))
  await routeRegionWorkforceReadCalls(page, workforceCalls)

  await page.goto('/store/workforce')

  await expect(page.getByTestId('store-workforce-page')).toBeVisible()
  const layout = await page.evaluate(() => {
    const ledger = document.querySelector('.command-canvas-data-list')?.getBoundingClientRect()
    const root = document.documentElement.getBoundingClientRect()
    const icon = document.querySelector('.operations-metric-icon')?.getBoundingClientRect()
    const svg = document.querySelector('.operations-metric-icon svg')?.getBoundingClientRect()
    const row = document.querySelector('.workforce-store-row')?.getBoundingClientRect()

    return {
      hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      ledgerFits: ledger ? ledger.left >= root.left && ledger.right <= root.right : false,
      rowActionFits: row ? row.left >= root.left && row.right <= root.right : false,
      rowActionFitsViewport: row ? row.left >= root.left && row.right <= root.right : false,
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
    .click()

  await expect(page.getByTestId('store-workforce-region-detail-dialog')).toBeVisible()
  await expect(page.getByTestId('store-workforce-region-detail-dialog')).toContainText('Store Personnel')
  expect(workforceCalls).toEqual(['workspace', 'workspace'])
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
  await expect(personnelList.getByText('Sales Consultant').first()).toBeVisible()
  await expect(personnelList.getByText(/1.*Nis.*2026/).first()).toBeVisible()
  await expect(personnelList.getByText('Aktif').first()).toBeVisible()
  await expect(page.getByText('Outside Store')).toHaveCount(0)
  await expect(page.getByText('Outside Personnel')).toHaveCount(0)
  await expect(page.getByText('TC numarasi tekrar kontrol edilmeli')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Personel sicil talebi' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'İşten ayrılma talebi' })).toBeVisible()
  await expect(page.getByTestId('store-workforce-request-workbench')).toHaveCount(0)
})

test('store workforce page keeps the store manager surface usable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })

  await page.goto('/store/workforce')

  await expect(page.getByTestId('store-workforce-page')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Norm Kadro', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Personel sicil talebi' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'İşten ayrılma talebi' })).toBeVisible()
  await expect(page.getByTestId('store-workforce-personnel-list')).toBeVisible()

  const hasHorizontalOverflow = await page.evaluate(() => {
    const root = document.documentElement
    return root.scrollWidth > root.clientWidth + 1
  })
  expect(hasHorizontalOverflow).toBe(false)
})

test('store workforce page submits seller code requests with Keycloak account details', async ({ page }) => {
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
        phoneNumber: '5551234567',
        username: 'ayse.yilmaz@example.com',
        email: 'ayse.yilmaz@example.com',
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
  await page.getByRole('button', { name: 'Personel sicil talebi' }).click()

  const sellerCodeForm = page.getByLabel(/Sat.*kodu.*formu/i)
  await expect(page.getByRole('heading', { name: 'Personel sicil talebi' })).toBeVisible()
  await sellerCodeForm.getByLabel('Ad', { exact: true }).fill('Ayse')
  await sellerCodeForm.getByLabel('Soyad', { exact: true }).fill('Yilmaz')
  await sellerCodeForm.getByLabel('TC kimlik no').fill('12345678901')
  await sellerCodeForm.getByLabel(/Telefon/i).fill('05551234567')
  await sellerCodeForm.getByLabel('E-posta').fill('ayse.yilmaz@example.com')
  await selectSingleCalendarDate(page, sellerCodeForm.getByLabel(/giri.*tarihi/i), '2026-05-01')
  const positionSelect = sellerCodeForm.getByRole('combobox', { name: 'Pozisyon' })
  await selectComboboxOption(page, positionSelect, 'Satış Danışmanı')
  await sellerCodeForm.getByLabel('Talep nedeni').fill('Yeni personel')
  await sellerCodeForm.getByRole('button', { name: /g.*nder/i }).click()

  await expect(page.getByText('Personel sicil talebi İK onayına gönderildi.')).toBeVisible()
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
  await page.getByRole('button', { name: 'İşten ayrılma talebi' }).click()

  const offboardingForm = page.getByLabel(/Personel.*talebi formu/i)
  const employeeSelect = offboardingForm.getByRole('combobox', { name: 'Personel' })
  await selectComboboxOption(page, employeeSelect, /Store Personnel/)
  await selectSingleCalendarDate(page, offboardingForm.getByLabel(/tarihi/i), '2026-05-10')
  await offboardingForm.getByLabel('Talep nedeni').fill('Personel istifa etti')
  await offboardingForm.getByRole('button', { name: /g.*nder/i }).click()

  await expect(page.getByText('İşten ayrılma talebi İK onayına gönderildi.')).toBeVisible()
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
        phoneNumber: '5551234567',
        username: 'ayse.yilmaz@example.com',
        email: 'ayse.yilmaz@example.com',
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
  await page.getByRole('button', { name: /ade.*talepler/i }).click()
  await expect(page.getByText('TC numarasi tekrar kontrol edilmeli')).toBeVisible()
  await expect(page.getByText('Cikis tarihi tekrar kontrol edilmeli')).toBeVisible()
  await expect(page.getByText('Outside store correction')).toHaveCount(0)
  await expect(page.getByText('Outside offboarding correction')).toHaveCount(0)

  await page.locator('.workforce-returned-row').filter({ hasText: 'Ayse Yilmaz' }).getByRole('button', { name: 'Düzenle' }).click()
  const sellerCodeForm = page.getByLabel(/Sat.*kodu.*formu/i)
  await expect(sellerCodeForm.getByLabel('Ad', { exact: true })).toHaveValue('Ayse')
  await sellerCodeForm.getByLabel('TC kimlik no').fill('12345678902')
  await selectSingleCalendarDate(page, sellerCodeForm.getByLabel(/giri.*tarihi/i), '2026-05-02')
  await sellerCodeForm.getByLabel('Talep nedeni').fill('TC guncellendi')
  await sellerCodeForm.getByRole('button', { name: /yeniden.*g.*nder/i }).click()
  await expect(page.getByText('Personel sicil talebi yeniden İK onayına gönderildi.')).toBeVisible()

  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /ade.*talepler/i }).click()
  await page.locator('.workforce-returned-row').filter({ hasText: 'Store Personnel' }).getByRole('button', { name: 'Düzenle' }).click()
  const offboardingForm = page.getByLabel(/Personel.*talebi formu/i)
  await selectSingleCalendarDate(page, offboardingForm.getByLabel(/tarihi/i), '2026-05-12')
  await offboardingForm.getByLabel('Talep nedeni').fill('Tarih ve sebep guncellendi')
  await offboardingForm.getByRole('button', { name: /yeniden.*g.*nder/i }).click()
  await expect(page.getByText('İşten ayrılma talebi yeniden İK onayına gönderildi.')).toBeVisible()

  expect(capturedSellerPayloads).toHaveLength(1)
  expect(capturedOffboardingPayloads).toHaveLength(1)
  expect(capturedPatchPaths).toEqual([
    `/api/workforce/seller-code-requests/${rejectedSellerCodeRequestFixture.requestId}/resubmit`,
    `/api/workforce/offboarding-requests/${rejectedOffboardingRequestFixture.requestId}/resubmit`,
  ])
})
