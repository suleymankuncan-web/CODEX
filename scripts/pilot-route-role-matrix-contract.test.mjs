import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function requireText(text, expected, context) {
  assert.ok(text.includes(expected), `${context} must include ${expected}`)
}

const matrix = readText('docs/architecture/pilot-route-role-matrix.md')
const appRouteSource = [
  readText('admin-web/src/App.tsx'),
  readText('admin-web/src/app/admin-navigation.ts'),
  readText('admin-web/src/app/admin-shell.tsx'),
  readText('admin-web/src/app/store-shell.tsx'),
  readText('admin-web/src/app/store-route-registry.ts'),
].join('\n')

const requiredRoutes = [
  '/admin/integrations',
  '/admin/master-data',
  '/admin/snapshots',
  '/admin/inbox',
  '/admin/feed',
  '/admin/checklists',
  '/admin/competitions',
  '/admin/reports',
  '/admin/targets',
  '/admin/kpi-config',
  '/admin/auth',
  '/admin/audit',
  '/admin/session',
  '/store',
  '/store/me',
  '/store/rankings',
  '/store/approvals',
  '/store/checklists',
  '/store/tasks',
  '/store/kpis',
  '/store/feed',
  '/store/competitions',
  '/store/incentives',
]

test('pilot route matrix documents every active admin and store route', () => {
  for (const route of requiredRoutes) {
    requireText(matrix, `| \`${route}\` |`, 'route matrix')
    requireText(appRouteSource, route, 'admin web route source')
  }
})

test('pilot route matrix keeps required governance columns', () => {
  for (const heading of [
    '| Route | Shell | Classification | Roles | Landing Behavior | Refresh/Return Expectation | Data Boundary | Primary Nav |',
    '## Classification Rules',
    '## Landing Order',
    '## Review Notes',
  ]) {
    requireText(matrix, heading, 'route matrix')
  }
})

test('pilot route matrix locks the first stabilization classifications', () => {
  for (const row of [
    '| `/admin/integrations` | admin | core | `SUPER_ADMIN`, `INTEGRATION_ADMIN` | first landing for super admin and integration admin | must return to same route after auth verification | company-scoped import state | yes |',
    '| `/admin/master-data` | admin | core | `SUPER_ADMIN`, `HR_ADMIN`, `INTEGRATION_ADMIN` | direct navigation only | must return to same route after auth verification | company-scoped bootstrap batches | yes |',
    '| `/admin/session` | admin | ops | any authenticated admin shell session | direct navigation only | must stay on `/admin/session` | local/session diagnostics only | yes |',
    '| `/store/me` | store | core | `STORE_MANAGER`, `STORE_PERSONNEL` | direct navigation or store landing link | must return to same route after auth verification | current employee performance only | yes |',
    '| `/store/rankings` | store | core | `STORE_MANAGER`, `STORE_PERSONNEL`, `REGION_MANAGER`, `SUPER_ADMIN` | direct navigation or store landing link | must return to same route after auth verification | top 100 for store roles, full list for privileged roles | yes |',
  ]) {
    requireText(matrix, row, 'route matrix')
  }
})
