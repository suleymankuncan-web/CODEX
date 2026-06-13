import { expect, type Locator } from './test-fixtures'

export async function expectChecklistResultModalVisualContract(dialog: Locator) {
  await expect(dialog.getByText('Kontrol listesi sonucu', { exact: true })).toBeVisible()
  await expect(dialog.getByText('Sonuç özeti')).toHaveCount(0)
  await expect(dialog.getByText('Dikkat isteyen maddeler')).toHaveCount(0)

  const legend = dialog.getByLabel('Renk anlamı')
  for (const text of ['Renk anlamı', 'Düşük', 'Takip', 'İyi']) {
    await expect(legend.getByText(text, { exact: true })).toBeVisible()
  }

  for (const tone of ['danger', 'warning', 'success']) {
    await expect(dialog.locator(`.store-checklist-result-item-${tone}`)).toHaveCount(1)
  }

  const scoreCenterDelta = await dialog.locator('.store-checklist-result-score-ring').evaluate((element) => {
    const ring = element.getBoundingClientRect()
    const score = element.querySelector('strong')?.getBoundingClientRect()
    return score ? Math.abs((score.left + score.width / 2) - (ring.left + ring.width / 2)) : 999
  })
  expect(scoreCenterDelta).toBeLessThanOrEqual(1)
}

export async function expectChecklistResultModalNoScoreContract(dialog: Locator) {
  await expect(dialog.locator('.store-checklist-result-score-ring').getByText('No score')).toBeVisible()
  await expect(dialog.locator('.store-checklist-result-score-card-neutral')).toBeVisible()
  await expect(dialog.locator('.store-checklist-modal-summary .store-checklists-fact').first()).toHaveCSS('display', 'grid')
  await expect(dialog.locator('.store-checklist-result-item-neutral')).toHaveCount(3)
  await expect(dialog.locator('.store-checklist-result-item-warning')).toHaveCount(0)
}
