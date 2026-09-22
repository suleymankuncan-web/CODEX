import { expect, test } from './test-fixtures'
import { createStoreContractSession, installStoreContractSession, storeIds } from './store-page-contract-fixtures'

test('visual campaigns hides technical load errors, retries in place, and localizes campaign status', async ({ page }) => {
  await installStoreContractSession(page, 'storeManager')
  let attempts = 0
  let allowRecovery = false

  await page.route('**/api/mobile/visual-campaigns?**', async (route) => {
    attempts += 1
    if (!allowRecovery) {
      await route.fulfill({
        status: 503,
        json: { message: 'GET /api/mobile/visual-campaigns failed; internal request id req-42' },
      })
      return
    }

    await route.fulfill({
      json: {
        items: [{
          assignmentId: '66666666-6666-4666-8666-666666666666',
          storeId: storeIds[0],
          storeName: 'Pilot Mağaza',
          referenceSetId: '77777777-7777-4777-8777-777777777777',
          referenceName: 'VM renk düzeni',
          deadlineStatus: 'open',
          reviewStatus: 'not_submitted',
          version: 1,
          startsAt: '2026-09-20T00:00:00.000Z',
          submissionClosesAt: '2026-09-30T20:59:59.000Z',
          items: [],
        }],
        total: 1,
        limit: 50,
        offset: 0,
      },
    })
  })

  await page.goto('/store/visual-campaigns')

  await expect(page.getByRole('alert')).toContainText('Veri alınamadı.')
  await expect(page.getByText(/internal request id|\/api\/mobile\/visual-campaigns/i)).toHaveCount(0)
  const failedAttempts = attempts
  allowRecovery = true
  await page.getByRole('button', { name: 'Yeniden dene' }).click()

  await expect(page.getByRole('heading', { name: 'VM renk düzeni' })).toBeVisible()
  await expect(page.getByRole('article').getByText('Açık', { exact: true })).toBeVisible()
  await expect(page.getByText('open', { exact: true })).toHaveCount(0)
  await expect.poll(() => attempts).toBeGreaterThan(failedAttempts)
})

test('visual campaign publisher keeps the prepared draft open when publish fails', async ({ page }) => {
  await installStoreContractSession(page, 'visualMerchandiser')
  const session = createStoreContractSession('visualMerchandiser')
  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', route => route.fulfill({ json: {
    ...session,
    user: {
      ...session.user,
      permissionScopes: { VM_REFERENCE_PUBLISHER: { companyIds: session.user.scope.companyIds } },
    },
  } }))

  await page.route('**/api/visual-merchandising/references**', async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (request.method() === 'GET' && pathname.endsWith('/references/options')) {
      await route.fulfill({ json: {
        stores: [{ storeId: storeIds[0], storeName: 'Pilot Mağaza' }],
        templates: [{
          templateId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          templateName: 'VM denetimi',
          items: [{
            templateItemId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            sectionName: 'Vitrin',
            itemNo: 1,
            itemText: 'Renk geçişi',
          }],
        }],
      } })
      return
    }
    if (request.method() === 'GET' && pathname.endsWith('/references')) {
      await route.fulfill({ json: {
        items: [{
          referenceSetId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          companyId: session.user.scope.companyIds[0],
          referenceCode: 'VM-RENK',
          referenceName: 'VM renk düzeni',
          instructions: 'Renk sırasını koruyun.',
          status: 'draft',
          version: 1,
          createdAt: '2026-09-20T00:00:00.000Z',
          updatedAt: '2026-09-20T00:00:00.000Z',
          retiredAt: null,
        }],
        total: 1,
        limit: 50,
        offset: 0,
      } })
      return
    }
    if (request.method() === 'POST' && pathname.includes('/draft/items/')) {
      await route.fulfill({ status: 500, json: { message: 'publish failed' } })
      return
    }
    await route.fulfill({ status: 404, json: { message: 'unexpected request' } })
  })

  await page.goto('/store/visual-campaigns')
  await page.getByRole('button', { name: 'Hazırla ve yayınla' }).click()
  const workbench = page.getByRole('region', { name: 'VM renk düzeni yayın hazırlığı' })
  await workbench.locator('[data-slot="select-trigger"]').click()
  await page.getByRole('option', { name: 'VM denetimi' }).click()
  await workbench.getByText('1. Renk geçişi', { exact: true }).click()
  await workbench.getByLabel('Renk geçişi referans görseli').setInputFiles({
    name: 'referans.png',
    mimeType: 'image/png',
    buffer: Buffer.from('reference-image'),
  })
  await workbench.getByText('Pilot Mağaza', { exact: true }).click()
  await workbench.getByLabel('Başlangıç').fill('2026-09-23')
  await workbench.getByLabel('Bitiş').fill('2026-09-30')
  await workbench.getByLabel('Yayın notu').fill('Eylül vitrin uygulaması')
  await workbench.getByRole('button', { name: 'Referansı yayınla' }).click()

  await expect(page.locator('.hr-axis-toast__title')).toHaveText('publish failed')
  await expect(workbench).toBeVisible()
  await expect(workbench.getByLabel('Yayın notu')).toHaveValue('Eylül vitrin uygulaması')
})
