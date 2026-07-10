import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  evaluatePostMergeReleaseProof,
  evaluatePostMergeVerificationFinal,
} from './post-merge-release-proof.mjs'

const commitSha = 'merge-sha'
const baseSha = 'base-sha'
const headSha = 'head-sha'
const treeSha = 'tree-sha'

function mergedPull(overrides = {}) {
  return {
    number: 926,
    state: 'closed',
    merged_at: '2026-07-10T12:10:00Z',
    base: { ref: 'main', sha: baseSha },
    head: { ref: 'codex/ci-exact-tree-dedupe', sha: headSha },
    ...overrides,
  }
}

function mergedCommit(overrides = {}) {
  return {
    sha: commitSha,
    parents: [{ sha: baseSha }],
    commit: { tree: { sha: treeSha } },
    ...overrides,
  }
}

function requiredRun(overrides = {}) {
  return {
    id: 100,
    path: '.github/workflows/required-release-gate.yml',
    event: 'pull_request',
    status: 'completed',
    conclusion: 'success',
    head_sha: headSha,
    head_branch: 'codex/ci-exact-tree-dedupe',
    head_commit: { tree_id: treeSha },
    run_started_at: '2026-07-10T12:00:00Z',
    updated_at: '2026-07-10T12:09:00Z',
    ...overrides,
  }
}

function evaluate(overrides = {}) {
  return evaluatePostMergeReleaseProof({
    commitSha,
    commit: mergedCommit(),
    pulls: [mergedPull()],
    workflowRuns: [requiredRun()],
    ...overrides,
  })
}

test('exact squash parent and tree reuse the latest successful PR gate', () => {
  const proof = evaluate()

  assert.equal(proof.reuse, true)
  assert.equal(proof.prNumber, '926')
  assert.equal(proof.runId, '100')
  assert.equal(proof.treeSha, treeSha)
})

test('missing PR association and unsupported merge shapes fail into the full release', () => {
  assert.equal(evaluate({ pulls: [] }).reuse, false)
  assert.match(evaluate({ pulls: [] }).reason, /expected one associated merged pull request/)

  const duplicateAssociation = evaluate({
    pulls: [mergedPull(), mergedPull({ number: 927 })],
  })
  assert.equal(duplicateAssociation.reuse, false)
  assert.match(duplicateAssociation.reason, /found 2/)

  const mergeCommit = mergedCommit({ parents: [{ sha: baseSha }, { sha: headSha }] })
  assert.equal(evaluate({ commit: mergeCommit }).reuse, false)
  assert.match(evaluate({ commit: mergeCommit }).reason, /single-parent squash commit/)
})

test('wrong workflow, event, or head cannot impersonate the required PR gate', () => {
  for (const run of [
    requiredRun({ path: '.github/workflows/other.yml' }),
    requiredRun({ event: 'push' }),
    requiredRun({ head_sha: 'other-head' }),
  ]) {
    const proof = evaluate({ workflowRuns: [run] })
    assert.equal(proof.reuse, false)
    assert.match(proof.reason, /no \.github\/workflows\/required-release-gate\.yml run/)
  }
})

test('stale base or changed tree cannot reuse the PR gate', () => {
  const staleBase = evaluate({
    commit: mergedCommit({ parents: [{ sha: 'newer-base' }] }),
  })
  assert.equal(staleBase.reuse, false)
  assert.match(staleBase.reason, /does not match merge parent/)

  const changedTree = evaluate({
    commit: mergedCommit({ commit: { tree: { sha: 'different-tree' } } }),
  })
  assert.equal(changedTree.reuse, false)
  assert.match(changedTree.reason, /does not match required gate tree/)
})

test('latest pending, cancelled, or failed required run wins over a stale success', () => {
  for (const [status, conclusion] of [
    ['in_progress', null],
    ['completed', 'cancelled'],
    ['completed', 'failure'],
    ['completed', 'timed_out'],
  ]) {
    const proof = evaluate({
      workflowRuns: [
        requiredRun(),
        requiredRun({
          id: 101,
          status,
          conclusion,
          run_started_at: '2026-07-10T12:05:00Z',
          updated_at: '2026-07-10T12:09:30Z',
        }),
      ],
    })

    assert.equal(proof.reuse, false)
    assert.match(
      proof.reason,
      new RegExp(`101.*${status}/${conclusion ?? 'missing'}`),
    )
  }
})

test('a gate completed after merge cannot retroactively prove the commit', () => {
  const proof = evaluate({
    workflowRuns: [requiredRun({ updated_at: '2026-07-10T12:11:00Z' })],
  })

  assert.equal(proof.reuse, false)
  assert.match(proof.reason, /completed after/)
})

test('post-merge aggregate accepts exactly one successful selected path', () => {
  assert.equal(
    evaluatePostMergeVerificationFinal({
      proofResult: 'success',
      reuseProof: true,
      fastResult: 'success',
      fallbackResult: 'skipped',
    }).ok,
    true,
  )

  assert.equal(
    evaluatePostMergeVerificationFinal({
      proofResult: 'success',
      reuseProof: false,
      fastResult: 'skipped',
      fallbackResult: 'success',
    }).ok,
    true,
  )
})

test('post-merge aggregate rejects missing, failed, or double-selected paths', () => {
  const cases = [
    {
      proofResult: 'failure',
      reuseProof: false,
      fastResult: 'skipped',
      fallbackResult: 'success',
    },
    {
      proofResult: 'success',
      reuseProof: true,
      fastResult: 'failure',
      fallbackResult: 'skipped',
    },
    {
      proofResult: 'success',
      reuseProof: false,
      fastResult: 'skipped',
      fallbackResult: 'cancelled',
    },
    {
      proofResult: 'success',
      reuseProof: true,
      fastResult: 'success',
      fallbackResult: 'success',
    },
  ]

  for (const input of cases) {
    assert.equal(evaluatePostMergeVerificationFinal(input).ok, false)
  }
})
