import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')
const evidencePath =
  'docs/evidence/readiness/2026-06-12-browser-session-staging-evidence.md'
const packagePath = 'admin-web/package.json'
const smokeScriptPath = 'admin-web/scripts/auth-cookie-session-live-smoke.mjs'
const workspaceIgnorePath = '.gitignore'
const cloudflareConfigPath = 'admin-web/wrangler.jsonc'

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function requireText(text, value) {
  assert.ok(text.includes(value), `Missing expected text: ${value}`)
}

const evidence = readText(evidencePath)
const packageJson = JSON.parse(readText(packagePath))
const smokeScript = readText(smokeScriptPath)

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
    '`POST /api/auth/browser-session` without a bearer token returned `401`',
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

test('browser-session staging evidence names the repeatable cookie-session smoke command', () => {
  requireText(evidence, '## Rerun Command')
  requireText(evidence, 'npm.cmd --prefix admin-web run smoke:auth:staging:cookie-session')

  for (const expected of [
    '`AUTH_SMOKE_BASE_URL`',
    '`AUTH_SMOKE_API_BASE_URL`',
    '`AUTH_SMOKE_USERNAME`',
    '`AUTH_SMOKE_PASSWORD`',
    '`AUTH_SMOKE_OTP`',
    '`AUTH_SMOKE_EXPECTED_ROLE`',
    '`AUTH_SMOKE_EXPECTED_LANDING`',
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

test('cloudflare build keeps local env and secret-bearing files outside the artifact', () => {
  assert.equal(existsSync(join(workspaceRoot, cloudflareConfigPath)), true, `${cloudflareConfigPath} must exist`)
  const workspaceIgnore = readText(workspaceIgnorePath)
  const cloudflareConfig = JSON.parse(readText(cloudflareConfigPath))

  for (const expected of [
    'admin-web/.env',
    'admin-web/.env.local',
    'admin-web/.env.*.local',
    'admin-web/node_modules/',
    'admin-web/dist/',
  ]) {
    requireText(workspaceIgnore, expected)
  }

  assert.equal(cloudflareConfig.assets.directory, './dist')
  assert.equal(cloudflareConfig.main, undefined)
})

test('admin package exposes the repeatable staging cookie-session smoke', () => {
  assert.equal(
    packageJson.scripts['smoke:auth:staging:cookie-session'],
    'node scripts/auth-cookie-session-live-smoke.mjs --staging',
  )
})

test('cookie-session live smoke script guards the launch security contract', () => {
  for (const expected of [
    'AUTH_SMOKE_BASE_URL',
    'AUTH_SMOKE_API_BASE_URL',
    'AUTH_SMOKE_USERNAME',
    'AUTH_SMOKE_PASSWORD',
    'AUTH_SMOKE_OTP',
    'AUTH_SMOKE_EXPECTED_ROLE',
    'AUTH_SMOKE_EXPECTED_LANDING',
    'hr_axis_browser_session',
    'store-ops-admin-session',
    'store-ops-admin-bearer-token',
    'store-ops-admin-provider-id-token',
    'window.__storeOpsBrowserSessionCsrfToken',
    '/api/auth/browser-session',
    'auth/browser-session',
    'auth/session',
    'target-distributions/requests',
    'appSessionBrowserSessionKeyPresent',
    'appSessionTransport',
    'tokenShapedStorageKeys',
    'unsafeMissingHeaderStatus',
    'SMOKE_FAIL',
    'Bearer <redacted>',
    '<redacted-jwt>',
  ]) {
    requireText(smokeScript, expected)
  }
})

test('cookie-session live smoke script does not ship local credentials or raw tokens', () => {
  for (const forbidden of [
    '424242',
    'StoreOps123!',
    'store.manager',
    /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
    /rnd_[A-Za-z0-9_-]+/,
    /postgres(?:ql)?:\/\/\S+/i,
    /redis:\/\/\S+/i,
  ]) {
    if (typeof forbidden === 'string') {
      assert.equal(smokeScript.includes(forbidden), false, `script must not contain ${forbidden}`)
    } else {
      assert.doesNotMatch(smokeScript, forbidden)
    }
  }
})
