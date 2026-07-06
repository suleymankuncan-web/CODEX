import { expect, test, type Page } from './test-fixtures'

const storeId = '11111111-1111-4111-8111-111111111111'
const templateId = '22222222-2222-4222-8222-222222222222'
const completedAt = '2026-04-12T09:00:00.000Z'

test('completed checklist source keeps past month visit rows visible without monthly summary', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-05-20T12:00:00.000Z'))
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'checklist-surface-user',
        mockRoleCodes: 'REGION_MANAGER',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })
  await routeChecklistMonthFilterApi(page)
  await page.goto('/store/checklists')

  await page.getByRole('combobox', { name: 'Month filter' }).click()
  await page.getByRole('option', { name: 'April 2026' }).click()

  const visitRow = page.locator('.store-checklists-visit-row').filter({ hasText: 'Marmara Park' })
  await expect(visitRow).toBeVisible()
  await expect(visitRow.locator('.store-checklists-date-cell').first()).toContainText('Apr 12, 2026')
})

async function routeChecklistMonthFilterApi(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: createAuthSessionFixture() })
  })
  await page.route('**/api/mobile/checklists/today', async (route) => {
    await route.fulfill({ json: createMobileChecklistTodayFixture() })
  })
  await page.route('**/api/checklists/acknowledgements/list', async (route) => {
    await route.fulfill({ json: createChecklistAcknowledgementsFixture() })
  })
  await page.route('**/api/workflow/inbox', async (route) => {
    await route.fulfill({ json: { items: [], meta: { count: 0, limit: 30, offset: 0, total: 0 } } })
  })
}

function createAuthSessionFixture() {
  return {
    authMode: 'mock',
    authenticated: true,
    user: {
      userId: 'checklist-surface-user',
      roleCodes: ['REGION_MANAGER'],
      scope: {
        companyIds: ['00000000-0000-0000-0000-000000000001'],
        regionIds: ['12121212-1212-4121-8121-121212121212'],
        storeIds: [storeId],
      },
      readScope: {
        companyIds: ['00000000-0000-0000-0000-000000000001'],
        regionIds: ['12121212-1212-4121-8121-121212121212'],
        storeIds: [storeId],
      },
      actionScope: { assignedStoreIds: [storeId] },
      assignedStoreIds: [storeId],
    },
    scopeSummary: { assignedStoreCount: 1, companyCount: 1, regionCount: 1, storeCount: 1 },
  }
}

function createMobileChecklistTodayFixture() {
  const completed = {
    acknowledgedAt: null,
    checklistInstanceId: '44444444-4444-4444-8444-444444444444',
    checklistTemplateId: templateId,
    completedAt,
    storeId,
    totalScore: 86,
  }
  return {
    data: {
      stores: [{ storeId, storeName: 'Marmara Park' }],
      templates: [
        {
          checklistTemplateId: templateId,
          templateCode: 'BM_VISIT_V1',
          templateName: 'BM Visit',
          templateType: 'BM_STORE_VISIT',
          versionNo: 1,
          items: [],
        },
      ],
      activeInstances: [],
      completedThisMonth: [completed],
      pendingAcknowledgements: [completed],
      monthlySummaries: [],
    },
  }
}

function createChecklistAcknowledgementsFixture() {
  return {
    items: [
      {
        acknowledgement: null,
        category: 'BM',
        checklistInstanceId: '44444444-4444-4444-8444-444444444444',
        checklistTemplateId: templateId,
        completedAt,
        completedByUserId: 'region-user-1',
        complianceRate: 0.75,
        responses: [],
        status: 'completed',
        storeId,
        storeName: 'Marmara Park',
        templateName: 'BM Result',
        templateType: 'BM_STORE_VISIT',
        totalScore: 86,
      },
    ],
    meta: { count: 1, limit: 50, offset: 0, total: 1 },
  }
}
