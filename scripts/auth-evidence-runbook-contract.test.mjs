import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')
const runbook = readFileSync(
  join(workspaceRoot, 'docs/plans/phase-7-staging-auth-smoke-runbook.md'),
  'utf8',
)

test('staging auth runbook is an operator checklist, not only a command note', () => {
  for (const heading of [
    '## Roles And Responsibilities',
    '## Operator Checklist',
    '### 1. Environment Preparation',
    '### 2. Preflight Review',
    '### 3. Smoke Execution',
    '### 4. Evidence Review',
    '### 5. Approval Decision',
  ]) {
    assert.match(runbook, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})

test('staging auth runbook preserves security evidence rules', () => {
  for (const phrase of [
    'Do not paste raw bearer tokens',
    'Do not paste raw id tokens',
    'Do not paste refresh tokens',
    'Do not paste authorization codes',
    'Do not paste PKCE `code_verifier` values',
    'Do not paste client secrets',
    'Do not paste client secrets, private keys, cookies, or browser storage dumps',
  ]) {
    assert.match(runbook, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})

test('staging auth runbook defines clear sign-off states', () => {
  assert.match(runbook, /Go/)
  assert.match(runbook, /No-Go/)
  assert.match(runbook, /Conditional Go/)
})

test('staging auth runbook requires guarded evidence before approval', () => {
  assert.match(runbook, /guard:auth:evidence/)
  assert.match(runbook, /--stdin/)
  assert.match(runbook, /Evidence guard passes before the note is approved/)
})
