import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { runRecoverablePlaywright } from './playwright-recovery-runner.mjs'

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
if (process.argv.length === 2) {
  process.exit(await runRecoverablePlaywright({
    adminRoot: fileURLToPath(new URL('..', import.meta.url)), cli: playwrightCli, env,
    resume: process.env.RELEASE_RECOVERY_MODE === 'resume',
  }))
}
const result = spawnSync(process.execPath, [playwrightCli, 'test', ...process.argv.slice(2)], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  env,
  stdio: 'inherit',
})

if (result.error) throw result.error
process.exit(result.status ?? 1)
