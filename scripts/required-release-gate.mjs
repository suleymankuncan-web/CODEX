import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { selectAffectedVerification } from './affected-verification-selector.mjs'

export const GITHUB_ACTIONS_APP_ID = 15368
export const REQUIRED_RELEASE_GATE_POLL_INTERVAL_MS = 30_000

const rootProcessFiles = new Set([
  'CONTRIBUTING.md',
  'current-state.md',
  'discipline.md',
  'sokrates.md',
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
    file.startsWith('docs/') ||
    rootProcessFiles.has(file) ||
    (!file.includes('/') && file.endsWith('.md'))
  )
}

function isFrontendCheckPath(file) {
  return (
    hasPrefix(file, ['admin-web/', 'docs/api/']) ||
    file === '.github/workflows/frontend-release-check.yml'
  )
}

function isRehearsalPath(file) {
  return (
    hasPrefix(file, ['backend/nestjs/', 'db/', 'infra/']) ||
    file === '.github/workflows/release-rehearsal.yml'
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
      runRootRelease: false,
      observeFrontendRelease: false,
      observeRehearsal: false,
    }
  }

  if (normalizedFiles.every(isDocsProcessPath)) {
    return {
      mode: 'docs',
      reason: 'all changed files are docs/process files',
      files: normalizedFiles,
      affectedVerification,
      runRootRelease: false,
      observeFrontendRelease: false,
      observeRehearsal: false,
    }
  }

  return {
    mode: 'release',
    reason: 'a non-docs/process path changed, so the official root release gate is required',
    files: normalizedFiles,
    affectedVerification,
    runRootRelease: true,
    observeFrontendRelease: normalizedFiles.some(isFrontendCheckPath),
    observeRehearsal: normalizedFiles.some(isRehearsalPath),
  }
}

function latestCheckRun(checkRuns) {
  return [...checkRuns].sort((left, right) => {
    const leftTime = Date.parse(left.started_at ?? left.created_at ?? left.completed_at ?? '') || 0
    const rightTime = Date.parse(right.started_at ?? right.created_at ?? right.completed_at ?? '') || 0

    if (leftTime !== rightTime) {
      return rightTime - leftTime
    }

    return Number(right.id ?? 0) - Number(left.id ?? 0)
  })[0]
}

export function evaluateObservedCheckRun(checkName, checkRuns) {
  const matchingRuns = checkRuns.filter(
    (checkRun) =>
      checkRun.name === checkName &&
      Number(checkRun.app?.id) === GITHUB_ACTIONS_APP_ID,
  )
  const checkRun = latestCheckRun(matchingRuns)

  if (!checkRun) {
    return {
      state: 'pending',
      reason: `${checkName} has not started for the latest PR head SHA`,
    }
  }

  if (checkRun.status !== 'completed') {
    return {
      state: 'pending',
      reason: `${checkName} is ${checkRun.status}`,
    }
  }

  if (checkRun.conclusion === 'success') {
    return {
      state: 'success',
      reason: `${checkName} completed successfully`,
    }
  }

  return {
    state: 'failure',
    reason: `${checkName} completed with ${checkRun.conclusion ?? 'no conclusion'}`,
  }
}

export function evaluateRequiredReleaseGateFinal({
  mode,
  scopeResult,
  docsResult,
  rootReleaseResult,
  frontendObserverResult,
  rehearsalObserverResult,
  observeFrontendRelease,
  observeRehearsal,
}) {
  const failures = []

  if (scopeResult !== 'success') {
    failures.push(`scope=${scopeResult || 'missing'}`)
  }

  if (mode === 'docs') {
    if (docsResult !== 'success') {
      failures.push(`docs-process-contracts=${docsResult || 'missing'}`)
    }
  } else if (mode === 'release') {
    if (rootReleaseResult !== 'success') {
      failures.push(`root-release=${rootReleaseResult || 'missing'}`)
    }
    if (observeFrontendRelease && frontendObserverResult !== 'success') {
      failures.push(`frontend-release-observer=${frontendObserverResult || 'missing'}`)
    }
    if (observeRehearsal && rehearsalObserverResult !== 'success') {
      failures.push(`release-rehearsal-observer=${rehearsalObserverResult || 'missing'}`)
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
  console.log(`run_root_release=${scope.runRootRelease}`)
  console.log(`observe_frontend_release=${scope.observeFrontendRelease}`)
  console.log(`observe_rehearsal=${scope.observeRehearsal}`)
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

async function fetchCheckRuns({ repository, headSha, checkName, token }) {
  const apiUrl = process.env.GITHUB_API_URL ?? 'https://api.github.com'
  const url = new URL(`${apiUrl}/repos/${repository}/commits/${headSha}/check-runs`)
  url.searchParams.set('check_name', checkName)
  url.searchParams.set('filter', 'all')
  url.searchParams.set('per_page', '100')
  url.searchParams.set('app_id', String(GITHUB_ACTIONS_APP_ID))

  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2026-03-10',
    },
  })

  if (!response.ok) {
    throw new Error(`check-runs API returned HTTP ${response.status} for ${checkName}`)
  }

  const body = await response.json()
  return body.check_runs ?? []
}

async function observeCheckRun() {
  const repository = requiredEnvironment('GITHUB_REPOSITORY')
  const headSha = requiredEnvironment('REQUIRED_RELEASE_GATE_HEAD_SHA')
  const checkName = requiredEnvironment('REQUIRED_RELEASE_GATE_CHECK_NAME')
  const token = requiredEnvironment('GITHUB_TOKEN')
  const maxAttempts = positiveInteger(process.env.REQUIRED_RELEASE_GATE_MAX_ATTEMPTS, 90)

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const checkRuns = await fetchCheckRuns({ repository, headSha, checkName, token })
    const evaluation = evaluateObservedCheckRun(checkName, checkRuns)
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
    `${checkName} never reached success for the latest PR head SHA; missing, cancelled, and timed out children fail closed`,
  )
}

function evaluateFinalFromEnvironment() {
  const final = evaluateRequiredReleaseGateFinal({
    mode: process.env.REQUIRED_RELEASE_GATE_MODE,
    scopeResult: process.env.REQUIRED_RELEASE_GATE_SCOPE_RESULT,
    docsResult: process.env.REQUIRED_RELEASE_GATE_DOCS_RESULT,
    rootReleaseResult: process.env.REQUIRED_RELEASE_GATE_ROOT_RELEASE_RESULT,
    frontendObserverResult: process.env.REQUIRED_RELEASE_GATE_FRONTEND_OBSERVER_RESULT,
    rehearsalObserverResult: process.env.REQUIRED_RELEASE_GATE_REHEARSAL_OBSERVER_RESULT,
    observeFrontendRelease: process.env.REQUIRED_RELEASE_GATE_OBSERVE_FRONTEND === 'true',
    observeRehearsal: process.env.REQUIRED_RELEASE_GATE_OBSERVE_REHEARSAL === 'true',
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
