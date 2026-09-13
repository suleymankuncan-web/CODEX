import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { buildStageInputs, MAX_PROOF_AGE_MS, recoveryEnvironment, reusableStage, stageInputPaths, stageOutputDigest } from './release-recovery.mjs'
import { prepareStageRecovery, recordStageRecovery } from './release-stage-execution.mjs'
import { writeReceiptAtomic } from './release-stage-runner.mjs'

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'release-recovery-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const put = (path, text) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text) }
  put('.gitignore', 'tmp/\nadmin-web/dist/\nbackend/nestjs/dist/\n.env\n')
  for (const path of ['admin-web/e2e/a.spec.ts', 'admin-web/e2e/helpers.ts', 'admin-web/src/app.ts',
    'backend/nestjs/src/app.ts', 'admin-web/package-lock.json', 'backend/nestjs/package-lock.json',
    'admin-web/playwright.config.ts', 'scripts/release-stage-manifest.json']) put(path, '{}')
  for (const args of [['init', '-q'], ['add', '.'], ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'fixture']]) {
    execFileSync('git', args, { cwd: root, stdio: 'ignore' })
  }
  put('backend/nestjs/dist/main.js', 'backend')
  put('admin-web/dist/index.html', 'frontend')
  return { root, put }
}
const stage = (id) => ({ id, cwd: '.', commands: [['node', '--version']] })

test('only reviewed file families are excluded; unknown configuration remains an input', () => {
  const paths = ['admin-web/e2e/a.spec.ts', 'admin-web/e2e/fixtures.ts', 'admin-web/src/app.ts', 'unknown', 'admin-web/package-lock.json']
  assert.deepEqual(stageInputPaths(paths, 'frontend-static'), paths.slice(1))
  assert.deepEqual(stageInputPaths(paths, 'backend-release'), ['unknown', 'admin-web/package-lock.json'])
  assert.deepEqual(stageInputPaths(paths, 'other'), paths)
})

test('spec-only edits retain static/backend inputs but source, helpers, locks, environment and unknown files invalidate', (t) => {
  const { root, put } = fixture(t)
  const backend = () => buildStageInputs({ root, stage: stage('backend-release') }).digest
  const frontend = () => buildStageInputs({ root, stage: stage('frontend-static') }).digest
  const b = backend(), f = frontend()
  put('admin-web/e2e/a.spec.ts', 'fixed assertion')
  assert.equal(backend(), b); assert.equal(frontend(), f)
  put('admin-web/src/app.ts', 'source changed')
  assert.equal(backend(), b); assert.notEqual(frontend(), f)
  for (const path of ['admin-web/e2e/helpers.ts', 'admin-web/playwright.config.ts',
    'admin-web/package-lock.json', 'backend/nestjs/package-lock.json', '.env', 'unknown.config']) {
    const before = frontend()
    put(path, 'changed')
    assert.notEqual(frontend(), before, path)
  }
  put('backend/nestjs/src/app.ts', 'changed')
  assert.notEqual(backend(), b)
})

test('execution metadata is separate while unknown environment and secret changes invalidate', (t) => {
  const { root } = fixture(t)
  const env = { GITHUB_RUN_ID: '1', GITHUB_SHA: 'a', RUNNER_NAME: 'one', FEATURE: 'one', SECRET: 'hidden' }
  const before = recoveryEnvironment(root, env)
  assert.equal(before, recoveryEnvironment(root, { ...env, GITHUB_RUN_ID: '2', GITHUB_SHA: 'b', RUNNER_NAME: 'two' }))
  assert.notEqual(before, recoveryEnvironment(root, { ...env, FEATURE: 'two' }))
  assert.notEqual(before, recoveryEnvironment(root, { ...env, SECRET: 'rotated' }))
  assert.doesNotMatch(before, /hidden|rotated/)
})

test('real output deletion/tampering, missing proof, expiry and fresh mode cannot reuse', (t) => {
  const { root, put } = fixture(t)
  const s = stage('frontend-static')
  const prepared = prepareStageRecovery({ root, stage: s, resume: true })
  assert.equal(prepared.reuse, false)
  recordStageRecovery({ root, stage: s, prepared, startedAt: new Date().toISOString(), durationMs: 5, write: writeReceiptAtomic })
  const valid = prepareStageRecovery({ root, stage: s, resume: true })
  assert.equal(valid.reuse, true)
  assert.equal(prepareStageRecovery({ root, stage: s, resume: false }).reuse, false)
  assert.equal(reusableStage({ record: valid.record, stage: s, inputs: valid.inputs,
    outputDigest: stageOutputDigest(root, s), now: Date.now() + MAX_PROOF_AGE_MS + 1000 }).reuse, false)
  put('admin-web/dist/index.html', 'tampered')
  assert.equal(prepareStageRecovery({ root, stage: s, resume: true }).reuse, false)
  rmSync(join(root, 'admin-web/dist/index.html'))
  assert.equal(prepareStageRecovery({ root, stage: s, resume: true }).reuse, false)
  for (const id of ['root-contracts', 'frontend-e2e', 'dependency-audit']) {
    assert.equal(reusableStage({ record: { ...valid.record, stageId: id }, stage: { ...stage(id), volatile: id === 'dependency-audit' },
      inputs: valid.inputs, outputDigest: valid.record.outputDigest }).reuse, false)
  }
})

test('proof cannot be recorded after source mutation during a stage', (t) => {
  const { root, put } = fixture(t)
  const s = stage('frontend-static')
  const prepared = prepareStageRecovery({ root, stage: s, resume: false })
  put('admin-web/src/app.ts', 'changed during build')
  assert.throws(() => recordStageRecovery({ root, stage: s, prepared, startedAt: new Date().toISOString(), durationMs: 1, write: writeReceiptAtomic }), /inputs changed/)
})
