import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const config = readFileSync(new URL('../playwright.config.ts', import.meta.url), 'utf8')

test('release E2E keeps file serialism with the bounded two-worker policy', () => {
  assert.match(config, /const releaseWorkerCount = 2/)
  assert.match(config, /workers: releaseWorkerCount/)
  assert.match(config, /fullyParallel: false/)
})
