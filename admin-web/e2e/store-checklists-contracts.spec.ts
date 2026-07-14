import { expect, test, type Page } from './test-fixtures'
import { installStoreContractSession, storeIds } from './store-page-contract-fixtures'

test('BM and VM checklist type filters keep assigned store population visible', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await routeChecklistContractApi(page)

  await page.goto('/store/checklists?view=workflow')

  await expect(page.locator('.store-checklists-visit-row')).toHaveCount(3)

  await page.getByRole('combobox', { name: 'Şablon tipi' }).click()
  await page.getByRole('option', { name: 'BM checklist' }).click()
  await expect(page.locator('.store-checklists-visit-row')).toHaveCount(3)

  await page.getByRole('combobox', { name: 'Şablon tipi' }).click()
  await page.getByRole('option', { name: 'VM checklist' }).click()
  await expect(page.locator('.store-checklists-visit-row')).toHaveCount(3)
})

async function routeChecklistContractApi(page: Page) {
  await page.route('**/api/mobile/checklists/today', async (route) => {
    await route.fulfill({ json: createChecklistTodayFixture() })
  })
  await page.route('**/api/checklists/acknowledgements/list**', async (route) => {
    await route.fulfill({ json: { items: [], meta: { count: 0, limit: 50, offset: 0, total: 0 } } })
  })
  await page.route('**/api/workflow/inbox**', async (route) => {
    await route.fulfill({ json: { items: [], meta: { count: 0, limit: 30, offset: 0, total: 0 } } })
  })
}

function createChecklistTodayFixture() {
  return {
    data: {
      activeInstances: [],
      completedThisMonth: [],
      monthlySummaries: [
        {
          averageScore: 82,
          checklistTemplateId: 'template-contract-vm',
          completedCount: 1,
          monthStart: '2026-07-01',
          storeId: storeIds[0],
        },
      ],
      pendingAcknowledgements: [],
      stores: storeIds.map((storeId, index) => ({
        city: ['Balıkesir', 'Bursa', 'İstanbul'][index],
        storeId,
        storeName: ['Balıkesir 10 Burda AVM', 'Bursa Downtown AVM', 'İstanbul MOI AVM'][index],
      })),
      templates: [
        {
          checklistTemplateId: 'template-contract-bm',
          items: [],
          templateCode: 'BM_STORE_VISIT_2026',
          templateName: 'BM Mağaza Ziyareti',
          templateType: 'BM_STORE_VISIT',
          versionNo: 1,
        },
        {
          checklistTemplateId: 'template-contract-vm',
          items: [],
          templateCode: 'VM_STORE_VISIT_2026',
          templateName: 'VM Mağaza Ziyareti',
          templateType: 'VM_STORE_VISIT',
          versionNo: 1,
        },
      ],
    },
  }
}
