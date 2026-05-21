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
