import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { selectAffectedVerification } from './affected-verification-selector.mjs'

export const REQUIRED_RELEASE_GATE_POLL_INTERVAL_MS = 60_000
export const RELEASE_REHEARSAL_WORKFLOW_PATH = '.github/workflows/release-rehearsal.yml'

const rootProcessFiles = new Set([
  'CONTRIBUTING.md',
  'current-state.md',
  'discipline.md',
  'sokrates.md',
])

const docsProcessContractFiles = new Set([
  'scripts/current-state-handoff-contract.test.mjs',
  'scripts/project-control-registries-contract.test.mjs',
])

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function normalizePath(path) {
  return path.trim().replaceAll('\\', '/').replace(/\/+/g, '/')
}

function hasPrefix(file, prefixes) {
  return prefixes.some((prefix) => file.startsWith(prefix))
}

function isDocsProcessPath(file) {
  if (file.startsWith('docs/api/')) {
    return false
  }

  return (
    file.startsWith('.codex/') ||
    file.startsWith('docs/') ||
    rootProcessFiles.has(file) ||
    docsProcessContractFiles.has(file) ||
    (!file.includes('/') && file.endsWith('.md'))
  )
}

function isRehearsalPath(file) {
  return (
    hasPrefix(file, ['backend/nestjs/', 'db/', 'infra/']) ||
    file === '.github/workflows/release-rehearsal.yml'
  )
}

const PROOF_MODES = new Set(['none', 'component', 'full'])
const IMAGE_SCOPES = new Set(['none', 'frontend', 'backend', 'both'])

const fullProofPaths = [
  'infra/',
  'db/',
  'tools/onprem-license/',
  'scripts/onprem-',
  'scripts/release-',
]

const fullProofFiles = new Set([
  '.dockerignore',
  'scripts/required-release-gate.mjs',
  'scripts/required-release-gate-contract.test.mjs',
  'scripts/check-release.mjs',
  'scripts/post-merge-release-proof.mjs',
  'scripts/affected-verification-selector.mjs',
  'scripts/affected-verification-selector.test.mjs',
  '.github/workflows/onprem-image-proof.yml',
  '.github/workflows/required-release-gate.yml',
  '.github/workflows/release-check.yml',
  '.github/workflows/release-rehearsal.yml',
  '.github/workflows/post-merge-verification.yml',
])

const sensitiveBackendToken = /^(?:auth(?:entication|orization)?|session|permission|scope|clerk|jwt|database|migration|db|queue|bullmq|worker|provider|s3|r2|photo|storage|onprem)s?(?:[._-]|$)/i

const imageEntrypointFiles = new Set([
  'admin-web/src/main.ts',
  'admin-web/src/main.tsx',
  'admin-web/src/index.ts',
  'admin-web/src/index.tsx',
  'admin-web/index.html',
  'backend/nestjs/src/main.ts',
  'backend/nestjs/src/main.tsx',
  'backend/nestjs/src/index.ts',
  'backend/nestjs/src/index.tsx',
])

function isSensitiveBackendPath(file) {
  return file.split('/').some((segment) => sensitiveBackendToken.test(segment))
}

function isFrontendAuthSessionTransportPath(file) {
  return (
    file === 'admin-web/src/lib/api.ts' ||
    /(^|\/)(?:auth|authentication|authorization|session|sessions)(?:\/|[._-]|$)/i.test(file) ||
    /(^|\/)(?:[^/]*[-_.])?(?:auth|authentication|authorization|session|sessions)(?:[-_.]|$)/i.test(file) ||
    /(^|\/)(?:providers?|hooks?)\/[^/]*(?:auth|session)/i.test(file)
  )
}

function isBackendFullProofSource(file) {
  return (
    /(^|\/)backend\/nestjs\/src\/.*\.controller\.(?:ts|tsx)$/i.test(file) ||
    /(^|\/)backend\/nestjs\/src\/.*\/infrastructure\/.*\.repository\.(?:ts|tsx)$/i.test(file) ||
    /(^|\/)backend\/nestjs\/src\/shared\/(?:config|secret|secrets|runtime|auth|session)(?:\/|[._-]|$)/i.test(file) ||
    /^backend\/nestjs\/src\/shared\/[^/]*(?:config|secret|runtime|auth|session)[^/]*\.(?:ts|tsx)$/i.test(file) ||
    /(^|\/)(?:database|db|migration|migrations|integrity|data[-_]?integrity|transaction|transactions)(?:\/|[._-]|$)/i.test(file)
  )
}

function isExplicitNonePath(file) {
  return (
    file.startsWith('admin-web/e2e/') ||
    /^admin-web\/scripts\/.*\.test\.mjs$/i.test(file) ||
    /(^|\/)playwright(?:\.|\/)/i.test(file) ||
    /(^|\/)README(?:\.[^/]*)?$/i.test(file) ||
    /(^|\/)\.env(?:\.|$)/i.test(file)
  )
}

function isFullProofPath(file) {
  return (
    fullProofFiles.has(file) ||
    hasPrefix(file, fullProofPaths) ||
    /^\.github\/workflows\//.test(file) ||
    /(^|\/)Dockerfile(?:\..*)?$/i.test(file)
  )
}

function classifyOnpremImageProofPath(file) {
  if (isExplicitNonePath(file)) {
    return { mode: 'none', imageScope: 'none' }
  }

  if (isFullProofPath(file)) {
    return { mode: 'full', imageScope: 'both' }
  }

  if (imageEntrypointFiles.has(file)) {
    return { mode: 'full', imageScope: 'both' }
  }

  if (file.startsWith('admin-web/src/') || file.startsWith('admin-web/public/')) {
    return isFrontendAuthSessionTransportPath(file) || isSensitiveBackendPath(file)
      ? { mode: 'full', imageScope: 'both' }
      : { mode: 'component', imageScope: 'frontend' }
  }

  if (file.startsWith('backend/nestjs/src/')) {
    return isBackendFullProofSource(file) || isSensitiveBackendPath(file)
      ? { mode: 'full', imageScope: 'both' }
      : { mode: 'component', imageScope: 'backend' }
  }

  if (file.startsWith('admin-web/') || file.startsWith('backend/nestjs/')) {
    return { mode: 'full', imageScope: 'both' }
  }

  return { mode: 'none', imageScope: 'none' }
}

function selectOnpremProofScope(files) {
  let mode = 'none'
  const imageScopes = new Set()

  for (const file of files) {
    const classification = classifyOnpremImageProofPath(file)
    if (classification.mode === 'full') {
      return { proofMode: 'full', imageScope: 'both' }
    }
    if (classification.mode === 'component') {
      mode = 'component'
      imageScopes.add(classification.imageScope)
    }
  }

  if (mode === 'none') {
    return { proofMode: 'none', imageScope: 'none' }
  }

  return {
    proofMode: 'component',
    imageScope: imageScopes.size === 2 ? 'both' : [...imageScopes][0],
  }
}

function isValidProofIdentity(proofMode, imageScope) {
  return PROOF_MODES.has(proofMode) && IMAGE_SCOPES.has(imageScope) && (
    (proofMode === 'none' && imageScope === 'none') ||
    (proofMode === 'component' && ['frontend', 'backend', 'both'].includes(imageScope)) ||
    (proofMode === 'full' && imageScope === 'both')
  )
}

export function parseNameStatusFiles(text) {
  const files = []

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) {
      continue
    }

    const parts = line.split('\t').filter(Boolean)
    if (parts.length === 1) {
      files.push(parts[0])
      continue
    }

    const [status, ...paths] = parts
    if (status.startsWith('R') || status.startsWith('C')) {
      files.push(...paths.slice(0, 2))
      continue
    }

    files.push(paths[0])
  }

  return unique(files.map(normalizePath))
}

export function selectRequiredReleaseGateScope(files) {
  const normalizedFiles = unique(files.map(normalizePath))
  const affectedVerification = selectAffectedVerification(normalizedFiles)

  if (normalizedFiles.length === 0) {
    return {
      mode: 'unsupported',
      reason: 'no changed files were detected; fail closed instead of guessing a release scope',
      files: normalizedFiles,
      affectedVerification,
      proofMode: 'none',
      imageScope: 'none',
      runRootRelease: false,
      observeRehearsal: false,
      runOnpremImageProof: false,
    }
  }

  if (normalizedFiles.every(isDocsProcessPath)) {
    return {
      mode: 'docs',
      reason: 'all changed files are docs/process files',
      files: normalizedFiles,
      affectedVerification,
      proofMode: 'none',
      imageScope: 'none',
      runRootRelease: false,
      observeRehearsal: false,
      runOnpremImageProof: false,
    }
  }

  const onpremProof = selectOnpremProofScope(normalizedFiles)

  return {
    mode: 'release',
    reason: 'a non-docs/process path changed, so the official root release gate is required',
    files: normalizedFiles,
    affectedVerification,
    ...onpremProof,
    runRootRelease: true,
    observeRehearsal: normalizedFiles.some(isRehearsalPath),
    runOnpremImageProof: onpremProof.proofMode !== 'none',
  }
}

function positiveRunIdentity(run) {
  return [run.run_number, run.run_attempt, run.id].every(
    (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0,
  )
}

export function evaluateObservedWorkflowRun({ workflowRuns, prNumber, baseSha, headSha }) {
  if (!Array.isArray(workflowRuns)) {
    return { state: 'failure', reason: 'release rehearsal workflow-runs response is malformed' }
  }

  const matchingRuns = workflowRuns.filter(
    (run) =>
      run.path === RELEASE_REHEARSAL_WORKFLOW_PATH &&
      run.event === 'pull_request' &&
      run.head_sha === headSha &&
      Array.isArray(run.pull_requests) &&
      run.pull_requests.some(
        (pullRequest) =>
          Number(pullRequest.number) === prNumber &&
          pullRequest.head?.sha === headSha &&
          pullRequest.base?.sha === baseSha,
      ),
  )

  if (matchingRuns.length === 0) {
    return {
      state: 'pending',
      reason: 'release rehearsal has not started for the exact PR/base/head identity',
    }
  }

  if (matchingRuns.some((run) => !positiveRunIdentity(run))) {
    return { state: 'failure', reason: 'release rehearsal run identity is malformed' }
  }

  const latestRun = [...matchingRuns].sort(
    (left, right) =>
      Number(right.run_number) - Number(left.run_number) ||
      Number(right.run_attempt) - Number(left.run_attempt) ||
      Number(right.id) - Number(left.id),
  )[0]

  if (['queued', 'in_progress', 'requested', 'waiting', 'pending'].includes(latestRun.status)) {
    return {
      state: 'pending',
      reason: `release rehearsal is ${latestRun.status}`,
    }
  }

  if (latestRun.status === 'completed' && latestRun.conclusion === 'success') {
    return {
      state: 'success',
      reason: 'release rehearsal completed successfully',
    }
  }

  return {
    state: 'failure',
    reason: `release rehearsal completed with ${latestRun.conclusion ?? latestRun.status ?? 'unknown state'}`,
  }
}

export function evaluateRequiredReleaseGateFinal({
  mode,
  scopeResult,
  docsResult,
  rootReleaseResult,
  rehearsalObserverResult,
  observeRehearsal,
  expectedSha,
  proofMode,
  imageScope,
  onpremImageProofResult,
  onpremImageProofMode,
  onpremImageProofScope,
  onpremImageProofEvidenceSha,
  onpremImageProofReceiptSha256,
  onpremImageProofProvenSha,
  runOnpremImageProof,
}) {
  const failures = []
  const selectedProofMode = proofMode ?? (runOnpremImageProof ? 'full' : 'none')
  const selectedImageScope = imageScope ?? (runOnpremImageProof ? 'both' : 'none')

  if (!/^[a-f0-9]{40}$/.test(String(expectedSha ?? ''))) {
    failures.push('expected-sha-invalid')
  }

  if (scopeResult !== 'success') {
    failures.push(`scope=${scopeResult || 'missing'}`)
  }

  const requireSkippedProof = () => {
    if (onpremImageProofResult !== 'skipped') {
      failures.push(`onprem-image-proof=expected-skipped:${onpremImageProofResult || 'missing'}`)
    }
    if (onpremImageProofMode || onpremImageProofScope || onpremImageProofEvidenceSha || onpremImageProofReceiptSha256 || onpremImageProofProvenSha) {
      failures.push('onprem-image-proof=unexpected-output-for-none')
    }
  }

  if (mode === 'docs') {
    if (docsResult !== 'success') {
      failures.push(`docs-process-contracts=${docsResult || 'missing'}`)
    }
    if (!isValidProofIdentity(selectedProofMode, selectedImageScope)) {
      failures.push(`onprem-image-proof=invalid-selector-identity:${selectedProofMode || 'missing'}/${selectedImageScope || 'missing'}`)
    } else if (selectedProofMode !== 'none') {
      failures.push(`onprem-image-proof=unexpected-for-docs:${selectedProofMode}/${selectedImageScope}`)
    } else {
      requireSkippedProof()
    }
  } else if (mode === 'release') {
    if (rootReleaseResult !== 'success') {
      failures.push(`root-release=${rootReleaseResult || 'missing'}`)
    }
    if (observeRehearsal && rehearsalObserverResult !== 'success') {
      failures.push(`release-rehearsal-observer=${rehearsalObserverResult || 'missing'}`)
    }
    if (!isValidProofIdentity(selectedProofMode, selectedImageScope)) {
      failures.push(`onprem-image-proof=invalid-selector-identity:${selectedProofMode || 'missing'}/${selectedImageScope || 'missing'}`)
    } else if (selectedProofMode === 'none') {
      requireSkippedProof()
    } else if (onpremImageProofResult !== 'success') {
      failures.push(`onprem-image-proof=${onpremImageProofResult || 'missing'}`)
    } else {
      if (onpremImageProofMode !== selectedProofMode) {
        failures.push(`onprem-image-proof=mode-mismatch:${onpremImageProofMode || 'missing'}`)
      }
      if (onpremImageProofScope !== selectedImageScope) {
        failures.push(`onprem-image-proof=scope-mismatch:${onpremImageProofScope || 'missing'}`)
      }
      if (!/^[a-f0-9]{64}$/.test(String(onpremImageProofEvidenceSha ?? ''))) {
        failures.push('onprem-image-proof=evidence-sha256-invalid')
      }
      if (!/^[a-f0-9]{64}$/.test(String(onpremImageProofReceiptSha256 ?? ''))) {
        failures.push('onprem-image-proof=receipt-sha256-invalid')
      }
      if (!/^[a-f0-9]{40}$/.test(String(onpremImageProofProvenSha ?? ''))) {
        failures.push('onprem-image-proof=proven-sha-invalid')
      } else if (onpremImageProofProvenSha !== expectedSha) {
        failures.push('onprem-image-proof=proven-sha-mismatch')
      }
    }
  } else {
    failures.push(`unsupported scope mode=${mode || 'missing'}`)
  }

  return {
    ok: failures.length === 0,
    failures,
  }
}

function writeScopeOutput(scope) {
  console.log(`mode=${scope.mode}`)
  console.log(`proof_mode=${scope.proofMode}`)
  console.log(`image_scope=${scope.imageScope}`)
  console.log(`run_root_release=${scope.runRootRelease}`)
  console.log(`observe_rehearsal=${scope.observeRehearsal}`)
  console.log(`run_onprem_image_proof=${scope.runOnpremImageProof}`)
  console.error(`[required-release-gate] ${scope.reason}`)
  console.error(`[required-release-gate] files: ${scope.files.join(', ')}`)
}

function requiredEnvironment(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required for required-release-gate observation`)
  }
  return value
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

export function isRetriableCheckRunsError(error) {
  if (error instanceof TypeError) {
    return true
  }

  const status = Number(error?.status)
  return status === 429 || (status >= 500 && status <= 599)
}

async function fetchWorkflowRuns({ repository, headSha, token }) {
  const apiUrl = process.env.GITHUB_API_URL ?? 'https://api.github.com'
  const url = new URL(`${apiUrl}/repos/${repository}/actions/workflows/${encodeURIComponent(RELEASE_REHEARSAL_WORKFLOW_PATH)}/runs`)
  url.searchParams.set('event', 'pull_request')
  url.searchParams.set('head_sha', headSha)
  url.searchParams.set('per_page', '100')

  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2026-03-10',
    },
  })

  if (!response.ok) {
    const error = new Error(`workflow-runs API returned HTTP ${response.status} for release rehearsal`)
    error.status = response.status
    throw error
  }

  const body = await response.json()
  if (!Array.isArray(body?.workflow_runs)) {
    throw new Error('workflow-runs API returned a malformed release rehearsal response')
  }
  return body.workflow_runs
}

async function observeCheckRun() {
  const repository = requiredEnvironment('GITHUB_REPOSITORY')
  const headSha = requiredEnvironment('REQUIRED_RELEASE_GATE_HEAD_SHA')
  const baseSha = requiredEnvironment('REQUIRED_RELEASE_GATE_BASE_SHA')
  const prNumber = positiveInteger(requiredEnvironment('REQUIRED_RELEASE_GATE_PR_NUMBER'), 0)
  if (prNumber === 0) {
    throw new Error('REQUIRED_RELEASE_GATE_PR_NUMBER must be a positive integer')
  }
  const token = requiredEnvironment('GITHUB_TOKEN')
  const maxAttempts = positiveInteger(process.env.REQUIRED_RELEASE_GATE_MAX_ATTEMPTS, 90)

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let workflowRuns
    try {
      workflowRuns = await fetchWorkflowRuns({ repository, headSha, token })
    } catch (error) {
      if (!isRetriableCheckRunsError(error)) {
        throw error
      }

      console.warn(
        `[required-release-gate] transient workflow-runs lookup failure: ${error.message} (poll ${attempt}/${maxAttempts})`,
      )
      if (attempt < maxAttempts) {
        await delay(REQUIRED_RELEASE_GATE_POLL_INTERVAL_MS)
        continue
      }
      break
    }

    const evaluation = evaluateObservedWorkflowRun({ workflowRuns, prNumber, baseSha, headSha })
    console.log(`[required-release-gate] ${evaluation.reason} (poll ${attempt}/${maxAttempts})`)

    if (evaluation.state === 'success') {
      return
    }
    if (evaluation.state === 'failure') {
      throw new Error(evaluation.reason)
    }
    if (attempt < maxAttempts) {
      await delay(REQUIRED_RELEASE_GATE_POLL_INTERVAL_MS)
    }
  }

  throw new Error(
    'release rehearsal never reached success for the exact PR/base/head identity; missing, cancelled, and timed out children fail closed',
  )
}

function evaluateFinalFromEnvironment() {
  const final = evaluateRequiredReleaseGateFinal({
    mode: process.env.REQUIRED_RELEASE_GATE_MODE,
    scopeResult: process.env.REQUIRED_RELEASE_GATE_SCOPE_RESULT,
    docsResult: process.env.REQUIRED_RELEASE_GATE_DOCS_RESULT,
    rootReleaseResult: process.env.REQUIRED_RELEASE_GATE_ROOT_RELEASE_RESULT,
    rehearsalObserverResult: process.env.REQUIRED_RELEASE_GATE_REHEARSAL_OBSERVER_RESULT,
    observeRehearsal: process.env.REQUIRED_RELEASE_GATE_OBSERVE_REHEARSAL === 'true',
    expectedSha: process.env.REQUIRED_RELEASE_GATE_EXPECTED_SHA,
    proofMode: process.env.REQUIRED_RELEASE_GATE_PROOF_MODE,
    imageScope: process.env.REQUIRED_RELEASE_GATE_IMAGE_SCOPE,
    onpremImageProofResult: process.env.REQUIRED_RELEASE_GATE_ONPREM_IMAGE_PROOF_RESULT,
    onpremImageProofMode: process.env.REQUIRED_RELEASE_GATE_ONPREM_IMAGE_PROOF_MODE,
    onpremImageProofScope: process.env.REQUIRED_RELEASE_GATE_ONPREM_IMAGE_PROOF_SCOPE,
    onpremImageProofEvidenceSha: process.env.REQUIRED_RELEASE_GATE_ONPREM_IMAGE_PROOF_EVIDENCE_SHA,
    onpremImageProofReceiptSha256: process.env.REQUIRED_RELEASE_GATE_ONPREM_IMAGE_PROOF_RECEIPT_SHA256,
    onpremImageProofProvenSha: process.env.REQUIRED_RELEASE_GATE_ONPREM_IMAGE_PROOF_PROVEN_SHA,
    runOnpremImageProof: process.env.REQUIRED_RELEASE_GATE_RUN_ONPREM_IMAGE_PROOF === 'true',
  })

  if (!final.ok) {
    throw new Error(`required-release-gate failed closed: ${final.failures.join(', ')}`)
  }

  console.log('[required-release-gate] selected checks completed successfully')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [command, inputPath] = process.argv.slice(2)

  if (command === '--scope') {
    if (!inputPath) {
      throw new Error('A git name-status file path is required after --scope')
    }
    writeScopeOutput(selectRequiredReleaseGateScope(parseNameStatusFiles(readFileSync(inputPath, 'utf8'))))
  } else if (command === '--observe') {
    await observeCheckRun()
  } else if (command === '--final') {
    evaluateFinalFromEnvironment()
  } else {
    throw new Error('Use --scope <file>, --observe, or --final')
  }
}
