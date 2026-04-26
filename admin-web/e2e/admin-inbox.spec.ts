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

  await expect(page.getByRole('heading', { name: 'Shared workflow contract in admin shell' })).toBeVisible()
  await expect(page.getByText('April Target Distribution')).toBeVisible()
  await expect(page.getByText('Detay özeti')).toBeVisible()
  await expect(page.getByText('Zaman sinyali')).toBeVisible()
  await expect(page.getByText('Yükseltme', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Inbox governance signals').getByText('Takipte tut')).toBeVisible()
  await expect(page.getByText('Kaynak aksiyonu')).toBeVisible()
  await expect(page.getByText('Karar ekranına git')).toBeVisible()
  await expect(page.getByText('Admin inbox unavailable')).toHaveCount(0)
})

async function routeAdminInboxApi(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSessionFixture })
  })

  await page.route('**/api/workflow/inbox', async (route) => {
    await route.fulfill({ json: workflowInboxFixture })
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
