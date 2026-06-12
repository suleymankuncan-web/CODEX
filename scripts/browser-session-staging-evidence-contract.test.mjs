import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')
const evidencePath =
  'docs/evidence/readiness/2026-06-12-browser-session-staging-evidence.md'
const vercelIgnorePath = 'admin-web/.vercelignore'

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function requireText(text, value) {
  assert.ok(text.includes(value), `Missing expected text: ${value}`)
}

const evidence = readText(evidencePath)

test('browser-session staging evidence records the real sanitized cookie proof', () => {
  assert.equal(existsSync(join(workspaceRoot, evidencePath)), true, `${evidencePath} must exist`)

  for (const expected of [
    '# Browser Session Staging Evidence',
    'Status: guarded',
    'Evidence status: `protected_staging_cookie_session_passed`.',
    'https://staging.hr-axis.com',
    'https://api-staging.hr-axis.com/api',
    'REGION_MANAGER',
    '/admin/competitions',
    '`provider.configured=true`',
    '`POST /api/auth/browser-session` returned `201`',
    '`HttpOnly=true`',
    '`Secure=true`',
    '`SameSite=Lax`',
    '`GET /api/auth/session` returned `200`',
    'Unsafe cookie-authenticated request without `X-CSRF-Token` returned `403`',
    'Logout cleared the backend-owned app-session cookie',
  ]) {
    requireText(evidence, expected)
  }
})

test('browser-session staging evidence keeps token storage and production limits explicit', () => {
  for (const expected of [
    'No raw password, one-time code, bearer token, provider token, cookie value',
    'App browser storage did not contain',
    '`store-ops-admin-bearer-token`',
    '`store-ops-admin-provider-id-token`',
    'No token-shaped values were found in `localStorage` or `sessionStorage`.',
    'This evidence does not approve broad production.',
    'does not claim Store Action create/approve write behavior for a',
    'different persona',
    'target request create endpoint is scoped to `STORE_MANAGER` and `SUPER_ADMIN`',
    'rerun this sanitized proof',
  ]) {
    requireText(evidence, expected)
  }
})

test('browser-session staging evidence does not contain raw secret patterns', () => {
  const forbidden = [
    /broad production:\s*`?go`?/i,
    /broad production is approved/i,
    /production readiness approved/i,
    /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
    /Bearer\s+[A-Za-z0-9._~+/=-]{12,}/i,
    /Set-Cookie:\s*[^;\s]+=[^;\s]+/i,
    /code_verifier\s*[:=]\s*['"]?[A-Za-z0-9._~-]{16,}/i,
    /one-time code\s*[:=]\s*\d{4,}/i,
    /password\s*[:=]\s*\S+/i,
    /postgres(?:ql)?:\/\/\S+/i,
    /redis:\/\/\S+/i,
    /rnd_[A-Za-z0-9_-]+/,
  ]

  for (const pattern of forbidden) {
    assert.doesNotMatch(evidence, pattern)
  }
})

test('vercel deployment ignores local env and secret-bearing files', () => {
  assert.equal(existsSync(join(workspaceRoot, vercelIgnorePath)), true, `${vercelIgnorePath} must exist`)
  const vercelIgnore = readText(vercelIgnorePath)

  for (const expected of [
    '.env',
    '.env.*',
    '!.env.example',
    '!.env*.example',
    '.vercel',
    'node_modules',
    'dist',
    'coverage',
    'playwright-report',
    'test-results',
  ]) {
    requireText(vercelIgnore, expected)
  }
})
