import { expect, test, type Page } from './test-fixtures'
import { installStoreContractSession, storeIds } from './store-page-contract-fixtures'
import { expectNoCriticalAxeViolations } from './axe-test-utils'

const comparisonRunId = '55555555-5555-4555-8555-555555555555'

test('Region Manager advisory workspace stays scoped, mobile-safe and removes invalid accept action', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installStoreContractSession(page, 'regionManager', { actionStoreIds: [storeIds[0]] })
  let reviewBody: Record<string, unknown> | null = null
  await routeAdvisoryApi(page, (body) => { reviewBody = body })

  await page.goto('/store/visual-campaigns')

  await expect(page.getByRole('heading', { name: 'Görsel denetim önerileri' })).toBeVisible()
  await expect(page.getByText('Bu öneri mağaza sonucunu veya puanını otomatik değiştirmez.')).toBeVisible()
  await page.getByRole('button', { name: /Manuel karar.*0/ }).click()
  await expect(page.getByText('Bu filtreyle eşleşen öneri yok.')).toBeVisible()
  await page.getByRole('button', { name: 'Filtreyi temizle' }).click()
  await page.getByRole('button', { name: /Pilot Mağaza.*VM renk düzeni/ }).click()
  await expect(page.getByRole('heading', { name: 'Pilot Mağaza' })).toBeVisible()
  await page.getByRole('button', { name: 'Karar ver' }).click()

  await expect(page.getByRole('dialog', { name: 'Bölge değerlendirmesi' })).toBeVisible()
  await expect(page.getByRole('combobox')).toContainText('Yeni fotoğraf iste')
  await page.getByRole('combobox').click()
  await expect(page.getByRole('option', { name: 'Öneriyi kabul et' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.getByLabel('Değerlendirme notu').fill('Görsel açı nedeniyle yeni çekim gerekli.')
  await page.getByRole('button', { name: 'Kararı kaydet' }).click()

  await expect.poll(() => reviewBody).toEqual({
    decision: 'recapture',
    reason: 'Görsel açı nedeniyle yeni çekim gerekli.',
  })
  const overflow = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }))
  expect(overflow.body).toBeLessThanOrEqual(overflow.viewport + 4)
})

test('Region Manager advisory workspace is accessible, responsive and restores focus', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager', { actionStoreIds: [storeIds[0]] })
  await routeAdvisoryApi(page, () => undefined)
  for (const viewport of [
    { width: 1440, height: 900 }, { width: 1024, height: 768 },
    { width: 390, height: 844 }, { width: 320, height: 700 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/store/visual-campaigns')
    await expectNoCriticalAxeViolations(page)
    const row = page.getByRole('button', { name: /Pilot Mağaza.*VM renk düzeni/ })
    await row.focus()
    await row.click()
    await expect(page.getByRole('heading', { name: 'Pilot Mağaza' })).toBeVisible()
    await expectNoCriticalAxeViolations(page)
    const reviewTrigger = page.getByRole('button', { name: 'Karar ver' })
    await reviewTrigger.click()
    await expect(page.getByRole('dialog', { name: 'Bölge değerlendirmesi' })).toBeVisible()
    await expectNoCriticalAxeViolations(page)
    await page.getByRole('button', { name: 'Vazgeç' }).click()
    await expect(reviewTrigger).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(row).toBeFocused()
    const overflow = await page.evaluate(() => document.body.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(4)
  }
})

test('Region Manager without current action-store scope cannot open the advisory workspace', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager', { actionStoreIds: [] })
  await page.goto('/store/visual-campaigns')
  await expect(page.getByRole('heading', { name: /Bu rol için rota kullanılamaz|Route not available/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Görsel denetim önerileri' })).toHaveCount(0)
})

test('Store Manager real VM evidence requires an explicit content attestation', async ({ page }) => {
  await installStoreContractSession(page, 'storeManager')
  await page.route('**/api/mobile/visual-campaigns**', async (route) => {
    await route.fulfill({ json: { items: [campaignAssignment()], total: 1, limit: 50, offset: 0 } })
  })

  await page.goto('/store/visual-campaigns')

  const submit = page.getByRole('button', { name: 'Kanıtları gönder' })
  await expect(submit).toBeDisabled()
  await page.getByLabel('Renk geçişi için galeriden seç').setInputFiles({
    name: 'reyon.png', mimeType: 'image/png', buffer: onePixelPng(),
  })
  await expect(submit).toBeDisabled()
  await page.getByText(/Görsellerin yalnız reyon ve ürün içerdiğini/).click()
  await expect(submit).toBeEnabled()
})

test('Report Viewer cannot open Region Manager advisory detail', async ({ page }) => {
  await installStoreContractSession(page, 'reportViewer')
  await page.goto('/store/visual-campaigns')
  await expect(page.getByRole('heading', { name: /Bu rol için rota kullanılamaz|Route not available/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Görsel denetim önerileri' })).toHaveCount(0)
})

async function routeAdvisoryApi(
  page: Page,
  onReview: (body: Record<string, unknown>) => void,
) {
  await page.route('**/api/visual-comparisons/advisories**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (request.method() === 'POST' && url.pathname.endsWith('/reviews')) {
      onReview(request.postDataJSON() as Record<string, unknown>)
      await route.fulfill({ json: {
        comparisonRunId, decision: 'recapture', finalDecision: null,
      } })
      return
    }
    if (url.pathname.includes('/media/')) {
      await route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng() })
      return
    }
    if (url.pathname.endsWith(`/${comparisonRunId}`)) {
      await route.fulfill({ json: advisory({ detail: true }) })
      return
    }
    await route.fulfill({ json: { items: [advisory({ detail: false })], total: 1, limit: 100, offset: 0 } })
  })
}

function advisory(input: { detail: boolean }) {
  return {
    comparisonRunId,
    storeName: 'Pilot Mağaza',
    referenceName: 'VM renk düzeni',
    status: 'completed',
    suggestion: 'partial',
    confidence: 0.45,
    acceptAllowed: false,
    qualityFlags: ['camera_angle'],
    modelLimitations: ['rear_rack_occluded'],
    dimensions: [{ key: 'color_palette_sequence', score: 72, confidence: 0.7,
      reasonCode: 'minor_variance', explanation: 'Renk geçişinde küçük bir sapma var.' }],
    finishedAt: '2026-07-30T10:00:00.000Z',
    reviewed: false,
    ...(input.detail ? {
      criterion: 'Renk geçişini ve ürün hizasını inceleyin.',
      reviewInstructions: 'Referansla mağaza görünümünü karşılaştırın.',
      review: null,
    } : {}),
  }
}

function campaignAssignment() {
  return {
    assignmentId: '66666666-6666-4666-8666-666666666666',
    storeId: storeIds[0], storeName: 'Pilot Mağaza',
    referenceSetId: '77777777-7777-4777-8777-777777777777',
    referenceName: 'VM renk düzeni', deadlineStatus: 'open', reviewStatus: 'not_submitted',
    version: 1, startsAt: '2026-07-30T00:00:00.000Z', submissionClosesAt: '2026-08-05T20:59:59.000Z',
    items: [{
      referenceItemId: '88888888-8888-4888-8888-888888888888',
      templateItemId: '99999999-9999-4999-8999-999999999999',
      expectedVisualIntent: 'Renk geçişi', reviewInstructions: 'Soldan sağa açık tondan koyu tona ilerleyin.',
      requiredEvidenceCount: 1,
      referenceAssetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    }],
  }
}

function onePixelPng() {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  )
}
