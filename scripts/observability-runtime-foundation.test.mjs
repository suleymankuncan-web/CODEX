import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const panel = readText('admin-web/src/pages/operations-api-failure-snapshot-panel.tsx')
const page = readText('admin-web/src/pages/OperationsControlTowerPage.tsx')
const messages = readText('admin-web/src/features/localization/messages/admin-operations.ts')
const e2e = readText('admin-web/e2e/operations-surfaces.spec.ts')

test('project health PR-6 API failure snapshot stays providerless and local-session only', () => {
  assert.match(panel, /window\.__STORE_OPS_API_FAILURES__/)
  assert.match(panel, /store-ops-api-failure/)
  assert.match(panel, /ApiFailureDiagnostic/)
  assert.match(panel, /API_FAILURE_PREVIEW_LIMIT = 5/)
  assert.doesNotMatch(panel, /\bfetch\(/)
  assert.doesNotMatch(panel, /\bsendJson\b/)
  assert.doesNotMatch(panel, /\blocalStorage\b/)
  assert.doesNotMatch(panel, /\bsessionStorage\b/)
  assert.doesNotMatch(panel, /\bSentry\b|\bDatadog\b|\bBetterStack\b|\bLogtail\b/)
})

test('project health PR-6 operations page exposes the snapshot without route or scope changes', () => {
  assert.match(page, /OperationsApiFailureSnapshotPanel/)
  assert.match(page, /<OperationsApiFailureSnapshotPanel locale=\{locale\} t=\{t\} \/>/)
  assert.doesNotMatch(page, /adminRoute\(/)
  assert.doesNotMatch(page, /getOperationsHealth\([^)]*api.failure/)
})

test('project health PR-6 copy states the runtime boundary honestly', () => {
  assert.match(messages, /browser oturumunda yakalanan/)
  assert.match(messages, /No provider, backend endpoint, DB record, or alert delivery was added/)
  assert.match(messages, /does not claim app-level monitoring/)
  assert.match(messages, /window\.__STORE_OPS_API_FAILURES__/)
})

test('project health PR-6 e2e covers empty and populated local diagnostics', () => {
  assert.match(e2e, /No API failures were captured in this browser session/)
  assert.match(e2e, /window\.__STORE_OPS_API_FAILURES__ = \[/)
  assert.match(e2e, /\/reports\/rankings\/:uuid/)
  assert.match(e2e, /No provider, backend endpoint, DB record, or alert delivery was added/)
})

function readText(path) {
  return readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
}
