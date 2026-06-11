import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function requireText(text, expected, message = `${expected} must be present`) {
  assert.match(text, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), message)
}

function readEnvExampleValue(example, variable) {
  const line = example.split(/\r?\n/).find((entry) => entry.startsWith(`${variable}=`))
  assert.ok(line, `${variable} must be present in example env`)
  return line.slice(variable.length + 1).trim()
}

const plan = readText('docs/plans/security-launch-blocker-pr-train-v1.md')
const inventory = readText('docs/plans/environment-variable-inventory.md')
const authShelf = readText('docs/domains/auth.md')
const backendEnvExample = readText('backend/nestjs/.env.example')
const frontendEnvExample = readText('admin-web/.env.example')
const appConfigService = readText('backend/nestjs/src/shared/app-config.service.ts')
const sessionStorage = readText('admin-web/src/features/session/session-storage.ts')

const backendVariables = [
  'BROWSER_SESSION_COOKIE_ENABLED',
  'BROWSER_SESSION_COOKIE_NAME',
  'BROWSER_SESSION_CSRF_COOKIE_NAME',
  'BROWSER_SESSION_SECRET',
  'BROWSER_SESSION_PREVIOUS_SECRET',
  'BROWSER_SESSION_TTL_SECONDS',
  'BROWSER_SESSION_RENEWAL_WINDOW_SECONDS',
  'BROWSER_SESSION_SAME_SITE',
]

test('browser-session backend env contract is documented, exampled, and read by config', () => {
  for (const variable of backendVariables) {
    requireText(plan, `\`${variable}\``)
    requireText(inventory, `\`${variable}\``)
    requireText(appConfigService, `"${variable}"`)
    readEnvExampleValue(backendEnvExample, variable)
  }

  assert.equal(readEnvExampleValue(backendEnvExample, 'BROWSER_SESSION_COOKIE_ENABLED'), 'false')
  assert.equal(readEnvExampleValue(backendEnvExample, 'BROWSER_SESSION_SECRET'), '')
  assert.equal(readEnvExampleValue(backendEnvExample, 'BROWSER_SESSION_PREVIOUS_SECRET'), '')
  assert.equal(readEnvExampleValue(backendEnvExample, 'BROWSER_SESSION_TTL_SECONDS'), '900')
  assert.equal(readEnvExampleValue(backendEnvExample, 'BROWSER_SESSION_RENEWAL_WINDOW_SECONDS'), '120')
  assert.equal(readEnvExampleValue(backendEnvExample, 'BROWSER_SESSION_SAME_SITE'), 'lax')
})

test('frontend browser-session transport is separate from auth mode', () => {
  requireText(plan, '`VITE_BROWSER_SESSION_TRANSPORT`')
  requireText(inventory, '`VITE_BROWSER_SESSION_TRANSPORT`')
  requireText(authShelf, 'VITE_BROWSER_SESSION_TRANSPORT')
  requireText(sessionStorage, 'import.meta.env.VITE_BROWSER_SESSION_TRANSPORT')
  requireText(sessionStorage, 'resolveBrowserSessionTransport')

  assert.equal(readEnvExampleValue(frontendEnvExample, 'VITE_AUTH_MODE'), 'mock')
  assert.equal(readEnvExampleValue(frontendEnvExample, 'VITE_BROWSER_SESSION_TRANSPORT'), 'bearer')
  assert.equal(readEnvExampleValue(frontendEnvExample, 'VITE_BEARER_TOKEN'), '')
})

test('browser-session contract keeps host-only cookies and response nonce transport explicit', () => {
  for (const phrase of [
    'host-only',
    'no `Domain` attribute',
    'frontend-readable response body',
    'does not depend on a frontend-readable API-host cookie',
    'VITE_AUTH_MODE` keeps the existing `mock`/`bearer` contract',
    'production-like values above 3600 seconds require explicit owner',
    'reject `SameSite=None` unless secure cookies are enabled',
  ]) {
    requireText(plan, phrase)
  }

  assert.doesNotMatch(backendEnvExample, /^BROWSER_SESSION_COOKIE_DOMAIN=/m)
  assert.doesNotMatch(appConfigService, /BROWSER_SESSION_COOKIE_DOMAIN/)
})
