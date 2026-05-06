import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')

function readJson(path) {
  return JSON.parse(readFileSync(join(workspaceRoot, path), 'utf8'))
}

test('root package exposes pilot stabilization check', () => {
  const pkg = readJson('package.json')

  assert.equal(
    pkg.scripts['check:pilot-stabilization'],
    'node --test scripts/pilot-route-role-matrix-contract.test.mjs scripts/pilot-release-smoke-checklist-contract.test.mjs scripts/ranking-demo-live-boundary-contract.test.mjs scripts/pilot-stabilization-release-gate-contract.test.mjs && npm.cmd --prefix admin-web run smoke:pilot',
  )
})

test('admin web package exposes pilot smoke command', () => {
  const pkg = readJson('admin-web/package.json')

  assert.equal(
    pkg.scripts['smoke:pilot'],
    'npm run build && playwright test pilot-smoke.spec.ts pilot-api-contracts.spec.ts',
  )
})
