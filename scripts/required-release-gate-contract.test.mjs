import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  RELEASE_REHEARSAL_WORKFLOW_PATH,
  evaluateObservedWorkflowRun,
  evaluateRequiredReleaseGateFinal,
  isRetriableCheckRunsError,
  parseNameStatusFiles,
  selectRequiredReleaseGateScope,
} from './required-release-gate.mjs'

const workspaceRoot = join(import.meta.dirname, '..')

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

const observedIdentity = {
  prNumber: 1011,
  baseSha: 'base-sha',
  headSha: 'head-sha',
}

function workflowRun(overrides = {}) {
  const run = {
    id: 100,
    run_number: 10,
    run_attempt: 1,
    path: RELEASE_REHEARSAL_WORKFLOW_PATH,
    event: 'pull_request',
    head_sha: observedIdentity.headSha,
    status: 'completed',
    conclusion: 'success',
    pull_requests: [{
      number: observedIdentity.prNumber,
      head: { sha: observedIdentity.headSha },
      base: { sha: observedIdentity.baseSha },
    }],
  }
  return { ...run, ...overrides }
}

test('docs/process-only scope uses local diff and root script contracts without a release child', () => {
  const scope = selectRequiredReleaseGateScope([
    '.codex/agents/luna-max.toml',
    '.codex/agents/problem-solver-high.toml',
    '.codex/config.toml',
    'AGENTS.md',
    'docs/plans/project-analysis-implementation-plan-v1.md',
    'current-state.md',
    'scripts/affected-verification-selector.mjs',
    'scripts/affected-verification-selector.test.mjs',
    'scripts/current-state-handoff-contract.test.mjs',
    'scripts/project-control-registries-contract.test.mjs',
  ])

  assert.equal(scope.mode, 'docs')
  assert.equal(scope.runRootRelease, false)
  assert.equal(scope.observeRehearsal, false)
  assert.equal(scope.runOnpremImageProof, false)
  assert.equal(scope.affectedVerification.fullReleaseRequired, false)
})

test('only explicitly named docs guard scripts bypass the full release', () => {
  const docsGuard = selectRequiredReleaseGateScope([
    'scripts/current-state-handoff-contract.test.mjs',
  ])
  const unknownScript = selectRequiredReleaseGateScope([
    'scripts/new-doc-looking-contract.test.mjs',
  ])

  assert.equal(docsGuard.mode, 'docs')
  assert.equal(docsGuard.runRootRelease, false)
  assert.equal(unknownScript.mode, 'release')
  assert.equal(unknownScript.runRootRelease, true)
})

test('frontend scope runs the canonical root release workflow once', () => {
  const scope = selectRequiredReleaseGateScope([
    'admin-web/src/features/store-checklist/checklist-page.tsx',
  ])

  assert.equal(scope.mode, 'release')
  assert.equal(scope.runRootRelease, true)
  assert.equal(scope.observeRehearsal, false)
  assert.equal(scope.runOnpremImageProof, true)
  assert.ok(scope.affectedVerification.commands.includes('npm.cmd --prefix admin-web run lint'))
  assert.ok(scope.affectedVerification.commands.includes('npm.cmd --prefix admin-web run build'))
})

test('pinned on-prem license tooling selects the fail-closed image proof', () => {
  const scope = selectRequiredReleaseGateScope(['tools/onprem-license/package-lock.json'])
  assert.equal(scope.mode, 'release')
  assert.equal(scope.runRootRelease, true)
  assert.equal(scope.runOnpremImageProof, true)
})

test('API-contract docs cannot be mistaken for docs/process-only scope', () => {
  const scope = selectRequiredReleaseGateScope(['docs/api/openapi.json'])

  assert.equal(scope.mode, 'release')
  assert.equal(scope.runRootRelease, true)
  assert.ok(scope.affectedVerification.commands.includes('npm.cmd run check:release'))
})

test('backend, database, and infrastructure scope waits for the rehearsal child', () => {
  for (const file of [
    'backend/nestjs/src/modules/auth/auth.service.ts',
    'db/migrations/999_example.sql',
    'infra/compose/release.yml',
  ]) {
    const scope = selectRequiredReleaseGateScope([file])

    assert.equal(scope.mode, 'release')
    assert.equal(scope.runRootRelease, true)
    assert.equal(scope.observeRehearsal, true)
    assert.equal(scope.runOnpremImageProof, file.startsWith('backend/nestjs/') || file.startsWith('infra/onprem/'))
  }
})

test('unknown paths fail safe into the official root release gate', () => {
  const scope = selectRequiredReleaseGateScope(['tooling/custom-release-policy.json'])

  assert.equal(scope.mode, 'release')
  assert.equal(scope.runRootRelease, true)
  assert.equal(scope.observeRehearsal, false)
})

test('empty and rename-aware change lists cannot hide a release-impacting path', () => {
  const emptyScope = selectRequiredReleaseGateScope([])
  assert.equal(emptyScope.mode, 'unsupported')

  const renamedFiles = parseNameStatusFiles(
    'R100\tadmin-web/src/legacy.tsx\tdocs/legacy.tsx\n',
  )
  const renameScope = selectRequiredReleaseGateScope(renamedFiles)
  assert.equal(renameScope.mode, 'release')
})

test('observer accepts only an exact workflow, event, PR, base, and head identity', () => {
  assert.equal(evaluateObservedWorkflowRun({ workflowRuns: [workflowRun()], ...observedIdentity }).state, 'success')

  const mismatches = [
    workflowRun({ path: '.github/workflows/other.yml' }),
    workflowRun({ event: 'workflow_dispatch' }),
    workflowRun({ head_sha: 'other-head' }),
    workflowRun({ pull_requests: [{ number: 1012, head: { sha: 'head-sha' }, base: { sha: 'base-sha' } }] }),
    workflowRun({ pull_requests: [{ number: 1011, head: { sha: 'other-head' }, base: { sha: 'base-sha' } }] }),
    workflowRun({ pull_requests: [{ number: 1011, head: { sha: 'head-sha' }, base: { sha: 'other-base' } }] }),
  ]
  for (const run of mismatches) {
    assert.equal(evaluateObservedWorkflowRun({ workflowRuns: [run], ...observedIdentity }).state, 'pending')
  }
})

test('observer uses only the latest eligible run attempt and never reuses stale success', () => {
  const oldSuccess = workflowRun({ id: 100, run_number: 10, run_attempt: 1 })
  for (const status of ['queued', 'in_progress', 'requested', 'waiting', 'pending']) {
    const latest = workflowRun({ id: 101, run_number: 11, status, conclusion: null })
    assert.equal(evaluateObservedWorkflowRun({ workflowRuns: [oldSuccess, latest], ...observedIdentity }).state, 'pending')
  }
  for (const conclusion of ['failure', 'cancelled', 'timed_out', 'skipped']) {
    const latest = workflowRun({ id: 102, run_number: 11, conclusion })
    assert.equal(evaluateObservedWorkflowRun({ workflowRuns: [oldSuccess, latest], ...observedIdentity }).state, 'failure')
  }

  const newerAttempt = workflowRun({ id: 103, run_number: 10, run_attempt: 2 })
  assert.equal(evaluateObservedWorkflowRun({ workflowRuns: [oldSuccess, newerAttempt], ...observedIdentity }).state, 'success')
})

test('observer fails malformed workflow-run evidence closed', () => {
  assert.equal(evaluateObservedWorkflowRun({ workflowRuns: [], ...observedIdentity }).state, 'pending')
  assert.equal(evaluateObservedWorkflowRun({ workflowRuns: null, ...observedIdentity }).state, 'failure')
  assert.equal(
    evaluateObservedWorkflowRun({ workflowRuns: [workflowRun({ run_attempt: null })], ...observedIdentity }).state,
    'failure',
  )
})

test('aggregate accepts only applicable children and fails on a selected child failure', () => {
  const docsFinal = evaluateRequiredReleaseGateFinal({
    mode: 'docs',
    scopeResult: 'success',
    docsResult: 'success',
    rootReleaseResult: 'skipped',
    rehearsalObserverResult: 'skipped',
    observeRehearsal: false,
    runOnpremImageProof: false,
    onpremImageProofResult: 'skipped',
  })
  assert.equal(docsFinal.ok, true)

  const releaseFinal = evaluateRequiredReleaseGateFinal({
    mode: 'release',
    scopeResult: 'success',
    docsResult: 'skipped',
    rootReleaseResult: 'success',
    rehearsalObserverResult: 'failure',
    observeRehearsal: true,
    runOnpremImageProof: true,
    onpremImageProofResult: 'failure',
  })
  assert.equal(releaseFinal.ok, false)
  assert.deepEqual(releaseFinal.failures, ['release-rehearsal-observer=failure', 'onprem-image-proof=failure'])
})

test('aggregate rejects cancelled, timed out, skipped, and missing selected children', () => {
  for (const rootReleaseResult of ['cancelled', 'timed_out', 'skipped', '']) {
    const result = evaluateRequiredReleaseGateFinal({
      mode: 'release',
      scopeResult: 'success',
      docsResult: 'skipped',
      rootReleaseResult,
      rehearsalObserverResult: 'skipped',
      observeRehearsal: false,
      runOnpremImageProof: false,
      onpremImageProofResult: 'skipped',
    })

    assert.equal(result.ok, false)
    assert.match(result.failures.join(', '), /root-release=/)
  }
})

test('observer retries only transient provider failures and keeps contract failures fail fast', () => {
  for (const status of [429, 500, 503, 599]) {
    assert.equal(isRetriableCheckRunsError(Object.assign(new Error('transient'), { status })), true)
  }

  assert.equal(isRetriableCheckRunsError(new TypeError('network unavailable')), true)
  assert.equal(isRetriableCheckRunsError(Object.assign(new Error('unauthorized'), { status: 401 })), false)
  assert.equal(isRetriableCheckRunsError(Object.assign(new Error('not found'), { status: 404 })), false)
  assert.equal(isRetriableCheckRunsError(new Error('invalid response contract')), false)
})

test('required workflow is unfiltered, uses the reusable root gate, and finalizes fail closed', () => {
  const workflow = readText('.github/workflows/required-release-gate.yml')
  const rehearsalWorkflow = readText('.github/workflows/release-rehearsal.yml')
  const frontendWorkflow = readText('.github/workflows/frontend-release-check.yml')
  const releaseWorkflow = readText('.github/workflows/release-check.yml')
  const postMergeWorkflow = readText('.github/workflows/post-merge-verification.yml')

  assert.match(workflow, /name:\s*Required Release Gate/)
  assert.match(workflow, /on:\s*\n\s+pull_request:\s*\n\s*\nconcurrency:/)
  assert.doesNotMatch(workflow, /pull_request:\s*\n\s+paths:/)
  assert.match(workflow, /uses:\s*\.\/\.github\/workflows\/release-check\.yml/)
  assert.match(workflow, /uses:\s*\.\/\.github\/workflows\/onprem-image-proof\.yml/)
  assert.match(workflow, /REQUIRED_RELEASE_GATE_ONPREM_IMAGE_PROOF_RESULT:/)
  assert.match(workflow, /REQUIRED_RELEASE_GATE_RUN_ONPREM_IMAGE_PROOF:/)
  assert.match(workflow, /git diff --check "\$BASE_SHA" "\$HEAD_SHA"/)
  assert.match(workflow, /run:\s*npm run test:scripts/)
  assert.doesNotMatch(workflow, /frontend-targeted:/)
  assert.match(workflow, /actions:\s*read/)
  assert.doesNotMatch(workflow, /checks:\s*read/)
  assert.match(workflow, /REQUIRED_RELEASE_GATE_PR_NUMBER:\s*\$\{\{ github\.event\.pull_request\.number \}\}/)
  assert.match(workflow, /REQUIRED_RELEASE_GATE_BASE_SHA:\s*\$\{\{ github\.event\.pull_request\.base\.sha \}\}/)
  assert.match(workflow, /REQUIRED_RELEASE_GATE_HEAD_SHA:\s*\$\{\{ github\.event\.pull_request\.head\.sha \}\}/)
  assert.match(workflow, /REQUIRED_RELEASE_GATE_MAX_ATTEMPTS:\s*"24"/)
  assert.doesNotMatch(readText('scripts/required-release-gate.mjs'), /check-runs|GITHUB_ACTIONS_APP_ID/)
  assert.match(workflow, /if:\s*\$\{\{ always\(\) \}\}/)
  assert.match(workflow, /name:\s*required-release-gate/)
  assert.match(frontendWorkflow, /name:\s*Frontend Targeted Check/)
  assert.match(frontendWorkflow, /workflow_call:\s*\n/)
  assert.match(frontendWorkflow, /run:\s*npm run api:check/)
  assert.match(frontendWorkflow, /run:\s*npm run lint/)
  assert.match(frontendWorkflow, /run:\s*npm run test:scripts/)
  assert.match(frontendWorkflow, /run:\s*npm run build/)
  assert.doesNotMatch(frontendWorkflow, /^\s*pull_request:/m)
  assert.doesNotMatch(frontendWorkflow, /^\s*push:/m)
  assert.doesNotMatch(frontendWorkflow, /npm run check:release/)
  assert.doesNotMatch(frontendWorkflow, /npm run (?:smoke:ui|test:e2e)\b/)
  assert.doesNotMatch(frontendWorkflow, /playwright test|npm audit/i)
  assert.doesNotMatch(rehearsalWorkflow, /continue-on-error/)
  assert.doesNotMatch(frontendWorkflow, /continue-on-error/)
  assert.match(releaseWorkflow, /name:\s*Upload Playwright failure artifacts/)
  assert.match(releaseWorkflow, /if:\s*\$\{\{ failure\(\) \}\}/)
  assert.match(releaseWorkflow, /uses:\s*actions\/upload-artifact@v4/)
  assert.match(releaseWorkflow, /path:\s*admin-web\/test-results/)
  assert.doesNotMatch(releaseWorkflow, /^\s*push:/m)
  assert.match(releaseWorkflow, /workflow_call:\s*\n/)
  assert.match(releaseWorkflow, /workflow_dispatch:\s*\n/)
  assert.match(releaseWorkflow, /^  root-contracts:/m)
  assert.match(releaseWorkflow, /^  backend-release:/m)
  assert.match(releaseWorkflow, /^  frontend-release:/m)
  assert.match(releaseWorkflow, /^  release-check:/m)
  assert.match(postMergeWorkflow, /name:\s*Post-Merge Verification/)
  assert.match(postMergeWorkflow, /^\s*push:\s*$/m)
  assert.match(postMergeWorkflow, /!scripts\/current-state-handoff-contract\.test\.mjs/)
  assert.match(postMergeWorkflow, /!scripts\/project-control-registries-contract\.test\.mjs/)
  assert.ok(
    postMergeWorkflow.indexOf('"scripts/**"') <
      postMergeWorkflow.indexOf('"!scripts/current-state-handoff-contract.test.mjs"'),
  )
  assert.ok(
    postMergeWorkflow.indexOf('"scripts/**"') <
      postMergeWorkflow.indexOf('"!scripts/project-control-registries-contract.test.mjs"'),
  )
  assert.doesNotMatch(postMergeWorkflow, /^concurrency:/m)
  assert.match(postMergeWorkflow, /permissions:\s*\n\s+actions:\s*read/)
  assert.match(postMergeWorkflow, /node scripts\/post-merge-release-proof\.mjs --proof/)
  assert.match(postMergeWorkflow, /run:\s*npm run test:scripts/)
  assert.match(postMergeWorkflow, /always\(\).*reuse_pr_gate != 'true'/)
  assert.match(postMergeWorkflow, /uses:\s*\.\/\.github\/workflows\/release-check\.yml/)
  assert.match(postMergeWorkflow, /node scripts\/post-merge-release-proof\.mjs --final/)
})
