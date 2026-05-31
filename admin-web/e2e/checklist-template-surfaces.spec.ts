import { expect, test, type Locator, type Page } from './test-fixtures'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'checklist-template-admin',
        mockRoleCodes: 'SUPER_ADMIN,HR_ADMIN',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })

  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSessionFixture })
  })
})

test('admin checklist template surface keeps BM and VM drafts isolated', async ({ page }) => {
  await page.goto('/admin/checklists')

  const main = page.getByRole('main')
  const templateTypeSelect = main.getByLabel('Checklist type')
  const firstQuestion = main.getByTestId('checklist-question-input').first()

  await expect(main.getByRole('heading', { name: 'Checklist template editor' })).toBeVisible()
  await expect(main.getByTestId('checklist-template-editor')).toBeVisible()
  await expect(main.locator('[class*="admin-checklist-builder"]')).toHaveCount(0)
  await expect(main.getByText('Total weight: 100/100')).toBeVisible()
  await expect(firstQuestion).toHaveValue(/Vitrin sezon/i)

  await chooseChecklistTemplate(page, templateTypeSelect, 'VM Checklist')
  await expect(firstQuestion).toHaveValue('Vitrin konsepti VM standardina uygun mu?')

  await firstQuestion.fill('VM-only fixture question')
  await chooseChecklistTemplate(page, templateTypeSelect, 'BM Checklist')
  await expect(firstQuestion).toHaveValue(/Vitrin sezon/i)

  await chooseChecklistTemplate(page, templateTypeSelect, 'VM Checklist')
  await expect(firstQuestion).toHaveValue('VM-only fixture question')
})

test('admin checklist template publish preserves create and publish payload shape', async ({ page }) => {
  const createdPayloads: unknown[] = []
  const publishPayloads: unknown[] = []

  await page.route('**/api/admin/checklist-templates', async (route) => {
    createdPayloads.push(route.request().postDataJSON())
    await route.fulfill({
      json: {
        command: { status: 'created', message: 'Draft saved' },
        data: {
          checklistTemplate: {
            checklistTemplateId: 'template-1',
            companyId: '00000000-0000-0000-0000-000000000001',
            templateCode: 'BM_STORE_VISIT_2026',
            templateType: 'BM_STORE_VISIT',
            templateName: 'BM Magaza Ziyareti',
            category: 'store_visit',
            versionNo: 1,
            status: 'draft',
            effectiveFrom: '2026-05-31',
            effectiveTo: null,
            items: [],
          },
        },
      },
    })
  })

  await page.route('**/api/admin/checklist-templates/*/publish', async (route) => {
    publishPayloads.push(route.request().postDataJSON())
    await route.fulfill({
      json: {
        command: { status: 'published', message: 'Template published' },
        data: {
          checklistTemplate: {
            checklistTemplateId: 'template-1',
            versionNo: 1,
            status: 'published',
          },
        },
      },
    })
  })

  await page.goto('/admin/checklists')
  await page.getByRole('button', { name: 'Publish' }).first().click()

  await expect.poll(() => createdPayloads.length).toBe(1)
  await expect.poll(() => publishPayloads.length).toBe(1)

  const createPayload = createdPayloads[0] as {
    companyId: string
    effectiveFrom: string
    items: Array<{
      expectedValue: string
      itemNo: number
      maxScore: number
      responseType: string
      sectionName: string
      weight: number
    }>
    templateCode: string
    templateName: string
    templateType: string
  }
  const firstExpectedValue = JSON.parse(createPayload.items[0]?.expectedValue ?? '{}') as {
    lowScoreThreshold?: number
    minScore?: number
    note?: string
    requiresLowScoreNote?: boolean
  }

  expect(createPayload.companyId).toBe('00000000-0000-0000-0000-000000000001')
  expect(createPayload.templateCode).toBe('BM_STORE_VISIT_2026')
  expect(createPayload.templateType).toBe('BM_STORE_VISIT')
  expect(createPayload.items).toHaveLength(4)
  expect(createPayload.items.map((item) => item.itemNo)).toEqual([1, 2, 3, 4])
  expect(createPayload.items.reduce((total, item) => total + item.weight, 0)).toBe(100)
  expect(createPayload.items.every((item) => item.responseType === 'score')).toBe(true)
  expect(firstExpectedValue).toEqual({
    lowScoreThreshold: 6,
    minScore: 0,
    note: 'Sezon kombinleri, manken dizilimi ve ilk karşılama alanı kontrol edilir.',
    requiresLowScoreNote: true,
  })
  expect(publishPayloads[0]).toEqual({ effectiveFrom: createPayload.effectiveFrom })
})

async function chooseChecklistTemplate(page: Page, trigger: Locator, optionName: string) {
  await trigger.click()
  await page.getByRole('option', { name: optionName }).click()
}

const authSessionFixture = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'checklist-template-admin',
    employeeId: null,
    roleCodes: ['SUPER_ADMIN', 'HR_ADMIN'],
    scope: {
      companyIds: ['00000000-0000-0000-0000-000000000001'],
      regionIds: [],
      storeIds: [],
    },
    readScope: {
      companyIds: ['00000000-0000-0000-0000-000000000001'],
      regionIds: [],
      storeIds: [],
    },
    actionScope: {
      assignedStoreIds: [],
    },
    assignedStoreIds: [],
  },
  scopeSummary: {
    companyCount: 1,
    regionCount: 0,
    storeCount: 0,
    assignedStoreCount: 0,
  },
}
