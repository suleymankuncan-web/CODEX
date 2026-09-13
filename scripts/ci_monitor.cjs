#!/usr/bin/env node
'use strict'

const { spawnSync } = require('node:child_process')
const { spawn } = require('node:child_process')
const { createInterface } = require('node:readline')

const HELP = `Usage: node scripts/ci_monitor.cjs <command> [arguments]

Commands:
  runs [gh run list options]       List recent workflow runs
  watch <run-id>                   Watch one run and fail with it
  fail-fast <run-id>               Alias for watch
  log-failed <run-id>              Print only failed-step logs
  test-summary <run-id>            Print structured run/job status
  timings <run-id>                 Show measured job time and slowest steps
  grep <run-id> <pattern>          Search a run log without dumping it all
  rerun-failed <run-id>            Re-run only failed jobs on the same SHA
  check-actions                    Verify GitHub auth and Actions access
  wait-for <pr-number>             Wait for PR checks at a 55 second interval
  pr-create <title> <body-file>    Create a PR from the current branch to main
  pr-view <pr-number>              Show mergeability and required PR identity
  pr-merge <pr-number>             Squash-merge a green PR without deleting refs
  retention-plan                   Dispatch read-only artifact inventory on main
  --help                           Show this help
`

function runGh(args, options = {}) {
  const result = spawnSync('gh', args, {
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
  })
  if (result.error) throw result.error
  if (options.capture && result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout)
  }
  return result
}

function requireArgument(value, label) {
  if (!value) throw new Error(`${label} is required`)
  return value
}

function summarizeTimings(run) {
  const seconds = (start, end) => {
    const value = (Date.parse(end) - Date.parse(start)) / 1000
    return Number.isFinite(value) && value >= 0 ? value : null
  }
  const jobs = (run.jobs ?? []).map((job) => ({
    name: job.name, conclusion: job.conclusion,
    seconds: seconds(job.startedAt, job.completedAt),
    slowestSteps: (job.steps ?? []).map((step) => ({
      name: step.name, seconds: seconds(step.startedAt, step.completedAt),
    })).filter((step) => step.seconds !== null).sort((a, b) => b.seconds - a.seconds).slice(0, 8),
  }))
  return { url: run.url, headSha: run.headSha, status: run.status, conclusion: run.conclusion,
    runElapsedSeconds: seconds(run.createdAt, run.updatedAt),
    summedReportedJobSeconds: jobs.reduce((sum, job) => sum + (job.seconds ?? 0), 0),
    completedReportedJobs: jobs.filter((job) => job.seconds !== null).length, jobs }
}

async function grepLog(runId, pattern, launch = spawn, output = process.stdout) {
  const matcher = new RegExp(pattern, 'iu')
  const child = launch('gh', ['run', 'view', runId, '--log'], {
    stdio: ['ignore', 'pipe', 'inherit'], windowsHide: true,
  })
  const completed = new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code) => resolve(code ?? 1))
  })
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity })
  const tail = []
  let count = 0
  for await (const line of lines) {
    if (!matcher.test(line)) continue
    count += 1
    tail.push(line.slice(0, 4000))
    if (tail.length > 100) tail.shift()
  }
  const code = await completed
  if (count > tail.length) output.write('[ci-monitor] Showing last 100 of ' + count + ' matching lines\n')
  if (tail.length) output.write(tail.join('\n') + '\n')
  return code || (count ? 0 : 1)
}

function main(argv) {
  const [command, ...args] = argv
  if (!command || command === '--help' || command === '-h') {
    process.stdout.write(HELP)
    return 0
  }

  if (command === 'runs') return runGh(['run', 'list', ...args]).status ?? 1
  if (command === 'watch' || command === 'fail-fast') {
    const runId = requireArgument(args[0], 'run id')
    return runGh(['run', 'watch', runId, '--exit-status']).status ?? 1
  }
  if (command === 'log-failed') {
    const runId = requireArgument(args[0], 'run id')
    return runGh(['run', 'view', runId, '--log-failed']).status ?? 1
  }
  if (command === 'test-summary') {
    const runId = requireArgument(args[0], 'run id')
    return runGh([
      'run',
      'view',
      runId,
      '--json',
      'name,status,conclusion,url,headSha,jobs',
    ]).status ?? 1
  }
  if (command === 'grep') {
    const runId = requireArgument(args[0], 'run id')
    const pattern = requireArgument(args.slice(1).join(' '), 'pattern')
    return grepLog(runId, pattern)
  }
  if (command === 'timings') {
    const result = runGh(['run', 'view', requireArgument(args[0], 'run id'), '--json',
      'url,headSha,status,conclusion,createdAt,updatedAt,jobs'], { capture: true })
    if (result.status !== 0) return result.status ?? 1
    process.stdout.write(JSON.stringify(summarizeTimings(JSON.parse(result.stdout)), null, 2) + '\n')
    return 0
  }
  if (command === 'rerun-failed') {
    return runGh(['run', 'rerun', requireArgument(args[0], 'run id'), '--failed']).status ?? 1
  }
  if (command === 'check-actions') {
    const auth = runGh(['auth', 'status'])
    if (auth.status !== 0) return auth.status ?? 1
    return runGh(['run', 'list', '--limit', '1']).status ?? 1
  }
  if (command === 'wait-for') {
    const prNumber = requireArgument(args[0], 'PR number')
    return runGh(['pr', 'checks', prNumber, '--watch', '--interval', '55']).status ?? 1
  }
  if (command === 'pr-create') {
    const title = requireArgument(args[0], 'PR title')
    const bodyFile = requireArgument(args[1], 'PR body file')
    return runGh(['pr', 'create', '--title', title, '--body-file', bodyFile, '--base', 'main']).status ?? 1
  }
  if (command === 'pr-view') {
    const prNumber = requireArgument(args[0], 'PR number')
    return runGh([
      'pr',
      'view',
      prNumber,
      '--json',
      'number,title,url,state,isDraft,mergeable,mergeStateStatus,headRefName,headRefOid,baseRefName,statusCheckRollup',
    ]).status ?? 1
  }
  if (command === 'pr-merge') {
    const prNumber = requireArgument(args[0], 'PR number')
    return runGh(['pr', 'merge', prNumber, '--squash']).status ?? 1
  }
  if (command === 'retention-plan') {
    if (args.length) throw new Error('retention-plan accepts no approval or write arguments')
    return runGh(['workflow', 'run', 'artifact-retention.yml', '--ref', 'main']).status ?? 1
  }
  throw new Error(`Unknown command: ${command}`)
}

if (require.main === module) {
  Promise.resolve().then(() => main(process.argv.slice(2))).then((code) => { process.exitCode = code }).catch((error) => {
    console.error(`[ci-monitor] ${error.message}`)
    process.exitCode = 1
  })
}

module.exports = { HELP, main, grepLog, summarizeTimings }
