import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const guardDocPath = 'docs/plans/staging-auth-session-edge-evidence-guard-v1.md'
const currentStatePath = 'current-state.md'
const gatePath = 'docs/plans/pilot-readiness-gate-v1.md'
const checklistPath = 'docs/plans/controlled-pilot-operating-checklist-v1.md'
const runbookPath = 'docs/plans/phase-7-staging-auth-smoke-runbook.md'
const evidenceTemplatePath = 'docs/plans/phase-7-auth-evidence-template.md'
const debtLedgerPath = 'docs/plans/project-debt-ledger.md'
const activeNextActionsPath = 'docs/plans/active-next-actions.md'
const packagePath = 'admin-web/package.json'
const liveSmokePath = 'admin-web/scripts/auth-live-smoke.mjs'
const evidenceGuardPath = 'admin-web/scripts/auth-evidence-guard.mjs'

function readText(path) {
  return readFileSync(path, 'utf8')
}

function requireText(text, value) {
  assert.ok(text.includes(value), `Missing expected text: ${value}`)
}

const guardDoc = existsSync(guardDocPath) ? readText(guardDocPath) : ''
const currentState = readText(currentStatePath)
const gate = readText(gatePath)
const checklist = readText(checklistPath)
const runbook = readText(runbookPath)
const evidenceTemplate = readText(evidenceTemplatePath)
const debtLedger = readText(debtLedgerPath)
const activeNextActions = readText(activeNextActionsPath)
const packageJson = JSON.parse(readText(packagePath))
const liveSmoke = readText(liveSmokePath)
const evidenceGuard = readText(evidenceGuardPath)

test('staging auth session edge evidence guard document records the controlled boundary', () => {
  assert.equal(existsSync(guardDocPath), true, `${guardDocPath} must exist`)

  for (const expected of [
    '# Staging Auth Session Edge Evidence Guard V1',
    'Controlled staging/internal pilot: `Conditional Go`.',
    'Broad production rollout: `No-Go`.',
    'This guard does not approve broad production rollout.',
    'Logout edge evidence',
    'Expired-token edge evidence',
    'No raw bearer tokens',
    'No refresh token',
    'guard:auth:evidence',
    'smoke:auth:staging',
    'smoke:auth:staging:action',
  ]) {
    requireText(guardDoc, expected)
  }
})

test('staging auth live smoke already emits logout and expired-token evidence fields', () => {
  for (const expected of [
    "await page.goto('/auth/logout')",
    'logoutRequests',
    'bearerTokenStoredAfterLogout',
    'providerIdTokenStoredAfterLogout',
    'makeExpiredJwt()',
    'authorizationHeaderSent',
    'browserRefreshTokenUsed: false',
    "landingRoute: new URL(expiredPage.url()).pathname",
  ]) {
    requireText(liveSmoke, expected)
  }

  assert.equal(packageJson.scripts['smoke:auth:staging'], 'node scripts/auth-live-smoke.mjs --staging')
  assert.equal(
    packageJson.scripts['smoke:auth:staging:action'],
    'node scripts/auth-live-smoke.mjs --staging --include-action-smoke',
  )
})

test('auth evidence guard rejects missing logout or expired-token edge proof', () => {
  for (const expected of [
    "requireEqual(evidence, failures, ['logout', 'returnedToLogin'], true)",
    "requireEqual(evidence, failures, ['logout', 'bearerTokenStoredAfterLogout'], false)",
    "requireEqual(evidence, failures, ['logout', 'providerIdTokenStoredAfterLogout'], false)",
    "requireEqual(evidence, failures, ['expiredToken', 'expiredJwtCleared'], true)",
    "requireEqual(evidence, failures, ['expiredToken', 'idTokenCleared'], true)",
    "requireEqual(evidence, failures, ['expiredToken', 'authorizationHeaderSent'], false)",
    "requireEqual(evidence, failures, ['expiredToken', 'browserRefreshTokenUsed'], false)",
  ]) {
    requireText(evidenceGuard, expected)
  }
})

test('runbook and evidence template keep logout and expired-token review explicit', () => {
  for (const text of [runbook, evidenceTemplate]) {
    for (const expected of [
      'Logout',
      'Expired Token',
      'id_token_hint',
      'browser returns to `/auth/login`',
      'expired bearer JWT is cleared',
      'API requests do not include `Authorization: Bearer <expired-jwt>`',
      'No refresh token',
    ]) {
      requireText(text, expected)
    }
  }
})

test('pilot handoff gate and checklist link the staging auth session edge guard', () => {
  for (const text of [currentState, gate, checklist]) {
    requireText(text, guardDocPath)
  }

  requireText(currentState, 'The staging auth session edge evidence guard is')
  requireText(gate, 'staging auth session edge evidence guard')
  requireText(checklist, 'Auth session edge guard:')
})

test('staging auth session edge guard is counted as closed evidence work', () => {
  requireText(debtLedger, '93. Staging Auth Session Edge Evidence Guard V1')
  requireText(debtLedger, 'Staging Auth Session Edge Evidence Guard V1 is counted as paid because')
  requireText(activeNextActions, 'Staging Auth Session Edge Evidence Guard V1 is counted as paid')
  requireText(activeNextActions, '### Completed: Staging Auth Session Edge Evidence Guard V1')
})
