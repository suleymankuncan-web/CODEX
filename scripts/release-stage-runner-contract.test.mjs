import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { test } from 'node:test'

import {
  acquireReleaseLock,
  commandInvocation,
  terminationInvocation,
  terminateProcessTree,
  writeReceiptAtomic,
} from './release-stage-runner.mjs'
import { evaluateReleaseWorkflowFinal } from './release-workflow-final.mjs'
import {
  commandDigest,
  digestReleaseEnvironment,
  digestWorkspaceFiles,
  receiptCanBeReused,
  receiptDigest,
  validateReleaseManifest,
} from './release-stage-proof.mjs'

const workspaceRoot = join(import.meta.dirname, '..')

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

test('canonical release stage manifest and runner exist', () => {
  assert.equal(existsSync(join(workspaceRoot, 'scripts/release-stage-manifest.json')), true)
  assert.equal(existsSync(join(workspaceRoot, 'scripts/release-stage-runner.mjs')), true)
})

test('release stage manifest preserves the complete proof families', () => {
  const manifest = JSON.parse(readText('scripts/release-stage-manifest.json'))
  const byId = new Map(manifest.stages.map((stage) => [stage.id, stage]))

  assert.equal(manifest.schemaVersion, 1)
  assert.deepEqual([...byId], [
    ['root-contracts', byId.get('root-contracts')],
    ['backend-release', byId.get('backend-release')],
    ['frontend-static', byId.get('frontend-static')],
    ['dependency-audit', byId.get('dependency-audit')],
    ['frontend-e2e', byId.get('frontend-e2e')],
  ])
  assert.deepEqual(byId.get('backend-release').dependsOn, ['root-contracts'])
  assert.deepEqual(byId.get('frontend-static').dependsOn, ['root-contracts'])
  assert.deepEqual(byId.get('dependency-audit').dependsOn, ['root-contracts'])
  assert.deepEqual(byId.get('frontend-e2e').dependsOn, ['frontend-static', 'backend-release'])
  assert.equal(byId.get('dependency-audit').volatile, true)
  assert.equal(byId.get('frontend-e2e').commands.length, 1)
  assert.equal(validateReleaseManifest(manifest), manifest)
  assert.throws(
    () =>
      validateReleaseManifest({
        ...manifest,
        stages: manifest.stages.map((stage) =>
          stage.id === 'frontend-e2e' ? { ...stage, cwd: '../outside' } : stage,
        ),
      }),
    /Invalid cwd/,
  )
  assert.throws(
    () =>
      validateReleaseManifest({
        ...manifest,
        stages: manifest.stages.map((stage) =>
          stage.id === 'root-contracts'
            ? { ...stage, dependsOn: ['frontend-e2e'] }
            : stage,
        ),
      }),
    /dependency cycle/,
  )
  assert.throws(
    () =>
      validateReleaseManifest({
        ...manifest,
        stages: manifest.stages.map((stage) =>
          stage.id === 'frontend-e2e'
            ? { ...stage, commands: [['npm', 'run', 'test:e2e&echo-pwned']] }
            : stage,
        ),
      }),
    /invalid command/,
  )
})

test('receipt reuse is exact, dependency-bound, and volatile stages always rerun', () => {
  const stage = {
    id: 'frontend-e2e',
    cwd: 'admin-web',
    commands: [['npm', 'run', 'check:release:e2e']],
    dependsOn: ['frontend-static'],
    volatile: false,
  }
  const upstreamReceiptDigests = { 'frontend-static': 'static-receipt' }
  const receipt = {
    schemaVersion: 1,
    stageId: stage.id,
    status: 'success',
    startedAt: '2026-07-16T10:00:00.000Z',
    completedAt: '2026-07-16T10:01:00.000Z',
    durationMs: 60_000,
    proofIdentityDigest: 'identity',
    commandDigest: commandDigest(stage),
    upstreamReceiptDigests,
  }

  assert.equal(
    receiptCanBeReused({ receipt, stage, proofIdentityDigest: 'identity', upstreamReceiptDigests }),
    true,
  )
  assert.equal(
    receiptCanBeReused({ receipt, stage, proofIdentityDigest: 'changed', upstreamReceiptDigests }),
    false,
  )
  assert.equal(
    receiptCanBeReused({
      receipt: { ...receipt, completedAt: 'not-a-timestamp' },
      stage,
      proofIdentityDigest: 'identity',
      upstreamReceiptDigests,
    }),
    false,
  )
  assert.equal(
    receiptCanBeReused({
      receipt,
      stage,
      proofIdentityDigest: 'identity',
      upstreamReceiptDigests: { 'frontend-static': 'changed' },
    }),
    false,
  )
  assert.equal(
    receiptCanBeReused({
      receipt,
      stage: { ...stage, volatile: true },
      proofIdentityDigest: 'identity',
      upstreamReceiptDigests,
    }),
    false,
  )
  assert.match(receiptDigest(receipt), /^[a-f0-9]{64}$/)
})

test('workspace content digest changes for path or byte changes', () => {
  const root = mkdtempSync(join(tmpdir(), 'hr-axis-release-digest-'))
  try {
    writeFileSync(join(root, 'a.txt'), 'alpha')
    writeFileSync(join(root, 'b.txt'), 'beta')
    const initial = digestWorkspaceFiles(root, ['a.txt', 'b.txt'])
    writeFileSync(join(root, 'b.txt'), 'changed')
    const changed = digestWorkspaceFiles(root, ['a.txt', 'b.txt'])
    rmSync(join(root, 'b.txt'))
    const deleted = digestWorkspaceFiles(root, ['a.txt', 'b.txt'])
    assert.notEqual(initial, changed)
    assert.notEqual(changed, deleted)
    assert.match(deleted, /^[a-f0-9]{64}$/)
    assert.notEqual(changed, digestWorkspaceFiles(root, ['b.txt']))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('release environment digest binds ignored env files and process variables without exposing values', () => {
  const root = mkdtempSync(join(tmpdir(), 'hr-axis-release-env-'))
  try {
    writeFileSync(join(root, '.env.local'), 'SECRET_VALUE=alpha\n')
    const initial = digestReleaseEnvironment(root, { VITE_API_BASE_URL: 'https://one.invalid' })
    const processDrift = digestReleaseEnvironment(root, { VITE_API_BASE_URL: 'https://two.invalid' })
    writeFileSync(join(root, '.env.local'), 'SECRET_VALUE=beta\n')
    const fileDrift = digestReleaseEnvironment(root, { VITE_API_BASE_URL: 'https://one.invalid' })
    assert.match(initial, /^[a-f0-9]{64}$/)
    assert.notEqual(initial, processDrift)
    assert.notEqual(initial, fileDrift)
    assert.doesNotMatch(initial, /alpha|one\.invalid/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('receipt writes are atomic and partial temp files are cleaned on rename failure', () => {
  const root = mkdtempSync(join(tmpdir(), 'hr-axis-release-lock-'))
  try {
    const receiptPath = join(root, 'stage.json')
    writeReceiptAtomic(receiptPath, { status: 'success' })
    assert.deepEqual(JSON.parse(readFileSync(receiptPath, 'utf8')), { status: 'success' })
    assert.deepEqual(readdirSync(root), ['stage.json'])
    const invalidPath = join(root, 'directory-receipt.json')
    writeFileSync(join(root, 'placeholder'), '')
    rmSync(join(root, 'placeholder'))
    mkdirSync(invalidPath)
    assert.throws(() => writeReceiptAtomic(invalidPath, { status: 'success' }))
    assert.equal(readdirSync(root).some((name) => name.endsWith('.tmp')), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('lock ownership is fail-closed across processes and stale locks require manual cleanup', () => {
  const root = mkdtempSync(join(tmpdir(), 'hr-axis-release-lock-'))
  try {
    const release = acquireReleaseLock(root)
    const childScript = [
      "import { acquireReleaseLock } from './scripts/release-stage-runner.mjs'",
      `acquireReleaseLock(${JSON.stringify(root)})`,
    ].join(';')
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', childScript], {
      cwd: workspaceRoot,
      encoding: 'utf8',
    })
    assert.notEqual(child.status, 0)
    assert.match(child.stderr, /must be manually verified/)
    release()

    const lockPath = join(root, 'runner.lock')
    writeFileSync(lockPath, JSON.stringify({ pid: 999999, nonce: 'stale' }))
    assert.throws(() => acquireReleaseLock(root), /must be manually verified/)
    assert.equal(existsSync(lockPath), true)
    rmSync(lockPath)

    const releaseOwned = acquireReleaseLock(root)
    const owned = JSON.parse(readFileSync(lockPath, 'utf8'))
    writeFileSync(lockPath, JSON.stringify({ ...owned, nonce: 'replaced' }))
    assert.throws(() => releaseOwned(), /ownership changed/)
    assert.equal(existsSync(lockPath), true)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('Windows command and process-tree invocations preserve fixed argument boundaries', () => {
  assert.deepEqual(
    commandInvocation(['npm', '--prefix', 'admin-web', 'run', 'check:release:e2e'], 'win32', 'cmd.exe'),
    {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'npm.cmd --prefix admin-web run check:release:e2e'],
    },
  )
  assert.deepEqual(terminationInvocation(4242, 'win32'), {
    command: 'taskkill.exe',
    args: ['/pid', '4242', '/t', '/f'],
  })
})

test(
  'Windows cleanup terminates an owned child and its descendant',
  { skip: process.platform !== 'win32' },
  async () => {
    const childProgram = [
      "const { spawn } = require('node:child_process')",
      "const descendant = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore', windowsHide: true })",
      'console.log(descendant.pid)',
      'setInterval(() => {}, 1000)',
    ].join(';')
    const child = spawn(process.execPath, ['-e', childProgram], {
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    })
    let descendantPid

    try {
      const [chunk] = await Promise.race([
        once(child.stdout, 'data'),
        delay(10_000, undefined, { ref: false }).then(() => {
          throw new Error('Timed out waiting for descendant PID')
        }),
      ])
      descendantPid = Number.parseInt(chunk.toString('utf8').trim(), 10)
      assert.equal(Number.isInteger(descendantPid), true)

      const childExit = once(child, 'exit')
      terminateProcessTree(child)
      await Promise.race([
        childExit,
        delay(10_000, undefined, { ref: false }).then(() => {
          throw new Error('Timed out waiting for Windows process tree cleanup')
        }),
      ])

      const processAlive = (pid) => {
        try {
          process.kill(pid, 0)
          return true
        } catch {
          return false
        }
      }
      assert.equal(processAlive(child.pid), false)
      assert.equal(processAlive(descendantPid), false)
    } finally {
      for (const pid of [child.pid, descendantPid].filter(Number.isInteger)) {
        spawnSync('taskkill.exe', ['/pid', String(pid), '/t', '/f'], {
          stdio: 'ignore',
          windowsHide: true,
        })
      }
    }
  },
)

test('root release command supports explicit exact-input resume', () => {
  const rootPackage = JSON.parse(readText('package.json'))
  const runner = readText('scripts/check-release.mjs')

  assert.equal(rootPackage.scripts['check:release'], 'node scripts/check-release.mjs')
  assert.match(runner, /--resume/)
  assert.match(runner, /runCanonicalRelease/)
})

test('package proof scripts preserve static e2e and volatile audit coverage', () => {
  const backend = JSON.parse(readText('backend/nestjs/package.json'))
  const frontend = JSON.parse(readText('admin-web/package.json'))

  assert.equal(
    backend.scripts['check:release:proof'],
    'npm run lint && npm test -- --runInBand && npm run build',
  )
  assert.equal(backend.scripts['check:release:audit'], 'npm audit --omit=dev')
  assert.equal(
    frontend.scripts['check:release:static'],
    'npm run api:check && npm run lint && npm run test:scripts && npm run build:e2e',
  )
  assert.equal(frontend.scripts['check:release:e2e'], 'npm run test:e2e')
  assert.equal(frontend.scripts['check:release:audit'], 'npm audit --omit=dev')
})

test('CI release DAG has independent proof jobs and one fail-closed aggregate', () => {
  const workflow = readText('.github/workflows/release-check.yml')

  for (const job of ['root-contracts:', 'backend-release:', 'frontend-release:', 'dependency-audit:', 'release-check:']) {
    assert.match(workflow, new RegExp(`^  ${job}`, 'm'))
  }
  assert.match(workflow, /backend-release:\s*\n\s*name:\s*backend-release\s*\n\s*needs:\s*root-contracts/)
  assert.match(workflow, /frontend-release:\s*\n\s*name:\s*frontend-release\s*\n\s*needs:\s*root-contracts/)
  assert.match(workflow, /name:\s*release-check/)
  assert.match(workflow, /if:\s*\$\{\{ always\(\) \}\}/)
  assert.match(workflow, /RELEASE_ROOT_CONTRACTS_RESULT/)
  assert.match(workflow, /RELEASE_BACKEND_RESULT/)
  assert.match(workflow, /RELEASE_FRONTEND_RESULT/)
  assert.doesNotMatch(workflow, /upload-artifact[\s\S]*if:\s*\$\{\{ success\(\) \}\}/)
  assert.match(workflow, /Publish Playwright test summary[\s\S]*if:\s*\$\{\{ always\(\) \}\}/)
  assert.match(workflow, /Upload structured Playwright results and failure artifacts/)

  assert.equal(
    evaluateReleaseWorkflowFinal({
      rootContractsResult: 'success',
      backendResult: 'success',
      frontendResult: 'success',
      auditResult: 'success',
    }).ok,
    true,
  )
  for (const result of ['failure', 'cancelled', 'timed_out', 'skipped', '']) {
    const final = evaluateReleaseWorkflowFinal({
      rootContractsResult: 'success',
      backendResult: 'success',
      frontendResult: result,
      auditResult: 'success',
    })
    assert.equal(final.ok, false)
    assert.match(final.failures.join(', '), /frontend-release=/)
  }
})

test('release rehearsal keeps Docker proof without repeating backend release proof', () => {
  const backend = JSON.parse(readText('backend/nestjs/package.json'))
  const workflow = readText('.github/workflows/release-rehearsal.yml')

  assert.equal(backend.scripts['rehearse:release'], 'ts-node scripts/release-rehearsal.ts')
  assert.doesNotMatch(workflow, /check:release/)
  assert.match(workflow, /npm run rehearse:release/)
})

test('operating truth permanently defines release resume and native failed-job reuse', () => {
  const discipline = readText('discipline.md')
  const agents = readText('AGENTS.md')
  const contributing = readText('CONTRIBUTING.md')
  const sokrates = readText('sokrates.md')
  const currentState = readText('current-state.md')

  for (const text of [discipline, agents, contributing, sokrates, currentState]) {
    assert.match(text, /--resume/)
    assert.match(text, /coverage|kapsam/i)
  }

  for (const text of [discipline, agents, contributing, currentState]) {
    assert.match(text, /55-60/)
  }

  assert.match(discipline, /Re-run failed jobs/)
  assert.match(discipline, /volatile/i)
  assert.match(discipline, /110%/)
  assert.match(discipline, /release-rehearsal\.yml/)
  assert.match(discipline, /HTTP 429 ve 5xx/)
  assert.match(discipline, /model agent/i)
  assert.match(discipline, /iki root\/full release suite eszamanli calistirilmaz/i)
  assert.match(agents, /Re-run failed jobs/)
  assert.match(agents, /Do not spawn a model agent only to wait or poll/)
  assert.match(contributing, /Re-run failed jobs/)
  assert.match(contributing, /Do not run two local canonical gates concurrently/)
  assert.match(sokrates, /fail-closed aggregate remain\s+unchanged/i)
})
