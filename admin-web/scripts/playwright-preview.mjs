import { spawn, spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PLAYWRIGHT_BUILD_ENVIRONMENT, verifyPlaywrightBuildReceipt } from './playwright-build-receipt.mjs'

const rawPort = process.argv[2] ?? '4174'
if (!/^\d{4,5}$/.test(rawPort)) {
  throw new Error('Playwright preview port must be a four or five digit number')
}

const testBuildEnvironment = {
  ...process.env,
  ...PLAYWRIGHT_BUILD_ENVIRONMENT,
}
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const isWindows = process.platform === 'win32'
const shell = isWindows ? process.env.ComSpec || 'cmd.exe' : 'npm'
const buildArguments = isWindows
  ? ['/d', '/s', '/c', 'npm.cmd run build:e2e']
  : ['run', 'build:e2e']
const receipt = verifyPlaywrightBuildReceipt(projectRoot)
if (receipt.valid) {
  console.log('Playwright preview: reusing exact static-stage build receipt')
} else {
  console.log(`Playwright preview: rebuilding because ${receipt.reason}`)
  const build = spawnSync(shell, buildArguments, { cwd: projectRoot, env: testBuildEnvironment, stdio: 'inherit' })
  if (build.status !== 0) process.exit(build.status ?? 1)
}

const previewArguments = isWindows
  ? ['/d', '/s', '/c', `npm.cmd run preview -- --host 127.0.0.1 --port ${rawPort}`]
  : ['run', 'preview', '--', '--host', '127.0.0.1', '--port', rawPort]
const preview = spawn(shell, previewArguments, {
  cwd: projectRoot,
  env: testBuildEnvironment,
  stdio: 'inherit',
})

const stopPreview = (signal) => {
  if (!preview.killed) preview.kill(signal)
}

process.once('SIGINT', () => stopPreview('SIGINT'))
process.once('SIGTERM', () => stopPreview('SIGTERM'))
preview.once('error', (error) => {
  console.error(error.message)
  process.exit(1)
})
preview.once('exit', (code) => process.exit(code ?? 0))
