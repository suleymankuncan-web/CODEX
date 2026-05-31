import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const inventoryPath = 'docs/plans/admin-ui-modernization-v1-inventory.md'
const adminShellPath = 'admin-web/src/app/admin-shell.tsx'
const adminNavigationPath = 'admin-web/src/app/admin-navigation.ts'

function readText(path) {
  return readFileSync(path, 'utf8')
}

function extractInventoryBaseline() {
  const text = readText(inventoryPath)
  const match = text.match(/```json\r?\n([\s\S]*?)\r?\n```/)
  assert.ok(match, 'admin UI inventory must contain a JSON route baseline block')

  return JSON.parse(match[1])
}

function parseRoleArray(text) {
  return [...text.matchAll(/'([^']+)'/g)].map((match) => match[1]).sort()
}

function normalizeRoute(route) {
  return {
    navId: route.navId ?? null,
    navVisible: Boolean(route.navVisible),
    page: route.page,
    path: route.path,
    roles: [...route.roles].sort(),
  }
}

function normalizeNavItem(item) {
  return {
    id: item.id,
    roles: [...item.roles].sort(),
    rolesMode: item.rolesMode ?? (item.roles.length === 0 ? 'omitted' : 'declared'),
    to: item.to,
  }
}

function parseAdminRoutes() {
  const text = readText(adminShellPath)
  const routes = []
  const adminRoutePattern =
    /<Route\s+path="([^"]+)"\s+element=\{adminRoute\(\[([\s\S]*?)\],\s*<([A-Za-z0-9_]+)/g

  for (const match of text.matchAll(adminRoutePattern)) {
    routes.push({
      path: match[1],
      roles: parseRoleArray(match[2]),
      page: match[3],
    })
  }

  if (text.includes('<Route path="/admin/session" element={<SessionGate />} />')) {
    routes.push({
      path: '/admin/session',
      roles: [],
      page: 'SessionReadinessPage',
    })
  }

  return routes.sort((left, right) => left.path.localeCompare(right.path))
}

function parseAdminNavigation() {
  const text = readText(adminNavigationPath)
  const start = text.indexOf('export const adminNavDefinitions')
  const end = text.indexOf('export function isNavAllowed')
  assert.notEqual(start, -1, 'admin navigation definitions must be present')
  assert.notEqual(end, -1, 'admin navigation allow helper must be present')

  const definitions = text.slice(start, end)
  const items = []

  for (const match of definitions.matchAll(/\{\s*\n([\s\S]*?)\n\s*\}/g)) {
    const block = match[1]
    const id = block.match(/id:\s*'([^']+)'/)?.[1]
    const to = block.match(/to:\s*'([^']+)'/)?.[1]
    const rolesMatch = block.match(/roles:\s*\[([\s\S]*?)\]/)

    if (!id || !to) {
      continue
    }

    items.push({
      id,
      to,
      roles: rolesMatch ? parseRoleArray(rolesMatch[1]) : [],
      rolesMode: rolesMatch ? 'declared' : 'omitted',
    })
  }

  return items.sort((left, right) => left.id.localeCompare(right.id))
}

function attachNavigationBaseline(routes, navigation) {
  const navByPath = new Map(navigation.map((item) => [item.to, item]))

  return routes.map((route) => {
    const navItem = navByPath.get(route.path)
    return normalizeRoute({
      ...route,
      navId: navItem?.id ?? null,
      navVisible: Boolean(navItem),
    })
  })
}

function visibilityMatrix(items, roles) {
  return roles.map((role) => ({
    role,
    visible: items.map((item) => ({
      id: item.path ?? item.id,
      visible:
        item.rolesMode === 'omitted' ||
        (!item.rolesMode && item.roles.length === 0) ||
        item.roles.includes(role),
    })),
  }))
}

function diffCount(left, right) {
  try {
    assert.deepEqual(left, right)
    return 0
  } catch {
    return 1
  }
}

const baseline = extractInventoryBaseline()

test('admin UI inventory JSON baseline is parseable and complete', () => {
  assert.equal(baseline.routes.length, 31)
  assert.equal(baseline.navigation.length, 16)
  assert.deepEqual(baseline.rolesForParityMatrix, [
    'SUPER_ADMIN',
    'HR_ADMIN',
    'INTEGRATION_ADMIN',
    'SNAPSHOT_OPERATOR',
    'REPORT_VIEWER',
    'REGION_MANAGER',
    'AUDITOR',
    'NO_SPECIAL_ADMIN_ROLE',
  ])
})

test('admin route graph and route roles match the PR-1 inventory baseline', () => {
  const expectedRoutes = baseline.routes
    .map(normalizeRoute)
    .sort((left, right) => left.path.localeCompare(right.path))
  const currentRoutes = attachNavigationBaseline(parseAdminRoutes(), parseAdminNavigation())

  assert.deepEqual(currentRoutes, expectedRoutes)
  assert.equal(diffCount(currentRoutes, expectedRoutes), 0)
})

test('admin navigation items and nav role visibility match the PR-1 inventory baseline', () => {
  const expectedNavigation = baseline.navigation
    .map(normalizeNavItem)
    .sort((left, right) => left.id.localeCompare(right.id))
  const currentNavigation = parseAdminNavigation().map(normalizeNavItem)

  assert.deepEqual(currentNavigation, expectedNavigation)
  assert.equal(diffCount(currentNavigation, expectedNavigation), 0)
})

test('admin navigation parity preserves omitted role semantics', () => {
  const publicByOmission = normalizeNavItem({
    id: 'session',
    roles: [],
    rolesMode: 'omitted',
    to: '/admin/session',
  })
  const explicitEmptyRoles = normalizeNavItem({
    id: 'session',
    roles: [],
    rolesMode: 'declared',
    to: '/admin/session',
  })
  const roles = ['NO_SPECIAL_ADMIN_ROLE']

  assert.notDeepEqual(explicitEmptyRoles, publicByOmission)
  assert.equal(visibilityMatrix([publicByOmission], roles)[0].visible[0].visible, true)
  assert.equal(visibilityMatrix([explicitEmptyRoles], roles)[0].visible[0].visible, false)
})

test('admin route and navigation visibility matrices have zero drift', () => {
  const roles = baseline.rolesForParityMatrix
  const expectedRoutes = baseline.routes
    .map(normalizeRoute)
    .sort((left, right) => left.path.localeCompare(right.path))
  const currentRoutes = attachNavigationBaseline(parseAdminRoutes(), parseAdminNavigation())
  const expectedNavigation = baseline.navigation
    .map(normalizeNavItem)
    .sort((left, right) => left.id.localeCompare(right.id))
  const currentNavigation = parseAdminNavigation().map(normalizeNavItem)

  const expectedRouteVisibility = visibilityMatrix(expectedRoutes, roles)
  const currentRouteVisibility = visibilityMatrix(currentRoutes, roles)
  const expectedNavVisibility = visibilityMatrix(expectedNavigation, roles)
  const currentNavVisibility = visibilityMatrix(currentNavigation, roles)

  assert.deepEqual(currentRouteVisibility, expectedRouteVisibility)
  assert.deepEqual(currentNavVisibility, expectedNavVisibility)
  assert.equal(diffCount(currentRouteVisibility, expectedRouteVisibility), 0)
  assert.equal(diffCount(currentNavVisibility, expectedNavVisibility), 0)
})
