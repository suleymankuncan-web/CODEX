import { createHash } from 'node:crypto'

export const FAILED_BUNDLE_MIN_AGE_MS = 7 * 24 * 60 * 60 * 1000
const positive = (value) => Number.isSafeInteger(value) && value > 0
const sha = (value) => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value)
const time = (value) => typeof value === 'string' ? Date.parse(value) : NaN

export function planArtifactRetention({ repositoryId, artifacts, runs, openPullRequests, protectedShas, now }) {
  if (!positive(repositoryId) || !Number.isFinite(now) ||
      ![artifacts, runs, openPullRequests, protectedShas].every(Array.isArray) ||
      !protectedShas.length || !protectedShas.every(sha)) throw new Error('Incomplete retention inventory')
  if (new Set(artifacts.map(a => a.id)).size !== artifacts.length ||
      new Set(runs.map(r => r.id)).size !== runs.length) throw new Error('Duplicate inventory identity')
  const protectedHeads = new Set(protectedShas)
  const protectedBranches = new Set()
  for (const pr of openPullRequests) {
    if (pr.state !== 'open' || !sha(pr.head?.sha) || !pr.head?.ref) throw new Error('Invalid open PR inventory')
    protectedHeads.add(pr.head.sha)
    protectedBranches.add(pr.head.ref)
  }
  const runMap = new Map(runs.map(run => [run.id, run]))
  const cutoff = now - FAILED_BUNDLE_MIN_AGE_MS
  const candidates = []
  let retainedCount = 0
  for (const artifact of artifacts) {
    const run = runMap.get(artifact.workflow_run?.id)
    const eligible = positive(artifact.id) && artifact.expired === false &&
      /^onprem-offline-bundle-[a-f0-9]{40}$/.test(artifact.name ?? '') &&
      /^sha256:[a-f0-9]{64}$/.test(artifact.digest ?? '') &&
      positive(artifact.size_in_bytes) && time(artifact.created_at) <= cutoff &&
      artifact.workflow_run?.repository_id === repositoryId &&
      artifact.workflow_run?.head_repository_id === repositoryId &&
      run?.repository?.id === repositoryId && run?.head_repository?.id === repositoryId &&
      run.path === '.github/workflows/onprem-offline-proof.yml' &&
      run.event === 'workflow_dispatch' && run.status === 'completed' &&
      ['failure', 'cancelled'].includes(run.conclusion) &&
      positive(run.id) && positive(run.run_attempt) && time(run.updated_at) <= cutoff &&
      sha(run.head_sha) && run.head_sha === artifact.workflow_run.head_sha &&
      artifact.name === 'onprem-offline-bundle-' + run.head_sha &&
      typeof run.head_branch === 'string' && run.head_branch.length > 0 &&
      !protectedHeads.has(run.head_sha) && !protectedBranches.has(run.head_branch)
    if (!eligible) { retainedCount++; continue }
    candidates.push({
      id: artifact.id, name: artifact.name, digest: artifact.digest,
      size: artifact.size_in_bytes, runId: run.id, runAttempt: run.run_attempt,
      sha: run.head_sha, createdAt: artifact.created_at, runUpdatedAt: run.updated_at,
    })
  }
  candidates.sort((a, b) => a.id - b.id)
  const planSha256 = createHash('sha256').update(JSON.stringify({ repositoryId, candidates })).digest('hex')
  return { schemaVersion: 1, repositoryId, planSha256, candidates, retainedCount,
    candidateBytes: candidates.reduce((sum, a) => sum + a.size, 0) }
}
