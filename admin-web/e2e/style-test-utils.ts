import type { Page } from '@playwright/test'

export type ComputedStyleSnapshot = {
  backgroundColor: string
  backgroundImage: string
  borderColor: string
  boxShadow: string
  color: string
  minHeight: string
}

export async function readComputedStyle(
  page: Page,
  selector: string,
): Promise<ComputedStyleSnapshot> {
  return page.locator(selector).first().evaluate((element) => {
    const computed = getComputedStyle(element)

    return {
      backgroundColor: computed.backgroundColor,
      backgroundImage: computed.backgroundImage,
      borderColor: computed.borderColor,
      boxShadow: computed.boxShadow,
      color: computed.color,
      minHeight: computed.minHeight,
    }
  })
}
