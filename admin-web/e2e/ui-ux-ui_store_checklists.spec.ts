import { expect, test, type Page } from './test-fixtures'
import { createStoreContractSession, installGenericStoreApiFallbacks, installStoreContractSession, regionId } from './store-page-contract-fixtures'

const storeId = '11111111-1111-4111-8111-111111111111'
const managerUserId = '10000000-0000-4000-8000-000000000001'
const checklistInstanceId = '20000000-0000-4000-8000-000000000001'
const activeInstanceId = '20000000-0000-4000-8000-000000000002'
const templateId = '30000000-0000-4000-8000-000000000001'
const itemId = '40000000-0000-4000-8000-000000000001'
const completedAt = '2026-09-21T10:00:00.000Z'
const storeName = 'Deneme Mağazası'

test('history retains its timeline and retries an independently failed result request at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  const state = await setupChecklistAudit(page, 'reportViewer')
  state.resultsStatus = 503
  await page.goto('/store/checklists')
  await page.getByRole('button', { name: 'Sonuçlar', exact: true }).click()

  const drawer = page.getByRole('dialog', { name: `${storeName} mağaza kaydı` })
  await expect(drawer.getByText('Denetim tamamlandı', { exact: true })).toBeVisible()
  await expect(drawer.getByRole('alert')).toContainText('Checklist sonuçları yüklenemedi.')
  await expect(drawer.getByRole('button', { name: 'Sonucu Gör', exact: true })).toHaveCount(0)
  await expectNoOverflow(page)

  state.resultsStatus = 200
  await drawer.getByRole('button', { name: 'Tekrar dene', exact: true }).click()
  await expect(drawer.getByRole('button', { name: 'Sonucu Gör', exact: true })).toBeVisible()
  await expect(drawer.getByLabel('Checklist puanı: 80 puan')).toBeVisible()
  await expect(drawer.getByRole('alert')).toHaveCount(0)
  expect(state.historyRequests).toBe(1)
})

test('history reports unavailable result access without offering a forbidden retry', async ({ page }) => {
  const state = await setupChecklistAudit(page, 'reportViewer')
  state.resultsStatus = 403
  await page.goto('/store/checklists')
  await page.getByRole('button', { name: 'Sonuçlar', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: `${storeName} mağaza kaydı` })
  await expect(drawer.getByRole('alert')).toContainText('Checklist sonuçlarına erişilemiyor.')
  await expect(drawer.getByRole('button', { name: 'Tekrar dene', exact: true })).toHaveCount(0)
  await expect(drawer.getByText('Denetim tamamlandı', { exact: true })).toBeVisible()
})

for (const persona of ['reportViewer', 'regionManager'] as const) {
  test(`${persona} returns focus to the store Results action after history-to-result close`, async ({ page }) => {
    await page.setViewportSize(persona === 'reportViewer' ? { width: 390, height: 844 } : { width: 1440, height: 900 })
    await setupChecklistAudit(page, persona)
    await page.goto('/store/checklists')
    const trigger = page.getByRole('button', { name: 'Sonuçlar', exact: true })
    await trigger.click()
    await page.getByRole('dialog', { name: `${storeName} mağaza kaydı` }).getByRole('button', { name: 'Sonucu Gör', exact: true }).click()

    const result = page.getByRole('dialog', { name: 'BM Denetimi', exact: true })
    await expect(result).toBeVisible()
    await result.getByRole('button', { name: 'Kapat', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page).not.toHaveURL(/overlay=/)
    await expect(trigger).toBeFocused()
  })
}

test('store manager preserves a result note during mobile resize and restores the direct opener on Escape', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await setupChecklistAudit(page, 'storeManager')
  await page.goto('/store/checklists')
  const trigger = page.getByRole('button', { name: 'İncele ve kabul et', exact: true })
  await trigger.click()

  const result = page.getByRole('dialog', { name: 'BM Denetimi', exact: true })
  const note = result.getByRole('textbox', { name: 'Kabul notu', exact: true })
  await note.fill('Mobil inceleme notu')
  await page.setViewportSize({ width: 320, height: 500 })
  await expect(note).toHaveValue('Mobil inceleme notu')
  await expectNoOverflow(page)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).not.toHaveURL(/overlay=/)
  await expect(trigger).toBeFocused()
})

test('region manager restores focus after a direct session and annual history close', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await setupChecklistAudit(page, 'regionManager')
  await page.goto('/store/checklists')
  const trigger = page.getByRole('button', { name: 'Devam et', exact: true })
  await trigger.click()
  const session = page.getByRole('dialog', { name: 'Checklist Oturumu', exact: true })
  await expect(session).toBeVisible()
  await session.getByRole('button', { name: 'Kapat', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Checklisti kapat', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).not.toHaveURL(/overlay=/)
  await expect(trigger).toBeFocused()

  const annualTrigger = page.getByRole('button', { name: 'Yıllık Ziyaretler', exact: true })
  await annualTrigger.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(annualTrigger).toBeFocused()
})

async function setupChecklistAudit(page: Page, persona: 'reportViewer' | 'regionManager' | 'storeManager') {
  const state = { historyRequests: 0, resultsStatus: 200 }
  await page.clock.setFixedTime(new Date('2026-09-22T12:00:00.000Z'))
  await page.addInitScript(() => window.localStorage.setItem('store-ops-app-locale', 'tr'))
  await installGenericStoreApiFallbacks(page)
  await installStoreContractSession(page, persona, { actionStoreIds: persona === 'reportViewer' ? [] : [storeId] })
  const session = createStoreContractSession(persona, { actionStoreIds: persona === 'reportViewer' ? [] : [storeId] })
  await page.route('**/api/auth/session', route => route.fulfill({ json: {
    ...session,
    user: { ...session.user,
      scope: { ...session.user.scope, storeIds: persona === 'storeManager' ? [storeId] : [] },
      readScope: { ...session.user.readScope, storeIds: persona === 'reportViewer' ? [] : [storeId] },
    },
  } }))

  await page.route('**/api/checklists/acknowledgements/list**', async (route) => {
    if (state.resultsStatus !== 200) {
      await route.fulfill({ status: state.resultsStatus, json: { message: 'Result request unavailable' } })
      return
    }
    await route.fulfill({ json: { items: [resultFixture()], meta: { count: 1, limit: 50, offset: 0, total: 1 } } })
  })
  await page.route('**/api/mobile/checklists/today**', async (route) => {
    await route.fulfill({ json: { data: {
      evidenceCapabilities: { captureAvailable: false, syntheticFixtureOnly: true, unavailableReason: 'Test fixture' },
      stores: [{ storeId, storeName }],
      templates: [{ checklistTemplateId: templateId, templateCode: 'BM_VISIT_V1', templateName: 'BM Denetimi', templateType: 'BM_STORE_VISIT', versionNo: 1, items: [{ templateItemId: itemId, itemNo: 1, itemText: 'Mağaza düzeni uygun mu?', sectionName: 'Mağaza', responseType: 'score', minScore: 1, maxScore: 5, weight: 100, lowScoreThreshold: 2, requiresLowScoreNote: true, evidencePolicy: 'none', maxEvidenceCount: 0 }] }],
      activeInstances: [{ checklistInstanceId: activeInstanceId, checklistTemplateId: templateId, storeId, status: 'in_progress', startedAt: completedAt, updatedAt: completedAt, responses: [], evidence: [], evidenceVersion: 0 }],
      completedThisMonth: [], monthlySummaries: [], pendingAcknowledgements: [],
    } } })
  })
  await page.route('**/api/checklists/command-canvas**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/operational-history')) {
      state.historyRequests += 1
      await route.fulfill({ json: { data: {
        store: { id: storeId, name: storeName, city: null, district: null },
        summary: { eventCount: 1, completedAuditCount: 1, completedVisitCount: 1, assignedTaskCount: 0, resolvedTaskCount: 0, openTaskCount: 0 },
        items: [{ id: 'audit-history-event', kind: 'checklist_completed', occurredAt: completedAt, title: 'Denetim tamamlandı', detail: null, actorSnapshot: { displayName: 'Deneme Yöneticisi', roleLabel: 'Bölge Müdürü', assignmentLabel: 'Deneme Bölgesi', identityStatus: 'captured' }, details: [] }],
        page: { nextCursor: null, hasMore: false },
      } } })
      return
    }
    if (url.pathname.endsWith('/visit-plans/regions')) {
      await route.fulfill({ json: { data: { items: [{ regionId, regionName: 'Deneme Bölgesi' }], page: { total: 1, limit: 20, offset: 0, hasMore: false } } } })
      return
    }
    if (url.pathname.endsWith('/visit-plans/period')) {
      await route.fulfill({ json: { data: { items: [], page: { total: 0, limit: 100, offset: 0, hasMore: false } } } })
      return
    }
    if (url.pathname.endsWith('/visit-plans')) {
      await route.fulfill({ json: { data: { planId: null, regionId, regionName: 'Deneme Bölgesi', weekStart: '2026-09-21', revision: 0, revisedAt: null, view: persona === 'regionManager' ? 'region_manager' : 'report_viewer', capabilities: { canMaintainWeeklyVisitPlan: persona === 'regionManager' }, items: [] } } })
      return
    }
    if (url.pathname.endsWith('/regions')) {
      const metrics = { totalStores: 1, missingVisitStores: 0, storesWithOpenActions: 0, openActionCount: 0, completedCoverageStores: 1, blockedActionCount: 0 }
      await route.fulfill({ json: { data: { period: '2026-09', view: 'report_viewer', capabilities: { weeklyVisitPlanningAvailable: false, canMaintainWeeklyVisitPlan: false }, metrics, items: [{ managerUserId, regionId, regionName: 'Deneme Bölgesi', regionManagers: [{ displayName: 'Deneme Yöneticisi' }], metrics, visitAverageScore: 80, scoreSampleCount: 1, lastOperationalAt: completedAt }], page: { total: 1, limit: 20, offset: 0, hasMore: false } } } })
      return
    }
    if (url.pathname === '/api/checklists/command-canvas') {
      await route.fulfill({ json: { data: {
        period: '2026-09', view: persona === 'regionManager' ? 'region_manager' : 'report_viewer', capabilities: { weeklyVisitPlanningAvailable: persona === 'regionManager', canMaintainWeeklyVisitPlan: persona === 'regionManager' },
        metrics: { totalStores: 1, needsVisit: 0, active: 1, pending: 0, completed: 0 },
        items: [{ storeId, storeCode: 'AUDIT-01', storeName, regionId, regionName: 'Deneme Bölgesi', regionManagers: [{ displayName: 'Deneme Yöneticisi' }], bmScore: 80, vmScore: null, bmCompletedAt: completedAt, vmCompletedAt: null, lastCompletedVisitAt: completedAt, elapsedDaysSinceLastVisit: 1, activeChecklistCount: 1, activeBmChecklistCount: 1, pendingAcknowledgementCount: 0, pendingBmAcknowledgementCount: 0, openActionCount: 0, blockedActionCount: 0, status: 'active', reasonCodes: ['active_checklist'], lastOperationalAt: completedAt }],
        page: { total: 1, limit: 30, offset: 0, hasMore: false },
      } } })
      return
    }
    await route.fallback()
  })
  return state
}

function resultFixture() {
  return {
    checklistInstanceId, checklistTemplateId: templateId, templateName: 'BM Denetimi', templateType: 'BM_STORE_VISIT', category: 'BM', storeId, storeName,
    completedByUserId: managerUserId, completedByDisplayName: 'Deneme Yöneticisi', completedAt, status: 'completed', totalScore: 80, complianceRate: 0.8, responses: [], acknowledgement: null,
  }
}

async function expectNoOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
}
