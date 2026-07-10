import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { buildSystemFlow } from './generate-system-flow.mjs'

const defaultRootDir = path.resolve(import.meta.dirname, '..')
const outputFile = 'docs/architecture/authorization-operating-truth-v1.json'
const previewFile = 'admin-web/src/features/auth/role-permission-preview.ts'
const adminNavigationFile = 'admin-web/src/app/admin-navigation.ts'

const routeDriftIds = new Map([
  ['/store/incentives', 'store-incentives-preview-extra-roles'],
  ['/store/personnel/:employeeId', 'store-personnel-preview-missing-report-viewer'],
  ['/store/tasks', 'store-tasks-preview-extra-roles'],
])

const endpointDrifts = [
  {
    id: 'store-incentives-store-manager-backend-only',
    route: '/store/incentives',
    endpoint: 'GET /api/store/incentives',
    direction: 'backend_declares_role_missing_from_route',
    roles: ['STORE_MANAGER'],
    gate: 'DG-1',
    status: 'decision_gated',
    source: 'backend/nestjs/src/modules/store-ops/web/store-sales-target-incentive.controller.ts',
  },
  {
    id: 'store-kpi-report-viewer-frontend-only',
    route: '/store/kpis',
    endpoint: 'GET /api/reports/store-kpi-highlights',
    direction: 'route_role_missing_from_backend_decorator',
    roles: ['REPORT_VIEWER'],
    gate: 'DG-1',
    status: 'decision_gated',
    source: 'backend/nestjs/src/modules/store-ops/web/reporting.controller.ts',
  },
  {
    id: 'store-personnel-report-viewer-frontend-only',
    route: '/store/personnel/:employeeId',
    endpoint: 'GET /api/reports/personnel-performance/:employeeId',
    direction: 'route_role_missing_from_backend_decorator',
    roles: ['REPORT_VIEWER'],
    gate: 'DG-1',
    status: 'decision_gated',
    source: 'backend/nestjs/src/modules/store-ops/web/reporting.controller.ts',
  },
]

export function compareRoutePreviewRoles({ route, runtimeRoles, previewRoles }) {
  const runtime = new Set(runtimeRoles)
  const preview = new Set(previewRoles)
  return {
    route,
    previewExtraRoles: [...preview].filter((role) => !runtime.has(role)).sort(),
    previewMissingRoles: [...runtime].filter((role) => !preview.has(role)).sort(),
  }
}

export function buildAuthorizationOperatingTruth(input = {}) {
  const rootDir = path.resolve(input.rootDir ?? defaultRootDir)
  const preview = parsePermissionPreview(rootDir)
  const flow = buildSystemFlow({ rootDir })
  const activeRouteKeys = new Set(
    flow.frontendRoutes.map((route) => routeKey(route.surface, route.path)),
  )

  const routes = flow.frontendRoutes.map((route) => {
    const directPreview = preview.byRoute.get(routeKey(route.surface, route.path)) ?? null
    const inheritedPreview = directPreview ? null : findInheritedPreview(route, preview.byRoute)
    const previewOwnership = directPreview
      ? 'direct'
      : inheritedPreview
        ? `inherits:${inheritedPreview.route}`
        : isPreviewRelevant(route)
          ? 'missing'
          : 'not_applicable'
    const runtimeRoles = effectiveRuntimeRoles(route, preview.allRoles)

    return {
      id: route.id,
      surface: route.surface,
      path: route.path,
      kind: route.kind,
      classification: classifyRoute(route, directPreview),
      aliasOf: route.surface === 'store' && route.path === '/store' ? '/store/home' : null,
      policyOwner: policyOwner(route),
      matrixOwnership: directPreview && ['admin', 'store'].includes(route.surface)
        ? 'direct'
        : inheritedPreview
          ? 'inherited'
          : 'not_applicable',
      previewOwnership,
      runtimeRoles,
      previewRoles: directPreview?.roles ?? null,
      authorization: route.authorization ?? null,
      source: route.source,
    }
  })

  const routePreviewDrifts = routes
    .filter((route) => route.previewOwnership === 'direct')
    .map((route) => compareRoutePreviewRoles({
      route: route.path,
      runtimeRoles: route.runtimeRoles,
      previewRoles: route.previewRoles,
    }))
    .filter((drift) => drift.previewExtraRoles.length > 0 || drift.previewMissingRoles.length > 0)
    .map((drift) => ({
      id: routeDriftIds.get(drift.route) ?? `unclassified:${drift.route}`,
      ...drift,
      gate: 'DG-1',
      status: 'decision_gated',
    }))
    .sort((left, right) => left.id.localeCompare(right.id))

  const previewOrphans = [...preview.byRoute.values()]
    .filter((row) => !activeRouteKeys.has(routeKey(row.surface, row.route)))
    .map((row) => ({ surface: row.surface, route: row.route }))
    .sort((left, right) => routeKey(left.surface, left.route).localeCompare(routeKey(right.surface, right.route)))

  return {
    schemaVersion: 1,
    sourceOfTruth: {
      routes: [
        'admin-web/src/app/admin-shell.tsx',
        'admin-web/src/app/auth-flow-shell.tsx',
        'admin-web/src/app/store-route-registry.ts',
      ],
      preview: previewFile,
      backendDriftEvidence: [...new Set(endpointDrifts.map((drift) => drift.source))],
    },
    roleCatalog: preview.allRoles,
    summary: {
      routeCount: routes.length,
      directMatrixRouteCount: routes.filter((route) => route.matrixOwnership === 'direct').length,
      routePreviewDriftCount: routePreviewDrifts.length,
      endpointDriftCount: endpointDrifts.length,
      previewOrphanCount: previewOrphans.length,
    },
    routes,
    routePreviewDrifts,
    endpointDrifts,
    previewOrphans,
  }
}

function parsePermissionPreview(rootDir) {
  const previewText = readSource(rootDir, previewFile)
  const roleArrays = parseRoleArrays(previewText)
  const allRoles = roleArrays.get('allPreviewRoleCodes') ?? []
  const byRoute = new Map()

  for (const row of parseObjectArray(previewText, 'const storePreviewRows')) {
    const route = quotedProperty(row, 'route')
    const roles = roleListProperty(row, 'allowedRoles', roleArrays)
    if (route && roles) byRoute.set(routeKey('store', route), { surface: 'store', route, roles })
  }

  const adminText = readSource(rootDir, adminNavigationFile)
  for (const row of parseObjectArray(adminText, 'export const adminNavDefinitions')) {
    const route = quotedProperty(row, 'to')
    const roles = roleListProperty(row, 'roles', roleArrays) ?? allRoles
    if (route) byRoute.set(routeKey('admin', route), { surface: 'admin', route, roles })
  }

  return { allRoles, byRoute }
}

function parseRoleArrays(text) {
  const pending = new Map()
  for (const match of text.matchAll(/(?:export\s+)?const\s+(\w+)\s*=\s*\[([\s\S]*?)\](?:\s+as const)?/g)) {
    pending.set(match[1], match[2])
  }

  const resolved = new Map()
  let changed = true
  while (changed && pending.size > 0) {
    changed = false
    for (const [name, body] of pending) {
      const references = [...body.matchAll(/\.\.\.(\w+)/g)].map((match) => match[1])
      if (references.some((reference) => !resolved.has(reference))) continue
      const roles = [...body.matchAll(/(['"])([^'"]+)\1/g)].map((match) => match[2])
      for (const reference of references) roles.push(...resolved.get(reference))
      resolved.set(name, uniqueSorted(roles))
      pending.delete(name)
      changed = true
    }
  }

  for (const match of text.matchAll(/const\s+(\w+)\s*=\s*(\w+)\.filter\([\s\S]*?!==\s*['"]([^'"]+)['"][\s\S]*?\)/g)) {
    const base = resolved.get(match[2])
    if (base) resolved.set(match[1], base.filter((role) => role !== match[3]))
  }

  return resolved
}

function parseObjectArray(text, marker) {
  const markerIndex = text.indexOf(marker)
  const equalsIndex = markerIndex === -1 ? -1 : text.indexOf('=', markerIndex)
  const start = equalsIndex === -1 ? -1 : text.indexOf('[', equalsIndex)
  const end = start === -1 ? -1 : findBalancedEnd(text, start, '[', ']')
  if (start === -1 || end === -1) return []

  const objects = []
  for (let cursor = start + 1; cursor < end; cursor += 1) {
    if (text[cursor] !== '{') continue
    const close = findBalancedEnd(text, cursor, '{', '}')
    if (close === -1 || close > end) break
    objects.push(text.slice(cursor, close + 1))
    cursor = close
  }
  return objects
}

function roleListProperty(text, property, roleArrays) {
  const match = new RegExp(`\\b${property}\\s*:\\s*(\\w+|\\[[\\s\\S]*?\\])`).exec(text)
  if (!match) return null
  if (!match[1].startsWith('[')) return roleArrays.get(match[1]) ?? null
  return uniqueSorted([...match[1].matchAll(/(['"])([^'"]+)\1/g)].map((role) => role[2]))
}

function quotedProperty(text, property) {
  return new RegExp(`\\b${property}\\s*:\\s*(['"])([^'"]+)\\1`).exec(text)?.[2] ?? null
}

function effectiveRuntimeRoles(route, allRoles) {
  if (route.surface === 'admin' && route.guard === 'none' && route.kind === 'page') {
    return allRoles
  }
  return uniqueSorted(route.roles)
}

function findInheritedPreview(route, byRoute) {
  if (route.surface !== 'admin' || route.kind !== 'page') return null
  return [...byRoute.values()]
    .filter((row) => row.surface === 'admin' && route.path.startsWith(`${row.route}/`))
    .sort((left, right) => right.route.length - left.route.length)[0] ?? null
}

function isPreviewRelevant(route) {
  return route.kind === 'page' && ['admin', 'store'].includes(route.surface)
}

function classifyRoute(route, directPreview) {
  if (route.path === '*') return 'non_product_fallback'
  if (route.kind === 'redirect' || route.path === '/') return 'shell_redirect'
  if (route.surface === 'store' && route.path === '/store') return 'alias'
  if (route.surface === 'auth') return 'auth_flow'
  if (route.surface === 'admin' && !directPreview) return 'detail_route'
  return 'product_route'
}

function policyOwner(route) {
  if (route.surface === 'store') return 'store_route_registry'
  if (route.surface === 'auth') return 'auth_flow_shell'
  return 'admin_shell'
}

function findBalancedEnd(text, openIndex, openChar, closeChar) {
  let depth = 0
  let quote = null
  for (let cursor = openIndex; cursor < text.length; cursor += 1) {
    const char = text[cursor]
    if (quote) {
      if (char === '\\') cursor += 1
      else if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'" || char === '`') quote = char
    else if (char === openChar) depth += 1
    else if (char === closeChar && --depth === 0) return cursor
  }
  return -1
}

function readSource(rootDir, repoPath) {
  return readFileSync(path.join(rootDir, ...repoPath.split('/')), 'utf8')
}

function routeKey(surface, routePath) {
  return `${surface}:${routePath}`
}

function uniqueSorted(values) {
  return [...new Set(values)].sort()
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const outputPath = path.join(defaultRootDir, ...outputFile.split('/'))
  writeFileSync(outputPath, `${JSON.stringify(buildAuthorizationOperatingTruth(), null, 2)}\n`)
  process.stdout.write(`[authorization-operating-truth] wrote ${outputFile}\n`)
}
