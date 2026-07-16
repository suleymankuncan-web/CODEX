import { randomUUID } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

import {
  RELEASE_RECEIPT_SCHEMA_VERSION,
  buildReleaseProofIdentity,
  commandDigest,
  receiptCanBeReused,
  receiptDigest,
  validateReleaseManifest,
} from './release-stage-proof.mjs'

const receiptDirectoryName = 'tmp/release-gate'

export function quoteWindowsCommandPart(value) {
  if (!/[\s"&|<>^()]/u.test(value)) return value
  return `"${value.replaceAll('"', '\\"')}"`
}

export function commandInvocation(
  command,
  platform = process.platform,
  comspec = process.env.ComSpec ?? 'cmd.exe',
) {
  const [executable, ...args] = command
  if (executable === 'npm' && platform === 'win32') {
    return {
      command: comspec,
      args: ['/d', '/s', '/c', ['npm.cmd', ...args].map(quoteWindowsCommandPart).join(' ')],
    }
  }
  return { command: executable, args }
}

function receiptPath(receiptRoot, stageId) {
  return join(receiptRoot, `${stageId}.json`)
}

function readReceipt(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

export function writeReceiptAtomic(path, receipt) {
  const temporaryPath = `${path}.${process.pid}.${Date.now()}.tmp`
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(receipt, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    })
    renameSync(temporaryPath, path)
  } finally {
    rmSync(temporaryPath, { force: true })
  }
}

export function acquireReleaseLock(receiptRoot) {
  mkdirSync(receiptRoot, { recursive: true })
  const lockPath = join(receiptRoot, 'runner.lock')
  const nonce = randomUUID()
  try {
    const descriptor = openSync(lockPath, 'wx', 0o600)
    writeFileSync(descriptor, `${JSON.stringify({ pid: process.pid, nonce, acquiredAt: new Date().toISOString() })}\n`)
    closeSync(descriptor)
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error
    throw new Error(
      `Canonical release gate lock exists and must be manually verified before removal (lock: ${lockPath})`,
    )
  }
  return () => {
    const currentLock = readReceipt(lockPath)
    if (currentLock?.pid !== process.pid || currentLock?.nonce !== nonce) {
      throw new Error('Canonical release gate lock ownership changed; refusing to remove it')
    }
    rmSync(lockPath)
  }
}

export function terminationInvocation(pid, platform = process.platform) {
  if (platform === 'win32') {
    return { command: 'taskkill.exe', args: ['/pid', String(pid), '/t', '/f'] }
  }
  return { signal: 'SIGTERM', processGroup: -pid }
}

export function terminateProcessTree(child) {
  if (!child?.pid || child.exitCode !== null) return
  if (process.platform === 'win32') {
    const invocation = terminationInvocation(child.pid)
    spawnSync(invocation.command, invocation.args, {
      stdio: 'ignore',
      windowsHide: true,
    })
    return
  }
  try {
    process.kill(-child.pid, 'SIGTERM')
  } catch {
    child.kill('SIGTERM')
  }
}

export async function runCanonicalRelease({ workspaceRoot, resume = false }) {
  const manifestPath = join(workspaceRoot, 'scripts', 'release-stage-manifest.json')
  const manifest = validateReleaseManifest(JSON.parse(readFileSync(manifestPath, 'utf8')))
  const receiptRoot = join(workspaceRoot, ...receiptDirectoryName.split('/'))
  const releaseLock = acquireReleaseLock(receiptRoot)
  const activeChildren = new Set()
  let aborted = false

  const stopChildren = () => {
    aborted = true
    for (const child of activeChildren) terminateProcessTree(child)
  }
  const onSignal = () => stopChildren()
  process.once('SIGINT', onSignal)
  process.once('SIGTERM', onSignal)

  try {
    if (!resume) {
      for (const stage of manifest.stages) {
        rmSync(receiptPath(receiptRoot, stage.id), { force: true })
      }
    }

    const identity = buildReleaseProofIdentity({ workspaceRoot, manifestPath })
    console.log(`[release] mode=${resume ? 'resume' : 'fresh'} identity=${identity.proofIdentityDigest.slice(0, 12)}`)
    const stagePromises = new Map()
    const completedReceipts = new Map()
    const stageById = new Map(manifest.stages.map((stage) => [stage.id, stage]))

    const runCommand = (stage, command) =>
      new Promise((resolvePromise, rejectPromise) => {
        if (aborted) {
          rejectPromise(new Error(`Release aborted before ${stage.id}`))
          return
        }
        const invocation = commandInvocation(command)
        const child = spawn(invocation.command, invocation.args, {
          cwd: join(workspaceRoot, ...stage.cwd.split('/')),
          env: process.env,
          stdio: 'inherit',
          windowsHide: true,
          detached: process.platform !== 'win32',
        })
        activeChildren.add(child)
        child.once('error', (error) => {
          activeChildren.delete(child)
          rejectPromise(error)
        })
        child.once('exit', (code, signal) => {
          activeChildren.delete(child)
          if (code === 0) resolvePromise()
          else rejectPromise(new Error(`${stage.id} failed (${signal ?? `exit ${code ?? -1}`})`))
        })
      })

    const runStage = (stageId) => {
      if (stagePromises.has(stageId)) return stagePromises.get(stageId)
      const stage = stageById.get(stageId)
      const promise = (async () => {
        await Promise.all(stage.dependsOn.map(runStage))
        if (aborted) throw new Error(`Release aborted before ${stage.id}`)

        const upstreamReceiptDigests = Object.fromEntries(
          stage.dependsOn.map((id) => [id, receiptDigest(completedReceipts.get(id))]),
        )
        const path = receiptPath(receiptRoot, stage.id)
        const existingReceipt = resume ? readReceipt(path) : null
        if (
          receiptCanBeReused({
            receipt: existingReceipt,
            stage,
            proofIdentityDigest: identity.proofIdentityDigest,
            upstreamReceiptDigests,
          })
        ) {
          completedReceipts.set(stage.id, existingReceipt)
          console.log(`[release] reuse ${stage.id} (${existingReceipt.durationMs}ms prior proof)`)
          return
        }

        rmSync(path, { force: true })
        const startedAt = new Date()
        const started = Date.now()
        console.log(`[release] start ${stage.id}`)
        try {
          for (const command of stage.commands) await runCommand(stage, command)
        } catch (error) {
          stopChildren()
          throw error
        }
        const completedAt = new Date()
        const receipt = {
          schemaVersion: RELEASE_RECEIPT_SCHEMA_VERSION,
          stageId: stage.id,
          status: 'success',
          startedAt: startedAt.toISOString(),
          completedAt: completedAt.toISOString(),
          durationMs: Date.now() - started,
          proofIdentityDigest: identity.proofIdentityDigest,
          commandDigest: commandDigest(stage),
          upstreamReceiptDigests,
        }
        writeReceiptAtomic(path, receipt)
        completedReceipts.set(stage.id, receipt)
        console.log(`[release] pass ${stage.id} (${receipt.durationMs}ms)`)
      })()
      stagePromises.set(stageId, promise)
      return promise
    }

    await Promise.all(manifest.stages.map((stage) => runStage(stage.id)))
    console.log('[release] canonical proof complete')
  } finally {
    stopChildren()
    process.removeListener('SIGINT', onSignal)
    process.removeListener('SIGTERM', onSignal)
    releaseLock()
  }
}
