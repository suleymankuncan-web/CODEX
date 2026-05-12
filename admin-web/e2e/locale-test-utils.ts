import type { Page } from '@playwright/test'

export async function setStoredLocale(page: Page, locale: 'tr' | 'en') {
  await page.evaluate((nextLocale) => {
    window.localStorage.setItem('store-ops-app-locale', nextLocale)
  }, locale)
  await page.reload()
}
