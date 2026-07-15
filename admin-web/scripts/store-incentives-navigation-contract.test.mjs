import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const sidebarSource = await readFile(
  new URL('../src/app/store-sidebar.tsx', import.meta.url),
  'utf8',
)
const navigationSource = await readFile(
  new URL('../src/app/store-route-registry.ts', import.meta.url),
  'utf8',
)

test('store incentives sidebar visibility is not gated by incentive query data', () => {
  assert.doesNotMatch(sidebarSource, /getStoreSalesTargetIncentives/u)
  assert.doesNotMatch(sidebarSource, /storeSalesTargetIncentivesQueryKey/u)
  assert.doesNotMatch(sidebarSource, /shouldShowIncentivesNav/u)
  assert.doesNotMatch(sidebarSource, /hasStoreIncentiveRows/u)
})

test('store incentives route visibility is limited to report viewers and region managers', () => {
  assert.match(navigationSource, /function canOpenStoreIncentives/u)
  assert.match(navigationSource, /canOpenCompanyStoreIncentives\(authSummary\)/u)
  assert.match(navigationSource, /const storeIncentiveRoles = \['REPORT_VIEWER', 'REGION_MANAGER'\]/u)
  assert.match(navigationSource, /hasAnyRole\(authSummary, storeIncentiveRoles\)/u)
  assert.doesNotMatch(navigationSource, /const storeIncentiveRoles = \[[^\]]*'STORE_MANAGER'/u)
})
