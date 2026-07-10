import type { Locator, Page } from './test-fixtures'

const documentStartSentinel = 'document-start-keyboard-sentinel'

export async function pressTabFromDocumentStart(page: Page, firstTabStop: Locator) {
  await firstTabStop.waitFor({ state: 'attached' })

  await page.evaluate((sentinelId) => {
    document.getElementById(sentinelId)?.remove()
    const sentinel = document.createElement('span')
    sentinel.id = sentinelId
    sentinel.tabIndex = 0
    sentinel.style.position = 'fixed'
    sentinel.style.width = '1px'
    sentinel.style.height = '1px'
    sentinel.style.clipPath = 'inset(50%)'
    document.body.prepend(sentinel)
  }, documentStartSentinel)

  const sentinel = page.locator(`#${documentStartSentinel}`)
  await sentinel.focus()
  await page.keyboard.press('Tab')
  await sentinel.evaluate((element) => element.remove())
}
