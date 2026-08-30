import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const authorizationTruth = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', 'docs/architecture/authorization-operating-truth-v1.json'), 'utf8'),
)

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
  readText('admin-web/src/app/route-states.tsx'),
].join('\n')

const requiredRoutes = authorizationTruth.routes
  .filter((route) => route.matrixOwnership === 'direct')
  .map((route) => route.path)

test('pilot route matrix documents every active admin and store route', () => {
  assert.ok(requiredRoutes.length > 30, 'route matrix must be derived from the complete active inventory')
  for (const route of requiredRoutes) {
    requireText(matrix, `| \`${route}\` |`, 'route matrix')
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
    '| `/admin/session` | admin | ops | every catalog role except `REPORT_VIEWER` | direct navigation only | must stay on `/admin/session` | local/session diagnostics only | yes |',
    '| `/store/me` | store | core | `STORE_MANAGER`, `STORE_PERSONNEL` | direct navigation or store landing link | must return to same route after auth verification | current employee performance only | yes |',
    '| `/store/rankings` | store | core | `STORE_MANAGER`, `STORE_PERSONNEL`, `REGION_MANAGER`, `SUPER_ADMIN`, `REPORT_VIEWER` | direct navigation or store landing link | must return to same route after auth verification | top 100 for store roles; company-scoped read for Report Viewer; no action | yes |',
  ]) {
    requireText(matrix, row, 'route matrix')
  }
})

test('pilot route matrix locks the visual merchandiser-only route boundary', () => {
  for (const expected of [
    '## Authority',
    'A Visual Merchandiser-only session lands on `/store/checklists` and may use',
    'only `/store/checklists`, `/store/visual-campaigns`, `/store/feed`, and `/store/settings`.',
    '| `/store/visual-campaigns` | store | secondary | `VISUAL_MERCHANDISER` with an explicit company-scoped publisher or reviewer capability; `STORE_MANAGER` with an assigned campaign store; `REGION_MANAGER` with both a current region-role assignment and current action-store assignment |',
    '| `/store/feed` | store | secondary | authenticated store shell session; visual merchandiser-only is permitted |',
    '| `/store/settings` | store | secondary | authenticated store shell session; visual merchandiser-only is permitted |',
    'Catalog inclusion for `VISUAL_MERCHANDISER` does not imply a Store route',
    '6. `VISUAL_MERCHANDISER`-only session: `/store/checklists`',
  ]) {
    requireText(matrix, expected, 'route matrix')
  }

  requireText(appRouteSource, "visualMerchandiser: ['checklists', 'visualCampaigns', 'feed', 'settings']", 'store route source')
  requireText(
    appRouteSource,
    'if (isVisualMerchandiserOnly(input.authSummary) && !input.allowVm)',
    'store route guard',
  )
  requireText(
    appRouteSource,
    'return <StoreForbiddenRoute firstAllowedPath="/store/checklists" />',
    'store route guard',
  )
  assert.equal((appRouteSource.match(/allowVisualMerchandiser: true/g) ?? []).length, 4)
})
