import assert from 'node:assert/strict'
import test from 'node:test'

import { doctorExitCode } from './test-doctor.mjs'

test('doctor warnings are informative locally and fail only in strict mode', () => {
  const report = { errorCount: 0, warningCount: 2 }
  assert.equal(doctorExitCode(report, false), 0)
  assert.equal(doctorExitCode(report, true), 1)
})

test('doctor errors always fail', () => {
  assert.equal(doctorExitCode({ errorCount: 1, warningCount: 0 }, false), 1)
})
