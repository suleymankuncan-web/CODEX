import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const registrySource = await readFile(
  new URL('../src/app/store-route-registry.ts', import.meta.url),
  'utf8',
)
const shellSource = await readFile(
  new URL('../src/app/store-shell.tsx', import.meta.url),
  'utf8',
)
const storeSidebarSource = await readFile(
  new URL('../src/app/store-sidebar.tsx', import.meta.url),
  'utf8',
)
const modulePreloaderSource = await readFile(
  new URL('../src/app/route-preloaders.ts', import.meta.url),
  'utf8',
)
const dataPreloaderSource = await readFile(
  new URL('../src/app/route-data-preloaders.ts', import.meta.url),
  'utf8',
)
const primitivesSource = await readFile(
  new URL('../src/pages/store-surface-primitives.tsx', import.meta.url),
  'utf8',
)

const expectedRouteIds = [
  'approvals',
  'checklists',
  'competitions',
  'feed',
  'home',
  'incentives',
  'kpis',
  'me',
  'personnel',
  'rankings',
  'reports',
  'settings',
  'targets',
  'tasks',
  'workforce',
]

function getRouteBlocks() {
  return [...registrySource.matchAll(/\r?\n  \{\r?\n    id: '([^']+)'[\s\S]*?\r?\n  \},/g)]
    .map((match) => ({
      id: match[1],
      source: match[0],
    }))
}

test('store route registry owns every store route with explicit access and preload metadata', () => {
  const routeBlocks = getRouteBlocks()
  const ids = routeBlocks.map((route) => route.id).sort()

  assert.deepEqual(ids, expectedRouteIds)

  for (const route of routeBlocks) {
    assert.match(route.source, /path: '\/store/u, `${route.id} should declare a store path`)
    assert.match(route.source, /routePath: '\/store/u, `${route.id} should declare a shell route path`)
    assert.match(route.source, /modulePreload:/u, `${route.id} should declare a module preload`)
    assert.match(route.source, /access:/u, `${route.id} should declare explicit access`)
  }
})

test('store navigation comes from registered routes instead of a second route list', () => {
  assert.match(registrySource, /const navigationByPersona/u)
  assert.match(registrySource, /getRoleAwareStoreNavigation/u)
  assert.doesNotMatch(registrySource, /managerNavigation/u)
  assert.doesNotMatch(registrySource, /regionManagerNavigation/u)
})

test('admin landing roles use an admin store persona instead of region manager copy', () => {
  assert.match(registrySource, /'admin'/u)
  assert.match(registrySource, /if \(roles\.has\('REGION_MANAGER'\)\) \{\s+return 'regionManager'\s+\}/u)
  assert.match(registrySource, /if \(hasAdminLandingRole\(authSummary\)\) \{\s+return 'admin'\s+\}/u)
  assert.match(registrySource, /storeHome\.persona\.admin/u)
})

test('store manager pilot navigation keeps reports hidden and personnel profile role-gated', () => {
  const storeManagerNavigation = registrySource.match(/storeManager: \[([\s\S]*?)\],/u)
  const reportingRoles = registrySource.match(/const storeReportingRoles = \[([^\]]+)\]/u)
  const personnelRoute = getRouteBlocks().find((route) => route.id === 'personnel')

  assert.ok(storeManagerNavigation, 'store manager navigation should be explicit')
  assert.ok(reportingRoles, 'store reporting roles should be explicit')
  assert.ok(personnelRoute, 'personnel profile route should be registered')

  assert.doesNotMatch(storeManagerNavigation[1], /'reports'/u)
  assert.doesNotMatch(reportingRoles[1], /'STORE_MANAGER'/u)
  assert.match(registrySource, /const storePersonnelPerformanceRoles = \[/u)
  assert.match(personnelRoute.source, /hasAnyRole\(authSummary, storePersonnelPerformanceRoles\)/u)
})

test('store shell renders registered routes instead of duplicating path-specific guards', () => {
  assert.match(shellSource, /getStoreRouteDefinitions\(\)\.flatMap/u)
  assert.match(shellSource, /isStoreRouteAllowed\(route, input\.authSummary\)/u)
  assert.doesNotMatch(shellSource, /path="\/store\/incentives"/u)
  assert.doesNotMatch(shellSource, /storeIncentivesAllowed/u)
  assert.doesNotMatch(shellSource, /storeWorkforceAllowed/u)
})

test('store route preloading and data prefetch resolve through the registry', () => {
  assert.match(modulePreloaderSource, /findStoreRouteDefinition\(pathname\)/u)
  assert.doesNotMatch(modulePreloaderSource, /pathname\) => pathname === '\/store\/incentives'/u)

  assert.match(dataPreloaderSource, /findStoreRouteDefinition\(pathname\)/u)
  assert.match(dataPreloaderSource, /getStoreRoutePrefetchTasks\(storeRoute\.id, authSummary\)/u)
  assert.match(
    dataPreloaderSource,
    /storeRouteDataPrefetchAllowedRoutes = new Set<StoreRouteId>\(\['home', 'feed'\]\)/u,
  )
  assert.doesNotMatch(dataPreloaderSource, /if \(pathname === '\/store\/incentives'\)/u)
  assert.doesNotMatch(storeSidebarSource, /prefetchRouteData/u)
  assert.doesNotMatch(storeSidebarSource, /route-data-preloaders/u)
})

test('store route state primitive defines the shared route-state contract', () => {
  for (const kind of ['loading', 'empty', 'error', 'unavailable', 'forbidden', 'preview']) {
    assert.match(primitivesSource, new RegExp(`'${kind}'`, 'u'))
  }

  assert.match(primitivesSource, /export function StoreRouteState/u)
})
