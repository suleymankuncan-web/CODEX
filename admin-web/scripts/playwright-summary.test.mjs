import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import {
  buildPlaywrightSummary,
  materializePlaywrightSummary,
} from './playwright-summary.mjs'

test('Playwright JSON is summarized for GitHub without copying full logs', () => {
  const markdown = buildPlaywrightSummary({
    stats: { expected: 540, unexpected: 2, flaky: 1, skipped: 3, duration: 900_000 },
  })
  assert.match(markdown, /FAIL.*546 tests/u)
  assert.match(markdown, /540 passed.*2 failed.*1 flaky.*3 skipped/u)
  assert.match(markdown, /15\.00 minutes/u)
})

test('summary materialization appends to the GitHub summary file', (context) => {
  const directory = join(import.meta.dirname, '..', 'test-results')
  const reportPath = join(directory, `summary-report-${process.pid}.json`)
  const summaryPath = join(directory, `summary-output-${process.pid}.md`)
  context.after(() => {
    rmSync(reportPath, { force: true })
    rmSync(summaryPath, { force: true })
  })
  mkdirSync(directory, { recursive: true })
  writeFileSync(reportPath, JSON.stringify({ stats: { expected: 2, duration: 1200 } }))
  const result = materializePlaywrightSummary({ reportPath, summaryPath })
  assert.equal(result.found, true)
  assert.match(readFileSync(summaryPath, 'utf8'), /PASS.*2 tests/u)
})
