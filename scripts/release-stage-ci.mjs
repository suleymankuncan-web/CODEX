import { spawnSync } from 'node:child_process'
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildStageInputs, gitText, readJson, reusableStage, stageOutputDigest, makeStageRecord } from './release-recovery.mjs'
import { collectBuildFiles, installBuildFiles, validateBundle, MAX_BUNDLE_BYTES } from './release-recovery-bundle.mjs'
import { artifactName, githubContext, restoreGithubBundle } from './release-recovery-github.mjs'
import { commandInvocation, writeReceiptAtomic } from './release-stage-runner.mjs'
import { verifyPlaywrightBuildReceipt } from '../admin-web/scripts/playwright-build-receipt.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const [action, argument] = process.argv.slice(2)
const transportEnvironment = { ...process.env }
// Transport credentials never enter tests, builds, fingerprints or artifacts.
delete process.env.GITHUB_TOKEN
const context = githubContext(root)
const manifest = readJson(join(root, 'scripts/release-stage-manifest.json'))

function exportBundle(family, record) {
  if (!context) return
  const bundle = { version: 2, family, provenance: context, record, files: collectBuildFiles(root, family) }
  validateBundle(bundle, family)
  const text = JSON.stringify(bundle)
  if (Buffer.byteLength(text) > MAX_BUNDLE_BYTES) throw new Error('Recovery bundle is too large')
  const directory = join(root, 'tmp/release-export', family)
  mkdirSync(directory, { recursive: true })
  writeFileSync(join(directory, 'bundle.json'), text, { mode: 0o600 })
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT,
    'artifact_name=' + artifactName(family, context.runId, context.attempt) + '\n')
}

if (['backend-release', 'frontend-static'].includes(action)) {
  const stage = manifest.stages.find((item) => item.id === action)
  const started = Date.now()
  const inputs = buildStageInputs({ root, stage })
  const candidate = await restoreGithubBundle({ root, family: action, environment: transportEnvironment })
  let record
  let reused = false
  if (candidate?.record.inputs?.digest === inputs.digest) {
    installBuildFiles(root, candidate)
    const decision = reusableStage({ record: candidate.record, stage, inputs, outputDigest: stageOutputDigest(root, stage) })
    if (decision.reuse) { record = candidate.record; reused = true }
  }
  if (!record) {
    for (const command of stage.commands) {
      const invocation = commandInvocation(command)
      const result = spawnSync(invocation.command, invocation.args, {
        cwd: join(root, stage.cwd), env: process.env, stdio: 'inherit', windowsHide: true,
      })
      if (result.error) throw result.error
      if (result.status !== 0) process.exit(result.status ?? 1)
    }
    record = makeStageRecord({ root, stage, inputs, startedAt: new Date(started).toISOString(), durationMs: Date.now() - started })
  }
  if (buildStageInputs({ root, stage }).digest !== inputs.digest) throw new Error('Inputs changed during CI verification')
  exportBundle(action, record)
  const summary = '**' + action + '**: ' + (reused ? 'reused verified inputs' : 'executed') +
    '; ' + ((Date.now() - started) / 1000).toFixed(1) + 's; proof source ' + record.sourceHead + '\n'
  console.log(summary)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary)
} else if (action === 'import-build') {
  const bundle = JSON.parse(readFileSync(argument, 'utf8'))
  validateBundle(bundle, 'frontend-static')
  const p = bundle.provenance
  if (!context || p.repository !== context.repository || p.runId !== context.runId ||
      p.headSha !== context.headSha || p.baseSha !== context.baseSha ||
      p.testedSha !== context.testedSha || p.treeSha !== context.treeSha ||
      p.attempt > context.attempt || bundle.record.status !== 'success') throw new Error('Build provenance does not match the current static job')
  installBuildFiles(root, bundle)
  if (stageOutputDigest(root, { id: 'frontend-static' }) !== bundle.record.outputDigest ||
      !verifyPlaywrightBuildReceipt(join(root, 'admin-web')).valid) throw new Error('Static build artifact identity mismatch')
} else if (action === 'restore-e2e') {
  const path = join(root, 'tmp/release-gate/playwright-recovery.json')
  rmSync(path, { force: true })
  const bundle = await restoreGithubBundle({ root, family: 'frontend-e2e', environment: transportEnvironment })
  if (bundle) {
    mkdirSync(join(root, 'tmp/release-gate'), { recursive: true })
    writeReceiptAtomic(path, bundle.record)
    console.log('[recovery] imported independently verified prior CI test inventory')
  }
} else if (action === 'export-e2e') {
  const record = readJson(join(root, 'tmp/release-gate/playwright-recovery.json'))
  if (record?.version === 2 && !record.globalErrors && record.sourceHead === gitText(root, ['rev-parse', 'HEAD'])) exportBundle('frontend-e2e', record)
} else {
  throw new Error('Usage: release-stage-ci.mjs backend-release|frontend-static|import-build <bundle>|restore-e2e|export-e2e')
}
