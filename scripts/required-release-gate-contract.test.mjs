import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  GITHUB_ACTIONS_APP_ID,
  evaluateObservedCheckRun,
  evaluateRequiredReleaseGateFinal,
  parseNameStatusFiles,
  selectRequiredReleaseGateScope,
} from './required-release-gate.mjs'

const workspaceRoot = join(import.meta.dirname, '..')

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function successfulRun(name) {
  return {
    id: 1,
    name,
    status: 'completed',
    conclusion: 'success',
    started_at: '2026-07-10T12:00:00Z',
    app: { id: GITHUB_ACTIONS_APP_ID },
  }
}

test('docs/process-only scope uses local diff and root script contracts without a release child', () => {
  const scope = selectRequiredReleaseGateScope([
    '.codex/agents/planner-xhigh.toml',
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
  assert.ok(scope.affectedVerification.commands.includes('npm.cmd --prefix admin-web run lint'))
  assert.ok(scope.affectedVerification.commands.includes('npm.cmd --prefix admin-web run build'))
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

test('observer evaluates the latest same-head GitHub Actions check run fail closed', () => {
  const staleSuccess = successfulRun('release-rehearsal')
  staleSuccess.id = 1
  staleSuccess.started_at = '2026-07-10T11:00:00Z'

  const latestCancelled = {
    ...successfulRun('release-rehearsal'),
    id: 2,
    conclusion: 'cancelled',
    started_at: '2026-07-10T12:00:00Z',
  }

  assert.deepEqual(
    evaluateObservedCheckRun('release-rehearsal', [staleSuccess, latestCancelled]),
    {
      state: 'failure',
      reason: 'release-rehearsal completed with cancelled',
    },
  )
  assert.equal(evaluateObservedCheckRun('release-rehearsal', []).state, 'pending')
  assert.equal(
    evaluateObservedCheckRun('release-rehearsal', [
      { ...successfulRun('release-rehearsal'), conclusion: 'timed_out' },
    ]).state,
    'failure',
  )
  assert.equal(
    evaluateObservedCheckRun('release-rehearsal', [
      { ...successfulRun('release-rehearsal'), conclusion: 'skipped' },
    ]).state,
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
  })
  assert.equal(docsFinal.ok, true)

  const releaseFinal = evaluateRequiredReleaseGateFinal({
    mode: 'release',
    scopeResult: 'success',
    docsResult: 'skipped',
    rootReleaseResult: 'success',
    rehearsalObserverResult: 'failure',
    observeRehearsal: true,
  })
  assert.equal(releaseFinal.ok, false)
  assert.deepEqual(releaseFinal.failures, ['release-rehearsal-observer=failure'])
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
    })

    assert.equal(result.ok, false)
    assert.match(result.failures.join(', '), /root-release=/)
  }
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
  assert.match(workflow, /git diff --check "\$BASE_SHA" "\$HEAD_SHA"/)
  assert.match(workflow, /run:\s*npm run test:scripts/)
  assert.doesNotMatch(workflow, /frontend-targeted:/)
  assert.match(workflow, /REQUIRED_RELEASE_GATE_CHECK_NAME:\s*release-rehearsal/)
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
