#!/usr/bin/env node
'use strict'

const { spawnSync } = require('node:child_process')

const HELP = `Usage: node scripts/ci_monitor.cjs <command> [arguments]

Commands:
  runs [gh run list options]       List recent workflow runs
  watch <run-id>                   Watch one run and fail with it
  fail-fast <run-id>               Alias for watch
  log-failed <run-id>              Print only failed-step logs
  test-summary <run-id>            Print structured run/job status
  grep <run-id> <pattern>          Search a run log without dumping it all
  check-actions                    Verify GitHub auth and Actions access
  wait-for <pr-number>             Wait for PR checks at a 55 second interval
  pr-create <title> <body-file>    Create a PR from the current branch to main
  pr-view <pr-number>              Show mergeability and required PR identity
  pr-merge <pr-number>             Squash-merge a green PR without deleting refs
  --help                           Show this help
`

function runGh(args, options = {}) {
  const result = spawnSync('gh', args, {
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    windowsHide: true,
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
    const result = runGh(['run', 'view', runId, '--log'], { capture: true })
    if (result.status !== 0) return result.status ?? 1
    const matcher = new RegExp(pattern, 'iu')
    const matches = result.stdout.split(/\r?\n/u).filter((line) => matcher.test(line))
    process.stdout.write(`${matches.join('\n')}${matches.length ? '\n' : ''}`)
    return matches.length > 0 ? 0 : 1
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
  throw new Error(`Unknown command: ${command}`)
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (error) {
    console.error(`[ci-monitor] ${error.message}`)
    process.exitCode = 1
  }
}

module.exports = { HELP, main }
