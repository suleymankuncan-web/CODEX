import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const targetsPageSource = await readFile(
  new URL('../src/pages/StoreTargetsPage.tsx', import.meta.url),
  'utf8',
)
const targetsModelSource = await readFile(
  new URL('../src/features/targets/command-workspace/model.ts', import.meta.url),
  'utf8',
)
const targetScaffoldSource = await readFile(
  new URL('../src/features/targets/command-workspace/workspace-scaffold.tsx', import.meta.url),
  'utf8',
)
const storeManagerSource = await readFile(
  new URL('../src/features/targets/command-workspace/store-manager-view.tsx', import.meta.url),
  'utf8',
)

test('store target metrics read workspace summary truth instead of approved workflow requests', () => {
  assert.match(targetsModelSource, /export function buildTargetMetrics\(workspace:/u)
  assert.match(targetsModelSource, /summary\.approvedStores \+ summary\.adjustedApprovedStores/u)
  assert.match(targetsModelSource, /summary\?\.pendingStores/u)
  assert.match(targetsModelSource, /summary\?\.missingStores/u)
  assert.match(targetScaffoldSource, /buildTargetMetrics\(input\.workspace\)/u)
  assert.match(targetScaffoldSource, /input\.workspace\.summary\?\.totalTargetValue/u)
  assert.doesNotMatch(targetScaffoldSource, /getTargetDistributionRequests/u)
})

test('the route has one workspace owner while Store Manager metrics use the same persisted summary', () => {
  assert.match(targetsPageSource, /return <TargetCommandWorkspaceOwner/u)
  assert.doesNotMatch(targetsPageSource, /StoreTargetsLegacyPage/u)
  assert.match(storeManagerSource, /const summary = input\.workspace\.summary/u)
  assert.match(storeManagerSource, /summary\?\.approvedStores/u)
  assert.match(storeManagerSource, /summary\?\.adjustedApprovedStores/u)
  assert.match(storeManagerSource, /summary\?\.missingStores/u)
})
