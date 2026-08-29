import { expect, type Locator } from './test-fixtures'

export async function expectChecklistResultModalVisualContract(dialog: Locator) {
  await expect(dialog.getByText('Kontrol listesi sonucu', { exact: true })).toBeVisible()
  await expect(dialog.getByText('Sonuç özeti')).toHaveCount(0)
  await expect(dialog.getByText('Dikkat isteyen maddeler')).toHaveCount(0)
  await expect(dialog.getByText('Kayıt durumu', { exact: true })).toHaveCount(0)
  await expect(dialog.getByText('Takip', { exact: true })).toHaveCount(0)
  await expect(dialog.locator('.store-checklist-result-overview .store-checklists-fact')).toHaveCount(0)
  await expect(dialog.locator('.store-checklist-result-hero-fact')).toHaveCount(2)
  await expect(dialog.locator('.store-checklist-result-metrics')).toHaveCount(0)

  const scopeCount = dialog.locator('.store-checklist-result-section-count')
  await expect(scopeCount.locator('b')).toHaveText(['2', '3'])

  await expect(dialog.locator('.store-checklist-result-status-legend')).toHaveCount(0)

  for (const tone of ['danger', 'warning', 'success']) {
    await expect(dialog.locator(`.store-checklist-result-item-${tone}`)).toHaveCount(1)
  }
  await expect(dialog.locator('.store-checklist-result-item-status')).toHaveCount(0)
  await expect(dialog.locator('.store-checklist-result-item-type')).toHaveCount(0)
  await expect(dialog.locator('.store-checklist-result-item-outcome')).toHaveCount(3)
  await expect(dialog.locator('.store-checklist-result-item-outcome').first().locator('dt')).toHaveText(['Cevap', 'Puan'])
  await expect(dialog.locator('.store-checklist-result-item-outcome').first().locator('dd')).toHaveText(['Evet', '30/60'])

  await expectChecklistResultModalAlignedContract(dialog)

  const scoreCenterDelta = await dialog.locator('.store-checklist-result-score-ring').evaluate((element) => {
    const ring = element.getBoundingClientRect()
    const score = element.querySelector('strong')?.getBoundingClientRect()
    return score ? Math.abs((score.left + score.width / 2) - (ring.left + ring.width / 2)) : 999
  })
  expect(scoreCenterDelta).toBeLessThanOrEqual(1)
}

export async function expectChecklistResultModalAlignedContract(dialog: Locator) {
  const alignedReport = await dialog.evaluate((element) => {
    const modal = element.getBoundingClientRect()
    const isSolo = element.querySelector('.store-checklist-result-body--solo') !== null
    const hero = element.querySelector<HTMLElement>('.store-checklist-result-hero')?.getBoundingClientRect()
    const findings = element.querySelector<HTMLElement>('.store-checklist-result-findings')?.getBoundingClientRect()
    if (!hero || !findings) throw new Error('missing result report landmark')
    return {
      isSolo,
      modalWidth: modal.width,
      leftDelta: Math.abs(hero.left - findings.left),
      widthDelta: Math.abs(hero.width - findings.width),
    }
  })
  expect(alignedReport.modalWidth).toBeLessThanOrEqual(961)
  if (alignedReport.isSolo) {
    expect(alignedReport.leftDelta).toBeLessThanOrEqual(1)
    expect(alignedReport.widthDelta).toBeLessThanOrEqual(1)
  }
}

export async function expectChecklistResultModalNoScoreContract(dialog: Locator) {
  await expect(dialog.locator('.store-checklist-result-score-ring').getByText('No score')).toBeVisible()
  await expect(dialog.locator('.store-checklist-result-score-card-neutral')).toBeVisible()
  await expect(dialog.locator('.store-checklist-result-hero-facts')).toHaveCSS('display', 'grid')
  await expect(dialog.locator('.store-checklist-result-hero-fact')).toHaveCount(2)
  await expect(dialog.locator('.store-checklist-result-item-neutral')).toHaveCount(3)
  await expect(dialog.locator('.store-checklist-result-item-warning')).toHaveCount(0)
}
