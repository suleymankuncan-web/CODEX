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
    'scripts/current-state-handoff-contract.test.mjs',
    'scripts/project-control-registries-contract.test.mjs',
  ])

  assert.equal(scope.mode, 'docs')
  assert.equal(scope.runRootRelease, false)
  assert.equal(scope.observeRehearsal, false)
  assert.equal(scope.proofMode, 'none')
  assert.equal(scope.imageScope, 'none')
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
  assert.equal(scope.proofMode, 'component')
  assert.equal(scope.imageScope, 'frontend')
  assert.equal(scope.runOnpremImageProof, true)
  assert.ok(scope.affectedVerification.commands.includes('npm.cmd --prefix admin-web run lint'))
  assert.ok(scope.affectedVerification.commands.includes('npm.cmd --prefix admin-web run build'))
})

test('selector keeps unshipped e2e, playwright, readme, and ignored env changes out of image proof', () => {
  for (const file of [
    'admin-web/e2e/pilot-smoke.spec.ts',
    'admin-web/playwright.config.ts',
    'backend/nestjs/README.md',
    'admin-web/.env.example',
  ]) {
    const scope = selectRequiredReleaseGateScope([file])

    assert.equal(scope.proofMode, 'none', file)
    assert.equal(scope.imageScope, 'none', file)
    assert.equal(scope.runOnpremImageProof, false, file)
  }
})

test('ordinary backend source uses a backend component proof', () => {
  const scope = selectRequiredReleaseGateScope(['backend/nestjs/src/modules/store-ops/store-ops.service.ts'])

  assert.equal(scope.proofMode, 'component')
  assert.equal(scope.imageScope, 'backend')
  assert.equal(scope.runOnpremImageProof, true)
})

test('sensitive backend source escalates to full proof for both images', () => {
  for (const file of [
    'backend/nestjs/src/modules/auth/auth.service.ts',
    'backend/nestjs/src/modules/authentication/authentication.service.ts',
    'backend/nestjs/src/shared/database/migration.service.ts',
    'backend/nestjs/src/shared/jobs/bullmq-worker-host.service.ts',
    'backend/nestjs/src/modules/store-ops/infrastructure/s3-compatible-photo-media-object-storage.ts',
  ]) {
    const scope = selectRequiredReleaseGateScope([file])

    assert.equal(scope.proofMode, 'full', file)
    assert.equal(scope.imageScope, 'both', file)
  }
})

test('repository-aware auth, session, controller, and data-integrity sources escalate conservatively', () => {
  for (const file of [
    'admin-web/src/lib/api.ts',
    'admin-web/src/lib/api-session-recovery.ts',
    'admin-web/src/providers/AuthProvider.tsx',
    'admin-web/src/hooks/useSession.ts',
    'admin-web/src/config/auth.ts',
    'backend/nestjs/src/shared/config/app-config.service.ts',
    'backend/nestjs/src/shared/app-config.service.ts',
    'backend/nestjs/src/shared/secret-file-config.ts',
    'backend/nestjs/src/shared/photo-media-runtime-config.ts',
    'backend/nestjs/src/shared/secrets/runtime-secret.service.ts',
    'backend/nestjs/src/modules/store-ops/store-ops.controller.ts',
    'backend/nestjs/src/modules/store-ops/infrastructure/store-ops.repository.ts',
    'backend/nestjs/src/shared/database/data-integrity.repository.ts',
    'backend/nestjs/src/modules/store-ops/repositories/data-integrity.repository.ts',
  ]) {
    const scope = selectRequiredReleaseGateScope([file])

    assert.equal(scope.proofMode, 'full', file)
    assert.equal(scope.imageScope, 'both', file)
  }
  const ordinaryService = selectRequiredReleaseGateScope([
    'backend/nestjs/src/modules/store-ops/store-ops.service.ts',
  ])
  assert.equal(ordinaryService.proofMode, 'component')
  assert.equal(ordinaryService.imageScope, 'backend')
})

test('ordinary source names do not false-match sensitive token prefixes', () => {
  for (const file of [
    'backend/nestjs/src/modules/people/author.ts',
    'backend/nestjs/src/modules/catalog/photosynthesis.service.ts',
  ]) {
    const scope = selectRequiredReleaseGateScope([file])

    assert.equal(scope.proofMode, 'component', file)
    assert.equal(scope.imageScope, 'backend', file)
  }
})

test('component image scopes union without losing the root release', () => {
  const scope = selectRequiredReleaseGateScope([
    'admin-web/src/features/store-checklist/checklist-page.tsx',
    'backend/nestjs/src/modules/store-ops/store-ops.service.ts',
  ])

  assert.equal(scope.proofMode, 'component')
  assert.equal(scope.imageScope, 'both')
  assert.equal(scope.runRootRelease, true)
})

test('image inputs, database paths, gate scripts, and unknown files under image roots select full both proof', () => {
  for (const file of [
    '.dockerignore',
    'Dockerfile',
    'Dockerfile.ci',
    '.github/workflows/onprem-image-proof.yml',
    '.github/workflows/required-release-gate.yml',
    'infra/onprem/images/backend.Dockerfile',
    'admin-web/package-lock.json',
    'backend/nestjs/tsconfig.onprem.json',
    'db/schema.sql',
    'scripts/required-release-gate.mjs',
    'scripts/affected-verification-selector.mjs',
    'scripts/check-release.mjs',
    'scripts/post-merge-release-proof.mjs',
    'scripts/release-stage-runner.mjs',
    'scripts/release-workflow-final.mjs',
    'scripts/release-stage-manifest.json',
    'tools/onprem-license/package-lock.json',
    'admin-web/scripts/unclassified-build-input.js',
    'backend/nestjs/scripts/unclassified-build-input.js',
  ]) {
    const scope = selectRequiredReleaseGateScope([file])

    assert.equal(scope.proofMode, 'full', file)
    assert.equal(scope.imageScope, 'both', file)
  }
})

test('image entrypoints require full proof for both production images', () => {
  for (const file of [
    'admin-web/src/main.tsx',
    'admin-web/src/index.ts',
    'admin-web/index.html',
    'backend/nestjs/src/main.ts',
    'backend/nestjs/src/index.ts',
  ]) {
    const scope = selectRequiredReleaseGateScope([file])

    assert.equal(scope.proofMode, 'full', file)
    assert.equal(scope.imageScope, 'both', file)
  }
})

test('pinned on-prem license tooling selects the fail-closed image proof', () => {
  const scope = selectRequiredReleaseGateScope(['tools/onprem-license/package-lock.json'])
  assert.equal(scope.mode, 'release')
  assert.equal(scope.runRootRelease, true)
  assert.equal(scope.runOnpremImageProof, true)
  assert.equal(scope.proofMode, 'full')
  assert.equal(scope.imageScope, 'both')
})

test('on-prem core-only changes select the fail-closed runtime image proof', () => {
  const scope = selectRequiredReleaseGateScope([
    'infra/onprem/core/caddy/Caddyfile',
  ])

  assert.equal(scope.mode, 'release')
  assert.equal(scope.runRootRelease, true)
  assert.equal(scope.runOnpremImageProof, true)
  assert.equal(scope.proofMode, 'full')
  assert.equal(scope.imageScope, 'both')
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
    assert.equal(scope.proofMode, 'full')
    assert.equal(scope.imageScope, 'both')
  }
})

test('unknown paths fail safe into the official root release gate', () => {
  const scope = selectRequiredReleaseGateScope(['tooling/custom-release-policy.json'])

  assert.equal(scope.mode, 'release')
  assert.equal(scope.runRootRelease, true)
  assert.equal(scope.observeRehearsal, false)
  assert.equal(scope.proofMode, 'none')
  assert.equal(scope.imageScope, 'none')
})

test('empty and rename-aware change lists cannot hide a release-impacting path', () => {
  const emptyScope = selectRequiredReleaseGateScope([])
  assert.equal(emptyScope.mode, 'unsupported')
  assert.equal(emptyScope.proofMode, 'none')
  assert.equal(emptyScope.imageScope, 'none')

  const renamedFiles = parseNameStatusFiles(
    'R100\tadmin-web/src/legacy.tsx\tdocs/legacy.tsx\n',
  )
  const renameScope = selectRequiredReleaseGateScope(renamedFiles)
  assert.equal(renameScope.mode, 'release')
})

test('rename-aware selection unions old and new image impact', () => {
  const renamedFiles = parseNameStatusFiles(
    'R100\tadmin-web/src/legacy.tsx\tbackend/nestjs/src/modules/auth/auth.service.ts\n',
  )
  const scope = selectRequiredReleaseGateScope(renamedFiles)

  assert.equal(scope.proofMode, 'full')
  assert.equal(scope.imageScope, 'both')
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
    expectedSha: 'c'.repeat(40),
    proofMode: 'none',
    imageScope: 'none',
    onpremImageProofMode: '',
    onpremImageProofScope: '',
    onpremImageProofEvidenceSha: '',
    onpremImageProofReceiptSha256: '',
    onpremImageProofProvenSha: '',
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
    expectedSha: 'c'.repeat(40),
    proofMode: 'full',
    imageScope: 'both',
    onpremImageProofMode: 'full',
    onpremImageProofScope: 'both',
    onpremImageProofEvidenceSha: 'a'.repeat(64),
    onpremImageProofReceiptSha256: 'b'.repeat(64),
    onpremImageProofProvenSha: 'c'.repeat(40),
    runOnpremImageProof: true,
    onpremImageProofResult: 'failure',
  })
  assert.equal(releaseFinal.ok, false)
  assert.deepEqual(releaseFinal.failures, ['release-rehearsal-observer=failure', 'onprem-image-proof=failure'])
})

test('docs scope rejects selected on-prem proof and any non-skipped proof output', () => {
  const result = evaluateRequiredReleaseGateFinal({
    mode: 'docs',
    scopeResult: 'success',
    docsResult: 'success',
    rootReleaseResult: 'skipped',
    rehearsalObserverResult: 'skipped',
    observeRehearsal: false,
    expectedSha: 'c'.repeat(40),
    proofMode: 'component',
    imageScope: 'frontend',
    runOnpremImageProof: true,
    onpremImageProofResult: 'success',
    onpremImageProofMode: 'component',
    onpremImageProofScope: 'frontend',
    onpremImageProofEvidenceSha: 'a'.repeat(64),
    onpremImageProofReceiptSha256: 'b'.repeat(64),
    onpremImageProofProvenSha: 'c'.repeat(40),
  })

  assert.equal(result.ok, false)
  assert.ok(result.failures.includes('onprem-image-proof=unexpected-for-docs:component/frontend'))

  const noneWithOutput = evaluateRequiredReleaseGateFinal({
    mode: 'docs',
    scopeResult: 'success',
    docsResult: 'success',
    rootReleaseResult: 'skipped',
    rehearsalObserverResult: 'skipped',
    observeRehearsal: false,
    expectedSha: 'c'.repeat(40),
    proofMode: 'none',
    imageScope: 'none',
    runOnpremImageProof: false,
    onpremImageProofResult: 'success',
    onpremImageProofMode: 'component',
    onpremImageProofScope: 'frontend',
    onpremImageProofEvidenceSha: 'a'.repeat(64),
    onpremImageProofReceiptSha256: 'b'.repeat(64),
    onpremImageProofProvenSha: 'c'.repeat(40),
  })

  assert.equal(noneWithOutput.ok, false)
  assert.ok(noneWithOutput.failures.includes('onprem-image-proof=expected-skipped:success'))
  assert.ok(noneWithOutput.failures.includes('onprem-image-proof=unexpected-output-for-none'))
})

test('aggregate requires exact component identity and fresh 64-hex evidence outputs', () => {
  const base = {
    mode: 'release',
    scopeResult: 'success',
    docsResult: 'skipped',
    rootReleaseResult: 'success',
    rehearsalObserverResult: 'skipped',
    observeRehearsal: false,
    expectedSha: 'c'.repeat(40),
    proofMode: 'component',
    imageScope: 'frontend',
    runOnpremImageProof: true,
    onpremImageProofResult: 'success',
    onpremImageProofMode: 'component',
    onpremImageProofScope: 'frontend',
    onpremImageProofEvidenceSha: 'a'.repeat(64),
    onpremImageProofReceiptSha256: 'b'.repeat(64),
    onpremImageProofProvenSha: 'c'.repeat(40),
  }

  assert.equal(evaluateRequiredReleaseGateFinal(base).ok, true)
  for (const [key, value] of [
    ['onpremImageProofMode', 'full'],
    ['onpremImageProofScope', 'backend'],
    ['onpremImageProofEvidenceSha', 'not-a-sha'],
    ['onpremImageProofEvidenceSha', 'A'.repeat(64)],
    ['onpremImageProofReceiptSha256', ''],
    ['onpremImageProofReceiptSha256', 'B'.repeat(64)],
    ['onpremImageProofProvenSha', ''],
    ['onpremImageProofProvenSha', 'C'.repeat(40)],
    ['onpremImageProofProvenSha', 'd'.repeat(40)],
  ]) {
    const result = evaluateRequiredReleaseGateFinal({ ...base, [key]: value })
    assert.equal(result.ok, false, key)
    assert.ok(result.failures.some((failure) => failure.startsWith('onprem-image-proof=')), key)
  }
})

test('aggregate requires a lowercase expected SHA and exact proven SHA identity', () => {
  const base = {
    mode: 'release',
    scopeResult: 'success',
    docsResult: 'skipped',
    rootReleaseResult: 'success',
    rehearsalObserverResult: 'skipped',
    observeRehearsal: false,
    expectedSha: 'c'.repeat(40),
    proofMode: 'component',
    imageScope: 'backend',
    runOnpremImageProof: true,
    onpremImageProofResult: 'success',
    onpremImageProofMode: 'component',
    onpremImageProofScope: 'backend',
    onpremImageProofEvidenceSha: 'a'.repeat(64),
    onpremImageProofReceiptSha256: 'b'.repeat(64),
    onpremImageProofProvenSha: 'c'.repeat(40),
  }

  assert.equal(evaluateRequiredReleaseGateFinal(base).ok, true)
  for (const expectedSha of ['', 'C'.repeat(40)]) {
    const result = evaluateRequiredReleaseGateFinal({ ...base, expectedSha })
    assert.equal(result.ok, false, expectedSha || 'missing expected SHA')
    assert.ok(result.failures.includes('expected-sha-invalid'))
  }
  const stale = evaluateRequiredReleaseGateFinal({ ...base, onpremImageProofProvenSha: 'd'.repeat(40) })
  assert.equal(stale.ok, false)
  assert.ok(stale.failures.includes('onprem-image-proof=proven-sha-mismatch'))
})

test('aggregate requires skipped proof and no outputs when selector returns none', () => {
  const result = evaluateRequiredReleaseGateFinal({
    mode: 'release',
    scopeResult: 'success',
    docsResult: 'skipped',
    rootReleaseResult: 'success',
    rehearsalObserverResult: 'skipped',
    observeRehearsal: false,
    proofMode: 'none',
    imageScope: 'none',
    expectedSha: 'c'.repeat(40),
    runOnpremImageProof: false,
    onpremImageProofResult: 'skipped',
    onpremImageProofMode: '',
    onpremImageProofScope: '',
    onpremImageProofEvidenceSha: '',
    onpremImageProofReceiptSha256: '',
    onpremImageProofProvenSha: '',
  })
  assert.equal(result.ok, true)
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
      expectedSha: 'c'.repeat(40),
      proofMode: 'none',
      imageScope: 'none',
      runOnpremImageProof: false,
      onpremImageProofResult: 'skipped',
      onpremImageProofMode: '',
      onpremImageProofScope: '',
      onpremImageProofEvidenceSha: '',
      onpremImageProofReceiptSha256: '',
      onpremImageProofProvenSha: '',
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
  assert.match(workflow, /REQUIRED_RELEASE_GATE_PROOF_MODE:/)
  assert.match(workflow, /REQUIRED_RELEASE_GATE_IMAGE_SCOPE:/)
  assert.match(workflow, /REQUIRED_RELEASE_GATE_ONPREM_IMAGE_PROOF_MODE:/)
  assert.match(workflow, /REQUIRED_RELEASE_GATE_ONPREM_IMAGE_PROOF_SCOPE:/)
  assert.match(workflow, /REQUIRED_RELEASE_GATE_ONPREM_IMAGE_PROOF_EVIDENCE_SHA:/)
  assert.match(workflow, /REQUIRED_RELEASE_GATE_ONPREM_IMAGE_PROOF_RECEIPT_SHA256:/)
  assert.match(workflow, /REQUIRED_RELEASE_GATE_RUN_ONPREM_IMAGE_PROOF:/)
  assert.match(workflow, /proof_mode:/)
  assert.match(workflow, /image_scope:/)
  assert.match(workflow, /expected_sha:/)
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
