import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const trackedRoots = ['admin-web/src/', 'backend/nestjs/src/', 'scripts/']
const trackedExtensions = new Set(['.css', '.js', '.jsx', '.mjs', '.ts', '.tsx'])
const generatedPrefixes = ['admin-web/src/generated/']

const oversizedBaseline = new Map([
  ['backend/nestjs/src/openapi/generate-openapi.ts', 5169],
  ['admin-web/src/pages/MasterDataBootstrapPage.tsx', 1568],
  ['backend/nestjs/src/modules/store-ops/application/reporting.service.ts', 1265],
  ['scripts/generate-system-flow.mjs', 1438],
  ['backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.ts', 1245],
  ['admin-web/src/pages/IntegrationDashboardPage.tsx', 1388],
  ['admin-web/src/pages/ImportBatchDetailPage.tsx', 1423],
  ['admin-web/src/pages/AdminKpiConfigPage.tsx', 1373],
  ['backend/nestjs/src/shared/openapi-baseline.contract.spec.ts', 1330],
  ['backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.ts', 906],
  ['backend/nestjs/src/modules/integration/infrastructure/master-data-bootstrap.repository.ts', 1179],
  ['admin-web/src/pages/store-my-performance-model.ts', 1096],
  ['admin-web/src/styles/store-approvals-ledger.css', 976],
  ['admin-web/src/features/auth/AuthDashboardSections.tsx', 937],
  ['backend/nestjs/src/modules/auth/auth-admin.service.ts', 936],
  ['backend/nestjs/src/modules/integration/web/integration.controller.ts', 899],
  ['admin-web/src/features/competitions/StageBuilderForm.tsx', 861],
  ['admin-web/src/pages/store-my-performance-sections.tsx', 865],
  ['backend/nestjs/src/modules/integration/infrastructure/import-batch-read.repository.ts', 858],
  ['admin-web/src/features/competitions/stage-builder-package-section.tsx', 802],
  ['backend/nestjs/src/modules/store-ops/infrastructure/snapshot-operations.repository.ts', 842],
  ['admin-web/src/pages/OperationsControlTowerPage.tsx', 941],
  ['admin-web/src/pages/store-checklists-logic.ts', 711],
  ['admin-web/src/features/localization/messages/competition.ts', 601],
])

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' })
}

function trackedFiles() {
  return git(['ls-files', '-z']).split('\0').filter(Boolean)
}

function extensionOf(path) {
  const match = path.match(/\.[^.]+$/)
  return match?.[0] ?? ''
}

function isTrackedSource(path) {
  return trackedRoots.some((root) => path.startsWith(root)) && trackedExtensions.has(extensionOf(path))
}

function isGenerated(path) {
  return generatedPrefixes.some((prefix) => path.startsWith(prefix))
}

function lineCount(path) {
  const text = readFileSync(path, 'utf8')
  if (text.length === 0) {
    return 0
  }

  const lines = text.split(/\r\n|\r|\n/)
  return lines.at(-1) === '' ? lines.length - 1 : lines.length
}

function standardBudget(path) {
  if (!isTrackedSource(path) || isGenerated(path)) {
    return null
  }

  if (path.endsWith('.spec.ts') || path.endsWith('.spec.tsx') || path.endsWith('.test.mjs')) {
    return 1200
  }

  if (path.startsWith('scripts/')) {
    return 900
  }

  if (path.endsWith('index.css')) {
    return 250
  }

  if (path.endsWith('.css')) {
    return 700
  }

  if (path.startsWith('admin-web/src/pages/') && path.endsWith('.tsx')) {
    return 900
  }

  if (path.endsWith('.tsx')) {
    return 700
  }

  if (path.endsWith('.controller.ts')) {
    return 600
  }

  if (path.endsWith('.service.ts')) {
    return 900
  }

  if (path.endsWith('.repository.ts')) {
    return 1000
  }

  return 600
}

function budgetFor(path) {
  const standard = standardBudget(path)
  if (standard === null) {
    return null
  }

  return {
    maxLines: oversizedBaseline.get(path) ?? standard,
    standard,
    isFrozenBaseline: oversizedBaseline.has(path),
  }
}

function formatViolation({ path, lines, maxLines, standard, isFrozenBaseline }) {
  const mode = isFrozenBaseline ? `frozen baseline ${maxLines}, standard ${standard}` : `standard ${standard}`
  return `${path}: ${lines} lines exceeds ${mode}`
}

test('file size guard policy is recorded in handoff docs', () => {
  const discipline = readFileSync('discipline.md', 'utf8')
  const currentState = readFileSync('current-state.md', 'utf8')
  const refactorInventory = readFileSync('docs/plans/refactor-completion-inventory-v1.md', 'utf8')

  for (const text of [discipline, currentState, refactorInventory]) {
    assert.match(text, /File Size Guard V1/)
  }

  assert.match(discipline, /scripts\/file-size-guard\.test\.mjs/)
})

test('active source files stay within size budgets or frozen oversized baselines', () => {
  const violations = []

  for (const path of trackedFiles()) {
    const budget = budgetFor(path)
    if (budget === null) {
      continue
    }

    const lines = lineCount(path)
    if (lines > budget.maxLines) {
      violations.push(formatViolation({ path, lines, ...budget }))
    }
  }

  assert.deepEqual(violations, [])
})

test('oversized baseline entries point to tracked files and real guard exceptions', () => {
  const tracked = new Set(trackedFiles())
  const stale = []
  const staleCaps = []
  const unnecessary = []

  for (const [path, frozenLimit] of oversizedBaseline) {
    if (!tracked.has(path) || !existsSync(path)) {
      stale.push(path)
      continue
    }

    const standard = standardBudget(path)
    const lines = lineCount(path)
    if (standard !== null && lines < frozenLimit && lines > standard) {
      staleCaps.push(`${path}: ${lines} lines is below frozen baseline ${frozenLimit}; lower the baseline cap`)
    }

    if (standard !== null && lines <= standard && frozenLimit > standard) {
      unnecessary.push(`${path}: ${lines} lines is now within standard ${standard}`)
    }
  }

  assert.deepEqual(stale, [])
  assert.deepEqual(staleCaps, [])
  assert.deepEqual(unnecessary, [])
})
