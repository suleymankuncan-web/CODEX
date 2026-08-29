import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const appRoot = dirname(scriptsDir)
const previewSource = readFileSync(join(scriptsDir, 'playwright-preview.mjs'), 'utf8')
const buildReceiptSource = readFileSync(join(scriptsDir, 'playwright-build-receipt.mjs'), 'utf8')
const configSource = readFileSync(join(appRoot, 'playwright.config.ts'), 'utf8')

test('Playwright preview build is isolated from developer staging env', () => {
  assert.match(configSource, /node scripts\/playwright-preview\.mjs \$\{previewPort\}/)
  assert.match(configSource, /const releaseWorkerCount = 2/)
  assert.match(configSource, /workers:\s*releaseWorkerCount/)
  assert.match(previewSource, /PLAYWRIGHT_BUILD_ENVIRONMENT/)
  assert.match(buildReceiptSource, /VITE_API_BASE_URL:\s*'\/api'/)
  assert.match(buildReceiptSource, /VITE_SENTRY_ENABLED:\s*'false'/)
  assert.match(buildReceiptSource, /VITE_SENTRY_DSN:\s*''/)
  assert.match(previewSource, /npm\.cmd run build/)
  assert.match(previewSource, /npm\.cmd run preview/)
})
