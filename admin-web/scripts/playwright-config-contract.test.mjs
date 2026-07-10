import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const config = readFileSync(new URL('../playwright.config.ts', import.meta.url), 'utf8')

test('release E2E keeps file serialism with bounded CI-only parallelism', () => {
  assert.match(config, /const ciWorkerCount = process\.env\.CI \? 2 : 1/)
  assert.match(config, /workers: ciWorkerCount/)
  assert.match(config, /fullyParallel: false/)
})
