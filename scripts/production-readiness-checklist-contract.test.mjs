import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')
const checklist = readFileSync(
  join(workspaceRoot, 'docs/plans/production-environment-readiness-checklist.md'),
  'utf8',
)

function requireText(text) {
  assert.match(checklist, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
}

test('production readiness checklist keeps core operator sections', () => {
  for (const heading of [
    '# Production Environment Readiness Checklist',
    '## Decision Rule',
    '## Ownership And Sign-Off',
    '## Environment And Secret Checklist',
    '## Identity Provider Checklist',
    '## Database And Migration Checklist',
    '## Audit, Backup, And Retention Checklist',
    '## Smoke Evidence Checklist',
    '## Go / No-Go Criteria',
    '## JSON Source Readiness Holding Area',
  ]) {
    requireText(heading)
  }
})

test('production readiness checklist preserves no-secret evidence rules', () => {
  for (const phrase of [
    'Do not paste raw bearer tokens',
    'Do not paste raw id tokens',
    'Do not paste refresh tokens',
    'Do not paste client secrets',
    'Do not commit `.env` files',
    'Do not store production credentials in screenshots',
  ]) {
    requireText(phrase)
  }
})

test('production readiness checklist requires guarded release and smoke evidence', () => {
  for (const phrase of [
    'npm.cmd run check:release',
    'npm.cmd run smoke:auth:staging:action',
    'npm.cmd run guard:auth:evidence',
    'assigned-store action returns success',
    'unassigned-store action returns `403`',
  ]) {
    requireText(phrase)
  }
})

test('production readiness checklist keeps JSON source work blocked until payload evidence exists', () => {
  for (const phrase of [
    'JSON sample payload',
    'source-specific adapter remains blocked',
    'canonical raw KPI contract',
    'idempotency key',
    'row hash',
  ]) {
    requireText(phrase)
  }
})
