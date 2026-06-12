import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')
const evidencePath =
  'docs/evidence/readiness/2026-06-12-browser-session-staging-evidence-blocked.md'
const planPath = 'docs/plans/security-launch-blocker-pr-train-v1.md'

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function requireText(text, value) {
  assert.ok(text.includes(value), `Missing expected text: ${value}`)
}

const evidence = readText(evidencePath)
const plan = readText(planPath)

test('PR-5 browser-session staging evidence is explicitly blocked on real external input', () => {
  assert.equal(existsSync(join(workspaceRoot, evidencePath)), true, `${evidencePath} must exist`)

  for (const expected of [
    '# Browser Session Staging Evidence Blocked',
    'Status: blocked_external',
    'Security Launch Blocker PR Train V1 PR-5',
    'Evidence status: `blocked_external`.',
    'approved real staging provider',
    'controlled browser session',
    'must not invent proof',
    'This is not a broad production Go.',
    'Broad production remains `No-Go`.',
  ]) {
    requireText(evidence, expected)
  }
})

test('PR-5 evidence note records the external inputs required for a real staging run', () => {
  for (const expected of [
    'Approved staging frontend origin and backend API target',
    'Approved Clerk/provider login method or controlled browser session',
    'Expected app role and landing route',
    'Seeded assigned store id',
    'Seeded unassigned store id',
    'Approved request month',
    'non-default signing secret',
    'explicit CORS',
    'allowlist',
    'host-only app-session cookie scope',
    'no cookie `Domain` attribute',
    'app-session TTL at or below one hour',
    '`VITE_BROWSER_SESSION_TRANSPORT=cookie`',
  ]) {
    requireText(evidence, expected)
  }
})

test('PR-5 evidence note defines the sanitized proof checklist without accepting bearer proof', () => {
  for (const expected of [
    'app-session cookie exists with value redacted',
    'no cookie `Domain` attribute is present',
    'CSRF nonce transport is proven without recording the nonce value',
    '`localStorage` and `sessionStorage` contain no bearer, id, access, refresh',
    'assigned-store protected action succeeds',
    'unassigned-store protected action returns `403`',
    'unsafe cookie-authenticated request without CSRF returns `403`',
    'logout clears app-session and CSRF cookie state',
    'Legacy bearer staging smoke may remain available',
    'but it is not evidence that launch browser token storage is fixed',
  ]) {
    requireText(evidence, expected)
  }
})

test('PR-5 blocked evidence note does not contain fake staging proof signals or raw secret patterns', () => {
  const forbidden = [
    /real staging cookie-session evidence passed/i,
    /protected staging cookie-session evidence passed/i,
    /broad production:\s*`?go`?/i,
    /broad production is approved/i,
    /production readiness approved/i,
    /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
    /Bearer\s+[A-Za-z0-9._~+/=-]{12,}/i,
    /Set-Cookie:\s*[^;\s]+=[^;\s]+/i,
    /code_verifier\s*[:=]\s*['"]?[A-Za-z0-9._~-]{16,}/i,
    /postgres(?:ql)?:\/\/\S+/i,
    /redis:\/\/\S+/i,
  ]

  for (const pattern of forbidden) {
    assert.doesNotMatch(evidence, pattern)
  }
})

test('security launch train links the PR-5 blocked evidence note', () => {
  requireText(plan, evidencePath)
  requireText(plan, 'PR-5 blocked evidence:')
})
