import { expect, test } from './test-fixtures'
import {
  installGenericStoreApiFallbacks,
  installStoreContractSession,
} from './store-page-contract-fixtures'

for (const width of [320, 390]) {
  test(`Tasks drawer wraps long task text at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 })
    await installStoreContractSession(page, 'storeManager')
    await installGenericStoreApiFallbacks(page)
    const title = 'Kontrol-' + 'A'.repeat(120)
    const note = 'Referans-' + 'B'.repeat(400)
    const auditNote = 'Açıklama-' + 'C'.repeat(400)
    const events = [{
      eventId: 'event-long-note',
      eventType: 'store_action_plan.closed',
      occurredAt: '2026-09-20T12:00:00.000Z',
      actorDisplayName: 'Mağaza Müdürü',
      actorRoleLabel: null,
      note: auditNote,
    }]
    await page.route('**/api/store/tasks/*/events**', route => route.fulfill({ json: {
      data: { items: events, total: 1, limit: 20, offset: 0, hasMore: false },
    } }))
    await page.route('**/api/store/tasks/workspace**', route => route.fulfill({ json: {
      data: {
        view: 'store_manager',
        capabilities: { canStart: true, canUpdate: true, canComplete: true, canCancel: true, canReview: false },
        items: [{
          actionPlanId: 'task-long-text',
          storeId: 'store-long-text',
          storeName: 'Deneme Mağazası',
          title,
          summary: 'Tamamlanan görev.',
          priority: 'medium',
          status: 'closed',
          dueOn: '2026-09-20',
          createdAt: '2026-09-18T12:00:00.000Z',
          updatedAt: '2026-09-20T12:00:00.000Z',
          completedAt: '2026-09-20T12:00:00.000Z',
          resultNote: note,
          resolutionWorkflowVersion: 1,
          photoEvidenceVersion: 0,
          currentSolutionAttemptId: null,
          source: { type: 'checklist_remediation', id: 'source-long-text', deepLink: '/store/checklists' },
          events: { items: events, total: 1, limit: 20, hasMore: false },
        }],
        summary: { retained: 1, actionable: 0, completed: 1, cancelled: 0, checklist: 1 },
        page: { total: 1, limit: 20, offset: 0, count: 1, hasMore: false },
      },
    } }))

    await page.goto('/store/tasks')
    await page.getByTestId('store-action-plan-row').click()
    const drawer = page.getByRole('dialog', { name: 'Görev detayı' })
    await expect(drawer.getByRole('heading', { name: title })).toBeVisible()
    await expect(drawer.getByText(note, { exact: true })).toBeVisible()
    await expect(drawer.getByText(auditNote, { exact: true })).toBeVisible()
    for (const region of [drawer, drawer.locator('.tasks-command-drawer-body')]) {
      expect(await region.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    }
    await page.screenshot({ path: testInfo.outputPath(`tasks-${width}.png`) })
  })
}
