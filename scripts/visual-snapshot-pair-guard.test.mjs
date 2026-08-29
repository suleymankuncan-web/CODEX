import assert from 'node:assert/strict'
import test from 'node:test'

import {
  snapshotPairKey,
  validateSnapshotPairs,
} from './visual-snapshot-pair-guard.mjs'

const linux =
  'admin-web/e2e/example.spec.ts-snapshots/example-1440x900-chromium-linux.png'
const win32 =
  'admin-web/e2e/example.spec.ts-snapshots/example-1440x900-chromium-win32.png'

test('snapshot pair identity keeps the platform outside the stable key', () => {
  assert.deepEqual(snapshotPairKey(linux), {
    key: 'admin-web/e2e/example.spec.ts-snapshots/example-1440x900',
    platform: 'linux',
  })
  assert.equal(snapshotPairKey('admin-web/e2e/notes.txt'), null)
})

test('paired Windows and Linux snapshots pass when both change together', () => {
  assert.deepEqual(validateSnapshotPairs([linux, win32], [linux, win32]), {
    pairCount: 1,
    errors: [],
  })
})

test('missing platform counterpart fails closed', () => {
  const result = validateSnapshotPairs([win32])
  assert.equal(result.pairCount, 1)
  assert.match(result.errors[0], /missing linux snapshot counterpart/)
})

test('one-sided snapshot refresh fails before hosted Linux E2E', () => {
  const result = validateSnapshotPairs([linux, win32], [win32])
  assert.equal(result.pairCount, 1)
  assert.match(result.errors[0], /win32 changed without its linux counterpart/)
})
