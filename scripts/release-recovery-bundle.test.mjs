import assert from 'node:assert/strict'
import test from 'node:test'
import { validateBundle } from './release-recovery-bundle.mjs'
import { artifactName, validateCandidate } from './release-recovery-github.mjs'
import { sha256 } from './release-stage-proof.mjs'

function candidate() {
  const now = Date.now(), family = 'frontend-static'
  const sha = 'a'.repeat(40), tree = 'b'.repeat(40)
  const context = { repository: 'owner/repo', prNumber: 42, baseSha: sha, runId: 2 }
  const run = { id: 1, status: 'completed', conclusion: 'failure', event: 'pull_request',
    path: '.github/workflows/required-release-gate.yml', head_repository: { full_name: 'owner/repo' }, run_attempt: 1, head_sha: sha }
  const jobs = [{ name: 'root-release / frontend-static', status: 'completed', conclusion: 'success' }]
  const artifact = { name: artifactName(family, 1, 1), created_at: new Date(now).toISOString(), workflow_run: { id: 1, head_sha: sha }, expired: false }
  const bundle = { version: 2, family, record: { status: 'success' },
    provenance: { ...context, workflowPath: run.path, runId: 1, attempt: 1, headSha: sha, testedSha: sha, treeSha: tree },
    files: [{ path: 'admin-web/dist/index.html', data: Buffer.from('build').toString('base64'), bytes: 5, sha256: sha256('build') }] }
  return { context, run, jobs, artifact, bundle, family, now }
}

test('completed successful stage from failed same-PR run is eligible', () => {
  const data = candidate()
  assert.equal(validateCandidate(data), true)
  validateBundle(data.bundle, data.family)
})

test('candidate rejects other PR/repo/base/workflow, stale attempt, cancelled/skipped jobs and expired artifact', () => {
  for (const mutate of [
    (x) => { x.bundle.provenance.prNumber += 1 },
    (x) => { x.bundle.provenance.repository = 'attacker/repo' },
    (x) => { x.bundle.provenance.baseSha = 'c'.repeat(40) },
    (x) => { x.run.path = 'other.yml' },
    (x) => { x.bundle.provenance.attempt = 0 },
    (x) => { x.run.run_attempt = 2 },
    (x) => { x.run.conclusion = 'cancelled' },
    (x) => { x.run.status = 'in_progress' },
    (x) => { x.jobs[0].conclusion = 'skipped' },
    (x) => { x.jobs.push(x.jobs[0]) },
    (x) => { x.artifact.expired = true },
    (x) => { x.artifact.workflow_run.head_sha = 'c'.repeat(40) },
    (x) => { x.artifact.created_at = '2000-01-01' },
  ]) {
    const data = candidate(); mutate(data)
    assert.equal(validateCandidate(data), false)
  }
})

test('bundles reject traversal, arbitrary outputs, duplicate files, corrupt bytes and invalid family', () => {
  for (const path of ['../outside', 'admin-web/dist/../src/app.ts', 'admin-web/dist//file',
    'admin-web/dist/C:evil', 'admin-web/dist/./file', 'admin-web/src/app.ts', 'admin-web\\dist\\file']) {
    const data = candidate(); data.bundle.files[0].path = path
    assert.throws(() => validateBundle(data.bundle, data.family))
  }
  for (const mutate of [
    (x) => { x.files.push(x.files[0]) },
    (x) => { x.files[0].sha256 = 'bad' },
    (x) => { x.files[0].bytes = 999 },
    (x) => { x.files[0].data = '!' },
    (x) => { x.family = 'frontend-e2e' },
  ]) {
    const { bundle, family } = candidate(); mutate(bundle)
    assert.throws(() => validateBundle(bundle, family))
  }
})
