import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { buildStageInputs, gitText, readJson, treeDigest } from '../../scripts/release-recovery.mjs'
import { sha256, stableJson } from '../../scripts/release-stage-proof.mjs'
import { reportCases, specDigests, uncertainSpecDependencies, selectSpecRecovery, combineSpecResults } from './playwright-recovery.mjs'
import { PLAYWRIGHT_BUILD_ENVIRONMENT, verifyPlaywrightBuildReceipt } from './playwright-build-receipt.mjs'
import { commandInvocation } from '../../scripts/release-stage-runner.mjs'

const require = createRequire(import.meta.url)
export async function runRecoverablePlaywright({ adminRoot, cli, env, resume }) {
  const root = resolve(adminRoot, '..')
  const ledgerPath = join(root, 'tmp/release-gate/playwright-recovery.json')
  const previous = resume ? readJson(ledgerPath) : null
  // Invalidate before build, inventory and browser launch as well as execution.
  // An interrupted startup must not republish a previous successful run.
  rmSync(ledgerPath, { force: true })
  if (!verifyPlaywrightBuildReceipt(adminRoot).valid) {
    const invocation = commandInvocation(['npm', 'run', 'build:e2e'])
    const build = spawnSync(invocation.command, invocation.args, {
      cwd: adminRoot, env: { ...env, ...PLAYWRIGHT_BUILD_ENVIRONMENT }, stdio: 'inherit', windowsHide: true,
    })
    if (build.status !== 0) throw new Error('Playwright build failed')
  }
  const run = (args, capture = false) => spawnSync(process.execPath, [cli, 'test', ...args], {
    cwd: adminRoot, env, encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    windowsHide: true, maxBuffer: 32 * 1024 * 1024,
  })
  // Enumerate the actual runner inventory, not a regexp approximation of test().
  const listed = run(['--list', '--reporter=json'], true)
  if (listed.status !== 0) throw new Error('Playwright inventory could not be enumerated')
  const inventory = reportCases(JSON.parse(listed.stdout))
  const stage = { id: 'frontend-e2e', cwd: 'admin-web', commands: [['npm', 'run', 'check:release:e2e']] }
  const browser = await require('@playwright/test').chromium.launch({
    headless: true, ...(env.PLAYWRIGHT_USE_SYSTEM_CHROME === '1' ? { channel: 'chrome' } : {}),
  })
  const browserVersion = browser.version()
  await browser.close()
  const buildDigest = treeDigest(root, 'admin-web/dist')
  if (!buildDigest) throw new Error('Release E2E requires the verified static build')
  const inputs = () => buildStageInputs({ root, stage, family: 'frontend-e2e-shared',
    toolchain: { browser: browserVersion, buildDigest },
  })
  const shared = inputs()
  const beforeDigests = specDigests(root)
  const policy = readJson(join(adminRoot, 'scripts/playwright-recovery-policy.json'))
  if (policy?.version !== 1 || !Array.isArray(policy.reviewedSpecs)) throw new Error('Invalid recovery policy')
  const selection = selectSpecRecovery({
    inventory, previous, sharedDigest: shared.digest, digests: beforeDigests,
    reviewedSpecs: policy.reviewedSpecs, uncertain: uncertainSpecDependencies(root),
  })
  console.log('[playwright-recovery] ' + selection.reason + '; execute=' + selection.execute.length + ' specs; reuse=' + selection.reused.length)
  mkdirSync(join(root, 'tmp/release-gate'), { recursive: true })
  const reportPath = join(adminRoot, 'test-results/playwright-results.json')
  rmSync(reportPath, { force: true })
  const started = Date.now()
  const execution = selection.execute.length
    ? run(selection.execute.map((file) => file.replace(/[.*+?^$\{\}()|[\]\\]/g, '\\$&') + '$'))
    : { status: 0 }
  if (inputs().digest !== shared.digest || stableJson(specDigests(root)) !== stableJson(beforeDigests) ||
      treeDigest(root, 'admin-web/dist') !== buildDigest) throw new Error('E2E inputs or output changed during execution')
  const report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8')) : null
  const ledger = combineSpecResults({
    inventory, previous, selection, report, sharedDigest: shared.digest, digests: beforeDigests,
    sourceHead: gitText(root, ['rev-parse', 'HEAD']), exitCode: execution.status,
  })
  ledger.wallTimeMs = Date.now() - started
  ledger.inventoryDigest = sha256(stableJson(inventory.map((item) => item.id).sort()))
  const temp = ledgerPath + '.' + process.pid + '.tmp'
  writeFileSync(temp, JSON.stringify(ledger, null, 2) + '\n', { mode: 0o600 })
  const { renameSync } = require('node:fs')
  renameSync(temp, ledgerPath)
  console.log('[playwright-recovery] ' + ledger.outcome + ': ' + ledger.executedCount + ' executed + ' +
    ledger.reusedCount + ' retained = ' + ledger.cases.length + ' verified cases; ' + (ledger.wallTimeMs / 1000).toFixed(1) + 's')
  return ledger.outcome === 'passed' ? 0 : 1
}
