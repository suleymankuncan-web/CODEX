import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const appRoot = dirname(scriptsDir)

function runAuthSmoke(args, env = {}) {
  return spawnSync(process.execPath, ['scripts/auth-live-smoke.mjs', ...args], {
    cwd: appRoot,
    env: {
      ...process.env,
      ...env,
    },
    encoding: 'utf8',
  })
}

test('staging smoke fails fast when local defaults are still active', () => {
  const result = runAuthSmoke(['--staging'], {
    AUTH_SMOKE_BASE_URL: '',
    AUTH_SMOKE_API_BASE_URL: '',
    AUTH_SMOKE_USERNAME: '',
    AUTH_SMOKE_PASSWORD: '',
  })
  const output = `${result.stdout}\n${result.stderr}`

  assert.notEqual(result.status, 0)
  assert.match(output, /staging smoke requires AUTH_SMOKE_BASE_URL/)
  assert.doesNotMatch(output, /ECONNREFUSED/)
})

test('staging smoke requires explicit issuer and JWKS evidence metadata', () => {
  const result = runAuthSmoke(['--staging'], {
    AUTH_SMOKE_BASE_URL: 'https://admin.stage.example.com',
    AUTH_SMOKE_API_BASE_URL: 'https://api.stage.example.com/api',
    AUTH_SMOKE_USERNAME: 'stage.store.manager@example.com',
    AUTH_SMOKE_PASSWORD: 'stage-password-redacted',
    AUTH_SMOKE_EXPECTED_ROLE: 'STORE_MANAGER',
    AUTH_SMOKE_ENVIRONMENT: 'staging',
    AUTH_SMOKE_PROVIDER_NAME: 'Corporate Staging IdP',
    AUTH_SMOKE_ACCEPTED_AUDIENCE: 'store-ops-api',
  })
  const output = `${result.stdout}\n${result.stderr}`

  assert.notEqual(result.status, 0)
  assert.match(output, /staging smoke requires AUTH_SMOKE_PROVIDER_ISSUER/)
  assert.doesNotMatch(output, /ENOTFOUND|ECONNREFUSED/)
})

test('package exposes explicit staging auth smoke scripts', () => {
  const packageJson = JSON.parse(readFileSync(join(appRoot, 'package.json'), 'utf8'))

  assert.equal(packageJson.scripts['guard:auth:evidence'], 'node scripts/auth-evidence-guard.mjs')
  assert.equal(packageJson.scripts['smoke:auth:staging'], 'node scripts/auth-live-smoke.mjs --staging')
  assert.equal(
    packageJson.scripts['smoke:auth:staging:action'],
    'node scripts/auth-live-smoke.mjs --staging --include-action-smoke',
  )
  assert.equal(
    packageJson.scripts['smoke:auth:staging:cookie-session'],
    'node scripts/auth-cookie-session-live-smoke.mjs --staging',
  )
  assert.equal(
    packageJson.scripts['smoke:auth:staging:store-manager'],
    'node scripts/auth-store-manager-cookie-session-smoke.mjs --staging',
  )

  const storeManagerSmokeSource = readFileSync(
    join(appRoot, 'scripts/auth-store-manager-cookie-session-smoke.mjs'),
    'utf8',
  )
  assert.match(storeManagerSmokeSource, /PILOT_SM_USERNAME/u)
  assert.match(storeManagerSmokeSource, /AUTH_SMOKE_EXPECTED_ROLE = 'STORE_MANAGER'/u)
  assert.match(storeManagerSmokeSource, /AUTH_SMOKE_EXPECTED_LANDING = '\/store\/home'/u)
})
