import { existsSync, readFileSync } from 'node:fs'
import { expect, test } from './test-fixtures'
import { installGenericStoreApiFallbacks, installStoreContractSession } from './store-page-contract-fixtures'
import { createIncentiveWorkspace, routeIncentiveWorkspace } from './store-incentives-command-fixtures'
import { routeTargetWorkspace } from './store-targets-command-fixtures'

const deletedFiles = [
  'src/pages/store-targets-approval-queue.tsx',
  'src/pages/store-targets-contract-sections.tsx',
  'src/pages/store-targets-page-model.ts',
  'src/pages/store-targets-page-widgets.tsx',
  'src/pages/store-targets-period-picker.tsx',
  'src/pages/store-targets-region-command-model.ts',
  'src/pages/store-targets-region-command.tsx',
  'src/styles/store-targets-command.css',
  'src/styles/store-targets-command-contracts.css',
  'src/styles/store-targets-prototype.css',
  'src/styles/store-targets-prototype-drawer.css',
] as const

const obsoleteTokens = [
  'StoreTargetsLegacyPage',
  'store-targets-prototype-shell',
  'store-targets-command-contracts',
  'targets-command-header',
  'targets-command-panel',
  'command-v2',
  'incentives-prototype-shell',
  'incentives-command-v2',
] as const

test('TGT-FR-012/013: deletion manifest has zero source owners or global imports', () => {
  for (const file of deletedFiles) expect(existsSync(file), file).toBe(false)

  const source = [readFileSync('src/pages/StoreTargetsPage.tsx', 'utf8'), readFileSync('src/index.css', 'utf8')].join('\n')
  for (const token of obsoleteTokens) expect(source, token).not.toContain(token)
  expect(source.match(/TargetCommandWorkspaceOwner/g)).toHaveLength(2)
})

test('AC-001/008: built Store routes contain no replaced Targets owner or prototype control', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await installGenericStoreApiFallbacks(page)
  await routeTargetWorkspace(page, 'region_manager')
  await page.goto('/store/targets')

  await expect(page.getByRole('heading', { name: 'Hedef Kontrol Masası' })).toBeVisible()
  await expect(page.locator('.store-targets-prototype-shell, .store-targets-command, .targets-command-panel')).toHaveCount(0)
  await expect(page.getByRole('columnheader', { name: 'İşlem' })).toHaveCount(0)

  const productionAssets = await page.evaluate(async () => {
    const urls = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((url) => url.startsWith(location.origin) && /\.(?:css|js)(?:\?|$)/.test(url))
    return (await Promise.all([...new Set(urls)].map((url) => fetch(url).then((response) => response.text())))).join('\n')
  })
  for (const token of obsoleteTokens) expect(productionAssets, token).not.toContain(token)
})

test('SH-FR-002: Incentives has one production owner and no internal prototype control', async ({ page }) => {
  await installStoreContractSession(page, 'reportViewer')
  await installGenericStoreApiFallbacks(page)
  await routeIncentiveWorkspace(page, createIncentiveWorkspace('report_viewer', { prototypeParity: true }))
  await page.goto('/store/incentives')

  await expect(page.getByRole('heading', { name: 'Şirket Prim Görünümü' })).toBeVisible()
  await expect(page.locator('[data-command-canvas-page]')).toHaveCount(1)
  await expect(page.locator('.role-switcher, [data-prototype-role-switcher]')).toHaveCount(0)
  await expect(page.getByText(/command-v2/i)).toHaveCount(0)
})
