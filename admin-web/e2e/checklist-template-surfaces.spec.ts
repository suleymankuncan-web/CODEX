import AxeBuilder from '@axe-core/playwright'
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
  await expect(main.getByText('Publish gate')).toBeVisible()
  await expect(main.getByText('Ready to publish')).toBeVisible()
  await expect(main.getByText('Total weight: 100/100')).toBeVisible()
  await expect(firstQuestion).toHaveValue(/Vitrin sezon/i)

  await chooseChecklistTemplate(page, templateTypeSelect, 'VM Checklist')
  await expect(firstQuestion).toHaveValue('Vitrin konsepti VM standardına uygun mu?')

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
  await page.getByRole('button', { name: /Item settings:/ }).first().click()
  await page.getByRole('checkbox', { name: 'Create a task when non-compliant' }).uncheck()
  await page.getByRole('button', { name: 'Done' }).click()
  await page.getByRole('button', { name: 'Publish' }).first().click()

  await expect.poll(() => createdPayloads.length).toBe(1)
  await expect.poll(() => publishPayloads.length).toBe(1)

  const createPayload = createdPayloads[0] as {
    companyId: string
    effectiveFrom: string
    items: Array<{
      expectedValue: string
      createsRemediationTask: boolean
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
  expect(createPayload.items.map((item) => item.createsRemediationTask)).toEqual([false, true, true, true])
  expect(firstExpectedValue).toEqual({
    lowScoreThreshold: 6,
    minScore: 0,
    note: 'Sezon kombinleri, manken dizilimi ve ilk karşılama alanı kontrol edilir.',
    requiresLowScoreNote: true,
  })
  expect(publishPayloads[0]).toEqual({ effectiveFrom: createPayload.effectiveFrom })
  await expect(page.getByText('Version 1', { exact: true })).toBeVisible()
  await expect(page.locator('.admin-checklist-summary-item').last().getByText('Published', { exact: true })).toBeVisible()
})

test('admin checklist template authoring stays bounded on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/admin/checklists')

  const main = page.getByRole('main')
  await expect(main.getByText('Publish gate')).toBeVisible()
  await expect(main.getByTestId('checklist-item-editor').first()).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    .toBe(true)
})

test('checklist search preserves the complete draft and recovers from no results', async ({ page }) => {
  await page.goto('/admin/checklists')
  const main = page.getByRole('main')
  const search = main.getByRole('textbox', { name: 'Search sections or items' })
  await search.fill('Kasa')
  await expect(main.getByTestId('checklist-item-editor')).toHaveCount(1)
  await main.getByRole('button', { name: 'Preview', exact: true }).click()
  const preview = page.getByRole('dialog', { name: 'Preview' })
  await expect(preview.locator('ol > li')).toHaveCount(4)
  await page.keyboard.press('Escape')
  await search.fill('no-matching-question')
  await expect(main.getByText('No matching items')).toBeVisible()
  await expect(main.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled()
  await main.getByRole('button', { name: 'Clear search' }).click()
  await expect(main.getByTestId('checklist-item-editor')).toHaveCount(4)
})

test('item settings retain score, note and evidence rules while publishing stays validated', async ({ page }) => {
  await page.goto('/admin/checklists')
  const settingsButton = page.getByRole('button', { name: /^Item settings:/ }).first()
  await settingsButton.click()
  const sheet = page.getByRole('dialog', { name: 'Item settings', exact: true })
  await expect(sheet.getByRole('spinbutton', { name: 'Evidence limit' })).toBeDisabled()
  await sheet.getByRole('spinbutton', { name: 'Weight', exact: true }).fill('19')
  await sheet.getByRole('textbox', { name: 'Item description' }).fill('Edited draft note')
  await sheet.getByRole('combobox', { name: 'Photo evidence' }).click()
  await page.getByRole('option', { name: 'Required', exact: true }).click()
  await sheet.getByRole('spinbutton', { name: 'Evidence limit' }).fill('3')
  await sheet.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(settingsButton).toBeFocused()
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled()
  await expect(page.getByText('Item weights must total 100 before publishing.')).toBeVisible()
  await settingsButton.click()
  await expect(sheet.getByRole('textbox', { name: 'Item description' })).toHaveValue('Edited draft note')
  await expect(sheet.getByRole('spinbutton', { name: 'Evidence limit' })).toHaveValue('3')
  await sheet.getByRole('spinbutton', { name: 'Weight', exact: true }).fill('20')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled()
})

test('failed draft creation keeps edits, ends pending state and does not publish', async ({ page }) => {
  let releaseRequest!: () => void
  const responseGate = new Promise<void>((resolve) => { releaseRequest = resolve })
  let publishes = 0
  await page.route('**/api/admin/checklist-templates', async (route) => {
    await responseGate
    await route.fulfill({ status: 500, json: { message: 'Unable to save template' } })
  })
  await page.route('**/api/admin/checklist-templates/*/publish', async (route) => {
    publishes += 1
    await route.fulfill({ status: 500, json: {} })
  })
  await page.goto('/admin/checklists')
  const question = page.getByTestId('checklist-question-input').first()
  await question.fill('Preserved question after failed save')
  const publish = page.getByRole('button', { name: 'Publish', exact: true })
  await publish.click()
  await expect(publish).toBeDisabled()
  await expect(question).toBeDisabled()
  releaseRequest()
  await expect(publish).toBeEnabled()
  await expect(question).toHaveValue('Preserved question after failed save')
  await expect(page.locator('[data-sonner-toast][data-type="error"]')).toBeVisible()
  expect(publishes).toBe(0)
})

test('company context is required before saving or publishing', async ({ page }) => {
  await page.route('**/api/auth/session', (route) => route.fulfill({ json: {
    ...authSessionFixture,
    user: { ...authSessionFixture.user, scope: { companyIds: [], regionIds: [], storeIds: [] }, readScope: { companyIds: [], regionIds: [], storeIds: [] } },
  } }))
  await page.goto('/admin/checklists')
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Save Draft', exact: true })).toBeDisabled()
  await expect(page.getByText('Company context was not found. This user cannot publish templates.')).toBeVisible()
})

test('publishing can retry the saved version after failure without creating another draft', async ({ page }) => {
  let creates = 0
  let publishes = 0
  await page.route('**/api/admin/checklist-templates', (route) => {
    creates += 1
    return route.fulfill({ json: { command: { status: 'created' }, data: { checklistTemplate: { checklistTemplateId: 'retry-template', versionNo: 7, status: 'draft' } } } })
  })
  await page.route('**/api/admin/checklist-templates/*/publish', (route) => {
    publishes += 1
    return publishes === 1
      ? route.fulfill({ status: 500, json: { message: 'Unable to publish template' } })
      : route.fulfill({ json: { command: { status: 'published' }, data: { checklistTemplate: { checklistTemplateId: 'retry-template', versionNo: 7, status: 'published' } } } })
  })
  await page.goto('/admin/checklists')
  const publish = page.getByRole('button', { name: 'Publish', exact: true })
  await publish.click()
  await expect(page.locator('[data-sonner-toast][data-type="error"]')).toBeVisible()
  await expect(page.getByText('Version 7', { exact: true })).toBeVisible()
  await expect(publish).toBeEnabled()
  await publish.click()
  await expect(page.locator('.admin-checklist-summary-item').last().getByText('Published', { exact: true })).toBeVisible()
  expect(creates).toBe(1)
  expect(publishes).toBe(2)
})

for (const [width, height] of [[1440, 900], [1024, 768], [390, 844], [360, 800]] as const) {
  test(`checklist workspace and settings are accessible at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height })
    await page.goto('/admin/checklists')
    await expect(page.getByTestId('checklist-question-input').first()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    const workspaceAudit = await new AxeBuilder({ page }).include('.admin-checklist-templates').withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(workspaceAudit.violations).toEqual([])
    await page.screenshot({ path: testInfo.outputPath(`admin-checklist-${width}.png`), fullPage: true })
    await page.getByRole('button', { name: /^Item settings:/ }).first().click()
    const sheet = page.getByRole('dialog', { name: 'Item settings', exact: true })
    await expect(sheet.getByRole('button', { name: 'Done', exact: true })).toBeInViewport()
    expect(await sheet.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
    const sheetAudit = await new AxeBuilder({ page }).include('.admin-checklist-sheet').withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(sheetAudit.violations).toEqual([])
    await page.screenshot({ path: testInfo.outputPath(`admin-checklist-settings-${width}.png`) })
  })
}

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
