import { expect, test, type Page } from '@playwright/test'
import { setStoredLocale } from './locale-test-utils'

const storeId = '11111111-1111-4111-8111-111111111111'
const templateId = '22222222-2222-4222-8222-222222222222'

test('region manager checklist surface shows assigned store visit workflow', async ({ page }) => {
  await setupChecklistPage(page, ['REGION_MANAGER'])
  await page.goto('/store/checklists')

  await expect(page.getByText('Checklist yap')).toBeVisible()
  await expect(page.getByText('Taslak')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tamamla' })).toBeVisible()
})

test('store manager checklist surface keeps acknowledgement language', async ({ page }) => {
  await setupChecklistPage(page, ['STORE_MANAGER'])
  await page.goto('/store/checklists')

  await expect(page.getByText('Kabul ettim')).toBeVisible()
})

test('visual merchandiser sees checklist-only VM coverage and no broad store links', async ({ page }) => {
  await setupChecklistPage(page, ['VISUAL_MERCHANDISER'], {
    templateType: 'VM_STORE_VISIT',
    templateCode: 'VM_VISIT_V1',
    templateName: 'VM Visit',
    activeInstances: [],
    monthlySummaries: [],
  })
  await page.goto('/store/checklists')

  await expect(page.getByText('VM checklist yapılmadı')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Checklist yap' })).toBeVisible()
  await expect(page.locator('a[href="/admin/reports"]')).toHaveCount(0)
  await expect(page.locator('a[href="/store/feed"]')).toHaveCount(0)
  await expect(page.locator('a[href="/store/competitions"]')).toHaveCount(0)
})

test('store checklist surface switches to English copy and persists locale', async ({ page }) => {
  await setupChecklistPage(page, ['SUPER_ADMIN'])
  await page.goto('/store/checklists')

  await setStoredLocale(page, 'en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(
    page.getByRole('heading', { name: /Checklist results flow as acknowledgements/i }),
  ).toBeVisible()
  await expect(page.getByText('Visit flow')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Assigned store checklist visits' })).toBeVisible()
  await expect(page.getByText('In progress', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Template type', { exact: true })).toBeVisible()
  await expect(page.getByText('This month', { exact: true })).toBeVisible()
  await expect(page.getByText('Draft', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Complete' })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Completed checklist receipts waiting on store acknowledgement' }),
  ).toBeVisible()
  await expect(page.getByText('Acknowledgement note')).toBeVisible()
  await expect(page.getByRole('button', { name: 'I acknowledge' })).toBeVisible()
  await expect(page.getByText('Checklist sonuçları')).toHaveCount(0)
  await expect(page.getByText('Ziyaret akışı')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ãƒ')
  await expect(page.locator('body')).not.toContainText('Ã„')
  await expect(page.locator('body')).not.toContainText('Ã…')

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(
    page.getByRole('heading', { name: /Checklist results flow as acknowledgements/i }),
  ).toBeVisible()
})

type ChecklistFixtureOptions = {
  templateType?: string
  templateCode?: string
  templateName?: string
  activeInstances?: typeof mobileChecklistTodayFixture.data.activeInstances
  monthlySummaries?: typeof mobileChecklistTodayFixture.data.monthlySummaries
}

async function setupChecklistPage(page: Page, roleCodes: string[], options: ChecklistFixtureOptions = {}) {
  const roleCodeHeader = roleCodes.join(',')
  await page.addInitScript((roles) => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'checklist-surface-user',
        mockRoleCodes: roles,
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  }, roleCodeHeader)

  await routeChecklistApi(page, roleCodes, options)
}

async function routeChecklistApi(page: Page, roleCodes: string[], options: ChecklistFixtureOptions) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: createAuthSessionFixture(roleCodes) })
  })

  await page.route('**/api/mobile/checklists/today', async (route) => {
    await route.fulfill({ json: createMobileChecklistTodayFixture(options) })
  })

  await page.route('**/api/checklists/acknowledgements/list', async (route) => {
    await route.fulfill({ json: checklistAcknowledgementsFixture })
  })

  await page.route('**/api/mobile/checklists/instances', async (route) => {
    await route.fulfill({
      status: 201,
      json: {
        command: { status: 'created', message: 'Checklist visit started' },
        data: {
          checklistInstance: {
            checklist_instance_id: '33333333-3333-4333-8333-333333333333',
            status: 'in_progress',
            created_at: '2026-04-28T10:00:00.000Z',
          },
        },
      },
    })
  })
}

function createAuthSessionFixture(roleCodes: string[]) {
  return {
    authMode: 'mock',
    authenticated: true,
    user: {
      userId: 'checklist-surface-user',
      roleCodes,
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
      actionScope: {
        assignedStoreIds: [storeId],
      },
      assignedStoreIds: [storeId],
    },
    scopeSummary: {
      companyCount: 1,
      regionCount: 1,
      storeCount: 1,
      assignedStoreCount: 1,
    },
  }
}

function createMobileChecklistTodayFixture(options: ChecklistFixtureOptions = {}) {
  const templateType = options.templateType ?? 'BM_STORE_VISIT'
  const templateCode = options.templateCode ?? 'BM_VISIT_V1'
  const templateName = options.templateName ?? 'BM Visit'

  return {
  data: {
    stores: [{ storeId, storeName: 'Marmara Park' }],
    templates: [
      {
        checklistTemplateId: templateId,
        templateCode,
        templateType,
        templateName,
        versionNo: 1,
        items: [
          {
            templateItemId: '55555555-5555-4555-8555-555555555555',
            sectionName: 'Gorsel duzen',
            itemNo: 1,
            itemText: 'Vitrin standartlara uygun',
            responseType: 'score',
            weight: 100,
            maxScore: 10,
          },
        ],
      },
    ],
    activeInstances: options.activeInstances ?? [
      {
        checklistInstanceId: '33333333-3333-4333-8333-333333333333',
        checklistTemplateId: templateId,
        storeId,
        status: 'in_progress',
        startedAt: '2026-04-28T10:00:00.000Z',
        updatedAt: '2026-04-28T10:00:00.000Z',
      },
    ],
    completedThisMonth: [],
    pendingAcknowledgements: [],
    monthlySummaries: options.monthlySummaries ?? [
      {
        storeId,
        checklistTemplateId: templateId,
        monthStart: '2026-04-01',
        completedCount: 2,
        averageScore: 86,
      },
    ],
  },
}
}

const checklistAcknowledgementsFixture = {
  items: [
    {
      checklistInstanceId: '44444444-4444-4444-8444-444444444444',
      checklistTemplateId: templateId,
      templateName: 'BM Visit',
      category: 'BM',
      storeId,
      storeName: 'Marmara Park',
      completedAt: '2026-04-28T09:00:00.000Z',
      status: 'completed',
      totalScore: 86,
      complianceRate: 1,
      acknowledgement: null,
    },
  ],
  meta: {
    count: 1,
    total: 1,
    limit: 50,
    offset: 0,
  },
}
