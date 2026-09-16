import { expect, test, type Page } from './test-fixtures'
import { setStoredLocale } from './locale-test-utils'

async function openInboxRecord(page: Page, title: string) {
  await page.getByRole('button', { name: `${title} detayını aç`, exact: true }).click()
  return page.getByRole('dialog')
}

test('inbox search and status filtering preserve keyboard sheet focus', async ({ page }) => {
  await page.goto('/admin/inbox')
  await page.getByRole('textbox', { name: 'Ad, mağaza veya iş ara' }).fill('missing request')
  await expect(page.getByText('Eşleşen kayıt yok')).toBeVisible()
  await page.getByRole('textbox', { name: 'Ad, mağaza veya iş ara' }).fill('April')
  await page.getByRole('combobox', { name: 'Durum', exact: true }).click()
  await page.getByRole('option', { name: 'Tamamlandı', exact: true }).click()
  await expect(page.getByText('Eşleşen kayıt yok')).toBeVisible()
  await page.getByRole('combobox', { name: 'Durum', exact: true }).click()
  await page.getByRole('option', { name: 'Tüm durumlar', exact: true }).click()
  const trigger = page.getByRole('button', { name: 'April Target Distribution detayını aç' })
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await expect(page.getByRole('textbox', { name: 'Ad, mağaza veya iş ara' })).toHaveValue('April')
  await expect(page.locator('.admin-inbox-page')).not.toContainText('00000000-0000-0000-0000-000000000010')
})

test('report viewers cannot open the admin inbox or request HR queues', async ({ page }) => {
  await page.route('**/api/auth/session', route => route.fulfill({ json: { ...authSessionFixture, user: { ...authSessionFixture.user, roleCodes: ['REPORT_VIEWER'] } } }))
  const workforceReads: string[] = []
  page.on('request', request => {
    const pathname = new URL(request.url()).pathname
    if (pathname.startsWith('/api/workforce/')) workforceReads.push(request.url())
  })
  await page.goto('/admin/inbox')
  await expect(page.getByRole('heading', { name: 'Bu rol için rota kullanılamaz' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'İş akışı', exact: true })).toHaveCount(0)
  await expect(page.getByRole('tab', { name: 'Satıcı kodu', exact: true })).toHaveCount(0)
  await expect(page.getByRole('tab', { name: 'Personel çıkışı', exact: true })).toHaveCount(0)
  await expect(page.getByRole('tab', { name: 'Personel düzeltmeleri', exact: true })).toHaveCount(0)
  expect(workforceReads).toEqual([])
})

test('failed approval retains entered code and return note for recovery', async ({ page }) => {
  await page.route('**/api/workforce/seller-code-requests/*/approve', route => route.fulfill({ status: 409, json: { message: 'Seller code already assigned' } }))
  await page.goto('/admin/inbox')
  await page.getByRole('tab', { name: 'Satıcı kodu', exact: true }).click()
  const sheet = await openInboxRecord(page, 'Ayse Yilmaz')
  await sheet.getByRole('textbox', { name: 'Ayse Yilmaz satıcı kodu' }).fill('FM9000')
  await sheet.getByRole('textbox', { name: 'Ayse Yilmaz için iade notu' }).fill('Kontrol gerekli')
  await sheet.getByRole('button', { name: 'Satıcı kodunu onayla' }).click()
  await expect(page.getByText('Seller code already assigned')).toBeVisible()
  await expect(sheet.getByRole('textbox', { name: 'Ayse Yilmaz satıcı kodu' })).toHaveValue('FM9000')
  await expect(sheet.getByRole('textbox', { name: 'Ayse Yilmaz için iade notu' })).toHaveValue('Kontrol gerekli')
  await expect(sheet.getByRole('button', { name: 'Satıcı kodunu onayla' })).toBeEnabled()
})

test('shared inbox failure leaves HR queues usable and retries the read', async ({ page }) => {
  let failed = true
  await page.route('**/api/workflow/inbox', route => failed ? route.fulfill({ status: 400, json: { message: 'Inbox temporarily unavailable' } }) : route.fulfill({ json: workflowInboxFixture }))
  await page.goto('/admin/inbox')
  await expect(page.getByRole('button', { name: 'Tekrar dene' })).toBeVisible()
  await expect(page.getByTestId('admin-metric-queueItems')).toContainText('Alınamadı')
  await page.getByRole('tab', { name: 'Satıcı kodu', exact: true }).click()
  await expect(page.getByText('Ayse Yilmaz')).toBeVisible()
  await page.getByRole('tab', { name: 'İş akışı', exact: true }).click()
  failed = false
  await page.getByRole('button', { name: 'Tekrar dene' }).click()
  await expect(page.getByText('April Target Distribution')).toBeVisible()
})

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 360, height: 800 }]) {
  test(`inbox Azure table and sheet fit ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    await page.goto('/admin/inbox')
    await expect(page.getByText('April Target Distribution')).toBeVisible()
    await expect(page.locator('.admin-inbox-page')).not.toContainText('Â')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    const statusBadge = page.locator('.admin-inbox-status-cell [data-slot=badge]').first()
    expect(await statusBadge.evaluate(element => element.scrollHeight <= element.clientHeight)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`inbox-${viewport.width}.png`), fullPage: true, animations: 'disabled' })
    const sheet = await openInboxRecord(page, 'April Target Distribution')
    await expect(sheet).toBeVisible()
    const bounds = await sheet.boundingBox()
    expect(bounds?.width).toBeLessThanOrEqual(viewport.width)
    await expect(sheet.getByRole('button', { name: 'Kapat', exact: true })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath(`inbox-sheet-${viewport.width}.png`), fullPage: true, animations: 'disabled' })
  })
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'super-admin-inbox-user',
        mockRoleCodes: 'SUPER_ADMIN',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })

  await routeAdminInboxApi(page)
})

test('admin inbox renders item detail, due, escalation, and source action signals', async ({ page }) => {
  await page.goto('/admin/inbox')

  await expect(page.getByRole('heading', { name: 'Admin iş kuyruğu', level: 1, exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'İş akışı kayıtları' })).toBeVisible()
  await expect(page.getByText('April Target Distribution')).toBeVisible()
  await openInboxRecord(page, 'April Target Distribution')
  await expect(page.getByText('Detay özeti')).toBeVisible()
  await expect(page.getByText('Zaman sinyali')).toBeVisible()
  await expect(page.getByText('Yükseltme', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Inbox governance signals').getByText('Takipte tut')).toBeVisible()
  await expect(page.getByText('Kaynak aksiyonu')).toBeVisible()
  await expect(page.getByText('Karar ekranına git')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Kapat', exact: true }).click()
  await page.getByRole('tab', { name: 'Satıcı kodu', exact: true }).click()
  const sellerList = page.getByRole('region', { name: 'Satıcı kodu onay kuyruğu', exact: true })
  await expect(sellerList.getByText('Son franchise kodu')).toBeVisible()
  await expect(sellerList.getByText('FM8375', { exact: true })).toBeVisible()
  const sellerQueue = await openInboxRecord(page, 'Ayse Yilmaz')
  await expect(sellerQueue.getByText('Ayse Yilmaz')).toBeVisible()
  await expect(sellerQueue.getByText('TC son 4')).toBeVisible()
  await expect(sellerQueue.getByText('8901')).toBeVisible()
  await expect(sellerQueue.getByText('05551234567')).toBeVisible()
  await expect(sellerQueue.getByText('2026-05-01')).toBeVisible()
  await expect(sellerQueue.getByText('Sales Consultant')).toBeVisible()
  await expect(sellerQueue.getByRole('textbox', { name: 'Ayse Yilmaz satıcı kodu' })).toHaveValue('FM8376')
  await sellerQueue.getByRole('button', { name: 'Satıcı kodunu onayla' }).click()
  await expect(page.getByText('Personel sicil talebi onaylandı.')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Kapat', exact: true }).click()
  await page.getByRole('tab', { name: 'Personel çıkışı', exact: true }).click()
  const offboardingQueue = await openInboxRecord(page, 'Store Personnel')
  await expect(offboardingQueue.getByText('Store Personnel')).toBeVisible()
  await expect(offboardingQueue.getByText('FM8001')).toBeVisible()
  await expect(offboardingQueue.getByText('2026-05-10')).toBeVisible()
  await expect(offboardingQueue.getByText('resignation')).toBeVisible()
  await offboardingQueue.getByRole('button', { name: 'Çıkışı onayla' }).click()
  await expect(page.getByText('İşten ayrılma talebi onaylandı.')).toBeVisible()
  await expect(
    page.getByText('Kullanıcı erişimi kapatıldı: 2 rol yetkisi, 1 aksiyon mağaza yetkisi, 1 mobil oturum.'),
  ).toBeVisible()
  await expect(page.getByText('Admin inbox unavailable')).toHaveCount(0)
})

test('admin inbox page switches chrome to English copy and persists locale', async ({ page }) => {
  let releaseInbox: (() => void) | undefined
  const inboxResponseGate = new Promise<void>(resolve => { releaseInbox = resolve })
  await page.route('**/api/workflow/inbox', async route => {
    await inboxResponseGate
    await route.fallback()
  })
  await page.goto('/admin/inbox')

  try {
    await expect(page.getByRole('heading', { name: 'Admin iş kuyruğu yükleniyor', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Admin iş kuyruğu', level: 1, exact: true })).toBeVisible()
  } finally {
    releaseInbox?.()
  }
  await expect(page.getByRole('heading', { name: 'Aksiyon bekleyenler' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Satıcı kodu', exact: true })).toBeVisible()
  await expect(page.getByText('One queue for admin-side approvals and KPI follow-up.')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ã')
  await expect(page.locator('body')).not.toContainText('Ä')
  await expect(page.locator('body')).not.toContainText('Å')

  await setStoredLocale(page, 'en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Admin inbox', level: 1, exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Needs attention' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Seller code', exact: true })).toBeVisible()
  await expect(page.getByText('Admin iş kuyruğu')).toHaveCount(0)

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Admin inbox', level: 1, exact: true })).toBeVisible()
})

test('admin sidebar prefetches inbox queues before opening admin inbox', async ({ page }) => {
  let workflowRequests = 0
  let sellerReferenceRequests = 0
  let sellerCodeRequests = 0
  let offboardingRequests = 0

  page.on('request', (request) => {
    if (request.method() !== 'GET') {
      return
    }

    const requestUrl = new URL(request.url())
    if (requestUrl.pathname === '/api/workflow/inbox') {
      workflowRequests += 1
    }
    if (requestUrl.pathname === '/api/workforce/seller-code-reference') {
      sellerReferenceRequests += 1
    }
    if (
      requestUrl.pathname === '/api/workforce/seller-code-requests' &&
      requestUrl.searchParams.get('status') === 'pending_hr_approval'
    ) {
      sellerCodeRequests += 1
    }
    if (
      requestUrl.pathname === '/api/workforce/offboarding-requests' &&
      requestUrl.searchParams.get('status') === 'pending_hr_approval'
    ) {
      offboardingRequests += 1
    }
  })

  await page.goto('/admin/session')

  const inboxLink = page.getByRole('link', { name: 'Gelen Kutusu' })
  await expect(inboxLink).toBeVisible()

  await inboxLink.hover()

  await expect.poll(() => workflowRequests).toBeGreaterThanOrEqual(1)
  await expect.poll(() => sellerReferenceRequests).toBeGreaterThanOrEqual(1)
  await expect.poll(() => sellerCodeRequests).toBeGreaterThanOrEqual(1)
  await expect.poll(() => offboardingRequests).toBeGreaterThanOrEqual(1)
  const prefetchedWorkflowRequests = workflowRequests
  const prefetchedSellerReferenceRequests = sellerReferenceRequests
  const prefetchedSellerCodeRequests = sellerCodeRequests
  const prefetchedOffboardingRequests = offboardingRequests

  await inboxLink.click()

  await expect(page).toHaveURL(/\/admin\/inbox$/)
  await expect(page.getByText('April Target Distribution')).toBeVisible()
  await expect.poll(() => workflowRequests, { timeout: 1000 }).toBe(prefetchedWorkflowRequests)
  await expect.poll(() => sellerReferenceRequests, { timeout: 1000 }).toBe(prefetchedSellerReferenceRequests)
  await expect.poll(() => sellerCodeRequests, { timeout: 1000 }).toBe(prefetchedSellerCodeRequests)
  await expect.poll(() => offboardingRequests, { timeout: 1000 }).toBe(prefetchedOffboardingRequests)
})

test('admin inbox lets HR return workforce requests with a required note', async ({ page }) => {
  await page.goto('/admin/inbox')

  await page.getByRole('tab', { name: 'Satıcı kodu', exact: true }).click()
  const sellerQueue = await openInboxRecord(page, 'Ayse Yilmaz')
  await sellerQueue.getByLabel('Ayse Yilmaz için iade notu').fill('TC numarasi tekrar kontrol edilmeli')
  await sellerQueue.getByRole('button', { name: 'Satıcı kodunu mağazaya iade et' }).click()
  await expect(page.getByText('Personel sicil talebi düzeltme için mağazaya iade edildi.')).toBeVisible()

  await page.getByRole('dialog').getByRole('button', { name: 'Kapat', exact: true }).click()
  await page.getByRole('tab', { name: 'Personel çıkışı', exact: true }).click()
  const offboardingQueue = await openInboxRecord(page, 'Store Personnel')
  await offboardingQueue.getByLabel('Store Personnel için iade notu').fill('Cikis tarihi tekrar kontrol edilmeli')
  await offboardingQueue.getByRole('button', { name: 'Çıkış talebini mağazaya iade et' }).click()
  await expect(page.getByText('İşten ayrılma talebi düzeltme için mağazaya iade edildi.')).toBeVisible()
})

async function routeAdminInboxApi(page: Page) {
  await page.route('**/api/workforce/personnel-corrections**', (route) => route.fulfill({ json: { items: [] } }))
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSessionFixture })
  })

  await page.route('**/api/integrations/**', async (route) => {
    await route.fulfill({ json: {} })
  })

  await page.route('**/api/workflow/inbox', async (route) => {
    await route.fulfill({ json: workflowInboxFixture })
  })

  await page.route('**/api/workforce/seller-code-reference**', async (route) => {
    await route.fulfill({ json: sellerCodeReferenceFixture })
  })

  await page.route('**/api/workforce/seller-code-requests**', async (route) => {
    if (route.request().method() === 'PATCH') {
      const pathname = new URL(route.request().url()).pathname
      const body = route.request().postDataJSON()
      if (pathname.endsWith('/reject')) {
        expect(body).toEqual({
          reviewNote: 'TC numarasi tekrar kontrol edilmeli',
        })
        await route.fulfill({
          json: {
            command: {
              status: 'rejected',
              message: 'Seller code request returned to store',
            },
            data: {
              request: {
                ...sellerCodeRequestsFixture.items[0],
                status: 'rejected',
                reviewedByUserId: 'super-admin-inbox-user',
                reviewNote: 'TC numarasi tekrar kontrol edilmeli',
              },
            },
          },
        })
        return
      }

      expect(body).toEqual({
        sellerCode: 'FM8376',
        reviewNote: 'Approved from admin inbox',
      })
      await route.fulfill({
        json: {
          command: {
            status: 'approved',
            message: 'Seller code request approved',
          },
          data: {
            request: {
              ...sellerCodeRequestsFixture.items[0],
              status: 'approved',
              approvedSellerCode: 'FM8376',
            },
          },
        },
      })
      return
    }

    await route.fulfill({ json: sellerCodeRequestsFixture })
  })

  await page.route('**/api/workforce/offboarding-requests**', async (route) => {
    if (route.request().method() === 'PATCH') {
      const pathname = new URL(route.request().url()).pathname
      const body = route.request().postDataJSON()
      if (pathname.endsWith('/reject')) {
        expect(body).toEqual({
          reviewNote: 'Cikis tarihi tekrar kontrol edilmeli',
        })
        await route.fulfill({
          json: {
            command: {
              status: 'rejected',
              message: 'Offboarding request returned to store',
            },
            data: {
              request: {
                ...offboardingRequestsFixture.items[0],
                status: 'rejected',
                reviewedByUserId: 'super-admin-inbox-user',
                reviewNote: 'Cikis tarihi tekrar kontrol edilmeli',
              },
            },
          },
        })
        return
      }

      expect(body).toEqual({
        reviewNote: 'Approved from admin inbox',
      })
      await route.fulfill({
        json: {
          command: {
            status: 'approved',
            message: 'Offboarding request approved',
          },
          data: {
            request: {
              ...offboardingRequestsFixture.items[0],
              status: 'approved',
              reviewedByUserId: 'super-admin-inbox-user',
              reviewNote: 'Approved from admin inbox',
            },
            accessClosure: {
              userAccessClosed: true,
              closedUserId: 'auth-user-for-offboarding',
              closedRoleAssignments: 2,
              closedActionStoreAssignments: 1,
              revokedMobileSessions: 1,
            },
          },
        },
      })
      return
    }

    await route.fulfill({ json: offboardingRequestsFixture })
  })
}

const authSessionFixture = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'super-admin-inbox-user',
    roleCodes: ['SUPER_ADMIN'],
    scope: {
      companyIds: ['00000000-0000-0000-0000-000000000001'],
      regionIds: ['00000000-0000-0000-0000-000000000010'],
      storeIds: [],
    },
    readScope: {
      companyIds: ['00000000-0000-0000-0000-000000000001'],
      regionIds: ['00000000-0000-0000-0000-000000000010'],
      storeIds: [],
    },
    actionScope: {
      assignedStoreIds: [],
    },
    assignedStoreIds: [],
  },
  scopeSummary: {
    companyCount: 1,
    regionCount: 1,
    storeCount: 0,
    assignedStoreCount: 0,
  },
}

const workflowInboxFixture = {
  items: [
    {
      itemType: 'approval',
      sourceType: 'target_distribution_request',
      sourceId: 'target-request-1',
      title: 'April Target Distribution',
      summary: 'IstinyePark Demo Store icin 4 kisilik hedef dagitimi talebi',
      companyId: '00000000-0000-0000-0000-000000000001',
      regionId: '00000000-0000-0000-0000-000000000010',
      storeId: '00000000-0000-0000-0000-000000000100',
      storeName: 'IstinyePark Demo Store',
      workflowStatus: 'pending_region_approval',
      inboxStatus: 'needs_attention',
      urgency: 'medium',
      createdAt: '2026-04-24T08:00:00.000Z',
      needsAttentionAt: '2026-04-24T08:00:00.000Z',
      actorRole: 'REGION_APPROVER',
      primaryActionLabel: 'Approve request',
      secondaryActionLabel: 'Open detail',
      deepLink: '/admin/targets',
      historyPreview: 'Submitted by store manager',
    },
  ],
  meta: {
    count: 1,
    total: 1,
    limit: 50,
    offset: 0,
  },
}

const sellerCodeReferenceFixture = {
  storeType: 'franchise',
  prefix: 'FM',
  lastSellerCode: 'FM8375',
  nextSellerCodePreview: 'FM8376',
}

const sellerCodeRequestsFixture = {
  items: [
    {
      requestId: '55555555-5555-4555-8555-555555555555',
      companyId: '00000000-0000-0000-0000-000000000001',
      regionId: '00000000-0000-0000-0000-000000000010',
      storeId: '00000000-0000-0000-0000-000000000100',
      storeCode: 'MP001',
      storeName: 'Marmara Park',
      storeType: 'franchise',
      requestType: 'create_code',
      status: 'pending_hr_approval',
      firstName: 'Ayse',
      lastName: 'Yilmaz',
      nationalIdLast4: '8901',
      phoneNumber: '05551234567',
      hireDate: '2026-05-01',
      requestedPositionId: '44444444-4444-4444-8444-444444444444',
      positionCode: 'SALES_CONSULTANT',
      positionName: 'Sales Consultant',
      employmentType: 'full_time',
      requestedSellerCode: null,
      approvedSellerCode: null,
      lastReferenceSellerCode: 'FM8375',
      submittedByUserId: 'store-manager-1',
      reviewedByUserId: null,
      reviewedAt: null,
      reviewNote: null,
      employeeId: null,
      createdAt: '2026-04-27T12:00:00.000Z',
      updatedAt: '2026-04-27T12:00:00.000Z',
    },
  ],
  meta: {
    count: 1,
    total: 1,
    limit: 50,
    offset: 0,
  },
}

const offboardingRequestsFixture = {
  items: [
    {
      requestId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      companyId: '00000000-0000-0000-0000-000000000001',
      regionId: '00000000-0000-0000-0000-000000000010',
      storeId: '00000000-0000-0000-0000-000000000100',
      storeCode: 'MP001',
      storeName: 'Marmara Park',
      employeeId: '00000000-0000-0000-0000-000000000202',
      displayName: 'Store Personnel',
      externalEmployeeRef: 'FM8001',
      positionCode: 'SALES_CONSULTANT',
      positionName: 'Sales Consultant',
      status: 'pending_hr_approval',
      terminationDate: '2026-05-10',
      terminationReason: 'resignation',
      requestReason: 'Personel istifa etti',
      submittedByUserId: 'store-manager-1',
      reviewedByUserId: null,
      reviewedAt: null,
      reviewNote: null,
      createdAt: '2026-04-27T12:00:00.000Z',
      updatedAt: '2026-04-27T12:00:00.000Z',
    },
  ],
  meta: {
    count: 1,
    total: 1,
    limit: 50,
    offset: 0,
  },
}


test('HR compares personnel corrections and keeps stale approvals visible', async ({ page }) => {
  const values = { firstName: 'Test', lastName: 'Personel', phoneNumber: '', hireDate: '2026-09-07', employmentType: 'full_time', positionId: 'position-1' }
  const decisions: string[] = []
  let rejected = false
  await page.route('**/api/workforce/personnel-corrections**', async (route) => {
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON(); decisions.push(body.decision)
      if (body.decision === 'approve') { await route.fulfill({ status: 409, json: { message: 'Personnel changed; reject this request and ask for a new correction' } }); return }
      rejected = true; await route.fulfill({ json: { request_status: 'rejected' } }); return
    }
    await route.fulfill({ json: { items: rejected ? [] : [{ request_id: 'request-1', employee_id: 'employee-1', store_name: 'Test Mağaza', request_status: 'pending_hr_approval', request_reason: 'İsim düzeltmesi', previous_values: values, proposed_values: { ...values, firstName: 'Düzeltilmiş' }, review_note: null }] } })
  })
  await page.goto('/admin/inbox')
  await page.getByRole('tab', { name: 'Personel düzeltmeleri', exact: true }).click()
  const queue = page.getByRole('region', { name: 'Personel düzeltme talepleri' })
  await expect(queue.getByText('Test → Düzeltilmiş')).toBeVisible()
  await expect(queue.getByRole('button', { name: 'Onayla', exact: true })).toBeDisabled()
  await queue.getByRole('textbox', { name: 'İK değerlendirme notu' }).fill('Kontrol edildi')
  await queue.getByRole('button', { name: 'Onayla', exact: true }).click()
  await expect(queue.getByRole('alert')).toBeVisible()
  await expect(queue.getByText('İK onayı bekliyor')).toBeVisible()
  await queue.getByRole('button', { name: 'Reddet', exact: true }).click()
  await expect(queue.getByText('Bu sayfada talep bulunmuyor.')).toBeVisible()
  expect(decisions).toEqual(['approve', 'reject'])
})
