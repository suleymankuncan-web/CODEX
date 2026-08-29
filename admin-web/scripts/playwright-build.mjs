import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { PLAYWRIGHT_BUILD_ENVIRONMENT, writePlaywrightBuildReceipt } from './playwright-build-receipt.mjs'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const environment = { ...process.env, ...PLAYWRIGHT_BUILD_ENVIRONMENT }
const isWindows = process.platform === 'win32'
const shell = isWindows ? process.env.ComSpec || 'cmd.exe' : 'npm'
const args = isWindows ? ['/d', '/s', '/c', 'npm.cmd run build'] : ['run', 'build']
const build = spawnSync(shell, args, { cwd: projectRoot, env: environment, stdio: 'inherit' })

if (build.status !== 0) process.exit(build.status ?? 1)
writePlaywrightBuildReceipt(projectRoot)
console.log('Playwright build receipt: exact source, environment, and dist identity recorded')
