import { expect, test, type Page } from './test-fixtures'
import {
  installGenericStoreApiFallbacks,
  installStoreContractSession,
} from './store-page-contract-fixtures'
import { storeRouteContractExpectations } from './store-page-route-matrix'

for (const item of storeRouteContractExpectations) {
  test(`${item.path} has basic page health for ${item.persona}`, async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    await installStoreContractSession(page, item.persona)
    await installGenericStoreApiFallbacks(page)

    await page.goto(item.path)

    await waitForStorePageLoadingToSettle(page, item.id)
    await expect(page.getByText(item.visibleText).first()).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await expectNoInternalCopy(page)
    expect(pageErrors).toEqual([])
  })
}

async function waitForStorePageLoadingToSettle(page: Page, routeId: string) {
  if (routeId === 'targets') {
    await expect(page.locator('.target-command-state[role="status"]')).toHaveCount(0)
  }

  if (routeId === 'workforce') {
    await expect(page.getByTestId('store-workforce-loading')).toHaveCount(0)
  }
}

test('store personnel cannot open region-manager-only incentives route', async ({ page }) => {
  await installStoreContractSession(page, 'storePersonnel')
  await installGenericStoreApiFallbacks(page)

  await page.goto('/store/incentives')

  await expect(page.getByRole('heading', { name: /rota kullan|Route not available/i })).toBeVisible()
  await expect(page.getByText(/Prim Kontrol Sayfası|Bölge hakediş kontrolü/i)).toHaveCount(0)
})

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }))
  expect(overflow.body).toBeLessThanOrEqual(overflow.viewport + 4)
}

async function expectNoInternalCopy(page: Page) {
  const body = await page.locator('body').innerText()
  expect(body).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)
  expect(body).not.toMatch(/\b(API|DB|scope|mock|contract)\b/i)
  expect(body).not.toMatch(/gerçek veri|yetkili mağaza|kayıt temsil eder/i)
  expect(body).not.toMatch(/Ã|Ä|Å|Ë|Ð|Ý|þ|ð/)
}
