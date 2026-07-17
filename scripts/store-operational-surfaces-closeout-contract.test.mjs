import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import test from 'node:test'

const workspaceRoot = process.cwd()
const frontendRoot = join(workspaceRoot, 'admin-web')
const frontendSourceRoot = join(frontendRoot, 'src')
const evidenceRoot = join(
  workspaceRoot,
  'docs/evidence/store-operational-surfaces-command-canvas',
)

const deletedOwners = [
  'admin-web/src/pages/store-approvals-submitted-targets-panel.tsx',
  'admin-web/src/pages/store-approvals-target-approval-ledger.tsx',
  'admin-web/src/pages/store-approvals-target-request-form.tsx',
  'admin-web/src/pages/store-approvals-workbench.tsx',
  'admin-web/src/pages/store-workforce-filter-select.tsx',
  'admin-web/src/pages/store-workforce-headcount.ts',
  'admin-web/src/pages/store-workforce-model.ts',
  'admin-web/src/pages/store-workforce-region-detail-panes.tsx',
  'admin-web/src/pages/store-workforce-region-metrics.tsx',
  'admin-web/src/pages/store-workforce-region-model.ts',
  'admin-web/src/pages/store-workforce-region-view-model.ts',
  'admin-web/src/pages/store-workforce-region-view.tsx',
  'admin-web/src/pages/store-workforce-store-manager-presentation.tsx',
  'admin-web/src/pages/store-workforce-store-manager-view-model.ts',
  'admin-web/src/styles/store-workforce-command-list.css',
  'admin-web/src/styles/store-workforce-command-modal.css',
  'admin-web/src/styles/store-workforce-command.css',
  'admin-web/src/features/store-tasks/store-tasks-command-center-model.ts',
  'admin-web/src/features/store-tasks/store-tasks-command-center.css',
  'admin-web/src/features/store-tasks/store-tasks-workbench.tsx',
]

const obsoleteReferences = [
  'store-approvals-workbench',
  'store-approvals-submitted-targets-panel',
  'store-approvals-target-approval-ledger',
  'store-approvals-target-request-form',
  'store-workforce-region-detail-panes',
  'store-workforce-region-metrics',
  'store-workforce-region-view-model',
  'store-workforce-region-view',
  'store-workforce-store-manager-presentation',
  'store-workforce-store-manager-view-model',
  'store-workforce-command-list.css',
  'store-workforce-command-modal.css',
  'store-tasks-command-center-model',
  'store-tasks-command-center.css',
  'store-tasks-workbench',
]

const routes = [
  { path: '/store/kpis', owner: 'StoreKpiHighlightsPage' },
  { path: '/store/approvals', owner: 'StoreApprovalsPage' },
  { path: '/store/workforce', owner: 'StoreWorkforcePage' },
  { path: '/store/tasks', owner: 'StoreTasksPage' },
]

test('PR7 zero-reference manifest keeps every former operational owner deleted', () => {
  for (const file of deletedOwners) {
    assert.equal(existsSync(join(workspaceRoot, file)), false, file)
  }

  const source = collectText(frontendSourceRoot)
  for (const token of obsoleteReferences) {
    assert.doesNotMatch(source, new RegExp(escapeRegExp(token), 'u'), token)
  }
})

test('PR7 keeps exactly one registered production owner for every operational route', () => {
  const registry = readFileSync(
    join(frontendSourceRoot, 'app/store-route-registry.ts'),
    'utf8',
  )
  const shell = readFileSync(join(frontendSourceRoot, 'app/store-shell.tsx'), 'utf8')

  for (const route of routes) {
    assert.equal(count(registry, `path: '${route.path}'`), 1, route.path)
    assert.equal(count(shell, `return <${route.owner}`), 1, route.owner)
  }
})

test('PR7 closeout records a separate prototype parity decision for all four routes', () => {
  const closeout = readFileSync(join(evidenceRoot, 'closeout-v1.md'), 'utf8')
  for (const label of ['KPI Özetleri', 'Talep Merkezi', 'Norm Kadro', 'Görevler']) {
    assert.match(closeout, new RegExp(`Prototype parity: PASS[^\\n]*${label}`, 'u'), label)
  }
  assert.match(closeout, /Report Viewer[^.\n]*read-only/u)
  assert.match(
    closeout,
    /no Labs helper or fixture is present in the\s+production source or bundle/u,
  )
})

function collectText(root) {
  return walk(root)
    .filter((path) => /\.(?:css|ts|tsx)$/u.test(path))
    .map((path) => `\n/* ${relative(root, path)} */\n${readFileSync(path, 'utf8')}`)
    .join('')
}

function walk(root) {
  return readdirSync(root)
    .flatMap((name) => {
      const path = join(root, name)
      return statSync(path).isDirectory() ? walk(path) : [path]
    })
}

function count(value, token) {
  return value.split(token).length - 1
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}
