import { expect, test, type Locator, type Page } from './test-fixtures'
import { expectNoCriticalAxeViolations } from './axe-test-utils'

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
  await page.goto(`/store/checklists?overlay=workflow&storeId=${storeId}&workflowTab=visits`)

  await page.getByRole('button', { name: 'Devam et' }).click()
  const dialog = page.getByRole('dialog')

  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('BM Mağaza Ziyareti')).toBeVisible()
  await expect(dialog.getByText('Madde 1/1 - Görsel Sunum')).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Vitrin konsepti VM standardına uygun mu?' })).toBeVisible()
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
  await dialog.getByRole('button', { name: 'Notu kaydet' }).click()
  await expect.poll(() => requests.saves.some((request) =>
    request.body.commentText === 'Eksik raf düzeni mağaza aksiyonuna düşmeli',
  )).toBe(true)
  await expect(dialog.getByText('Taslağa kaydedildi')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Tamamla', exact: true })).toBeEnabled()

  page.once('dialog', (confirm) => confirm.accept())
  await dialog.getByRole('button', { name: 'Tamamla', exact: true }).click()

  await expect.poll(() => requests.completes).toEqual([{ checklistInstanceId }])
})

test('draft close returns to the workflow while keeping the visit in progress', async ({ page }) => {
  const requests = createRequestLog()
  await setupChecklistSessionPolicyPage(page, requests)
  await page.goto(`/store/checklists?overlay=workflow&storeId=${storeId}&workflowTab=visits`)

  const workflowDialog = page.getByRole('dialog', { name: 'Checklist akışı' })
  await expect(workflowDialog.getByRole('heading', { name: 'Marmara Park' })).toBeVisible()
  await workflowDialog.getByRole('button', { name: 'Devam et' }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByRole('radio', { name: '4', exact: true }).click()
  await expect(dialog.getByText('Bu puanda mağazaya görev oluşacaktır.')).toHaveCount(0)
  await expect.poll(() => requests.saves.length).toBeGreaterThanOrEqual(1)

  await dialog.getByRole('button', { name: 'Taslak kaydet' }).click()

  const closeConfirmation = page.getByRole('alertdialog', { name: 'Checklist kapatılsın mı?' })
  await expect(closeConfirmation).toBeVisible()
  await closeConfirmation.getByRole('button', { name: 'Checklisti kapat' }).click()

  await expect(page.getByRole('dialog', { name: 'Checklist akışı' })).toBeVisible()
  await expect.poll(() => requests.completes).toEqual([])
  await expect.poll(() => requests.saves.length).toBeGreaterThanOrEqual(1)
  await expect(workflowDialog.getByRole('button', { name: 'Devam et' })).toBeVisible()
  await expect(page.getByText('Başarıyla Tamamlandı')).toHaveCount(0)
})

test('checklist session modal keeps footer usable on mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const requests = createRequestLog()
  await setupChecklistSessionPolicyPage(page, requests)
  await page.goto(`/store/checklists?overlay=workflow&storeId=${storeId}&workflowTab=visits`)

  await page.getByRole('button', { name: 'Devam et' }).click()
  const dialog = page.getByRole('dialog')

  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Taslak kaydet' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'İptal' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Tamamla', exact: true })).toBeVisible()
  await expectFooterActionsFillMobileWidth(dialog)
  await expectPageNoHorizontalOverflow(page)
  await expectLocatorNoHorizontalOverflow(dialog)
})

test('checklist session stays contained and question numbers align at compact desktop width', async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 900 })
  const requests = createRequestLog()
  await setupChecklistSessionPolicyPage(page, requests)
  await page.goto(`/store/checklists?overlay=workflow&storeId=${storeId}&workflowTab=visits`)

  await page.getByRole('button', { name: 'Devam et' }).click()
  const dialog = page.getByRole('dialog')

  await expect(dialog).toBeVisible()
  await expectPageNoHorizontalOverflow(page)
  await expectLocatorNoHorizontalOverflow(dialog)
  await expectQuestionNumberAligned(dialog)
})

test('photo evidence entry stays hidden and the session remains accessible at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  const requests = createRequestLog()
  await setupChecklistSessionPolicyPage(page, requests)
  await page.goto(`/store/checklists?overlay=workflow&storeId=${storeId}&workflowTab=visits`)
  await page.getByRole('button', { name: 'Devam et' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('radio', { name: '4', exact: true }).click()
  await expect(dialog.getByText('Fotoğraf ekle', { exact: true })).toHaveCount(0)
  await expect(dialog.locator('section[aria-label="Fotoğraf kanıtı"]')).toHaveCount(0)
  await expectPageNoHorizontalOverflow(page)
  await expectLocatorNoHorizontalOverflow(dialog)
  await expectNoCriticalAxeViolations(page)
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
  await routeChecklistCommandShell(page)
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
  let evidenceVersion = 0
  let linked = false
  await page.route('**/api/mobile/checklists/instances/*/items/*/evidence**', async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (pathname.endsWith('/uploads') && request.method() === 'POST') {
      await route.fulfill({ json: { mediaAssetId: '77777777-7777-4777-8777-777777777777', state: 'uploaded' } })
      return
    }
    if (pathname.endsWith('/finalize') && request.method() === 'POST') {
      await route.fulfill({ json: { mediaAssetId: '77777777-7777-4777-8777-777777777777', state: 'ready', rawDisposal: 'verified' } })
      return
    }
    if (pathname.endsWith('/content/thumbnail') && request.method() === 'GET') {
      await route.fulfill({
        body: Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v89WAAAAA==', 'base64'),
        contentType: 'image/webp',
      })
      return
    }
    if (request.method() === 'POST') {
      linked = true
      evidenceVersion += 1
    } else if (request.method() === 'DELETE') {
      linked = false
      evidenceVersion += 1
    }
    await route.fulfill({
      json: {
        command: { message: linked ? 'linked' : 'unlinked', status: linked ? 'linked' : 'unlinked' },
        data: {
          evidence: {
            checklistInstanceId,
            templateItemId,
            evidenceVersion,
            evidencePolicy: 'optional',
            maxEvidenceCount: 2,
            idempotent: false,
            evidence: linked ? [{
              mediaAssetId: '77777777-7777-4777-8777-777777777777',
              displayOrder: 0,
              captureSource: 'system_generated',
              thumbnailAvailable: true,
            }] : [],
          },
        },
      },
    })
  })
}

async function routeChecklistCommandShell(page: Page) {
  const regionId = '12121212-1212-4121-8121-121212121212'
  await page.route('**/api/checklists/command-canvas**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/visit-plans/regions')) {
      await route.fulfill({ json: { data: { view: 'region_manager', capabilities: { canMaintainWeeklyVisitPlan: true }, items: [{ regionId, regionName: 'Marmara' }], page: { total: 1, limit: 20, offset: 0, hasMore: false } } } })
      return
    }
    if (url.pathname === '/api/checklists/command-canvas') {
      await route.fulfill({ json: { data: { period: '2026-05', view: 'region_manager', capabilities: { weeklyVisitPlanningAvailable: true, canMaintainWeeklyVisitPlan: true }, metrics: { totalStores: 1, needsVisit: 0, active: 1, pending: 0, completed: 0 }, items: [{ storeId, storeCode: 'MP-01', storeName: 'Marmara Park', regionId, regionName: 'Marmara', regionManagers: [{ displayName: 'Pilot Bölge Müdürü' }], bmScore: null, vmScore: null, bmCompletedAt: null, vmCompletedAt: null, lastCompletedVisitAt: null, elapsedDaysSinceLastVisit: null, activeChecklistCount: 1, pendingAcknowledgementCount: 0, openActionCount: 0, blockedActionCount: 0, status: 'active', reasonCodes: ['active_checklist'], lastOperationalAt: fixtureNow.toISOString() }], page: { total: 1, limit: 30, offset: 0, hasMore: false } } } })
      return
    }
    await route.fallback()
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
      evidenceCapabilities: {
        captureAvailable: true,
        syntheticFixtureOnly: true,
        unavailableReason: null,
      },
      activeInstances: [
        {
          checklistInstanceId,
          checklistTemplateId: templateId,
          responses: [],
          evidenceVersion: 0,
          evidence: [],
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
              itemText: 'Vitrin konsepti VM standardina uygun mu?',
              lowScoreThreshold: 2,
              maxScore: 5,
              minScore: 1,
              requiresLowScoreNote: true,
              responseType: 'score',
              sectionName: 'Gorsel Sunum',
              templateItemId,
              weight: 100,
              evidencePolicy: 'optional',
              maxEvidenceCount: 2,
            },
          ],
          templateCode: 'BM_VISIT_V1',
          templateName: 'BM Magaza Ziyareti',
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

async function expectQuestionNumberAligned(dialog: Locator) {
  const questionCopy = dialog.locator('.store-checklist-session-question-copy').first()
  await expect
    .poll(async () =>
      questionCopy.evaluate((element) => {
        const index = element.querySelector('.store-checklist-session-question-index')
        const heading = element.querySelector('h3')
        if (!(index instanceof HTMLElement) || !(heading instanceof HTMLElement)) return false

        const containerRect = element.getBoundingClientRect()
        const indexRect = index.getBoundingClientRect()
        const headingRect = heading.getBoundingClientRect()

        return (
          getComputedStyle(element).alignItems === 'baseline' &&
          indexRect.right < headingRect.left &&
          headingRect.right <= containerRect.right + 1 &&
          element.scrollWidth <= element.clientWidth + 1
        )
      }),
    )
    .toBe(true)
}

async function expectFooterActionsFillMobileWidth(dialog: Locator) {
  const footerActions = dialog.locator('.store-checklist-session-footer-actions')
  await expect
    .poll(async () =>
      footerActions.evaluate((element) => {
        const buttons = Array.from(element.querySelectorAll('button'))
        if (buttons.length < 3) return false
        const containerRect = element.getBoundingClientRect()
        const draftRect = buttons[0]!.getBoundingClientRect()
        const cancelRect = buttons[1]!.getBoundingClientRect()
        const completeRect = buttons[2]!.getBoundingClientRect()
        const threshold = 1

        return (
          Math.abs(draftRect.left - containerRect.left) <= threshold &&
          Math.abs(draftRect.right - containerRect.right) <= threshold &&
          Math.abs(cancelRect.left - containerRect.left) <= threshold &&
          Math.abs(completeRect.right - containerRect.right) <= threshold
        )
      }),
    )
    .toBe(true)
}
