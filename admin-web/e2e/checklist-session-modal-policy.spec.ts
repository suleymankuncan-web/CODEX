import { expect, test, type Locator, type Page } from './test-fixtures'

const storeId = '11111111-1111-4111-8111-111111111111'
const templateId = '22222222-2222-4222-8222-222222222222'
const checklistInstanceId = '33333333-3333-4333-8333-333333333333'
const templateItemId = '55555555-5555-4555-8555-555555555555'
const fixtureNow = new Date('2026-05-20T12:00:00.000Z')

type ChecklistRequestLog = {
  completes: Array<{ checklistInstanceId: string }>
  saves: Array<{
    body: { commentText?: string; scoreValue: number; templateItemId: string }
    checklistInstanceId: string
  }>
}

test('checklist session modal uses 1-5 score policy and low-score note guard', async ({ page }) => {
  const requests = createRequestLog()
  await setupChecklistSessionPolicyPage(page, requests)
  await page.goto('/store/checklists')

  await page.getByRole('button', { name: 'Devam et' }).click()
  const dialog = page.getByRole('dialog')

  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('radio', { name: '0', exact: true })).toHaveCount(0)
  for (const score of ['1', '2', '3', '4', '5']) {
    await expect(dialog.getByRole('radio', { name: score, exact: true })).toBeVisible()
  }
  await expect(dialog.getByRole('radio', { name: '6', exact: true })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Tamamla', exact: true })).toBeDisabled()

  await dialog.getByRole('radio', { name: '2', exact: true }).click()
  await expect(dialog.getByText('Bu puanda mağazaya görev oluşacaktır.')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Tamamla', exact: true })).toBeDisabled()

  await dialog.getByRole('textbox', { name: /Not/ }).fill('Eksik raf düzeni mağaza aksiyonuna düşmeli')
  await expect(dialog.getByRole('button', { name: 'Tamamla', exact: true })).toBeEnabled()

  page.once('dialog', (confirm) => confirm.accept())
  await dialog.getByRole('button', { name: 'Tamamla', exact: true }).click()

  await expect.poll(() => requests.completes).toEqual([{ checklistInstanceId }])
})

test('draft close keeps visit in progress and does not complete the checklist', async ({ page }) => {
  const requests = createRequestLog()
  await setupChecklistSessionPolicyPage(page, requests)
  await page.goto('/store/checklists')

  const visitRow = page.locator('.store-checklists-visit-row').filter({ hasText: 'Marmara Park' })
  await expect(visitRow).toBeVisible()
  await page.getByRole('button', { name: 'Devam et' }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByRole('radio', { name: '4', exact: true }).click()
  await expect(dialog.getByText('Bu puanda mağazaya görev oluşacaktır.')).toHaveCount(0)
  await expect.poll(() => requests.saves.length).toBeGreaterThanOrEqual(1)

  page.once('dialog', (confirm) => confirm.accept())
  await dialog.getByRole('button', { name: 'Taslak kaydet' }).click()

  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect.poll(() => requests.completes).toEqual([])
  await expect(visitRow.getByRole('button', { name: 'Devam et' })).toBeVisible()
  await expect(page.getByText('Başarıyla Tamamlandı')).toHaveCount(0)
})

test('checklist session modal keeps footer usable on mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const requests = createRequestLog()
  await setupChecklistSessionPolicyPage(page, requests)
  await page.goto('/store/checklists')

  await page.getByRole('button', { name: 'Devam et' }).click()
  const dialog = page.getByRole('dialog')

  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Taslak kaydet' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'İptal' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Tamamla', exact: true })).toBeVisible()
  await expectPageNoHorizontalOverflow(page)
  await expectLocatorNoHorizontalOverflow(dialog)
})

function createRequestLog(): ChecklistRequestLog {
  return {
    completes: [],
    saves: [],
  }
}

async function setupChecklistSessionPolicyPage(page: Page, requests: ChecklistRequestLog) {
  await page.clock.setFixedTime(fixtureNow)
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'tr')
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        bearerToken: '',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        mockRoleCodes: 'REGION_MANAGER',
        mockUserId: 'checklist-session-policy-user',
        mode: 'mock',
      }),
    )
  })

  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: createAuthSessionFixture() })
  })
  await page.route('**/api/mobile/checklists/today**', async (route) => {
    await route.fulfill({ json: createMobileChecklistTodayFixture() })
  })
  await page.route('**/api/checklists/acknowledgements/list', async (route) => {
    await route.fulfill({ json: { items: [], meta: { count: 0, limit: 50, offset: 0, total: 0 } } })
  })
  await page.route('**/api/workflow/inbox', async (route) => {
    await route.fulfill({ json: { items: [], meta: { count: 0, limit: 30, offset: 0, total: 0 } } })
  })
  await page.route('**/api/mobile/checklists/instances/*/responses', async (route) => {
    const match = route.request().url().match(/instances\/([^/]+)\/responses/)
    requests.saves.push({
      checklistInstanceId: match?.[1] ?? '',
      body: await route.request().postDataJSON(),
    })
    await route.fulfill({
      json: {
        command: { message: 'Checklist response saved', status: 'saved' },
        data: {
          checklistResponse: {
            responded_at: '2026-05-20T12:05:00.000Z',
            response_id: '66666666-6666-4666-8666-666666666666',
          },
        },
      },
    })
  })
  await page.route('**/api/mobile/checklists/instances/*/complete', async (route) => {
    const match = route.request().url().match(/instances\/([^/]+)\/complete/)
    requests.completes.push({ checklistInstanceId: match?.[1] ?? '' })
    await route.fulfill({
      json: {
        command: { message: 'Checklist instance completed', status: 'completed' },
        data: {
          checklistInstance: {
            checklist_instance_id: match?.[1] ?? checklistInstanceId,
            completed_at: '2026-05-20T12:30:00.000Z',
            compliance_rate: '1.0000',
            locked_at: '2026-05-20T12:30:00.000Z',
            status: 'completed',
            total_score: '80.00',
          },
        },
      },
    })
  })
}

function createAuthSessionFixture() {
  return {
    authMode: 'mock',
    authenticated: true,
    scopeSummary: { assignedStoreCount: 1, companyCount: 1, regionCount: 1, storeCount: 1 },
    user: {
      actionScope: { assignedStoreIds: [storeId] },
      assignedStoreIds: [storeId],
      readScope: {
        companyIds: ['00000000-0000-0000-0000-000000000001'],
        regionIds: ['12121212-1212-4121-8121-121212121212'],
        storeIds: [storeId],
      },
      roleCodes: ['REGION_MANAGER'],
      scope: {
        companyIds: ['00000000-0000-0000-0000-000000000001'],
        regionIds: ['12121212-1212-4121-8121-121212121212'],
        storeIds: [storeId],
      },
      userId: 'checklist-session-policy-user',
    },
  }
}

function createMobileChecklistTodayFixture() {
  return {
    data: {
      activeInstances: [
        {
          checklistInstanceId,
          checklistTemplateId: templateId,
          responses: [],
          startedAt: '2026-05-20T12:00:00.000Z',
          status: 'in_progress',
          storeId,
          updatedAt: '2026-05-20T12:00:00.000Z',
        },
      ],
      completedThisMonth: [],
      monthlySummaries: [],
      pendingAcknowledgements: [],
      stores: [{ storeId, storeName: 'Marmara Park' }],
      templates: [
        {
          checklistTemplateId: templateId,
          items: [
            {
              itemNo: 1,
              itemText: 'Vitrin standartlara uygun',
              lowScoreThreshold: 2,
              maxScore: 5,
              minScore: 1,
              requiresLowScoreNote: true,
              responseType: 'score',
              sectionName: 'Görsel düzen',
              templateItemId,
              weight: 100,
            },
          ],
          templateCode: 'BM_VISIT_V1',
          templateName: 'BM Mağaza Ziyareti',
          templateType: 'BM_STORE_VISIT',
          versionNo: 1,
        },
      ],
    },
  }
}

async function expectPageNoHorizontalOverflow(page: Page) {
  await expect
    .poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1))
    .toBe(true)
}

async function expectLocatorNoHorizontalOverflow(locator: Locator) {
  await expect
    .poll(async () => locator.evaluate((element) => element.scrollWidth <= element.clientWidth + 1))
    .toBe(true)
}
