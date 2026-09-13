import { execFileSync } from 'node:child_process'
import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { MAX_PROOF_AGE_MS, gitText } from './release-recovery.mjs'
import { sha256 } from './release-stage-proof.mjs'
import { MAX_BUNDLE_BYTES, validateBundle } from './release-recovery-bundle.mjs'

const workflowPath = '.github/workflows/required-release-gate.yml'
const familyJobs = { 'backend-release': 'backend-release', 'frontend-static': 'frontend-static', 'frontend-e2e': 'frontend-release' }
const controls = ['.github/workflows/', 'scripts/release-', 'scripts/check-release.mjs',
  'scripts/required-release-gate', 'admin-web/scripts/playwright-', 'admin-web/scripts/run-release-e2e.mjs']
export const artifactName = (family, runId, attempt) => 'release-recovery-' + family + '-' + runId + '-' + attempt

export function githubContext(root, environment = process.env) {
  if (environment.GITHUB_ACTIONS !== 'true') return null
  const event = JSON.parse(readFileSync(environment.GITHUB_EVENT_PATH, 'utf8'))
  const pr = event.pull_request
  const repository = environment.GITHUB_REPOSITORY
  if (!pr) return {
    repository, prNumber: null, baseSha: null, headSha: environment.GITHUB_SHA,
    testedSha: gitText(root, ['rev-parse', 'HEAD']), treeSha: gitText(root, ['rev-parse', 'HEAD^{tree}']),
    runId: Number(environment.GITHUB_RUN_ID), attempt: Number(environment.GITHUB_RUN_ATTEMPT),
    workflowPath: environment.GITHUB_WORKFLOW_REF?.split('/').slice(2).join('/').split('@')[0],
  }
  return {
    sameRepository: pr.head?.repo?.full_name === repository && pr.base?.repo?.full_name === repository,
    repository, prNumber: pr.number, baseSha: pr.base.sha, headSha: pr.head.sha,
    testedSha: gitText(root, ['rev-parse', 'HEAD']), treeSha: gitText(root, ['rev-parse', 'HEAD^{tree}']),
    runId: Number(environment.GITHUB_RUN_ID), attempt: Number(environment.GITHUB_RUN_ATTEMPT),
    workflowPath, branch: pr.head.ref,
  }
}

export function validateCandidate({ run, jobs, artifact, bundle, context, family, now = Date.now() }) {
  const p = bundle?.provenance
  if (!p || !['passed', 'success', 'failed'].includes(bundle.record?.outcome ?? bundle.record?.status)) return false
  if (run.id >= context.runId || run.status !== 'completed' || !['success', 'failure'].includes(run.conclusion) ||
      run.event !== 'pull_request' || run.path?.split('@')[0] !== workflowPath ||
      run.head_repository?.full_name !== context.repository) return false
  if (p.repository !== context.repository || p.prNumber !== context.prNumber || p.baseSha !== context.baseSha ||
      p.workflowPath !== workflowPath || p.runId !== run.id || p.attempt !== run.run_attempt || p.headSha !== run.head_sha ||
      !/^[a-f0-9]{40}$/.test(p.testedSha ?? '') || !/^[a-f0-9]{40}$/.test(p.treeSha ?? '')) return false
  const completed = Date.parse(artifact.created_at)
  if (!Number.isFinite(completed) || completed > now || now - completed > MAX_PROOF_AGE_MS) return false
  if (artifact.expired || artifact.name !== artifactName(family, run.id, run.run_attempt) ||
      artifact.workflow_run?.id !== run.id || artifact.workflow_run?.head_sha !== run.head_sha) return false
  const matching = jobs.filter((job) => job.name.split(' / ').at(-1) === familyJobs[family])
  if (matching.length !== 1 || matching[0].status !== 'completed') return false
  if (family === 'frontend-e2e') {
    if (!['success', 'failure'].includes(matching[0].conclusion) || bundle.record.globalErrors) return false
  } else if (matching[0].conclusion !== 'success' || bundle.record.status !== 'success') return false
  return true
}

async function boundedResponse(response, maximum) {
  if (!response.ok) throw new Error('Recovery API request failed (' + response.status + ')')
  if (Number(response.headers.get('content-length') ?? 0) > maximum) throw new Error('Recovery response exceeds size limit')
  const chunks = []
  let bytes = 0
  for await (const chunk of response.body) {
    bytes += chunk.length
    if (bytes > maximum) throw new Error('Recovery response exceeds size limit')
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

export async function restoreGithubBundle({ root, family, fetcher = fetch, environment = process.env }) {
  const context = githubContext(root, environment)
  if (!context?.prNumber || !context.sameRepository) return null
  const token = environment.GITHUB_TOKEN
  if (!token) return null
  try {
    const changes = gitText(root, ['diff', '--name-only', context.baseSha, 'HEAD']).split('\n')
    if (changes.some((path) => controls.some((prefix) => path.startsWith(prefix)))) return null
    const api = 'https://api.github.com/repos/' + context.repository
    const request = (url, authenticated = true) => fetcher(url, {
      headers: authenticated ? { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } : {},
      signal: AbortSignal.timeout(15_000), redirect: 'manual',
    })
    const json = async (path) => JSON.parse((await boundedResponse(await request(api + path), 4 * 1024 * 1024)).toString())
    const data = await json('/actions/workflows/required-release-gate.yml/runs?event=pull_request&branch=' + encodeURIComponent(context.branch) + '&per_page=100')
    // Select latest prior run before checking outcome: never fall back to older green.
    const run = (data.workflow_runs ?? []).filter((item) => item.id < context.runId)
      .sort((a, b) => b.id - a.id)[0]
    if (!run || run.status !== 'completed' || !['success', 'failure'].includes(run.conclusion)) return null
    const artifacts = await json('/actions/runs/' + run.id + '/artifacts?per_page=100')
    if (artifacts.total_count > 100) return null
    const matching = artifacts.artifacts.filter((item) => item.name === artifactName(family, run.id, run.run_attempt))
    if (matching.length !== 1) return null
    const artifact = matching[0]
    if (!/^sha256:[a-f0-9]{64}$/.test(artifact.digest ?? '') || artifact.expired || artifact.size_in_bytes > MAX_BUNDLE_BYTES) return null
    let response = await request(api + '/actions/artifacts/' + artifact.id + '/zip')
    if (response.status === 302) {
      const location = new URL(response.headers.get('location'))
      if (location.protocol !== 'https:' || location.username || location.password) return null
      response = await request(location.href, false)
    }
    const zip = await boundedResponse(response, MAX_BUNDLE_BYTES)
    if ('sha256:' + sha256(zip) !== artifact.digest) return null
    const directory = join(root, 'tmp/release-import', family)
    mkdirSync(directory, { recursive: true })
    const zipPath = join(directory, 'candidate.zip')
    writeFileSync(zipPath, zip, { mode: 0o600 })
    let bundle
    try {
      const names = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8', maxBuffer: 4096, timeout: 15_000 }).trim().split('\n')
      if (names.length !== 1 || names[0] !== 'bundle.json') return null
      // Stream only the expected member; never extract paths from an archive.
      const raw = execFileSync('unzip', ['-p', zipPath, 'bundle.json'], { encoding: 'utf8', maxBuffer: MAX_BUNDLE_BYTES, timeout: 30_000 })
      bundle = JSON.parse(raw)
    } finally { rmSync(zipPath, { force: true }) }
    validateBundle(bundle, family)
    const jobData = await json('/actions/runs/' + run.id + '/attempts/' + run.run_attempt + '/jobs?per_page=100')
    if (jobData.total_count > 100 || !validateCandidate({ run, jobs: jobData.jobs, artifact, bundle, context, family })) return null
    const commit = await json('/git/commits/' + bundle.provenance.testedSha)
    if (commit.tree?.sha !== bundle.provenance.treeSha || commit.parents?.length !== 2 ||
        commit.parents[0].sha !== context.baseSha || commit.parents[1].sha !== run.head_sha) return null
    return bundle
  } catch (error) {
    console.log('[recovery] prior CI proof unavailable; fresh verification (' + error.name + ')')
    return null
  }
}
