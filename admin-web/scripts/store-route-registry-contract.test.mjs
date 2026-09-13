import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const registrySource = await readFile(
  new URL('../src/app/store-route-registry.ts', import.meta.url),
  'utf8',
)
const authorizationSource = await readFile(
  new URL('../src/features/auth/authorization.ts', import.meta.url),
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
  'visualCampaigns',
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
    assert.match(route.source, /operatingPolicy:/u, `${route.id} should declare operating policy metadata`)
    assert.match(route.source, /catalogRoles:/u, `${route.id} should declare catalog roles`)
    assert.match(route.source, /routeAccess:/u, `${route.id} should separate route access`)
    assert.match(route.source, /readScope:/u, `${route.id} should separate read scope`)
    assert.match(route.source, /actionScope:/u, `${route.id} should separate action scope`)
  }
})

test('route policy metadata reuses authorization role sources for helper-guarded routes', () => {
  for (const exportedRoles of [
    'checklistResultReadRoles',
    'storeWorkforceRouteRoles',
    'targetRequestListRoles',
  ]) {
    assert.match(authorizationSource, new RegExp(`export const ${exportedRoles} =`, 'u'))
    assert.match(registrySource, new RegExp(`catalogRoles: ${exportedRoles}`, 'u'))
  }
})

test('store navigation comes from registered routes instead of a second route list', () => {
  assert.match(registrySource, /const navigationByPersona/u)
  assert.match(registrySource, /getRoleAwareStoreNavigation/u)
  assert.doesNotMatch(registrySource, /managerNavigation/u)
  assert.doesNotMatch(registrySource, /regionManagerNavigation/u)
})

test('checklist is the second navigation item for store personas with a home route', () => {
  for (const persona of ['admin', 'storeManager', 'regionManager']) {
    const navigation = registrySource.match(new RegExp(`${persona}: \\[([\\s\\S]*?)\\],`, 'u'))

    assert.ok(navigation, `${persona} navigation should be explicit`)
    assert.match(navigation[1], /^\s*'home',\s*'checklists',/u)
  }
})

test('admin landing roles use an admin store persona instead of region manager copy', () => {
  assert.match(registrySource, /'admin'/u)
  assert.match(registrySource, /if \(roles\.has\('REGION_MANAGER'\)\) \{\s+return 'regionManager'\s+\}/u)
  assert.match(registrySource, /if \(hasAdminLandingRole\(authSummary\)\) \{\s+return 'admin'\s+\}/u)
  assert.match(registrySource, /storeHome\.persona\.admin/u)
})

test('store manager navigation exposes scoped reports, keeps incentives hidden and personnel profile role-gated', () => {
  const storeManagerNavigation = registrySource.match(/storeManager: \[([\s\S]*?)\],/u)
  const reportingRoles = registrySource.match(/const storeReportingRoles = \[([^\]]+)\]/u)
  const personnelRoute = getRouteBlocks().find((route) => route.id === 'personnel')

  assert.ok(storeManagerNavigation, 'store manager navigation should be explicit')
  assert.ok(reportingRoles, 'store reporting roles should be explicit')
  assert.ok(personnelRoute, 'personnel profile route should be registered')

  assert.match(storeManagerNavigation[1], /'reports'/u)
  assert.doesNotMatch(storeManagerNavigation[1], /'incentives'/u)
  assert.match(reportingRoles[1], /'STORE_MANAGER'/u)
  assert.match(registrySource, /const storePersonnelPerformanceRoles = \[/u)
  assert.match(personnelRoute.source, /hasAnyRole\(authSummary, storePersonnelPerformanceRoles\)/u)
})

test('store shell renders registered routes instead of duplicating path-specific guards', () => {
  assert.match(shellSource, /getStoreRouteDefinitions\(\)\.flatMap/u)
  assert.match(shellSource, /getStoreLandingPath\(input\.authSummary\)/u)
  assert.match(shellSource, /isStoreRouteAllowed\(route, input\.authSummary\)/u)
  assert.match(shellSource, /location\.pathname === '\/store'/u)
  assert.match(shellSource, /storeLandingPath !== '\/store\/home'/u)
  assert.match(shellSource, /<Navigate to=\{storeLandingPath\} replace \/>/u)
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
    /storeRouteDataPrefetchAllowedRoutes = new Set<StoreRouteId>\(\['home', 'feed', 'incentives'\]\)/u,
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
