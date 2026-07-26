import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const appRoot = dirname(scriptsDir)
const workshopSource = readFileSync(join(scriptsDir, 'ui-workshop-dev.mjs'), 'utf8')
const viteSource = readFileSync(join(appRoot, 'vite.config.ts'), 'utf8')

test('UI workshop keeps staging business APIs fail-closed and read-only', () => {
  assert.match(workshopSource, /HR_AXIS_VITE_PROXY_READ_ONLY:\s*'true'/)
  assert.match(viteSource, /new Set\(\['GET', 'HEAD', 'OPTIONS'\]\)/)
  assert.match(viteSource, /new Set\(\['\/api\/auth\/browser-session'\]\)/)
  assert.match(viteSource, /response\.statusCode = 405/)
  assert.match(viteSource, /error:\s*'workshop_read_only'/)
  assert.doesNotMatch(viteSource, /safeWorkshopMethods[^\n]*(POST|PATCH|PUT|DELETE)/)
})
