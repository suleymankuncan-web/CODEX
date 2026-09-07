import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { planArtifactRetention } from './artifact-retention-policy.mjs'
import { createGitHubApi, runRetention } from './artifact-retention.mjs'

const sha = 'a'.repeat(40)
const main = 'b'.repeat(40)
const date = '2026-08-01T00:00:00Z'
const now = Date.parse('2026-09-01T00:00:00Z')
function fixture() {
  return {
    repositoryId: 1, now, protectedShas: [main], openPullRequests: [],
    artifacts: [{ id: 2, name: 'onprem-offline-bundle-' + sha, digest: 'sha256:' + 'c'.repeat(64),
      size_in_bytes: 1000, expired: false, created_at: date,
      workflow_run: { id: 3, repository_id: 1, head_repository_id: 1, head_sha: sha } }],
    runs: [{ id: 3, repository: { id: 1 }, head_repository: { id: 1 }, run_attempt: 1,
      path: '.github/workflows/onprem-offline-proof.yml', event: 'workflow_dispatch',
      status: 'completed', conclusion: 'failure', updated_at: date, head_sha: sha, head_branch: 'old-proof' }],
  }
}

test('only old failed/cancelled manual offline bundles become cleanup candidates', () => {
  const value = fixture()
  const plan = planArtifactRetention(value)
  assert.equal(plan.candidates.length, 1)
  assert.equal(plan.candidateBytes, 1000)
  assert.match(plan.planSha256, /^[a-f0-9]{64}$/)
  value.runs[0].conclusion = 'cancelled'
  assert.equal(planArtifactRetention(value).candidates.length, 1)
})

test('success, active runs, retries, foreign repositories and unknown metadata are protected', () => {
  const cases = [
    v => { v.runs[0].conclusion = 'success' },
    v => { v.runs[0].status = 'in_progress' },
    v => { v.runs[0].conclusion = 'timed_out' },
    v => { v.runs[0].event = 'pull_request' },
    v => { v.runs[0].path = '.github/workflows/other.yml' },
    v => { v.runs[0].updated_at = '2026-08-31T00:00:00Z' },
    v => { v.runs[0].head_repository.id = 9 },
    v => { v.artifacts[0].workflow_run.head_repository_id = 9 },
    v => { v.artifacts[0].workflow_run.head_sha = main },
    v => { v.artifacts[0].name = 'onprem-offline-trust-' + sha },
    v => { v.artifacts[0].name = 'onprem-image-proof-' + sha },
    v => { v.artifacts[0].digest = null },
    v => { v.artifacts[0].created_at = 'invalid' },
    v => { v.artifacts[0].created_at = '2026-08-31T00:00:00Z' },
    v => { v.artifacts[0].expired = true },
    v => { delete v.artifacts[0].workflow_run },
    v => { v.runs = [] },
    v => { v.protectedShas.push(sha) },
    v => { v.openPullRequests = [{ state: 'open', head: { sha, ref: 'new-name' } }] },
    v => { v.openPullRequests = [{ state: 'open', head: { sha: main, ref: 'old-proof' } }] },
  ]
  for (const mutate of cases) {
    const value = fixture(); mutate(value)
    assert.equal(planArtifactRetention(value).candidates.length, 0, mutate.toString())
  }
})

test('incomplete or duplicate inventory fails closed and changed identities change the plan digest', () => {
  for (const mutate of [v => { v.protectedShas = [] }, v => { v.artifacts.push(v.artifacts[0]) },
    v => { v.runs.push(v.runs[0]) }, v => { v.openPullRequests = [{}] }]) {
    const value = fixture(); mutate(value)
    assert.throws(() => planArtifactRetention(value))
  }
  const value = fixture()
  const before = planArtifactRetention(value).planSha256
  value.runs[0].run_attempt++
  assert.notEqual(planArtifactRetention(value).planSha256, before)
})

function fakeApi(value, onRefresh = () => {}) {
  const deleted = []
  let scans = 0
  return { deleted, api: async (path, _list, method) => {
    if (method === 'DELETE') { deleted.push(path); return }
    if (path === '') { scans++; onRefresh(value, scans); return { id: 1, default_branch: 'main' } }
    if (path.startsWith('/actions/artifacts?')) return structuredClone(value.artifacts)
    if (path === '/actions/artifacts/2') return structuredClone(value.artifacts[0])
    if (path.startsWith('/pulls?')) return structuredClone(value.openPullRequests)
    if (path.startsWith('/tags?')) return value.tags ?? []
    if (path === '/commits/main') return { sha: main }
    if (path === '/actions/runs/3') return structuredClone(value.runs[0])
    throw new Error('Unexpected API path ' + path)
  } }
}

test('default inventory is read-only; mismatched approval cannot delete', async () => {
  const fake = fakeApi(fixture())
  const result = await runRetention({ api: fake.api, report: () => {} })
  assert.equal(result.plan.candidates.length, 1)
  assert.deepEqual(fake.deleted, [])
  await assert.rejects(runRetention({ api: fake.api, report: () => {}, approvedPlanSha256: '0'.repeat(64) }), /Plan changed/)
  assert.deepEqual(fake.deleted, [])
})

test('exact approved plan deletes only the exact artifact after revalidation', async () => {
  const value = fixture(); const fake = fakeApi(value)
  await runRetention({ api: fake.api, report: () => {}, approvedPlanSha256: planArtifactRetention(value).planSha256 })
  assert.deepEqual(fake.deleted, ['/actions/artifacts/2'])
})

test('a reopened PR, changed digest or successful rerun stops deletion', async () => {
  for (const mutate of [
    v => { v.openPullRequests = [{ state: 'open', head: { sha, ref: 'old-proof' } }] },
    v => { v.artifacts[0].digest = 'sha256:' + 'd'.repeat(64) },
    v => { v.runs[0].conclusion = 'success' },
    v => { v.tags = [{ commit: { sha } }] },
  ]) {
    const value = fixture(); const digest = planArtifactRetention(value).planSha256
    const fake = fakeApi(value, (v, scan) => { if (scan === 2) mutate(v) })
    await assert.rejects(runRetention({ api: fake.api, report: () => {}, approvedPlanSha256: digest }), /Candidate changed/)
    assert.deepEqual(fake.deleted, [])
  }
})

test('GitHub pagination requires complete stable results and never follows external links', async () => {
  const urls = []
  const api = createGitHubApi('owner/repo', 'synthetic-token', async url => {
    urls.push(url)
    const page = urls.length
    return new Response(JSON.stringify({ total_count: 2, artifacts: [{ id: page }] }), {
      headers: page === 1 ? { link: '<https://evil.invalid/>; rel="next"' } : {},
    })
  })
  assert.deepEqual(await api('/actions/artifacts?per_page=100', 'artifacts'), [{ id: 1 }, { id: 2 }])
  assert.ok(urls.every(url => url.startsWith('https://api.github.com/repos/owner/repo/')))
  const incomplete = createGitHubApi('owner/repo', 'synthetic-token', async () =>
    new Response(JSON.stringify({ total_count: 2, artifacts: [{ id: 1 }] })))
  await assert.rejects(incomplete('/actions/artifacts?per_page=100', 'artifacts'), /Incomplete/)
  const denied = createGitHubApi('owner/repo', 'synthetic-token', async () => new Response('', { status: 403 }))
  await assert.rejects(denied(''), /HTTP 403/)
  const unexpectedDelete = createGitHubApi('owner/repo', 'synthetic-token', async () => new Response(''))
  await assert.rejects(unexpectedDelete('/actions/artifacts/2', false, 'DELETE'), /unexpected acknowledgement/)
})

test('retention workflow is manual, default read-only, main-only and avoids PR-head execution', () => {
  const text = readFileSync(new URL('../.github/workflows/artifact-retention.yml', import.meta.url), 'utf8')
  assert.match(text, /workflow_dispatch:/)
  assert.doesNotMatch(text, /pull_request_target:|workflow_run:|schedule:/)
  assert.match(text, /needs: plan/)
  assert.match(text, /github.ref == 'refs\/heads\/main' && inputs.approved_plan_sha256 != ''/)
  assert.match(text, /APPROVED_ARTIFACT_PLAN_SHA256: ''/)
  assert.equal((text.match(/persist-credentials: false/g) ?? []).length, 2)
})
