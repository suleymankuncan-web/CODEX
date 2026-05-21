import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function requireText(text, expected) {
  assert.match(text, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
}

function matrixRowFor(surface) {
  const row = matrix.split('\n').find((line) => line.startsWith(`| ${surface} |`))
  assert.ok(row, `matrix must include a row for ${surface}`)
  return row
}

function splitMatrixRow(row) {
  return row
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim())
}

const matrixPath = 'docs/plans/scope-auth-regression-matrix-v1.md'
const matrix = readText(matrixPath)
const currentState = readText('current-state.md')
const activeNextActions = readText('docs/plans/active-next-actions.md')
const debtLedger = readText('docs/plans/project-debt-ledger.md')

const protectedSurfaces = [
  'Auth session context',
  'Role/scope policy',
  'Store/org read scope',
  'Reporting read scope',
  'Feed visible posts',
  'Competition read scope',
  'Checklist read model',
  'Checklist assigned-store actions',
  'Target distribution read scope',
  'Target distribution assigned-store actions',
  'Workforce lifecycle assigned-store actions',
  'Admin/integration/migration roles',
]

test('scope/auth regression matrix keeps the auth boundary explicit', () => {
  for (const phrase of [
    '# Scope/Auth Regression Matrix V1',
    'This matrix documents existing protected surfaces; it does not add a new auth model.',
    'Read scope is not action scope.',
    'Claims are not enough; DB assignment/action checks stay in place.',
    'No role semantics are changed.',
  ]) {
    requireText(matrix, phrase)
  }
})

test('scope/auth regression matrix covers read-scope surfaces and fail-closed rules', () => {
  for (const phrase of [
    'Reporting read scope',
    'Store/org read scope',
    'Feed visible posts',
    'Competition read scope',
    'Empty scope returns no data without widening to all companies.',
    'Foreign scope or explicit store filters cannot widen access outside the actor scope.',
  ]) {
    requireText(matrix, phrase)
  }
})

test('scope/auth regression matrix covers assigned-store action surfaces', () => {
  for (const phrase of [
    'Checklist assigned-store actions',
    'Target distribution assigned-store actions',
    'Workforce lifecycle assigned-store actions',
    'Assigned-store action rules remain separate from read scope.',
    'A broad read scope does not allow create, approve, complete, acknowledge, or mutate outside `assignedStoreIds`.',
  ]) {
    requireText(matrix, phrase)
  }
})

test('scope/auth regression matrix keeps route endpoint and action-scope drift columns', () => {
  for (const phrase of [
    '| Surface | Route / entrypoint | Backend boundary | Role guard | Read scope guard | Action scope guard | Positive evidence | Negative evidence |',
    'Frontend visibility check is not a backend authorization test',
    'backend role guard is not enough for store-scoped actions',
  ]) {
    requireText(matrix, phrase)
  }
})

test('scope/auth regression matrix rows keep positive and negative evidence cells', () => {
  for (const surface of protectedSurfaces) {
    const cells = splitMatrixRow(matrixRowFor(surface))
    assert.equal(cells.length, 8, `${surface} row must keep the drift guard column count`)
    assert.notEqual(cells[6], '', `${surface} row must include positive evidence`)
    assert.notEqual(cells[7], '', `${surface} row must include negative evidence`)
    assert.doesNotMatch(cells.join(' '), /\b(TBD|TODO)\b/, `${surface} row must not use placeholder evidence`)
  }
})

test('scope/auth regression matrix links protected surfaces to existing tests', () => {
  for (const phrase of [
    'backend/nestjs/test/integration/auth-scope.e2e-spec.ts',
    'backend/nestjs/src/modules/auth/auth-context.service.spec.ts',
    'backend/nestjs/src/modules/auth/auth-role-scope-policy.service.spec.ts',
    'backend/nestjs/src/modules/store-ops/infrastructure/store-ops.repository.spec.ts',
    'backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.spec.ts',
    'backend/nestjs/src/modules/store-ops/infrastructure/checklist.repository.spec.ts',
    'backend/nestjs/src/modules/store-ops/infrastructure/feed.repository.spec.ts',
    'backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.spec.ts',
    'backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.spec.ts',
  ]) {
    requireText(matrix, phrase)
  }
})

test('scope/auth regression matrix is linked from handoff and debt docs', () => {
  for (const text of [currentState, activeNextActions, debtLedger]) {
    requireText(text, matrixPath)
    requireText(text, 'Scope/Auth Regression Matrix V1')
  }
  requireText(debtLedger, '68. Scope/Auth Regression Matrix V1')
})
