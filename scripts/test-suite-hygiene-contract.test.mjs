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
const currentState = readText('docs/history/current-state-through-pr-913-2026-07-09.md')
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
  'rejects HR admin pilot user bindings outside the actor company scope',
  'rejects pilot user binding when provider subject is already linked',
  'creates a role assignment for a user',
  'creates an HR admin role assignment for a company-scoped user',
  'rejects duplicate active role assignments',
  'rejects region-scoped role assignments when the region belongs to another company',
  'rejects store-scoped role assignments when the store hierarchy does not match',
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
  'keeps user account total count independent from pagination offset',
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
  'searches active auth users by username email or provider subject',
  'escapes wildcard characters in auth user lookup queries',
  'rejects too-short auth user lookup queries',
  'rejects above-max auth user lookup limits',
  'searches active stores by code name or region',
  'rejects too-short store lookup queries',
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
  'does not expose or retry import batches outside the actor company scope',
  'approves an external employee mapping without accepting a client-supplied table name',
  'rejects external ID mapping approval outside the actor company scope',
  'lists controlled store and employee candidates for external ID mapping',
  'lists and updates store master data for import controls',
  'does not update store master data outside the actor company scope',
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
const snapshotRunSplitFiles = [
  'backend/nestjs/test/integration/snapshot-run.e2e-spec.ts',
  'backend/nestjs/test/integration/snapshot-run-read-models.e2e-spec.ts',
]
const snapshotRunCommandExpectedTestNames = [
  'creates a snapshot run and dispatches snapshot generation',
  'reruns a failed snapshot by creating a new snapshot run',
  'returns rerun governance in snapshot detail and blocks duplicate active reruns',
  'rejects rerun when an active rerun already exists',
]
const snapshotRunReadModelExpectedTestNames = [
  'lists snapshot runs with health state and pagination metadata',
  'returns snapshot run detail with cards and rerun state',
  'returns snapshot run audit events',
  'returns snapshot run summary with latest critical pointers',
  'returns snapshot run overview with action totals and stuck pointers',
  'returns snapshot needs-action queue with retry-ready and stuck runs',
  'returns snapshot lookups',
  'returns snapshot run dependencies',
  'returns snapshot run lineage',
]
const competitionServiceSplitFiles = [
  'backend/nestjs/src/modules/store-ops/application/competition.service.spec.ts',
  'backend/nestjs/src/modules/store-ops/application/competition-team-template.service.spec.ts',
]
const competitionServiceTeamTemplateExpectedTestNames = [
  'lists active competition team templates',
  'lists inactive competition team templates when requested',
  'rejects team template creation without stores',
  'creates a reusable competition team template',
  'deactivates a competition team template',
  'updates a competition team template with unique store membership',
  'rejects team template update without stores',
  'clones a competition team template',
]
const competitionServiceCoreExpectedTestNames = [
  'creates a stage with a format preset code',
  'creates a stage package through the repository',
  'lists saved stage package plans for a competition',
  'saves a stage package plan draft without creating stages',
  'executes a saved stage package plan through the repository',
  'updates a draft stage package plan through the repository',
  'submits a draft stage package plan for review',
  'approves a submitted stage package plan',
  'rejects a submitted stage package plan',
  'clones a rejected stage package plan as a new draft',
  'cancels a draft stage package plan through the repository',
  'lists stage package plan audit events',
  'creates a draft competition through the repository',
  'rejects finalization with open warnings unless override justification is written',
  'finalizes cleanly without persisting override note when no warnings remain',
  'finalizes with overridden state when warnings exist and justification is present',
  'redacts out-of-scope team stores while returning scoped store contributions',
  'keeps store manager competition detail limited to assigned stores even when company scope is present',
  'redacts team stores from other companies for company-scoped competition detail',
]
const authScopeSplitFiles = [
  'backend/nestjs/test/integration/auth-scope.e2e-spec.ts',
  'backend/nestjs/test/integration/auth-action-scope.e2e-spec.ts',
]
const authScopeReadAndSessionExpectedTestNames = [
  'blocks company-scoped access to store headcount gap without explicit store scope',
  'allows store-scoped access to headcount gap for the assigned store',
  'rejects import batch creation when authenticated user lacks integration role',
  'rejects snapshot run creation when authenticated user lacks snapshot role',
  'rejects migration runs when authenticated user lacks super admin role',
  'allows reporting reads for report viewer role',
  'allows reporting reads with JWT auth mode',
  'returns authenticated mock session context',
  'returns authenticated JWT session context',
  'keeps region scope restrictions on workforce reporting even with explicit store filter',
  'keeps region scope restrictions on turnover reporting even with explicit store filter',
  'rejects invalid JWT tokens with 401',
]
const authActionScopeExpectedTestNames = [
  'rejects checklist creation when authenticated user is out of store scope',
  'accepts seeded PostgreSQL UUID store ids for target distribution creation',
  'rejects target distribution creation outside assigned action stores even with broad read scope',
  'rejects target distribution approval for report viewer role',
  'rejects target distribution approval outside assigned action stores',
  'rejects checklist acknowledgement outside assigned action stores',
]
const masterDataBootstrapServiceFiles = [
  'backend/nestjs/src/modules/integration/application/master-data-bootstrap-staging.service.spec.ts',
  'backend/nestjs/src/modules/integration/application/master-data-bootstrap-read-models.service.spec.ts',
  'backend/nestjs/src/modules/integration/application/master-data-bootstrap-validation.service.spec.ts',
  'backend/nestjs/src/modules/integration/application/master-data-bootstrap-promotion.service.spec.ts',
]
const masterDataBootstrapServiceExpectedTestNames = [
  'stages bootstrap rows with normalized references and stable row hashes',
  'normalizes personnel national id evidence into a hash for preflight checks',
  'stages personnel rows with normalized promotion metadata',
  'stages store rows with normalized promotion metadata',
  'validates personnel rows without promoting staged data',
  'allows personnel rows without national id evidence when required live-write metadata is present',
  'marks unknown store types as review rows for store bootstrap batches',
  'marks new store rows without region code as review rows',
  'marks new store rows with unknown region code as review rows',
  'validates new store rows when region code resolves',
  'marks normalized duplicate store codes as review issues before store promotion',
  'marks normalized duplicate personnel seller codes as review issues',
  'marks duplicate personnel national id hashes as review issues',
  'marks existing employee seller code and national id mismatches as review issues',
  'lists bootstrap batches with derived readiness and next action',
  'lists bootstrap rows for review after checking scoped batch access',
  'reports pending rows as needing validation before promotion',
  'reports invalid and needs-review rows as blocking promotion',
  'reports ready rows when the batch is ready to promote',
  'reports promoted rows as already promoted and not ready again',
  'rejects personnel batch store promotion',
  'rejects store promotion before the batch is ready',
  'promotes only ready store rows and skips already promoted rows',
  'rejects stale store promotion when any non-promoted row is not ready',
  'rejects store batch personnel promotion',
  'rejects personnel promotion before the batch is ready',
  'promotes only ready personnel rows and skips already promoted rows',
  'rejects stale personnel promotion when any non-promoted row is not ready',
  'rejects ready personnel promotion when required evidence is missing',
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

  assert.equal(totalTests, 44)
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

  assert.equal(totalTests, 35)
  assert.equal([...readText(importSplitFiles[0]).matchAll(/\bit\s*\(/g)].length, 11)
  assert.equal([...readText(importSplitFiles[1]).matchAll(/\bit\s*\(/g)].length, 16)
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

  assert.equal(totalTests, 29)
  assert.equal([...readText(competitionRepositorySplitFiles[0]).matchAll(/\bit\s*\(/g)].length, 12)
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

test('snapshot run e2e tests are split without dropping read-model or command coverage', () => {
  let totalTests = 0
  let largestLineCount = 0
  let combinedText = ''

  for (const file of snapshotRunSplitFiles) {
    assert.equal(existsSync(join(workspaceRoot, file)), true, `${file} must exist`)
    const text = readText(file)
    const testCount = [...text.matchAll(/\bit\s*\(/g)].length
    totalTests += testCount
    largestLineCount = Math.max(largestLineCount, text.split('\n').length)
    combinedText += `\n${text}`
  }

  assert.equal(totalTests, 13)
  assert.equal([...readText(snapshotRunSplitFiles[0]).matchAll(/\bit\s*\(/g)].length, 4)
  assert.equal([...readText(snapshotRunSplitFiles[1]).matchAll(/\bit\s*\(/g)].length, 9)
  for (const testName of snapshotRunCommandExpectedTestNames) {
    const exactOccurrences = [...combinedText.matchAll(new RegExp(`it\\("${testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g'))].length
    assert.equal(exactOccurrences, 1, `${testName} must appear exactly once`)
  }
  for (const testName of snapshotRunReadModelExpectedTestNames) {
    const exactOccurrences = [...combinedText.matchAll(new RegExp(`it\\("${testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g'))].length
    assert.equal(exactOccurrences, 1, `${testName} must appear exactly once`)
  }
  assert.ok(
    largestLineCount < 1500,
    `largest split snapshot run test file has ${largestLineCount} lines`,
  )
})

test('competition service tests are split without dropping team-template or core coverage', () => {
  let totalTests = 0
  let largestLineCount = 0
  let combinedText = ''

  for (const file of competitionServiceSplitFiles) {
    assert.equal(existsSync(join(workspaceRoot, file)), true, `${file} must exist`)
    const text = readText(file)
    const testCount = [...text.matchAll(/\bit\s*\(/g)].length
    totalTests += testCount
    largestLineCount = Math.max(largestLineCount, text.split('\n').length)
    combinedText += `\n${text}`
  }

  assert.equal(totalTests, 27)
  assert.equal([...readText(competitionServiceSplitFiles[0]).matchAll(/\bit\s*\(/g)].length, 19)
  assert.equal([...readText(competitionServiceSplitFiles[1]).matchAll(/\bit\s*\(/g)].length, 8)
  for (const testName of competitionServiceTeamTemplateExpectedTestNames) {
    const exactOccurrences = [...combinedText.matchAll(new RegExp(`it\\("${testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g'))].length
    assert.equal(exactOccurrences, 1, `${testName} must appear exactly once`)
  }
  for (const testName of competitionServiceCoreExpectedTestNames) {
    const exactOccurrences = [...combinedText.matchAll(new RegExp(`it\\("${testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g'))].length
    assert.equal(exactOccurrences, 1, `${testName} must appear exactly once`)
  }
  assert.ok(
    largestLineCount < 1500,
    `largest split competition service test file has ${largestLineCount} lines`,
  )
})

test('auth scope integration tests are split without dropping read/session or action-scope coverage', () => {
  let totalTests = 0
  let largestLineCount = 0
  let combinedText = ''

  for (const file of authScopeSplitFiles) {
    assert.equal(existsSync(join(workspaceRoot, file)), true, `${file} must exist`)
    const text = readText(file)
    const testCount = [...text.matchAll(/\bit\s*\(/g)].length
    totalTests += testCount
    largestLineCount = Math.max(largestLineCount, text.split('\n').length)
    combinedText += `\n${text}`
  }

  assert.equal(totalTests, 18)
  assert.equal([...readText(authScopeSplitFiles[0]).matchAll(/\bit\s*\(/g)].length, 12)
  assert.equal([...readText(authScopeSplitFiles[1]).matchAll(/\bit\s*\(/g)].length, 6)
  for (const testName of authScopeReadAndSessionExpectedTestNames) {
    const exactOccurrences = [...combinedText.matchAll(new RegExp(`it\\("${testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g'))].length
    assert.equal(exactOccurrences, 1, `${testName} must appear exactly once`)
  }
  for (const testName of authActionScopeExpectedTestNames) {
    const exactOccurrences = [...combinedText.matchAll(new RegExp(`it\\("${testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g'))].length
    assert.equal(exactOccurrences, 1, `${testName} must appear exactly once`)
  }
  assert.ok(
    largestLineCount < 1500,
    `largest split auth scope test file has ${largestLineCount} lines`,
  )
})

test('master data bootstrap service coverage is frozen before split', () => {
  let totalTests = 0
  let combinedText = ''

  for (const file of masterDataBootstrapServiceFiles) {
    assert.equal(existsSync(join(workspaceRoot, file)), true, `${file} must exist`)
    const text = readText(file)
    totalTests += [...text.matchAll(/\bit\s*\(/g)].length
    combinedText += `\n${text}`
  }

  assert.equal(totalTests, 29)
  assert.equal([...readText(masterDataBootstrapServiceFiles[0]).matchAll(/\bit\s*\(/g)].length, 4)
  assert.equal([...readText(masterDataBootstrapServiceFiles[1]).matchAll(/\bit\s*\(/g)].length, 6)
  assert.equal([...readText(masterDataBootstrapServiceFiles[2]).matchAll(/\bit\s*\(/g)].length, 10)
  assert.equal([...readText(masterDataBootstrapServiceFiles[3]).matchAll(/\bit\s*\(/g)].length, 9)
  for (const testName of masterDataBootstrapServiceExpectedTestNames) {
    const exactOccurrences = [...combinedText.matchAll(new RegExp(`it\\("${testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g'))].length
    assert.equal(exactOccurrences, 1, `${testName} must appear exactly once`)
  }
})
