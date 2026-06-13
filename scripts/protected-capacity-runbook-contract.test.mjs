import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')
const runbookPath = join(workspaceRoot, 'docs/plans/protected-capacity-runbook-v1.md')
const runbook = readFileSync(runbookPath, 'utf8')

test('protected capacity runbook names the required role token env vars', () => {
  assert.match(runbook, /CAPACITY_STORE_MANAGER_TOKEN/)
  assert.match(runbook, /CAPACITY_REGION_MANAGER_TOKEN/)
  assert.match(runbook, /CAPACITY_SUPER_ADMIN_TOKEN/)
})

test('protected capacity runbook locks the accepted protected ladder command', () => {
  assert.match(runbook, /\$env:CAPACITY_PROFILES='store-manager,region-manager,admin'/)
  assert.match(runbook, /\$env:CAPACITY_LEVELS='1,5,10,25'/)
  assert.match(runbook, /\$env:CAPACITY_MAX_LEVEL='25'/)
  assert.match(runbook, /\$env:CAPACITY_TIMEOUT_MS='45000'/)
  assert.match(runbook, /npm\.cmd run capacity:read/)
})

test('protected capacity runbook blocks shared-token acceptance runs', () => {
  assert.match(runbook, /CAPACITY_ALLOW_SHARED_TOKEN[\s\S]*must not be used/i)
  assert.doesNotMatch(runbook, /CAPACITY_ALLOW_SHARED_TOKEN='?true'?/i)
})

test('protected capacity runbook requires clear pass and blocked criteria', () => {
  assert.match(runbook, /Result status is `ok`/)
  assert.match(runbook, /Max measured concurrency is `25`/)
  assert.match(runbook, /Blocked profile count is `0`/)
  assert.match(runbook, /Failed level count is `0`/)
  assert.match(runbook, /Availability is `100%`/)
  assert.match(runbook, /Store manager p95 stays `<=2000ms`/)
  assert.match(runbook, /Region manager and admin p95 stay `<=2500ms`/)
  assert.match(runbook, /Any required token env var is absent/)
  assert.match(runbook, /Endpoint calls for blocked profiles are `0`/)
  assert.match(runbook, /protected capacity remains unproven/i)
  assert.match(runbook, /Record the run as `failed` \/ No-Go, not `blocked`/)
  assert.match(runbook, /does not reach concurrency `25` after any protected endpoint call/)
})

test('protected capacity runbook ships no raw auth material or broad launch claims', () => {
  assert.doesNotMatch(runbook, /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/)
  assert.doesNotMatch(runbook, /\bBearer\s+[A-Za-z0-9._-]{20,}\b/i)

  for (const phrase of [
    ['production', 'ready'].join(' '),
    ['broad launch', 'approved'].join(' '),
    ['700 concurrent users', 'proven'].join(' '),
  ]) {
    assert.doesNotMatch(runbook, new RegExp(escapeRegExp(phrase), 'i'))
  }
})

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
