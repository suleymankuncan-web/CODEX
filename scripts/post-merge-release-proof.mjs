import { fileURLToPath } from 'node:url'

const API_VERSION = '2026-03-10'
const REQUIRED_WORKFLOW_PATH = '.github/workflows/required-release-gate.yml'
const SUPPORTED_BASE_REFS = new Set(['main', 'master'])

function normalizeWorkflowPath(path) {
  return String(path ?? '').split('@')[0]
}

function latestWorkflowRun(runs) {
  return [...runs].sort((left, right) => {
    const leftTime = Date.parse(
      left.run_started_at ?? left.created_at ?? left.updated_at ?? '',
    ) || 0
    const rightTime = Date.parse(
      right.run_started_at ?? right.created_at ?? right.updated_at ?? '',
    ) || 0

    if (leftTime !== rightTime) {
      return rightTime - leftTime
    }

    return Number(right.id ?? 0) - Number(left.id ?? 0)
  })[0]
}

function rejected(reason) {
  return {
    reuse: false,
    reason,
    prNumber: '',
    runId: '',
    treeSha: '',
  }
}

export function evaluatePostMergeReleaseProof({
  commitSha,
  commit,
  pulls,
  workflowRuns,
  requiredWorkflowPath = REQUIRED_WORKFLOW_PATH,
}) {
  const mergedPulls = pulls.filter(
    (pull) =>
      pull.state === 'closed' &&
      Boolean(pull.merged_at) &&
      SUPPORTED_BASE_REFS.has(pull.base?.ref),
  )

  if (mergedPulls.length !== 1) {
    return rejected(
      `expected one associated merged pull request for ${commitSha}; found ${mergedPulls.length}`,
    )
  }

  const pull = mergedPulls[0]
  const parents = commit.parents ?? []
  if (parents.length !== 1) {
    return rejected(
      `pull request #${pull.number} did not produce a single-parent squash commit`,
    )
  }

  if (parents[0]?.sha !== pull.base?.sha) {
    return rejected(
      `pull request #${pull.number} base ${pull.base?.sha ?? 'missing'} does not match merge parent ${parents[0]?.sha ?? 'missing'}`,
    )
  }

  const matchingRuns = workflowRuns.filter(
    (run) =>
      normalizeWorkflowPath(run.path) === requiredWorkflowPath &&
      run.event === 'pull_request' &&
      run.head_sha === pull.head?.sha,
  )
  const run = latestWorkflowRun(matchingRuns)

  if (!run) {
    return rejected(
      `no ${requiredWorkflowPath} run exists for pull request #${pull.number} head ${pull.head?.sha ?? 'missing'}`,
    )
  }

  if (run.status !== 'completed' || run.conclusion !== 'success') {
    return rejected(
      `latest required gate run ${run.id} is ${run.status ?? 'missing'}/${run.conclusion ?? 'missing'}`,
    )
  }

  const mergedAt = Date.parse(pull.merged_at)
  const completedAt = Date.parse(run.updated_at ?? '')
  if (
    Number.isFinite(mergedAt) &&
    Number.isFinite(completedAt) &&
    completedAt > mergedAt
  ) {
    return rejected(
      `required gate run ${run.id} completed after pull request #${pull.number} merged`,
    )
  }

  const mergedTree = commit.commit?.tree?.sha
  const testedTree = run.head_commit?.tree_id
  if (!mergedTree || !testedTree) {
    return rejected(
      `tree metadata is missing for pull request #${pull.number} or run ${run.id}`,
    )
  }

  if (mergedTree !== testedTree) {
    return rejected(
      `merged tree ${mergedTree} does not match required gate tree ${testedTree}`,
    )
  }

  return {
    reuse: true,
    reason: `pull request #${pull.number} required gate run ${run.id} proved merged tree ${mergedTree}`,
    prNumber: String(pull.number),
    runId: String(run.id),
    treeSha: mergedTree,
  }
}

export function evaluatePostMergeVerificationFinal({
  proofResult,
  reuseProof,
  fastResult,
  fallbackResult,
}) {
  const failures = []

  if (proofResult !== 'success') {
    failures.push(`proof=${proofResult || 'missing'}`)
  }

  if (reuseProof) {
    if (fastResult !== 'success') {
      failures.push(`fast-post-merge=${fastResult || 'missing'}`)
    }
    if (fallbackResult !== 'skipped') {
      failures.push(`fallback-full-release=${fallbackResult || 'missing'}`)
    }
  } else {
    if (fastResult !== 'skipped') {
      failures.push(`fast-post-merge=${fastResult || 'missing'}`)
    }
    if (fallbackResult !== 'success') {
      failures.push(`fallback-full-release=${fallbackResult || 'missing'}`)
    }
  }

  return {
    ok: failures.length === 0,
    failures,
  }
}

function requiredEnvironment(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required`)
  }
  return value
}

async function githubJson(path, token) {
  const apiUrl = process.env.GITHUB_API_URL ?? 'https://api.github.com'
  const response = await fetch(`${apiUrl}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': API_VERSION,
    },
  })

  if (!response.ok) {
    throw new Error(`GitHub API returned HTTP ${response.status} for ${path}`)
  }

  return response.json()
}

async function resolvePostMergeReleaseProof() {
  const repository = requiredEnvironment('GITHUB_REPOSITORY')
  const token = requiredEnvironment('GITHUB_TOKEN')
  const commitSha = process.env.POST_MERGE_SHA ?? requiredEnvironment('GITHUB_SHA')
  const encodedSha = encodeURIComponent(commitSha)

  try {
    const [commit, pulls] = await Promise.all([
      githubJson(`/repos/${repository}/commits/${encodedSha}`, token),
      githubJson(`/repos/${repository}/commits/${encodedSha}/pulls?per_page=100`, token),
    ])
    const pullDetails = await Promise.all(
      pulls
        .filter((candidate) => Number.isInteger(candidate.number))
        .map((candidate) =>
          githubJson(`/repos/${repository}/pulls/${candidate.number}`, token),
        ),
    )
    const mergedPulls = pullDetails.filter(
      (candidate) =>
        candidate.state === 'closed' &&
        candidate.merged_at &&
        SUPPORTED_BASE_REFS.has(candidate.base?.ref),
    )
    const pull = mergedPulls.length === 1 ? mergedPulls[0] : undefined

    if (!pull?.head?.sha) {
      return rejected(`no merged pull request head is associated with ${commitSha}`)
    }

    const headSha = encodeURIComponent(pull.head.sha)
    const workflowRuns = await githubJson(
      `/repos/${repository}/actions/workflows/required-release-gate.yml/runs?event=pull_request&head_sha=${headSha}&per_page=100`,
      token,
    )

    return evaluatePostMergeReleaseProof({
      commitSha,
      commit,
      pulls: pullDetails,
      workflowRuns: workflowRuns.workflow_runs ?? [],
    })
  } catch (error) {
    return rejected(`proof lookup failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function outputValue(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim()
}

async function writeProofOutputs() {
  const proof = await resolvePostMergeReleaseProof()
  console.log(`reuse_pr_gate=${proof.reuse}`)
  console.log(`reason=${outputValue(proof.reason)}`)
  console.log(`pr_number=${outputValue(proof.prNumber)}`)
  console.log(`proof_run_id=${outputValue(proof.runId)}`)
  console.log(`tree_sha=${outputValue(proof.treeSha)}`)
  console.error(`[post-merge-proof] ${proof.reason}`)
}

function verifyFinalFromEnvironment() {
  const final = evaluatePostMergeVerificationFinal({
    proofResult: process.env.POST_MERGE_PROOF_RESULT,
    reuseProof: process.env.POST_MERGE_REUSE_PROOF === 'true',
    fastResult: process.env.POST_MERGE_FAST_RESULT,
    fallbackResult: process.env.POST_MERGE_FALLBACK_RESULT,
  })

  if (!final.ok) {
    throw new Error(`post-merge verification failed closed: ${final.failures.join(', ')}`)
  }

  console.log('[post-merge-proof] selected verification path completed successfully')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [command] = process.argv.slice(2)

  if (command === '--proof') {
    await writeProofOutputs()
  } else if (command === '--final') {
    verifyFinalFromEnvironment()
  } else {
    throw new Error('Use --proof or --final')
  }
}
