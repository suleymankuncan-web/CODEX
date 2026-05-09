import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')
const scriptPath = join(workspaceRoot, 'scripts/protected-performance-baseline.mjs')
const planPath = join(workspaceRoot, 'docs/plans/performance-baseline.md')
const evidencePath = join(
  workspaceRoot,
  'docs/evidence/performance/2026-05-09-staging-protected-performance-gate.md',
)

function readText(path) {
  return readFileSync(path, 'utf8')
}

function requireText(text, expected) {
  assert.ok(text.includes(expected), `Missing expected text: ${expected}`)
}

test('root package exposes protected performance baseline command', () => {
  const pkg = JSON.parse(readText(join(workspaceRoot, 'package.json')))

  assert.equal(pkg.scripts['perf:protected'], 'node scripts/protected-performance-baseline.mjs')
})

test('protected performance runner requires real bearer tokens and redacts them', () => {
  assert.equal(existsSync(scriptPath), true, 'protected performance runner must exist')
  const script = readText(scriptPath)

  for (const expected of [
    'PROTECTED_PERF_STORE_MANAGER_TOKEN',
    'PROTECTED_PERF_STORE_PERSONNEL_TOKEN',
    'PERF_AUTH_TOKEN',
    'PILOT_SMOKE_BEARER_TOKEN',
    'AUTH_SMOKE_BEARER_TOKEN',
    '<redacted-bearer-token>',
    'PROTECTED_PERF_ALLOW_BLOCKED',
    'PROTECTED_PERF_ALLOW_SHARED_TOKEN',
    'PERF_TARGET_PROFILE',
    'store-manager',
    'store-personnel',
  ]) {
    requireText(script, expected)
  }
})

test('performance baseline plan documents protected staging gate', () => {
  const plan = readText(planPath)

  for (const expected of [
    'npm.cmd run perf:protected',
    'PROTECTED_PERF_STORE_MANAGER_TOKEN',
    'PROTECTED_PERF_STORE_PERSONNEL_TOKEN',
    'PROTECTED_PERF_ALLOW_BLOCKED=true',
    'PROTECTED_PERF_ALLOW_SHARED_TOKEN=true',
    'Protected staging API baseline',
    '2026-05-09-staging-protected-performance-gate.md',
  ]) {
    requireText(plan, expected)
  }
})

test('protected performance evidence records the current auth blocker safely', () => {
  assert.equal(existsSync(evidencePath), true, 'protected performance evidence must exist')
  const evidence = readText(evidencePath)

  for (const expected of [
    '# Staging Protected Performance Gate - 2026-05-09',
    'Status: blocked by missing real bearer token',
    'PROTECTED_PERF_STORE_MANAGER_TOKEN',
    'PROTECTED_PERF_STORE_PERSONNEL_TOKEN',
    '/reports/kpi-config',
    '403 Forbidden',
    'Raw bearer tokens, Clerk cookies, passwords, provider subjects, full JWTs, and private user data are not recorded.',
  ]) {
    requireText(evidence, expected)
  }

  assert.doesNotMatch(evidence, /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/)
})
