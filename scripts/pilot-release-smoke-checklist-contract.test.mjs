import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')
const checklist = readFileSync(
  join(workspaceRoot, 'docs/plans/pilot-release-smoke-checklist.md'),
  'utf8',
)

function requireText(expected) {
  assert.ok(checklist.includes(expected), `checklist must include ${expected}`)
}

test('pilot release checklist documents deploy decision rules', () => {
  for (const phrase of [
    '# Pilot Release Smoke Checklist',
    '## Decision Rule',
    'Frontend-only change',
    'Backend/API change',
    'Database migration change',
    'Vercel deployment id',
    'Git commit hash',
    'Render deploy',
  ]) {
    requireText(phrase)
  }
})

test('pilot release checklist covers required smoke URLs', () => {
  for (const route of [
    '/admin/integrations',
    '/admin/master-data',
    '/admin/targets',
    '/store',
    '/store/me',
    '/store/rankings',
    '/store/approvals',
  ]) {
    requireText(route)
  }
})

test('pilot release checklist covers cache and old chunk recovery', () => {
  for (const phrase of [
    'Old chunk symptoms',
    'Close all browser windows',
    'Hard refresh',
    'Verify the Vercel deployment id maps to the expected Git commit hash',
  ]) {
    requireText(phrase)
  }
})
