import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildReleaseProofIdentity } from './release-stage-proof.mjs'
import { prepareStageRecovery } from './release-stage-execution.mjs'

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

export function collectReleaseStatus(workspaceRoot, suppliedIdentity) {
  const manifest = readJson(join(workspaceRoot, 'scripts', 'release-stage-manifest.json'))
  if (!Array.isArray(manifest?.stages)) throw new Error('Release stage manifest is unavailable')
  const receiptRoot = join(workspaceRoot, 'tmp', 'release-gate')
  let identity = suppliedIdentity
  if (!identity) {
    try { identity = buildReleaseProofIdentity({ workspaceRoot, manifestPath: join(workspaceRoot, 'scripts/release-stage-manifest.json') }).proofIdentityDigest }
    catch { identity = null }
  }
  const stages = manifest.stages.map((stage) => {
    const path = join(receiptRoot, `${stage.id}.json`)
    const receipt = readJson(path)
    const validSuccess =
      receipt?.schemaVersion === manifest.receiptSchemaVersion &&
      receipt?.stageId === stage.id &&
      receipt?.status === 'success'
    return {
      id: stage.id,
      status: !existsSync(path) ? 'missing' : receipt?.status === 'failed' ? 'failed' :
        validSuccess ? identity && receipt.proofIdentityDigest === identity ? 'current' : 'stale' : 'invalid',
      durationMs: Number.isFinite(receipt?.durationMs) ? receipt.durationMs : null,
      completedAt: typeof receipt?.completedAt === 'string' ? receipt.completedAt : null,
      proofIdentity: typeof receipt?.proofIdentityDigest === 'string'
        ? receipt.proofIdentityDigest.slice(0, 12)
        : null,
    }
  })
  return {
    stages,
    lockPresent: existsSync(join(receiptRoot, 'runner.lock')),
  }
}

export function collectRecoveryPlan(workspaceRoot) {
  const manifest = readJson(join(workspaceRoot, 'scripts/release-stage-manifest.json'))
  return manifest.stages.map((stage) => {
    const result = prepareStageRecovery({ root: workspaceRoot, stage, resume: true })
    return { stage: stage.id, action: result.reuse ? 'reuse' : 'execute', reason: result.reason }
  })
}

export function formatDuration(durationMs) {
  if (!Number.isFinite(durationMs)) return '-'
  return `${(durationMs / 1000).toFixed(1)}s`
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const workspaceRoot = join(import.meta.dirname, '..')
  const status = collectReleaseStatus(workspaceRoot)
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(status, null, 2))
  } else {
    console.log(`[test-status] canonical release receipts lock=${status.lockPresent ? 'present' : 'clear'}`)
    for (const stage of status.stages) {
      console.log(
        `${stage.status.toUpperCase().padEnd(7)} ${stage.id.padEnd(20)} ${formatDuration(stage.durationMs).padStart(8)} ${stage.proofIdentity ?? '-'}`,
      )
    }
  }
}
