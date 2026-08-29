import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import {
  buildReleasePlaywrightEnvironment,
  findAvailablePreviewPort,
} from './playwright-runtime.mjs'

const previewPort = await findAvailablePreviewPort({
  requestedPort: process.env.PLAYWRIGHT_PREVIEW_PORT,
})
const env = buildReleasePlaywrightEnvironment(process.env, previewPort)
console.log(`[playwright-release] isolated preview port=${previewPort}`)

const playwrightCli = fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url))
const result = spawnSync(process.execPath, [playwrightCli, 'test', ...process.argv.slice(2)], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  env,
  stdio: 'inherit',
})

if (result.error) throw result.error
process.exit(result.status ?? 1)
