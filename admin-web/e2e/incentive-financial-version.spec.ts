import { expect, test } from './test-fixtures'
import { companyCycleFixture, installCompanyCycleSession } from './incentive-company-cycle-fixture'

for (const moment of ['before-dialog', 'after-dialog']) {
  test(`company confirmation cannot carry a changed full seal ${moment} even at the same total`, async ({ page }) => {
    await installCompanyCycleSession(page)
    let changed = false
    const posts: Record<string, unknown>[] = []
    await page.route('**/api/store/incentives/company-cycle**', route => {
      if (route.request().method() === 'POST') { posts.push(route.request().postDataJSON()); return route.fulfill({ status: 409, json: { message: 'Seal content changed' } }) }
      const detail = companyCycleFixture(); if (changed) { detail.revisions[0]!.seal_hash = 'b'.repeat(64); detail.revisions[0]!.payload.roster[0]!.display_name = 'Yeni Mühürlü Personel' }
      return route.fulfill({ json: { items: [detail] } })
    })
    await page.goto('/store/incentives'); const open = page.getByRole('button', { name: 'Aşamayı onayla' }); await expect(open).toBeEnabled()
    if (moment === 'before-dialog') changed = true
    await open.click()
    if (moment === 'before-dialog') {
      await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.getByText('Yeni Mühürlü Personel')).toBeVisible(); expect(posts).toHaveLength(0)
    } else {
      const dialog = page.getByRole('dialog', { name: 'Şirket aşamasını onayla' }); await expect(dialog).toContainText('₺125,00')
      changed = true; await dialog.getByRole('button', { name: 'Onayla', exact: true }).click()
      await expect(page.getByText('Yeni Mühürlü Personel')).toBeVisible(); expect(posts).toHaveLength(1); expect(posts[0]?.sealHash).toBe('a'.repeat(64))
      await expect(dialog).toHaveCount(0)
    }
  })
}
