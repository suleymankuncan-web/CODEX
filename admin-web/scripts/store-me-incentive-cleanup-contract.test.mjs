import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const storeMePageSource = await readFile(
  new URL('../src/pages/StoreMyPerformancePage.tsx', import.meta.url),
  'utf8',
)
const routeRegistrySource = await readFile(
  new URL('../src/app/store-route-registry.ts', import.meta.url),
  'utf8',
)

test('store me performance surface does not load or render incentive projections', () => {
  assert.doesNotMatch(storeMePageSource, /StoreMeIncentiveCard/u)
  assert.doesNotMatch(storeMePageSource, /getMySalesTargetIncentives/u)
  assert.doesNotMatch(storeMePageSource, /mySalesTargetIncentivesQueryKey/u)
  assert.doesNotMatch(storeMePageSource, /incentiveProjection/u)
})

test('store manager incentives route stays closed while region manager route remains open', () => {
  assert.match(routeRegistrySource, /function canOpenStoreIncentives/u)
  assert.match(routeRegistrySource, /const storeIncentiveRoles = \['REGION_MANAGER'\]/u)
  assert.match(routeRegistrySource, /hasAnyRole\(authSummary, storeIncentiveRoles\)/u)
  assert.doesNotMatch(routeRegistrySource, /const storeIncentiveRoles = \[[^\]]*'STORE_MANAGER'/u)

  const storeManagerNavigation = routeRegistrySource.match(/storeManager: \[([\s\S]*?)\],/u)
  const regionManagerNavigation = routeRegistrySource.match(/regionManager: \[([\s\S]*?)\],/u)

  assert.ok(storeManagerNavigation, 'store manager navigation should be declared')
  assert.ok(regionManagerNavigation, 'region manager navigation should be declared')
  assert.doesNotMatch(storeManagerNavigation[1], /'incentives'/u)
  assert.match(regionManagerNavigation[1], /'incentives'/u)
})
