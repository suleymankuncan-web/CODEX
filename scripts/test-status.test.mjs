import assert from 'node:assert/strict'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { collectReleaseStatus, formatDuration } from './test-status.mjs'

test('release status distinguishes successful, invalid, and missing receipts', (context) => {
  const workspaceRoot = join(import.meta.dirname, '..', 'tmp', `test-status-${process.pid}-${Date.now()}`)
  context.after(() => rmSync(workspaceRoot, { recursive: true, force: true }))
  mkdirSync(join(workspaceRoot, 'scripts'), { recursive: true })
  mkdirSync(join(workspaceRoot, 'tmp', 'release-gate'), { recursive: true })
  writeFileSync(
    join(workspaceRoot, 'scripts', 'release-stage-manifest.json'),
    JSON.stringify({
      schemaVersion: 1,
      receiptSchemaVersion: 1,
      stages: [{ id: 'one' }, { id: 'two' }, { id: 'three' }],
    }),
  )
  writeFileSync(
    join(workspaceRoot, 'tmp', 'release-gate', 'one.json'),
    JSON.stringify({
      schemaVersion: 1,
      stageId: 'one',
      status: 'success',
      durationMs: 1250,
      proofIdentityDigest: '1234567890abcdef',
    }),
  )
  writeFileSync(join(workspaceRoot, 'tmp', 'release-gate', 'two.json'), '{bad json')

  assert.deepEqual(
    collectReleaseStatus(workspaceRoot).stages.map(({ id, status }) => ({ id, status })),
    [
      { id: 'one', status: 'success' },
      { id: 'two', status: 'invalid' },
      { id: 'three', status: 'missing' },
    ],
  )
  assert.equal(formatDuration(1250), '1.3s')
})
