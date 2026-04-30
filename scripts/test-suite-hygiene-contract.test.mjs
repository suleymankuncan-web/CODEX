import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function requireText(text, expected) {
  assert.match(text, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
}

const planPath = 'docs/plans/test-suite-hygiene-v1.md'
const plan = readText(planPath)
const currentState = readText('current-state.md')
const activeNextActions = readText('docs/plans/active-next-actions.md')
const debtLedger = readText('docs/plans/project-debt-ledger.md')
const authSplitFiles = [
  'backend/nestjs/test/integration/auth-pilot-user-bindings.e2e-spec.ts',
  'backend/nestjs/test/integration/auth-role-assignments.e2e-spec.ts',
  'backend/nestjs/test/integration/auth-action-store-assignments.e2e-spec.ts',
  'backend/nestjs/test/integration/auth-user-accounts.e2e-spec.ts',
  'backend/nestjs/test/integration/auth-role-permissions.e2e-spec.ts',
  'backend/nestjs/test/integration/auth-lookups.e2e-spec.ts',
]
const authExpectedTestNames = [
  'creates a pilot user binding with HR admin access',
  'rejects pilot user binding when provider subject is already linked',
  'creates a role assignment for a user',
  'rejects duplicate active role assignments',
  'creates an action store assignment for a user',
  'lists action store assignments with store context',
  'deactivates an action store assignment',
  'returns action store assignment audit events',
  'rejects region-scoped role assignments without company context',
  'rejects company-scoped role assignments with narrower scope identifiers',
  'lists active role assignments with pagination metadata',
  'filters role assignments by role, scope, active state, and user',
  'returns role assignment audit events',
  'deactivates an active role assignment',
  'rejects deactivation when the role assignment is already inactive',
  'creates a user account',
  'lists user accounts with filters and pagination metadata',
  'deactivates a user account',
  'reactivates a user account',
  'returns user account audit events',
  'rejects reactivation when the user account is already active',
  'lists role catalog entries with permission visibility',
  'lists permission catalog entries',
  'grants a permission to a role',
  'rejects duplicate permission grants for the same role',
  'revokes a permission from a role',
  'returns not found when revoking a missing role permission',
  'returns auth lookups',
]

test('test suite hygiene keeps the no-coverage-loss boundary', () => {
  for (const phrase of [
    '# Test Suite Hygiene V1',
    'No behavior coverage is deleted in this pass.',
    'Production code is not changed.',
    'Test count must stay stable unless a duplicate test is explicitly documented.',
    'Root `npm.cmd run check:release` remains the release gate.',
  ]) {
    requireText(plan, phrase)
  }
})

test('test suite hygiene starts with the auth role assignment split', () => {
  for (const phrase of [
    'First safe slice: split `backend/nestjs/test/integration/auth-role-assignments.e2e-spec.ts`.',
    'auth-pilot-user-bindings.e2e-spec.ts',
    'auth-role-assignments.e2e-spec.ts',
    'auth-action-store-assignments.e2e-spec.ts',
    'auth-user-accounts.e2e-spec.ts',
    'auth-role-permissions.e2e-spec.ts',
    'auth-lookups.e2e-spec.ts',
  ]) {
    requireText(plan, phrase)
  }
})

test('test suite hygiene records risk and no-go rules', () => {
  for (const phrase of [
    'Project scatter risk: low if we split mechanically and keep the same assertions.',
    'Primary risk: accidentally dropping a test case during file movement.',
    'No-Go: any targeted auth suite failure.',
    'No-Go: root release gate failure.',
    'No-Go: broad helper abstraction that hides business expectations.',
  ]) {
    requireText(plan, phrase)
  }
})

test('test suite hygiene is linked from handoff and debt docs', () => {
  for (const text of [currentState, activeNextActions, debtLedger]) {
    requireText(text, planPath)
    requireText(text, 'Test Suite Hygiene V1')
  }
  requireText(activeNextActions, 'Closed active debts: 70')
  requireText(debtLedger, 'Closed active debts: 70')
  requireText(debtLedger, '70. Test Suite Hygiene V1')
})

test('auth admin integration tests are split without dropping test cases', () => {
  let totalTests = 0
  let largestLineCount = 0
  let combinedText = ''

  for (const file of authSplitFiles) {
    assert.equal(existsSync(join(workspaceRoot, file)), true, `${file} must exist`)
    const text = readText(file)
    const testCount = [...text.matchAll(/\bit\s*\(/g)].length
    totalTests += testCount
    largestLineCount = Math.max(largestLineCount, text.split('\n').length)
    combinedText += `\n${text}`
  }

  assert.equal(totalTests, 28)
  for (const testName of authExpectedTestNames) {
    const exactOccurrences = [...combinedText.matchAll(new RegExp(`it\\("${testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g'))].length
    assert.equal(exactOccurrences, 1, `${testName} must appear exactly once`)
  }
  assert.ok(largestLineCount < 1500, `largest split auth test file has ${largestLineCount} lines`)
})
