import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  buildSystemFlow,
  renderSystemFlowHtml,
} from './generate-system-flow.mjs'

const normalizedRootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readText(file) {
  return readFileSync(path.join(normalizedRootDir, file), 'utf8')
}

function readJson(file) {
  return JSON.parse(readText(file))
}

function normalizeLineEndings(value) {
  return value.replace(/\r\n/g, '\n')
}

function withoutVolatileFields(flow) {
  return {
    ...flow,
    generatedAt: '<generated>',
  }
}

function findRoute(flow, routePath) {
  const route = flow.frontendRoutes.find((item) => item.path === routePath)
  assert.ok(route, `Missing route ${routePath}`)
  return route
}

function routeApiPaths(flow, routePath) {
  const route = findRoute(flow, routePath)
  const callById = new Map(flow.frontendApiCalls.map((call) => [call.id, call]))
  return flow.edges.routeToApi
    .filter((edge) => edge.routeId === route.id)
    .map((edge) => callById.get(edge.apiCallId))
    .filter(Boolean)
    .map((call) => `${call.method} ${call.path}`)
    .sort()
}

test('system flow artifacts are generated from current repository sources', () => {
  const recorded = readJson('docs/flows/store-ops-system-flow.json')
  const current = buildSystemFlow({ rootDir: normalizedRootDir })

  assert.deepEqual(withoutVolatileFields(recorded), withoutVolatileFields(current))
  assert.equal(
    normalizeLineEndings(readText('docs/flows/store-ops-system-flow.html')),
    normalizeLineEndings(renderSystemFlowHtml(recorded)),
  )
})

test('system flow captures the main route, API, controller, and OpenAPI layers', () => {
  const flow = readJson('docs/flows/store-ops-system-flow.json')

  assert.ok(flow.summary.frontendRouteCount >= 40, 'expected route inventory coverage')
  assert.ok(flow.summary.backendEndpointCount >= 120, 'expected backend endpoint coverage')
  assert.ok(flow.summary.frontendApiCallCount >= 100, 'expected frontend API usage coverage')
  assert.equal(flow.summary.unmatchedFrontendApiCallCount, 0)
  assert.equal(flow.summary.backendEndpointCount, flow.summary.openApiEndpointCount)

  for (const expectedRoute of [
    '/admin/operations',
    '/admin/integrations',
    '/admin/auth',
    '/store/checklists',
    '/store/rankings',
  ]) {
    findRoute(flow, expectedRoute)
  }
})

test('system flow route IDs and source lines keep route shells distinct', () => {
  const flow = readJson('docs/flows/store-ops-system-flow.json')
  const routeIds = flow.frontendRoutes.map((route) => route.id)

  assert.equal(new Set(routeIds).size, routeIds.length, 'route IDs should be unique across app shells')

  for (const route of flow.frontendRoutes) {
    const sourceLine = readText(route.source.file).split(/\r?\n/)[route.source.line - 1] ?? ''
    if (route.source.file === 'admin-web/src/app/store-route-registry.ts') {
      assert.match(
        sourceLine,
        /\b(?:routePath|aliases)\s*:/,
        `${route.id} should point at a concrete store route registry entry`,
      )
    } else {
      assert.match(sourceLine, /<Route(?:\s|\/|>|$)/, `${route.id} should point at a concrete Route tag`)
      assert.doesNotMatch(sourceLine, /<Routes|<RouteTransitionFrame/, `${route.id} should not point at a route wrapper`)
    }
  }
})

test('system flow resolves shell-local and conditional route components', () => {
  const flow = readJson('docs/flows/store-ops-system-flow.json')

  for (const [routePath, component] of [
    ['/admin/session', 'SessionGate'],
    ['/store', 'StoreHomePage'],
    ['/store/home', 'StoreHomePage'],
    ['/auth/login', 'AuthLoginPage'],
  ]) {
    const route = findRoute(flow, routePath)
    assert.equal(route.component, component)
    assert.equal(route.kind, 'page')
    assert.ok(route.componentFile, `${routePath} should resolve a component file`)
  }
})

test('system flow links representative product routes to their backend API surfaces', () => {
  const flow = readJson('docs/flows/store-ops-system-flow.json')

  assert.ok(
    routeApiPaths(flow, '/admin/operations').includes('GET /api/integrations/import-batches/overview'),
    'operations control tower should link to import overview',
  )
  assert.ok(
    routeApiPaths(flow, '/admin/operations').includes('GET /api/workflow/inbox'),
    'operations control tower should link to workflow inbox',
  )
  assert.ok(
    routeApiPaths(flow, '/store/rankings').includes('GET /api/reports/rankings'),
    'store rankings should link to report rankings',
  )
  assert.ok(
    routeApiPaths(flow, '/store/checklists').includes('GET /api/mobile/checklists/today'),
    'store checklists should link to mobile checklist today',
  )
  assert.ok(
    routeApiPaths(flow, '/admin/auth').includes('GET /api/auth/users'),
    'auth admin dashboard should link to user admin reads',
  )
})

test('system flow does not treat route preload registries as route API fanout', () => {
  const flow = readJson('docs/flows/store-ops-system-flow.json')

  assert.deepEqual(routeApiPaths(flow, '/auth/login'), ['GET /api/auth/bootstrap'])
  assert.deepEqual(routeApiPaths(flow, '/admin/session'), ['GET /api/auth/session'])

  assert.ok(
    !routeApiPaths(flow, '/auth/login').includes('GET /api/reports/rankings'),
    'auth login should not inherit unrelated report calls from route preloader registries',
  )
  assert.ok(
    !routeApiPaths(flow, '/admin/session').includes('GET /api/integrations/import-batches/overview'),
    'session readiness should not inherit unrelated route-loader imports',
  )
})

test('system flow endpoint filters use the full API-to-endpoint edge set', () => {
  const flow = readJson('docs/flows/store-ops-system-flow.json')

  assert.ok(
    flow.edges.apiToEndpoint.length > flow.hotspots.endpointsByFrontendCallCount.length,
    'expected full endpoint edge coverage to be larger than the displayed hotspot sample',
  )
  assert.ok(
    renderSystemFlowHtml(flow).includes('linkedEndpointIds'),
    'backend endpoint filtering should use full API-to-endpoint edges instead of the truncated hotspot sample',
  )
})
