import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import monitor from './ci_monitor.cjs'
import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'

test('repo-local CI monitor exposes the supported low-noise operations', () => {
  const source = readFileSync('scripts/ci_monitor.cjs', 'utf8')
  for (const command of [
    'runs',
    'watch',
    'fail-fast',
    'log-failed',
    'test-summary',
    'grep',
    'check-actions',
    'wait-for',
    'pr-create',
    'pr-view',
    'pr-merge',
    'retention-plan',
  ]) {
    assert.match(source, new RegExp(`\\b${command}\\b`, 'u'))
  }
  assert.match(source, /--interval', '55'/u)
  assert.match(source, /'pr', 'merge', prNumber, '--squash'/u)
  assert.doesNotMatch(source, /--delete-branch/u)
  assert.doesNotMatch(source, /execSync|shell:\s*true/u)
})

test('large CI logs stream without maxBuffer overflow and output stays bounded', async () => {
  let output = ''
  const launch = (_command, args) => {
    assert.deepEqual(args, ['run', 'view', '123', '--log'])
    const child = new EventEmitter()
    child.stdout = Readable.from((async function* () {
      for (let index = 0; index < 12000; index += 1) yield 'match ' + index + ' ' + 'x'.repeat(1000) + '\n'
      setImmediate(() => child.emit('close', 0))
    })())
    return child
  }
  assert.equal(await monitor.grepLog('123', 'match', launch, { write: (text) => { output += text } }), 0)
  assert.match(output, /Showing last 100 of 12000/)
  assert.match(output, /match 11999/)
  assert.ok(output.length < 110000)
})

test('retention wrapper cannot pass write approval and dispatches only the main inventory', () => {
  assert.throws(() => monitor.main(['retention-plan', 'approve']), /no approval or write/)
  const source = readFileSync('scripts/ci_monitor.cjs', 'utf8')
  assert.match(source, /'workflow', 'run', 'artifact-retention.yml', '--ref', 'main'/)
})

test('timing report separates elapsed run time from summed job work and unknown durations', () => {
  const result = monitor.summarizeTimings({
    createdAt: '2026-09-13T10:00:00Z', updatedAt: '2026-09-13T10:03:00Z',
    jobs: [
      { name: 'backend', startedAt: '2026-09-13T10:00:00Z', completedAt: '2026-09-13T10:02:00Z' },
      { name: 'frontend', startedAt: '2026-09-13T10:00:00Z', completedAt: '2026-09-13T10:03:00Z' },
      { name: 'missing', startedAt: null, completedAt: null },
    ],
  })
  assert.equal(result.runElapsedSeconds, 180)
  assert.equal(result.summedReportedJobSeconds, 300)
  assert.equal(result.completedReportedJobs, 2)
  assert.equal(result.jobs[2].seconds, null)
})
