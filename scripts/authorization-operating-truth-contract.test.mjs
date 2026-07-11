import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  buildAuthorizationOperatingTruth,
  compareRoutePreviewRoles,
} from './authorization-operating-truth.mjs'

const truthPath = 'docs/architecture/authorization-operating-truth-v1.json'
const matrixPath = 'docs/architecture/pilot-route-role-matrix.md'

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function readText(path) {
  return readFileSync(path, 'utf8')
}

const currentTruth = buildAuthorizationOperatingTruth()

test('authorization operating truth is generated from every active frontend route', () => {
  const current = currentTruth
  const checkedIn = readJson(truthPath)

  assert.deepEqual(checkedIn, current)
  assert.equal(current.summary.routeCount, current.routes.length)
  assert.equal(current.previewOrphans.length, 0)
  assert.deepEqual(current.roleCatalog, [
    'AUDITOR',
    'HR_ADMIN',
    'INTEGRATION_ADMIN',
    'REGION_MANAGER',
    'REPORT_VIEWER',
    'SNAPSHOT_OPERATOR',
    'STORE_MANAGER',
    'STORE_PERSONNEL',
    'SUPER_ADMIN',
    'VISUAL_MERCHANDISER',
  ])
  assert.equal(new Set(current.routes.map((route) => route.id)).size, current.routes.length)

  for (const route of current.routes) {
    assert.ok(route.classification, `${route.id} must have a classification`)
    assert.ok(route.policyOwner, `${route.id} must have a policy owner`)
    assert.ok(route.previewOwnership, `${route.id} must classify preview ownership`)
  }
})

test('endpoint drift register reflects current backend role decorators', () => {
  const reporting = readText('backend/nestjs/src/modules/store-ops/web/reporting.controller.ts')
  const incentives = readText(
    'backend/nestjs/src/modules/store-ops/web/store-sales-target-incentive.controller.ts',
  )

  assert.match(
    reporting,
    /@Get\("personnel-performance\/:employeeId"\)[\s\S]*?@RequireRoles\("STORE_PERSONNEL", "STORE_MANAGER", "REGION_MANAGER", "SUPER_ADMIN", "REPORT_VIEWER"\)/,
  )
  assert.match(
    reporting,
    /@Get\("store-kpi-highlights"\)[\s\S]*?@RequireRoles\("STORE_MANAGER", "REGION_MANAGER", "REPORT_VIEWER"\)/,
  )
  assert.match(
    incentives,
    /@Get\("incentives"\)[\s\S]*?@RequireRoles\("STORE_MANAGER", "REGION_MANAGER"\)/,
  )
})

test('aliases, shell redirects, and wildcard fallbacks are explicit non-product classifications', () => {
  const truth = currentTruth
  const byId = new Map(truth.routes.map((route) => [route.id, route]))

  assert.equal(byId.get('route:store:/store')?.classification, 'alias')
  assert.equal(byId.get('route:store:/store')?.aliasOf, '/store/home')
  assert.equal(
    byId.get('route:store:/store')?.authorization.routeAccess,
    'authenticated_landing_alias',
  )
  assert.ok(byId.get('route:store:/store')?.runtimeRoles.includes('VISUAL_MERCHANDISER'))
  assert.equal(byId.get('route:admin:/')?.classification, 'shell_redirect')
  assert.equal(byId.get('route:admin:*')?.classification, 'non_product_fallback')
  assert.equal(byId.get('route:auth:*')?.classification, 'non_product_fallback')
})

test('route preview drift is complete, exact, and machine-visible', () => {
  const truth = currentTruth

  assert.deepEqual(
    truth.routePreviewDrifts.map((drift) => drift.id),
    [
      'store-incentives-preview-extra-roles',
    ],
  )

  assert.deepEqual(
    truth.endpointDrifts.map((drift) => drift.id),
    [
      'store-incentives-store-manager-backend-only',
    ],
  )

  assert.equal(truth.summary.endpointExpectationCount, 7)
  assert.deepEqual(
    truth.endpointRoleEvidence
      .filter((expectation) => expectation.status === 'approved')
      .filter((expectation) =>
        expectation.actualRoles.join('|') !== [...expectation.expectedRoles].sort().join('|')),
    [],
  )

  const synthetic = compareRoutePreviewRoles({
    route: '/synthetic',
    runtimeRoles: ['REGION_MANAGER'],
    previewRoles: ['REGION_MANAGER', 'STORE_MANAGER'],
  })
  assert.deepEqual(synthetic, {
    route: '/synthetic',
    previewExtraRoles: ['STORE_MANAGER'],
    previewMissingRoles: [],
  })
})

test('every direct product route is owned by the human route matrix', () => {
  const truth = currentTruth
  const matrix = readText(matrixPath)
  const directRoutes = truth.routes.filter((route) => route.matrixOwnership === 'direct')

  assert.ok(directRoutes.length > 30)
  for (const route of directRoutes) {
    assert.ok(
      matrix.includes(`| \`${route.path}\` |`),
      `${route.id} must have a direct route matrix row`,
    )
  }
})
