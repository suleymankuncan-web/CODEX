import AxeBuilder from '@axe-core/playwright'
import { expect, test } from './test-fixtures'
import { installGenericStoreApiFallbacks, installStoreContractSession, regionId, storeIds } from './store-page-contract-fixtures'
import { storeFeedFixture } from './store-surfaces-profile-fixtures'

const pinnedBody = 'Haftalık mağaza duyurusu yayınlandı.'
const todayBody = 'İZMİR mağazaları için vitrin kontrolü bugün tamamlanacak.'
const posts = [
  { ...storeFeedFixture.items[0], feedPostId: 'feed-azure-pinned', title: 'Haftalık mağaza duyurusu', body: pinnedBody, visibilityScopeType: 'region', visibilityScopeIds: [regionId] },
  { ...storeFeedFixture.items[0], feedPostId: 'feed-azure-today', title: 'İZMİR vitrin kontrolü', body: todayBody, isPinned: false, visibilityScopeType: 'region', visibilityScopeIds: [regionId], publishedAt: '2026-09-12T08:00:00.000Z', createdAt: '2026-09-12T08:00:00.000Z', updatedAt: '2026-09-12T08:00:00.000Z' },
]

for (const persona of ['regionManager', 'storeManager', 'reportViewer'] as const) {
  for (const width of [1440, 320]) {
    test(`Azure announcements ${persona} renders and filters accessibly at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      await page.clock.setFixedTime(new Date('2026-09-12T12:00:00.000Z'))
      await installStoreContractSession(page, persona, persona === 'regionManager' ? { actionStoreIds: [storeIds[0]] } : undefined)
      await installGenericStoreApiFallbacks(page)
      const visiblePosts = persona === 'regionManager'
        ? [{ ...posts[0], visibilityScopeType: 'store', visibilityScopeIds: [storeIds[0]] }, posts[1]]
        : posts
      await page.route('**/api/feed?**', route => route.fulfill({ json: { items: visiblePosts, meta: { count: visiblePosts.length, total: visiblePosts.length, limit: 50, offset: 0 } } }))
      await page.goto('/store/feed')
      const surface = page.locator('.store-feed-azure')
      const rows = surface.getByTestId('store-feed-post-row')
      await expect(surface.getByRole('heading', { name: 'Duyurular', level: 1 })).toBeVisible()
      await expect(rows).toHaveCount(2)
      await expect(rows.first()).toContainText(pinnedBody)
      await expect(rows.last()).toContainText(todayBody)
      await expect(surface.locator('table')).toBeVisible()
      await expect(surface.getByRole('columnheader', { name: 'Duyuru', exact: true })).toHaveCount(1)

      const composer = surface.getByRole('textbox', { name: 'Duyuru içeriği' })
      const publish = surface.getByRole('button', { name: 'Paylaş', exact: true })
      const options = surface.getByRole('button', { name: 'Gönderi seçenekleri' })
      if (persona === 'regionManager') {
        await expect(composer).toBeVisible()
        await expect(publish).toBeDisabled()
        await composer.fill('Mağaza ekibine yeni duyuru.')
        await expect(publish).toBeEnabled()
        await expect(options).toHaveCount(1)
        await options.first().focus()
        await page.keyboard.press('Enter')
        await expect(page.getByRole('menuitem', { name: 'Düzenle', exact: true })).toBeVisible()
        await expect(page.getByRole('menuitem', { name: 'Yayından kaldır', exact: true })).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(options.first()).toBeFocused()
        await expect(page.getByRole('menu')).toHaveCount(0)
        await composer.fill('')
        await options.first().click()
        await page.getByRole('menuitem', { name: 'Düzenle', exact: true }).click()
        const editor = surface.getByRole('textbox', { name: 'Gönderi metnini düzenle' })
        await expect(editor).toHaveValue(pinnedBody)
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
        await editor.fill('')
        await expect(surface.getByRole('button', { name: 'Kaydet', exact: true })).toBeDisabled()
        await surface.getByRole('button', { name: 'Vazgeç', exact: true }).click()
        await expect(editor).toHaveCount(0)
      } else {
        await expect(composer).toHaveCount(0)
        await expect(publish).toHaveCount(0)
        await expect(options).toHaveCount(0)
      }

      const bounds = await surface.boundingBox()
      expect(bounds).not.toBeNull()
      expect(bounds!.x).toBeGreaterThanOrEqual(0)
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1)
      const overflow = await page.evaluate(() => [...document.querySelectorAll('*')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).map(el => ({ tag: el.tagName, cls: el.getAttribute('class'), slot: el.getAttribute('data-slot'), width: el.getBoundingClientRect().width, left: el.getBoundingClientRect().left })).slice(-20))
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), JSON.stringify(overflow)).toBeLessThanOrEqual(1)
      expect(await surface.locator('[data-slot="table-container"]').evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
      for (const control of await surface.locator('input, textarea, button').all()) {
        if (!await control.isVisible()) continue
        const controlBounds = await control.boundingBox()
        expect(controlBounds!.x).toBeGreaterThanOrEqual(0)
        expect(controlBounds!.x + controlBounds!.width).toBeLessThanOrEqual(width + 1)
      }
      const accessibility = await new AxeBuilder({ page }).include('.store-feed-azure').withTags(['wcag2a', 'wcag2aa']).analyze()
      expect(accessibility.violations).toEqual([])
      await page.screenshot({ path: testInfo.outputPath(`store-feed-${persona}-${width}.png`), fullPage: true })

      const search = surface.getByRole('textbox', { name: 'Duyurularda ara' })
      await search.fill('izmir')
      await expect(rows).toHaveCount(1)
      await expect(rows.first()).toContainText(todayBody)
      await search.fill('')
      const filters = surface.getByRole('group', { name: 'Duyuru filtresi' })
      await filters.getByRole('radio', { name: 'Sabit', exact: true }).click()
      await expect(rows).toHaveCount(1)
      await expect(rows.first()).toContainText(pinnedBody)
      await filters.getByRole('radio', { name: 'Bugün', exact: true }).click()
      await expect(rows).toHaveCount(1)
      await expect(rows.first()).toContainText(todayBody)
      await search.fill('eşleşmeyen-duyuru')
      await expect(rows).toHaveCount(0)
      await expect(surface.getByText('Eşleşen duyuru bulunamadı', { exact: true })).toBeVisible()
      await surface.getByRole('button', { name: 'Filtreleri temizle' }).click()
      await expect(rows).toHaveCount(2)
    })
  }
}
