import { appendFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { planArtifactRetention } from './artifact-retention-policy.mjs'

// Fixed GitHub host, read-only default, complete pagination or no plan.
async function collectProtections(api) {
  const repository = await api('')
  const [openPullRequests, tags, main] = await Promise.all([
    api('/pulls?state=open&per_page=100', true),
    api('/tags?per_page=100', true),
    api('/commits/' + encodeURIComponent(repository.default_branch)),
  ])
  return { repositoryId: repository.id, openPullRequests,
    protectedShas: [main.sha, ...tags.map(tag => tag.commit?.sha)], now: Date.now() }
}

export async function collectRetentionInventory(api) {
  const protections = await collectProtections(api)
  const artifacts = await api('/actions/artifacts?per_page=100', 'artifacts')
  const runIds = [...new Set(artifacts.filter(a => /^onprem-offline-bundle-[a-f0-9]{40}$/.test(a.name ?? '') && a.expired === false)
    .map(a => a.workflow_run?.id))]
  if (runIds.some(id => !Number.isSafeInteger(id) || id <= 0)) throw new Error('Invalid artifact run identity')
  const runs = []
  for (const id of runIds) runs.push(await api('/actions/runs/' + id))
  return { ...protections, artifacts, runs }
}

export function createGitHubApi(repository, token, request = fetch) {
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository ?? '') || !token) throw new Error('Repository and GitHub token are required')
  const base = 'https://api.github.com/repos/' + repository
  return async (path, listKey = false, method = 'GET') => {
    const rows = []
    let expectedTotal
    for (let page = 1; page <= 30; page++) {
      const url = base + path + (listKey ? '&page=' + page : '')
      const response = await request(url, { method, redirect: 'error', signal: AbortSignal.timeout(30_000),
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } })
      if (!response.ok) throw new Error('GitHub retention request failed: HTTP ' + response.status)
      if (method === 'DELETE') {
        if (response.status !== 204) throw new Error('Artifact deletion returned an unexpected acknowledgement')
        return
      }
      const body = await response.json()
      if (!listKey) return body
      const chunk = listKey === true ? body : body[listKey]
      if (!Array.isArray(chunk)) throw new Error('Malformed paginated inventory')
      if (listKey !== true) {
        if (!Number.isSafeInteger(body.total_count) || body.total_count < 0 ||
            (expectedTotal !== undefined && expectedTotal !== body.total_count)) throw new Error('Inventory changed during pagination')
        expectedTotal = body.total_count
      }
      rows.push(...chunk)
      if (!response.headers.get('link')?.includes('rel="next"')) {
        if (expectedTotal !== undefined && rows.length !== expectedTotal) throw new Error('Incomplete paginated inventory')
        return rows
      }
    }
    throw new Error('Retention pagination budget exhausted')
  }
}

export async function runRetention({ api, approvedPlanSha256 = '', report = console.log }) {
  if (approvedPlanSha256 && !/^[a-f0-9]{64}$/.test(approvedPlanSha256)) throw new Error('Invalid approved plan digest')
  const inventory = await collectRetentionInventory(api)
  const plan = planArtifactRetention(inventory)
  report(JSON.stringify(plan, null, 2))
  if (!approvedPlanSha256) return { plan, deleted: [] }
  if (approvedPlanSha256 !== plan.planSha256) throw new Error('Plan changed; review the fresh plan before deletion')
  const deleted = []
  for (const candidate of plan.candidates) {
    // Refresh protections and candidate identities before each irreversible action.
    const protections = await collectProtections(api)
    const artifact = await api('/actions/artifacts/' + candidate.id)
    const run = await api('/actions/runs/' + candidate.runId)
    const fresh = planArtifactRetention({ ...protections, artifacts: [artifact], runs: [run] })
    const current = fresh.candidates.find(a => a.id === candidate.id)
    if (JSON.stringify(current) !== JSON.stringify(candidate)) throw new Error('Candidate changed or became protected; deletion stopped')
    await api('/actions/artifacts/' + candidate.id, false, 'DELETE')
    deleted.push(candidate.id)
    report('Deleted approved artifact ' + candidate.id)
  }
  return { plan, deleted }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 2) throw new Error('Use GITHUB_REPOSITORY and optional APPROVED_ARTIFACT_PLAN_SHA256')
  const result = await runRetention({
    api: createGitHubApi(process.env.GITHUB_REPOSITORY, process.env.GH_TOKEN),
    approvedPlanSha256: process.env.APPROVED_ARTIFACT_PLAN_SHA256 || '',
  })
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `## Artifact retention\nPlan: \`${result.plan.planSha256}\`\n\nCandidates: ${result.plan.candidates.length}; bytes: ${result.plan.candidateBytes}; deleted: ${result.deleted.length}.\n\nSuccessful, open-PR, tagged/current-main and unknown evidence remains protected.\n`)
}
