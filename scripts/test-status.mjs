import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

export function collectReleaseStatus(workspaceRoot) {
  const manifest = readJson(join(workspaceRoot, 'scripts', 'release-stage-manifest.json'))
  if (!Array.isArray(manifest?.stages)) throw new Error('Release stage manifest is unavailable')
  const receiptRoot = join(workspaceRoot, 'tmp', 'release-gate')
  const stages = manifest.stages.map((stage) => {
    const path = join(receiptRoot, `${stage.id}.json`)
    const receipt = readJson(path)
    const validSuccess =
      receipt?.schemaVersion === manifest.receiptSchemaVersion &&
      receipt?.stageId === stage.id &&
      receipt?.status === 'success'
    return {
      id: stage.id,
      status: !existsSync(path) ? 'missing' : validSuccess ? 'success' : 'invalid',
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
