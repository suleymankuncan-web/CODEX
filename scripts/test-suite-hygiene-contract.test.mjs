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
const importSplitFiles = [
  'backend/nestjs/test/integration/import-batch.e2e-spec.ts',
  'backend/nestjs/test/integration/import-batch-evidence.e2e-spec.ts',
  'backend/nestjs/test/integration/integration-sources.e2e-spec.ts',
]
const importEvidenceExpectedTestNames = [
  'returns import batch detail with row status summary',
  'returns KPI import batch lineage summary for source evidence review',
  'returns import batch reconciliation totals and rates',
  'returns import batch error rows with pagination metadata',
  'returns KPI import batch error row lineage for reconciliation',
  'approves an external employee mapping without accepting a client-supplied table name',
  'lists controlled store and employee candidates for external ID mapping',
  'lists and updates store master data for import controls',
  'returns import batch audit events',
  'returns import batch audit events from the nested audit route',
  'requeues import batches that no longer have blocking dependencies',
  'does not requeue import batches with unresolved blocking dependencies',
  'does not requeue completed import batches without retryable rows',
]
const integrationSourceExpectedTestNames = [
  'lists integration sources with filters and pagination metadata',
  'creates an integration source',
  'deactivates and reactivates an integration source',
  'returns integration lookups',
  'returns integration source audit events',
  'allows reusing source code across different entity types but rejects duplicate source code within the same entity type',
  'fails import creation with a clear error when the integration source is inactive',
  'rejects deactivating an integration source when active import batches exist',
]
const competitionRepositorySplitFiles = [
  'backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.spec.ts',
  'backend/nestjs/src/modules/store-ops/infrastructure/competition-stage-package-plan.repository.spec.ts',
  'backend/nestjs/src/modules/store-ops/infrastructure/competition-team-template.repository.spec.ts',
]
const competitionStagePackagePlanExpectedTestNames = [
  'lists stage package plan drafts for a competition',
  'saves a stage package plan draft and writes audit metadata',
  'updates a draft stage package plan and writes audit metadata',
  'rejects updating an executed stage package plan',
  'cancels a draft stage package plan and writes audit metadata',
  'submits a draft stage package plan and writes audit metadata',
  'approves a submitted stage package plan and writes audit metadata',
  'rejects a submitted stage package plan and writes audit metadata',
  'clones a rejected stage package plan as a clean draft and writes audit metadata',
  'rejects cloning a non-rejected stage package plan',
  'lists stage package plan audit events',
]
const competitionTeamTemplateExpectedTestNames = [
  'lists active team templates with store memberships',
  'can list inactive team templates when active filter is disabled',
  'creates a team template and writes store memberships plus audit',
  'deactivates a team template and writes audit metadata',
  'updates a team template and replaces store memberships with audit metadata',
  'clones a team template with source stores and audit metadata',
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
  assert.match(activeNextActions, /Closed active debts: \d+/)
  assert.match(debtLedger, /Closed active debts: \d+/)
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

test('import batch e2e is split without dropping evidence coverage', () => {
  let totalTests = 0
  let largestLineCount = 0
  let combinedText = ''

  for (const file of importSplitFiles) {
    assert.equal(existsSync(join(workspaceRoot, file)), true, `${file} must exist`)
    const text = readText(file)
    const testCount = [...text.matchAll(/\bit\s*\(/g)].length
    totalTests += testCount
    largestLineCount = Math.max(largestLineCount, text.split('\n').length)
    combinedText += `\n${text}`
  }

  assert.equal(totalTests, 32)
  assert.equal([...readText(importSplitFiles[0]).matchAll(/\bit\s*\(/g)].length, 11)
  assert.equal([...readText(importSplitFiles[1]).matchAll(/\bit\s*\(/g)].length, 13)
  assert.equal([...readText(importSplitFiles[2]).matchAll(/\bit\s*\(/g)].length, 8)
  for (const testName of importEvidenceExpectedTestNames) {
    const exactOccurrences = [...combinedText.matchAll(new RegExp(`it\\("${testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g'))].length
    assert.equal(exactOccurrences, 1, `${testName} must appear exactly once`)
  }
  for (const testName of integrationSourceExpectedTestNames) {
    const exactOccurrences = [...combinedText.matchAll(new RegExp(`it\\("${testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g'))].length
    assert.equal(exactOccurrences, 1, `${testName} must appear exactly once`)
  }
  assert.ok(largestLineCount < 1500, `largest split import test file has ${largestLineCount} lines`)
})

test('competition repository tests are split without dropping package or template coverage', () => {
  let totalTests = 0
  let largestLineCount = 0
  let combinedText = ''

  for (const file of competitionRepositorySplitFiles) {
    assert.equal(existsSync(join(workspaceRoot, file)), true, `${file} must exist`)
    const text = readText(file)
    const testCount = [...text.matchAll(/\bit\s*\(/g)].length
    totalTests += testCount
    largestLineCount = Math.max(largestLineCount, text.split('\n').length)
    combinedText += `\n${text}`
  }

  assert.equal(totalTests, 27)
  assert.equal([...readText(competitionRepositorySplitFiles[0]).matchAll(/\bit\s*\(/g)].length, 10)
  assert.equal([...readText(competitionRepositorySplitFiles[1]).matchAll(/\bit\s*\(/g)].length, 11)
  assert.equal([...readText(competitionRepositorySplitFiles[2]).matchAll(/\bit\s*\(/g)].length, 6)
  for (const testName of competitionStagePackagePlanExpectedTestNames) {
    const exactOccurrences = [...combinedText.matchAll(new RegExp(`it\\("${testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g'))].length
    assert.equal(exactOccurrences, 1, `${testName} must appear exactly once`)
  }
  for (const testName of competitionTeamTemplateExpectedTestNames) {
    const exactOccurrences = [...combinedText.matchAll(new RegExp(`it\\("${testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g'))].length
    assert.equal(exactOccurrences, 1, `${testName} must appear exactly once`)
  }
  assert.ok(
    largestLineCount < 1500,
    `largest split competition repository test file has ${largestLineCount} lines`,
  )
})
