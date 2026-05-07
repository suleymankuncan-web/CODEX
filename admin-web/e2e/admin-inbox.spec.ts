import { expect, test, type Page } from '@playwright/test'

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

  await expect(page.getByRole('heading', { name: 'Admin iş kuyruğu' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Admin kabuğunda ortak iş akışı' })).toBeVisible()
  await expect(page.getByText('April Target Distribution')).toBeVisible()
  await expect(page.getByText('Detay özeti')).toBeVisible()
  await expect(page.getByText('Zaman sinyali')).toBeVisible()
  await expect(page.getByText('Yükseltme', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Inbox governance signals').getByText('Takipte tut')).toBeVisible()
  await expect(page.getByText('Kaynak aksiyonu')).toBeVisible()
  await expect(page.getByText('Karar ekranına git')).toBeVisible()
  const sellerQueue = page.getByLabel('Satıcı kodu onay kuyruğu')
  await expect(sellerQueue.getByText('Son franchise kodu')).toBeVisible()
  await expect(sellerQueue.getByText('FM8375', { exact: true })).toBeVisible()
  await expect(sellerQueue.getByText('Ayse Yilmaz')).toBeVisible()
  await expect(sellerQueue.getByText('TC son 4')).toBeVisible()
  await expect(sellerQueue.getByText('8901')).toBeVisible()
  await expect(sellerQueue.getByText('05551234567')).toBeVisible()
  await expect(sellerQueue.getByText('2026-05-01')).toBeVisible()
  await expect(sellerQueue.getByText('Sales Consultant')).toBeVisible()
  await expect(sellerQueue.getByRole('textbox', { name: 'Ayse Yilmaz satıcı kodu' })).toHaveValue('FM8376')
  await sellerQueue.getByRole('button', { name: 'Satıcı kodunu onayla' }).click()
  await expect(page.getByText('Seller code request approved')).toBeVisible()
  const offboardingQueue = page.getByLabel('Personel çıkış onay kuyruğu')
  await expect(offboardingQueue.getByText('Store Personnel')).toBeVisible()
  await expect(offboardingQueue.getByText('FM8001')).toBeVisible()
  await expect(offboardingQueue.getByText('2026-05-10')).toBeVisible()
  await expect(offboardingQueue.getByText('resignation')).toBeVisible()
  await offboardingQueue.getByRole('button', { name: 'Çıkışı onayla' }).click()
  await expect(page.getByText('Offboarding request approved')).toBeVisible()
  await expect(
    page.getByText('Kullanıcı erişimi kapatıldı: 2 rol yetkisi, 1 aksiyon mağaza yetkisi, 1 mobil oturum.'),
  ).toBeVisible()
  await expect(page.getByText('Admin inbox unavailable')).toHaveCount(0)
})

test('admin inbox page switches chrome to English copy and persists locale', async ({ page }) => {
  await page.goto('/admin/inbox')

  await expect(page.getByRole('heading', { name: 'Admin iş kuyruğu' })).toBeVisible()
  await expect(page.getByText('Aksiyon bekleyenler')).toBeVisible()
  await expect(page.getByText('Satıcı kodu onay kuyruğu')).toBeVisible()
  await expect(page.getByText('One queue for admin-side approvals and KPI follow-up.')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ã')
  await expect(page.locator('body')).not.toContainText('Ä')
  await expect(page.locator('body')).not.toContainText('Å')

  await page.locator('.language-toggle-button').filter({ hasText: 'EN' }).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'One queue for admin-side approvals and KPI follow-up.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Needs attention' })).toBeVisible()
  await expect(page.getByText('Seller code approval queue')).toBeVisible()
  await expect(page.getByText('Admin iş kuyruğu')).toHaveCount(0)

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'One queue for admin-side approvals and KPI follow-up.' })).toBeVisible()
})

test('admin inbox lets HR return workforce requests with a required note', async ({ page }) => {
  await page.goto('/admin/inbox')

  const sellerQueue = page.getByLabel('Satıcı kodu onay kuyruğu')
  await sellerQueue.getByLabel('Ayse Yilmaz için iade notu').fill('TC numarasi tekrar kontrol edilmeli')
  await sellerQueue.getByRole('button', { name: 'Satıcı kodunu mağazaya iade et' }).click()
  await expect(page.getByText('Seller code request returned to store')).toBeVisible()

  const offboardingQueue = page.getByLabel('Personel çıkış onay kuyruğu')
  await offboardingQueue.getByLabel('Store Personnel için iade notu').fill('Cikis tarihi tekrar kontrol edilmeli')
  await offboardingQueue.getByRole('button', { name: 'Çıkış talebini mağazaya iade et' }).click()
  await expect(page.getByText('Offboarding request returned to store')).toBeVisible()
})

async function routeAdminInboxApi(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSessionFixture })
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
